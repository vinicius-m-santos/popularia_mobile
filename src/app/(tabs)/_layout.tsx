import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/tab-bar';
import { useAccount } from '@/features/account/account-context';
import { Colors } from '@/constants/theme';

/**
 * Abas em JavaScript (e não NativeTabs) porque o design pede uma barra escura
 * personalizada com o botão "Criar" no centro.
 */
export default function TabsLayout() {
  const { onboarded } = useAccount();

  // A rota / é a tela inicial do app. Sem sessão, ela redireciona para as boas-vindas
  // em vez de deixar o router escolher outra rota pública como fallback.
  if (!onboarded) return <Redirect href="/boas-vindas" />;

  // Cada aba tem a própria pilha, mas volta ao topo quando perde o foco (POP-32).
  // O detalhe não fica preso em outra aba e o cache da lista é mantido; o teste
  // src/components/__tests__/tabs-layout.test.tsx trava essa decisão.
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Colors.cream } }}>
      <Tabs.Screen name="(inicio)" options={{ title: 'Início', popToTopOnBlur: true }} />
      <Tabs.Screen name="explorar" options={{ title: 'Explorar', popToTopOnBlur: true }} />
      <Tabs.Screen name="pracas" options={{ title: 'Praças', popToTopOnBlur: true }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil', popToTopOnBlur: true }} />
    </Tabs>
  );
}
