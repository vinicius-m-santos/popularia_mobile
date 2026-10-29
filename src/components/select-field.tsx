import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet, PopulariaBottomSheetFlatList } from '@/components/bottom-sheet';
import { Icon } from '@/components/icon';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

export type SelectOption = { value: string; label: string };

type Props = {
  label: string;
  value: string;
  options: SelectOption[];
  placeholder: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
};

/** Select nativo ao design do app: gatilho compacto e opções em folha rolável. */
export function SelectField({ label, value, options, placeholder, onChange, disabled, loading, error }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const text = loading ? 'Carregando…' : selected?.label ?? placeholder;

  return (
    <View style={styles.field}>
      <AppText style={styles.label}>{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}`}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled || loading}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, (disabled || loading) && styles.disabled, pressed && styles.pressed]}>
        <AppText style={styles.value} color={selected ? Colors.ink : Colors.muted} numberOfLines={1}>{text}</AppText>
        <Icon name="chevronRight" size={18} color={Colors.muted} />
      </Pressable>
      {error ? <AppText style={styles.error} color={Colors.red}>{error}</AppText> : null}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label} scrollable={false} virtualized>
        <PopulariaBottomSheetFlatList
          data={options}
          keyExtractor={(item) => item.value}
          style={styles.list}
          contentContainerStyle={styles.options}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: item.value === value }}
              onPress={() => { onChange(item.value); setOpen(false); }}
              style={({ pressed }) => [styles.option, item.value === value && styles.selected, pressed && styles.pressed]}>
              <AppText style={styles.optionLabel}>{item.label}</AppText>
              {item.value === value ? <Icon name="check" size={18} color={Colors.red} /> : null}
            </Pressable>
          )}
        />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: Fonts.bold, fontSize: 13.5, lineHeight: 18 },
  trigger: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1.5, borderColor: Colors.ink, borderRadius: Radius.xl, backgroundColor: Colors.paper, paddingLeft: 14, paddingRight: Spacing.two },
  value: { flex: 1, fontSize: 16, lineHeight: 21 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
  error: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 17 },
  list: { maxHeight: 430 },
  options: { paddingBottom: Spacing.four },
  option: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  selected: { backgroundColor: Colors.strawLight },
  optionLabel: { flex: 1, fontSize: 15, lineHeight: 21 },
});
