import { absoluteMediaUrl } from '@/features/media/media-url';
import { queryClient } from '@/lib/query/client';
/**
 * Conta da pessoa: sessão, dados de /me e o rascunho do cadastro.
 *
 * Com a API configurada (EXPO_PUBLIC_API_URL), cadastro, login, sessão persistente,
 * logout e /me são reais. A sessão volta sozinha ao abrir o app (refresh token no
 * armazenamento seguro). Sem a API, o app roda em modo demonstração, só na memória.
 *
 * Comunas, feed, publicações e comentários usam a API com a identidade do token: a autoria
 * é decidida pelo servidor (`viewer.isAuthor`), nunca por um ID mandado pelo app.
 * As funcionalidades que ainda usam dados fictícios (explorar, moderação)
 * continuam identificando a pessoa pelo ID local "me" dos mocks; nome e @ vêm da conta real.
 */
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { DEMO_MODE, GOOGLE_WEB_CLIENT_ID, GOOGLE_IOS_CLIENT_ID } from '@/constants/config';
import { useInteractions } from '@/features/interactions/interactions-context';
import { findUser } from '@/features/lookup';
import { hasStoredSession, onSessionEnded, refreshSession } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { clearSentryUser, setSentryUser } from '@/lib/monitoring';
import { initialsOf } from '@/lib/format';
import { demoInterests } from '@/mocks/topics';
import { currentUser } from '@/mocks/users';
import type { TopicId, User } from '@/types/models';

import * as accountApi from './api';
import type { MeDto, SocialTokensDto } from './api';

export type AccountProfile = {
  name: string;
  handle: string;
  city: string;
  state: string;
  country: string;
  countryCode: string;
  stateIbgeCode: string;
  municipalityIbgeCode: string;
  bio: string;
};

/** Perfil de demonstração, já preenchido no formulário quando não há API. */
const DEMO_PROFILE: AccountProfile = {
  name: 'Camila Rocha',
  handle: 'camilarocha',
  city: currentUser.city,
  state: 'SP',
  country: 'Brasil',
  countryCode: 'BR', stateIbgeCode: '35', municipalityIbgeCode: '',
  bio: '',
};

const EMPTY_PROFILE: AccountProfile = { name: '', handle: '', city: '', state: '', country: 'Brasil', countryCode: 'BR', stateIbgeCode: '', municipalityIbgeCode: '', bio: '' };

export const BIO_MAX_LENGTH = 150;

export type SessionStatus = 'restoring' | 'signedOut' | 'signedIn';

type AccountValue = {
  status: SessionStatus;
  /** Dados reais da conta (null no modo demonstração ou sem sessão). */
  account: MeDto | null;
  profile: AccountProfile;
  updateProfile: (patch: Partial<AccountProfile>) => void;
  interests: TopicId[];
  toggleInterest: (id: TopicId) => void;
  /** Grava os interesses (na API, quando houver sessão real). */
  saveInterests: (ids: TopicId[]) => Promise<void>;
  onboarded: boolean;
  /** "Criar minha conta": começa um cadastro do zero. */
  startSignup: () => void;
  /** Guarda e-mail e senha da etapa 1 na memória até o cadastro ser enviado na etapa 2. */
  setSignupCredentials: (email: string, password: string) => void;
  /** Etapa 2: cria a conta e entra nela. Repetir depois de criada só atualiza o perfil. */
  completeSignupProfile: () => Promise<void>;
  /** Completa o onboarding de conta criada via social (escolhe handle e nome). */
  completeSocialOnboarding: () => Promise<void>;
  /** Encerra o cadastro e mostra o aviso "Seu feed está pronto" no feed. */
  finishSignup: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  /** Autentica via Google (nativo). Após validação no backend, inicia sessão Popularia. */
  signInWithGoogle: () => Promise<void>;
  /** Autentica via Apple (nativo, apenas iOS). Após validação no backend, inicia sessão Popularia. */
  signInWithApple: () => Promise<void>;
  /** Sai deste aparelho (ou de todos) e volta para as boas-vindas. */
  signOut: (everywhere?: boolean) => Promise<void>;
  reloadAccount: () => Promise<void>;
  /** Confirma no servidor e publica imediatamente o novo estado para todas as telas. */
  confirmEmail: (code: string) => Promise<void>;
  /** Publica a foto nova na conta já carregada, sem recarregar a sessão. */
  replaceAvatarUrl: (avatarUrl: string) => void;
  deleteAccount: (proof: accountApi.DeletionProof) => Promise<void>;
  showWelcome: boolean;
  dismissWelcome: () => void;
  /** Mensagem exibida entre um login concluído e a entrada no app. */
  showLoginWelcome: boolean;
  dismissLoginWelcome: () => void;
};

