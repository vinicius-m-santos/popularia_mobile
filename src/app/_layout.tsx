import LegalAcceptanceScreen from '@/features/legal/legal-acceptance-screen';
// Importa cada peso pelo subcaminho: o índice do pacote embutiria todos os pesos no app.
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { ArchivoNarrow_700Bold } from '@expo-google-fonts/archivo-narrow/700Bold';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import * as Sentry from '@sentry/react-native';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Modal } from 'react-native';

import { MockDataNotice } from '@/components/mock-data-notice';
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
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    if (fontError && __DEV__) console.warn('Falha ao carregar fontes; usando fontes do sistema.', fontError);
  }, [fontError]);

  // Sem fontes, o app segue com as fontes do sistema em vez de travar na splash.
  if (!fontsLoaded && !fontError) return null;

  return (
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
  );
}

/**
 * Sem sessão (ou com o cadastro em andamento), só o fluxo de boas-vindas fica acessível.
 * Ao entrar ou concluir o cadastro, o guarda muda e o roteador leva ao feed sozinho.
 * A splash fica na tela enquanto a sessão guardada no aparelho é retomada.
 */
function RootStack() {
  const { onboarded, status, account } = useAccount();
  const [deferredLegalUser, setDeferredLegalUser] = useState<string | null>(null);
  const restoring = status === 'restoring';

  useEffect(() => {
    if (!restoring) SplashScreen.hideAsync();
  }, [restoring]);

  if (restoring) return null;
  const needsLegal = status === 'signedIn' && account !== null && !account.legalAccepted && deferredLegalUser !== account.id;

  return (
    <>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.cream } }}>
      <Stack.Protected guard={onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="avisos" />
        <Stack.Screen name="biblioteca" />
        <Stack.Screen name="praca/[id]" />
        <Stack.Screen name="praca/figurinhas/[id]" />
        <Stack.Screen name="criar" options={{ presentation: 'modal' }} />
        <Stack.Screen name="interesses" options={{ presentation: 'modal' }} />
        <Stack.Screen name="moderacao/[id]" />
        <Stack.Screen name="criar-comuna" options={{ presentation: 'modal' }} />
        <Stack.Screen name="gerir-comuna/[id]" />
        <Stack.Screen name="conta" options={{ presentation: 'modal' }} />
        <Stack.Screen name="verificar-email" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="boas-vindas" />
      </Stack.Protected>
    </Stack>
    {/* Mantém o navegador montado enquanto o login social abre o onboarding por baixo do aceite. */}
    <Modal visible={needsLegal} presentationStyle="fullScreen" animationType="slide">
      <LegalAcceptanceScreen onDefer={() => { if (account) setDeferredLegalUser(account.id); }} />
    </Modal>
    {onboarded ? <MockDataNotice /> : null}
    </>
  );
}
