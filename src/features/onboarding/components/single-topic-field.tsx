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
export function SingleTopicField({ value, onChange, optional = false, error, disabled = false, appearance = 'default' }: {
  value: TopicId | null; onChange: (value: TopicId | null) => void; optional?: boolean; error?: string; disabled?: boolean; appearance?: 'default' | 'editorial' | 'filter';
}) {
  const [open, setOpen] = useState(false);
  const load = useCallback(() => getTopicGroups(), []);
  const data = useAsyncData(load);
  const topics = data.data?.flatMap((g) => g.topics) ?? [];
  const selected = topics.find((t) => t.id === value);
  const filter = appearance === 'filter';
  const emptyLabel = filter ? 'Todos os assuntos' : 'Escolher assunto';
  const choose = (id: TopicId | null) => { onChange(id); setOpen(false); };
  return (
    <View style={styles.field}>
      {!filter ? <AppText variant="label">Assunto{optional ? ' · opcional' : ''}</AppText> : null}
      <Pressable disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }} accessibilityLabel={`Assunto: ${(filter ? selected?.label : selected?.shortLabel) ?? emptyLabel}`} onPress={() => setOpen(true)} style={({ pressed }) => [styles.trigger, appearance === 'editorial' && styles.editorialTrigger, filter && styles.filterTrigger, filter && !!value && styles.filterSelected, filter && pressed && styles.filterPressed]}>
        <AppText style={styles.name}>{selected?.label ?? (value && data.status === 'loading' ? 'Carregando assunto…' : emptyLabel)}</AppText>
        <Icon name={appearance !== 'default' ? 'chevronDown' : 'chevronRight'} size={18} />
      </Pressable>
      {error ? <AppText variant="caption" color={Colors.red}>{error}</AppText> : null}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={filter ? 'Filtrar por assunto' : 'Escolher assunto'}>
        <View>
          {data.status === 'loading' ? <StateView kind="loading" message="Carregando assuntos" /> : null}
          {data.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar os assuntos." onRetry={data.reload} /> : null}
          {optional ? <Pressable onPress={() => choose(null)} accessibilityRole="radio" accessibilityState={{ checked: value === null }} style={styles.option}>
            <RadioMark selected={value === null} /><AppText>{filter ? 'Todos os assuntos' : 'Sem assunto'}</AppText>
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
  editorialTrigger: { minHeight: 46, borderRadius: 0, backgroundColor: Colors.paper, paddingHorizontal: Spacing.four },
  filterTrigger: { minHeight: 44, paddingVertical: Spacing.two, borderWidth: 1, borderColor: Colors.inkSoft, borderRadius: Radius.sm, backgroundColor: Colors.paper },
  filterSelected: { borderColor: Colors.ink, backgroundColor: Colors.strawLight },
  filterPressed: { opacity: 0.68 },
  name: { flex: 1, minWidth: 0 },
  option: { minHeight: 48, paddingVertical: Spacing.three, flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  group: { paddingTop: Spacing.five, paddingBottom: Spacing.two },
});
