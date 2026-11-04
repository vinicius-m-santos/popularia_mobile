import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useAccount } from '@/features/account/account-context';
import { Redirect } from 'expo-router';
export default function IncomingLink() {
  const { status, onboarded, showLoginWelcome } = useAccount();
  if (showLoginWelcome) return <Redirect href="/boas-vindas/mensagem" />;
  if (status !== 'restoring' && (status !== 'signedIn' || !onboarded)) return <Redirect href="/boas-vindas" />;
  return <Screen><StateView kind="loading" message="Abrindo conteúdo" /></Screen>;
}
