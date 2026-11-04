import { useLocalSearchParams } from 'expo-router';

import AccountScreen from '@/features/onboarding/account-screen';
import LoginScreen from '@/features/onboarding/login-screen';

/** A mesma rota serve cadastro e login; o modo escolhe a tela, sem misturar os fluxos. */
export default function ContaRoute() {
  const { modo } = useLocalSearchParams<{ modo?: string }>();
  return modo === 'entrar' ? <LoginScreen /> : <AccountScreen />;
}
