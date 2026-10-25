// Importa cada peso pelo subcaminho: o índice do pacote embutiria todos os pesos no app.
import { Archivo_400Regular } from '@expo-google-fonts/archivo/400Regular';
import { Archivo_700Bold } from '@expo-google-fonts/archivo/700Bold';
import { Archivo_800ExtraBold } from '@expo-google-fonts/archivo/800ExtraBold';
import { ArchivoNarrow_700Bold } from '@expo-google-fonts/archivo-narrow/700Bold';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync();

/**
 * Captura erros de renderização de qualquer rota filha e oferece tentar de novo,
 * em vez de derrubar o app. Não exibe detalhes técnicos para a pessoa usuária.
 */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  if (__DEV__) console.error(error);
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
    if (fontsLoaded || fontError) SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  // Sem fontes, o app segue com as fontes do sistema em vez de travar na splash.
  if (!fontsLoaded && !fontError) return null;

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.cream } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="criar" options={{ presentation: 'modal' }} />
      </Stack>
    </>
  );
}
