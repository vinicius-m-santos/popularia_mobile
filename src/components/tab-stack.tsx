import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

/**
 * Pilha de uma aba: a tela raiz e os detalhes (comuna, discussão, perfil).
 * Cada aba tem a sua, para que voltar leve à tela de onde a pessoa saiu.
 */
export function TabStack() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.cream } }} />;
}
