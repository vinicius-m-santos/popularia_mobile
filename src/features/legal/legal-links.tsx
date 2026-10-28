import { router } from 'expo-router';
import { Pressable } from 'react-native';
import { AppText } from '@/components/app-text';
export function LegalAppLink() {
  return <Pressable onPress={() => router.push('/sobre-e-legal' as never)} accessibilityRole="link"><AppText style={{ fontSize: 12, textDecorationLine: 'underline' }}>Sobre e legal</AppText></Pressable>;
}
