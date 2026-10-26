import { Stack } from 'expo-router';

import { Colors } from '@/constants/theme';

export const unstable_settings = { anchor: 'index' };

/** Fluxo inicial: boas-vindas → perfil → assuntos → comunas → feed (design 2a–2c). */
export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.cream } }} />;
}
