import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { RadioMark } from '@/components/choice-marks';
import { Icon } from '@/components/icon';
import { StateView } from '@/components/state-view';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useAsyncData } from '@/hooks/use-async-data';
import type { TopicId } from '@/types/models';

import { getTopicGroups } from '../api';

/** Escolha única da taxonomia oficial; compartilhada entre comuna e publicação geral. */
export function SingleTopicField({ value, onChange, optional = false, error, disabled = false }: {
  value: TopicId | null; onChange: (value: TopicId | null) => void; optional?: boolean; error?: string; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const load = useCallback(() => getTopicGroups(), []);
  const data = useAsyncData(load);
  const topics = data.data?.flatMap((g) => g.topics) ?? [];
  const selected = topics.find((t) => t.id === value);
  const choose = (id: TopicId | null) => { onChange(id); setOpen(false); };
  return (
    <View style={styles.field}>
      <AppText variant="label">Assunto{optional ? ' · opcional' : ''}</AppText>
      <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel={`Assunto: ${selected?.shortLabel ?? 'Escolher assunto'}`} onPress={() => setOpen(true)} style={styles.trigger}>
        <AppText style={styles.name}>{selected?.label ?? (value && data.status === 'loading' ? 'Carregando assunto…' : 'Escolher assunto')}</AppText>
        <Icon name="chevronRight" size={18} />
      </Pressable>
      {error ? <AppText variant="caption" color={Colors.red}>{error}</AppText> : null}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title="Escolher assunto">
        <View>
          {data.status === 'loading' ? <StateView kind="loading" message="Carregando assuntos" /> : null}
          {data.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar os assuntos." onRetry={data.reload} /> : null}
          {optional ? <Pressable onPress={() => choose(null)} accessibilityRole="radio" accessibilityState={{ checked: value === null }} style={styles.option}>
            <RadioMark selected={value === null} /><AppText>Sem assunto</AppText>
          </Pressable> : null}
          {data.data?.map((g) => <View key={g.title}>
            <AppText variant="label" color={Colors.red} style={styles.group}>{g.title}</AppText>
            {g.topics.map((t) => <Pressable key={t.id} onPress={() => choose(t.id)} accessibilityRole="radio" accessibilityLabel={t.label} accessibilityState={{ checked: value === t.id }} style={styles.option}>
              <RadioMark selected={value === t.id} /><AppText style={styles.name}>{t.label}</AppText>
            </Pressable>)}
          </View>)}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.two },
  trigger: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, padding: Spacing.three, borderWidth: 1.5, borderColor: Colors.ink, borderRadius: Radius.lg, backgroundColor: Colors.paper },
  name: { flex: 1, minWidth: 0 },
  option: { minHeight: 48, paddingVertical: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  group: { paddingTop: Spacing.five, paddingBottom: Spacing.two },
});
