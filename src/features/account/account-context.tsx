/**
 * Conta da pessoa: sessão, dados de /me e o rascunho do cadastro.
 *
 * Com a API configurada (EXPO_PUBLIC_API_URL), cadastro, login, sessão persistente,
 * logout e /me são reais. A sessão volta sozinha ao abrir o app (refresh token no
 * armazenamento seguro). Sem a API, o app roda em modo demonstração, só na memória.
 *
 * Comunas, feed, publicações e comentários usam a API com a identidade do token: a autoria
 * é decidida pelo servidor (`viewer.isAuthor`), nunca por um ID mandado pelo app.
 * As funcionalidades que ainda usam dados fictícios (perfis, explorar, avisos, moderação)
 * continuam identificando a pessoa pelo ID local "me" dos mocks; nome e @ vêm da conta real.
 */
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { DEMO_MODE } from '@/constants/config';
import { useInteractions } from '@/features/interactions/interactions-context';
import { findUser } from '@/features/lookup';
import { hasStoredSession, onSessionEnded, refreshSession } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';
import { initialsOf } from '@/lib/format';
import { demoInterests } from '@/mocks/topics';
import { currentUser } from '@/mocks/users';
import type { TopicId, User } from '@/types/models';

import * as accountApi from './api';
import type { MeDto } from './api';

export type AccountProfile = {
  name: string;
  handle: string;
  city: string;
  bio: string;
};

/** Perfil de demonstração, já preenchido no formulário quando não há API. */
const DEMO_PROFILE: AccountProfile = {
  name: 'Camila Rocha',
  handle: 'camilarocha',
  city: currentUser.city,
  bio: '',
};

const EMPTY_PROFILE: AccountProfile = { name: '', handle: '', city: '', bio: '' };

export const BIO_MAX_LENGTH = 160;

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
  /** Encerra o cadastro e mostra o aviso "Seu feed está pronto" no feed. */
  finishSignup: () => void;
  signIn: (email: string, password: string) => Promise<void>;
  /** Sai deste aparelho (ou de todos) e volta para as boas-vindas. */
  signOut: (everywhere?: boolean) => Promise<void>;
  reloadAccount: () => Promise<void>;
  showWelcome: boolean;
  dismissWelcome: () => void;
};

const AccountContext = createContext<AccountValue | null>(null);

function profileOf(me: MeDto): AccountProfile {
  return { name: me.displayName, handle: me.handle, city: me.city ?? '', bio: me.bio };
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
  // E-mail e senha da etapa 1: só na memória, apagados assim que o cadastro é enviado.
  const credentials = useRef<{ email: string; password: string } | null>(null);

  const applyAccount = useCallback((me: MeDto) => {
    setAccount(me);
    setDraft(profileOf(me));
    setInterests(me.interests);
    setStatus('signedIn');
  }, []);

  const resetToSignedOut = useCallback(() => {
    credentials.current = null;
    // Participações, contagens e interações locais são desta pessoa: não passam para a próxima.
    resetAll();
    setAccount(null);
    setDraft(DEMO_MODE ? DEMO_PROFILE : EMPTY_PROFILE);
    setInterests([]);
    setSigningUp(false);
    setShowWelcome(false);
    setStatus('signedOut');
  }, [resetAll]);

  // Ao abrir o app: retoma a sessão guardada no aparelho, se houver.
  useEffect(() => {
    if (DEMO_MODE) return;
    onSessionEnded(resetToSignedOut);
    let cancelled = false;
    (async () => {
      try {
        if ((await hasStoredSession()) && (await refreshSession())) {
          const me = await accountApi.getMe();
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
    const fields = { displayName: draft.name.trim(), bio: draft.bio.trim(), city: draft.city.trim() };
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
        setStatus('signedIn');
        return;
      }
      await accountApi.login(email, password, deviceLabel());
      resetAll();
      setSigningUp(false);
      setShowWelcome(false);
      applyAccount(await accountApi.getMe());
    },
    [applyAccount, replaceAll, resetAll],
  );

  const signOut = useCallback(
    async (everywhere = false) => {
      if (!DEMO_MODE) await accountApi.logout(everywhere);
      resetToSignedOut();
    },
    [resetToSignedOut],
  );

  const reloadAccount = useCallback(async () => {
    if (!DEMO_MODE) applyAccount(await accountApi.getMe());
  }, [applyAccount]);

  const dismissWelcome = useCallback(() => setShowWelcome(false), []);

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
      finishSignup,
      signIn,
      signOut,
      reloadAccount,
      showWelcome,
      dismissWelcome,
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
      finishSignup,
      signIn,
      signOut,
      reloadAccount,
      showWelcome,
      dismissWelcome,
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
 * A pessoa logada como `User`, para exibir nome, @ e avatar. O `id` é sempre o "me" dos mocks:
 * serve só para as telas fictícias (perfil, explorar, moderação). Ele nunca vai para a API,
 * e conteúdo real não é comparado com ele: use `viewer.isAuthor`/`isOwn` vindos do servidor.
 */
export function useMe(): User {
  const { profile } = useAccount();
  return useMemo(() => {
    const base = findUser(currentUser.id);
    const name = profile.name.trim() || base?.name || 'Você';
    return {
      id: currentUser.id,
      tone: base?.tone ?? 'red',
      name,
      handle: profile.handle || base?.handle || '',
      initials: initialsOf(name),
    };
  }, [profile.name, profile.handle]);
}
