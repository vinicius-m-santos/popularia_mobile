import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/tab-bar';
import { Colors } from '@/constants/theme';

/**
 * Abas em JavaScript (e não NativeTabs) porque o design pede uma barra escura
 * personalizada com o botão "Criar" no centro.
 */
export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Colors.cream } }}>
      <Tabs.Screen name="(inicio)" options={{ title: 'Início' }} />
      <Tabs.Screen name="explorar" options={{ title: 'Explorar' }} />
      <Tabs.Screen name="pracas" options={{ title: 'Praças' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