const AccountContext = createContext<AccountValue | null>(null);

function profileOf(me: MeDto): AccountProfile {
  return { name: me.displayName, handle: me.handle, city: me.city ?? '', state: me.state ?? '', country: me.country ?? '', countryCode: me.countryCode, stateIbgeCode: me.stateIbgeCode ?? '', municipalityIbgeCode: me.municipalityIbgeCode ?? '', bio: me.bio };
}

function deviceLabel(): string {
  return Platform.select({ ios: 'iPhone', android: 'Android', web: 'Navegador', default: 'Aparelho' });
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const { replaceAll, resetAll } = useInteractions();
  const [status, setStatus] = useState<SessionStatus>(DEMO_MODE ? 'signedOut' : 'restoring');
  const [account, setAccount] = useState<MeDto | null>(null);
  const [draft, setDraft] = useState<AccountProfile>(DEMO_MODE ? DEMO_PROFILE : EMPTY_PROFILE);
  const [interests, setInterests] = useState<TopicId[]>([]);
  const [signingUp, setSigningUp] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showLoginWelcome, setShowLoginWelcome] = useState(false);
  // E-mail e senha da etapa 1: só na memória, apagados assim que o cadastro é enviado.
  const credentials = useRef<{ email: string; password: string } | null>(null);

  const applyAccount = useCallback((me: MeDto) => {
    setSentryUser(me.id);
    setAccount(me);
    setDraft(profileOf(me));
    setInterests(me.interests);
    setStatus('signedIn');
  }, []);

  const resetToSignedOut = useCallback(() => {
    queryClient.clear();
    credentials.current = null;
    clearSentryUser();
    // Participações, contagens e interações locais são desta pessoa: não passam para a próxima.
    resetAll();
    setAccount(null);
    setDraft(DEMO_MODE ? DEMO_PROFILE : EMPTY_PROFILE);
    setInterests([]);
    setSigningUp(false);
    setShowWelcome(false);
    setShowLoginWelcome(false);
    setStatus('signedOut');
  }, [resetAll]);

  // Configura Google Sign-In uma vez na inicialização.
  useEffect(() => {
    if (DEMO_MODE || !GOOGLE_WEB_CLIENT_ID) return;
    import('@react-native-google-signin/google-signin').then(({ GoogleSignin }) => {
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
        offlineAccess: false,
      });
    });
  }, []);

  // Ao abrir o app: retoma a sessão guardada no aparelho, se houver.
  useEffect(() => {
    if (DEMO_MODE) return;
    onSessionEnded(resetToSignedOut);
    let cancelled = false;
    let restoreTimer: ReturnType<typeof setTimeout> | undefined;
    (async () => {
      try {
        const restored = (async () => {
          if (!(await hasStoredSession()) || !(await refreshSession())) return null;
          return accountApi.getMe();
        })();
        const timedOut = new Promise<null>((resolve) => {
          // A API local pode não ser alcançável pelo celular. Isso não pode prender o
          // aplicativo na inicialização durante todo o timeout HTTP de desenvolvimento.
          restoreTimer = setTimeout(() => resolve(null), 8000);
        });
        const me = await Promise.race([restored, timedOut]);
        if (restoreTimer) clearTimeout(restoreTimer);
        if (me) {
          if (!cancelled) applyAccount(me);
          return;
        }
      } catch (error) {
        // Sem rede: a sessão continua guardada e volta na próxima abertura.
        if (__DEV__) console.warn('Não foi possível retomar a sessão.', error);
      }
      if (!cancelled) setStatus('signedOut');
    })();
    return () => {
      cancelled = true;
      if (restoreTimer) clearTimeout(restoreTimer);
      onSessionEnded(null);
    };
  }, [applyAccount, resetToSignedOut]);

  const updateProfile = useCallback(
    (patch: Partial<AccountProfile>) => setDraft((prev) => ({ ...prev, ...patch })),
    [],
  );

  const toggleInterest = useCallback(
    (id: TopicId) =>
      setInterests((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id])),
    [],
  );

  const saveInterests = useCallback(
    async (ids: TopicId[]) => {
      if (!DEMO_MODE && account) {
        applyAccount(await accountApi.updateMe({ interests: ids }));
        return;
      }
      setInterests(ids);
    },
    [account, applyAccount],
  );

  const startSignup = useCallback(() => {
    replaceAll('joinedComunas', []);
    credentials.current = null;
    setInterests([]);
    setDraft(DEMO_MODE ? DEMO_PROFILE : EMPTY_PROFILE);
    setSigningUp(true);
  }, [replaceAll]);

  const setSignupCredentials = useCallback((email: string, password: string) => {
    credentials.current = { email: email.trim(), password };
  }, []);

  const completeSignupProfile = useCallback(async () => {
    if (DEMO_MODE) return;
    const fields = { displayName: draft.name.trim(), bio: draft.bio.trim(), city: draft.city.trim(), state: draft.state.trim(), country: draft.country.trim(), countryCode: draft.countryCode, stateIbgeCode: draft.stateIbgeCode, municipalityIbgeCode: draft.municipalityIbgeCode };
    if (account) {
      // Já criada (a pessoa voltou para esta etapa): só atualiza o perfil.
      applyAccount(await accountApi.updateMe(fields));
      return;
    }
    const creds = credentials.current;
    if (!creds) throw new Error('Volte e informe e-mail e senha.');
    await accountApi.register({ ...creds, ...fields, handle: draft.handle });
    try {
      await accountApi.login(creds.email, creds.password, deviceLabel());
    } catch (error) {
      // O cadastro responde igual para e-mail já usado; o login é que falha.
      if (error instanceof ApiError && error.status === 401) {
        throw new ApiError(401, '/errors/email-in-use', 'Não foi possível criar a conta com este e-mail. Se ele já tem conta, entre ou recupere a senha.');
      }
      throw error;
    }
    credentials.current = null;
    applyAccount(await accountApi.getMe());
  }, [account, applyAccount, draft]);

  const finishSignup = useCallback(() => {
    setSigningUp(false);
    setShowWelcome(true);
    if (DEMO_MODE) setStatus('signedIn');
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      if (DEMO_MODE) {
        // Sem servidor, não há senha para conferir: entra no perfil de demonstração.
        replaceAll('joinedComunas', currentUser.joinedComunaIds);
        setInterests(demoInterests);
        setDraft(DEMO_PROFILE);
        setSigningUp(false);
        setShowWelcome(false);
        setShowLoginWelcome(true);
        setStatus('signedIn');
        return;
      }
      await accountApi.login(email, password, deviceLabel());
      resetAll();
      setSigningUp(false);
      setShowWelcome(false);
      setShowLoginWelcome(true);
      applyAccount(await accountApi.getMe());
    },
    [applyAccount, replaceAll, resetAll],
  );

  // Após social login: inicia sessão Popularia e, se necessário, abre o onboarding de handle.
  const applySocialSession = useCallback(
    async (tokens: SocialTokensDto) => {
      const { startSession } = await import('@/lib/api/client');
      await startSession(tokens);
      resetAll();
      const me = await accountApi.getMe();
      if (tokens.onboardingRequired) {
        setSigningUp(true);
        applyAccount(me);
        const { router } = await import('expo-router');
        router.push('/boas-vindas/perfil');
      } else {
        setSigningUp(false);
        setShowWelcome(false);
        setShowLoginWelcome(true);
        applyAccount(me);
      }
    },
    [applyAccount, resetAll],
  );

  const signInWithGoogle = useCallback(async () => {
    const { GoogleSignin, statusCodes } = await import('@react-native-google-signin/google-signin');
    try {
      await GoogleSignin.hasPlayServices();
      const { data } = await GoogleSignin.signIn();
      if (!data?.idToken) throw new Error('Token Google ausente.');
      const tokens = await accountApi.socialLogin({
        provider: 'google',
        idToken: data.idToken,
        deviceLabel: deviceLabel(),
      });
      await applySocialSession(tokens);
    } catch (error: unknown) {
      // Cancelamento pelo usuário não é um erro crítico.
      const isCancel =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === statusCodes.SIGN_IN_CANCELLED;
      if (!isCancel) throw error;
    }
  }, [applySocialSession]);

  const signInWithApple = useCallback(async () => {
    const AppleAuthentication = await import('expo-apple-authentication');
    const Crypto = await import('expo-crypto');
    // Gera nonce: app envia rawNonce ao backend; hashed vai no pedido à Apple.
    const rawNonce = Crypto.randomUUID();
    const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error('Token Apple ausente.');
      const parts = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean);
      const displayName = parts.length > 0 ? parts.join(' ') : undefined;
      const tokens = await accountApi.socialLogin({
        provider: 'apple',
        idToken: credential.identityToken,
        nonce: rawNonce,
        displayName,
        deviceLabel: deviceLabel(),
      });
      await applySocialSession(tokens);
    } catch (error: unknown) {
      // ERR_REQUEST_CANCELED é cancelamento pela pessoa: não é erro crítico.
      const isCancel =
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code: string }).code === 'ERR_REQUEST_CANCELED';
      if (!isCancel) throw error;
    }
  }, [applySocialSession]);

  const completeSocialOnboarding = useCallback(async () => {
    if (DEMO_MODE) return;
    const me = await accountApi.completeOnboarding({
      handle: draft.handle.trim(),
      displayName: draft.name.trim(),
      bio: draft.bio.trim() || undefined,
      city: draft.city.trim() || undefined,
      state: draft.state.trim() || undefined,
      country: draft.country.trim() || undefined,
      countryCode: draft.countryCode || undefined,
      stateIbgeCode: draft.stateIbgeCode || undefined,
      municipalityIbgeCode: draft.municipalityIbgeCode || undefined,
      interests: interests.length > 0 ? interests : undefined,
    });
    applyAccount(me);
    setSigningUp(false);
    setShowWelcome(true);
  }, [applyAccount, draft, interests]);

  const signOut = useCallback(
    async (everywhere = false) => {
      try {
        if (!DEMO_MODE) await accountApi.logout(everywhere);
      } finally {
        // A API já apaga os tokens no finally; erro de revogação não pode deixar
        // a árvore autenticada e os dados da pessoa anterior na tela.
        resetToSignedOut();
      }
    },
    [resetToSignedOut],
  );

  const deleteAccount = useCallback(async (proof: accountApi.DeletionProof) => {
    await accountApi.deleteAccount(proof);
    resetToSignedOut();
  }, [resetToSignedOut]);

  const reloadAccount = useCallback(async () => {
    if (!DEMO_MODE) applyAccount(await accountApi.getMe());
  }, [applyAccount]);

  const replaceAvatarUrl = useCallback((avatarUrl: string) => {
    setAccount((current) => current ? { ...current, avatarUrl } : current);
  }, []);

  const confirmEmail = useCallback(async (code: string) => {
    if (DEMO_MODE) return;
    await accountApi.verifyEmail(code);
    // O POST já confirmou a conta. Não mantenha bloqueios se o refresh seguinte falhar.
    setAccount((current) => current ? { ...current, emailVerified: true } : current);
    try {
      applyAccount(await accountApi.getMe());
    } catch (error) {
      if (__DEV__) console.warn('E-mail confirmado; não foi possível atualizar os demais dados da conta.', error);
    }
  }, [applyAccount]);

  const dismissWelcome = useCallback(() => setShowWelcome(false), []);
  const dismissLoginWelcome = useCallback(() => setShowLoginWelcome(false), []);

  const onboarded = status === 'signedIn' && !signingUp;

  const value = useMemo(
    () => ({
      status,
      account,
      profile: draft,
      updateProfile,
      interests,
      toggleInterest,
      saveInterests,
      onboarded,
      startSignup,
      setSignupCredentials,
      completeSignupProfile,
      completeSocialOnboarding,
      finishSignup,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signOut,
      reloadAccount,
      confirmEmail,
      replaceAvatarUrl,
      deleteAccount,
      showWelcome,
      dismissWelcome,
      showLoginWelcome,
      dismissLoginWelcome,
    }),
    [
      status,
      account,
      draft,
      updateProfile,
      interests,
      toggleInterest,
      saveInterests,
      onboarded,
      startSignup,
      setSignupCredentials,
      completeSignupProfile,
      completeSocialOnboarding,
      finishSignup,
      signIn,
      signInWithGoogle,
      signInWithApple,
      signOut,
      reloadAccount,
      confirmEmail,
      replaceAvatarUrl,
      deleteAccount,
      showWelcome,
      dismissWelcome,
      showLoginWelcome,
      dismissLoginWelcome,
    ],
  );

  return <AccountContext value={value}>{children}</AccountContext>;
}

export function useAccount(): AccountValue {
  const ctx = use(AccountContext);
  if (!ctx) throw new Error('useAccount precisa estar dentro de <AccountProvider>.');
  return ctx;
}

/**
 * A pessoa logada como `User`, para exibir nome, @ e avatar. Na API, usa somente o estado
 * persistido da conta; rascunhos de formulário não podem vazar para o restante do aplicativo.
 */
export function useMe(): User {
  const { account, profile } = useAccount();
  return useMemo(() => {
    const base = findUser(currentUser.id);
    const name = account?.displayName.trim() || (DEMO_MODE ? profile.name.trim() || base?.name : '') || 'Você';
    const handle = account?.handle ?? (DEMO_MODE ? profile.handle || base?.handle || '' : '');
    return {
      id: account?.id ?? currentUser.id,
      // Sem foto, o avatar da própria conta é sempre vermelho Popularia — não sorteia tom.
      tone: 'red',
      name,
      handle,
      initials: initialsOf(name),
      avatarUrl: absoluteMediaUrl(account?.avatarUrl),
    };
  }, [account, profile.name, profile.handle]);
}
