import { useEffect, useState } from 'react';
import { AppState, Linking, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Spacing } from '@/constants/theme';

import { pushPermission, registerPush, type PushPermission } from './push';

export function PushPermissionPrompt() {
  const [permission, setPermission] = useState<PushPermission>('unavailable');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    if (DEMO_MODE) return;
    let active = true;
    const refresh = () => { void pushPermission().then((value) => { if (active) setPermission(value); }).catch(() => {}); };
    refresh();
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') refresh(); });
    return () => { active = false; listener.remove(); };
  }, []);
  if (permission === 'unavailable' || permission === 'granted') return null;
  const enable = async () => {
    setBusy(true);
    try {
      if (permission === 'denied') await Linking.openSettings();
      else setPermission(await registerPush(true));
    } catch {
      toast.show('Não conseguimos ativar os avisos neste aparelho. Tente novamente.');
    } finally { setBusy(false); }
  };
  return <View style={styles.prompt}>
    <AppText>Receba avisos de respostas e interações mesmo com o Popularia fechado.</AppText>
    <EditorialAction icon="bell" label={permission === 'denied' ? 'Abrir ajustes de avisos' : 'Ativar avisos no aparelho'} onPress={() => void enable()} disabled={busy} />
  </View>;
}
const styles = StyleSheet.create({ prompt: { padding: Spacing.four, gap: Spacing.three } });
