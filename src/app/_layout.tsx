// Importa cada peso pelo subcaminho: o índice do pacote embutiria todos os pesos no app.
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { ArchivoNarrow_700Bold } from '@expo-google-fonts/archivo-narrow/700Bold';
import { Anton_400Regular } from '@expo-google-fonts/anton/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { router, Stack, usePathname, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { ToastProvider } from '@/components/toast';
import { Colors } from '@/constants/theme';
import { AccountProvider, useAccount } from '@/features/account/account-context';
import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { ActionsSheetProvider } from '@/features/moderation/actions-sheet';
import { ModerationProvider } from '@/features/moderation/moderation-context';
import { NotificationsProvider } from '@/features/notifications/notifications-context';
import { initSentry } from '@/lib/monitoring';

// Inicializa o Sentry o mais cedo possível (antes de qualquer render).
initSentry();

SplashScreen.preventAutoHideAsync();

/**
 * Captura erros de renderização de qualquer rota filha e oferece tentar de novo,
 * em vez de derrubar o app. Não exibe detalhes técnicos para a pessoa usuária.
 * Erros são enviados ao Sentry para investigação posterior.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  if (__DEV__) console.error(error);
  // Envia ao Sentry sem expor a stack trace ao usuário.
  Sentry.captureException(error, { level: 'fatal', tags: { boundary: 'root' } });
  return (
    <Screen>
      <StateView
        kind="error"
        message="Não foi possível mostrar esta tela. Tente novamente."
        onRetry={retry}
      />
    </Screen>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Archivo_400Regular,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    ArchivoNarrow_700Bold,
    Anton_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
    ...MaterialIcons.font,
  });

  useEffect(() => {
    if (fontError && __DEV__) console.warn('Falha ao carregar fontes; usando fontes do sistema.', fontError);
  }, [fontError]);

  // Sem fontes, o app segue com as fontes do sistema em vez de travar na splash.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <InteractionsProvider>
        <AccountProvider>
          <NotificationsProvider>
            <ModerationProvider>
              <ToastProvider>
                <ActionsSheetProvider>
                  <StatusBar style="dark" />
                  <RootStack />
                </ActionsSheetProvider>
              </ToastProvider>
            </ModerationProvider>
          </NotificationsProvider>
        </AccountProvider>
      </InteractionsProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Sem sessão (ou com o cadastro em andamento), só o fluxo de boas-vindas fica acessível.
 * Ao entrar ou concluir o cadastro, o guarda muda e o roteador leva ao feed sozinho.
 * A splash fica na tela enquanto a sessão guardada no aparelho é retomada.
 */
function RootStack() {
  const { onboarded, status, account, showLoginWelcome } = useAccount();
  const pathname = usePathname();
  const restoring = status === 'restoring';

  useEffect(() => {
    if (!restoring) SplashScreen.hideAsync();
  }, [restoring]);

  const needsLegal = status === 'signedIn' && account !== null && !account.legalAccepted;

  useEffect(() => {
    if (restoring) return;
    const legalDocument = pathname === '/sobre-e-legal' || pathname.startsWith('/documento-legal/');
    if (needsLegal && pathname !== '/aceite-legal' && !legalDocument) {
      router.replace('/aceite-legal');
      return;
    }
    if (!needsLegal && pathname === '/aceite-legal') {
      if (status !== 'signedIn') router.replace('/boas-vindas');
      else if (onboarded) router.replace('/');
      else router.replace(account?.pendingOnboarding ? '/boas-vindas/perfil' : '/boas-vindas');
    }
  }, [account?.pendingOnboarding, needsLegal, onboarded, pathname, restoring, status]);

  // A mensagem editorial pertence a cada autenticação concluída, antes do feed.
  useEffect(() => {
    if (!restoring && showLoginWelcome && pathname !== '/boas-vindas/mensagem') {
      router.replace('/boas-vindas/mensagem');
    }
  }, [pathname, restoring, showLoginWelcome]);

  if (restoring) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.cream } }}>
      <Stack.Screen name="aceite-legal" />
      <Stack.Screen name="sobre-e-legal" />
      <Stack.Screen name="documento-legal/[id]" />
      <Stack.Protected guard={onboarded && !needsLegal}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="avisos" />
        <Stack.Screen name="biblioteca" />
        <Stack.Screen name="praca/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="praca/figurinhas/[id]" />
        <Stack.Screen name="criar" />
        <Stack.Screen name="interesses" />
        <Stack.Screen name="moderacao/[id]" />
        <Stack.Screen name="criar-comuna" />
        <Stack.Screen name="gerir-comuna/[id]" />
        <Stack.Screen name="conta" />
        <Stack.Screen name="verificar-email" />
      </Stack.Protected>
      <Stack.Protected guard={(!onboarded || showLoginWelcome) && !needsLegal}>
        <Stack.Screen name="boas-vindas" />
      </Stack.Protected>
    </Stack>
  );
}
