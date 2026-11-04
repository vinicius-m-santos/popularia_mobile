import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
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
  /** Variante editorial, usada nos formulários do perfil. */
  appearance?: 'default' | 'editorial' | 'setup';
};

/** Select nativo ao design do app: gatilho compacto e opções em folha rolável. */
export function SelectField({ label, value, options, placeholder, onChange, disabled, loading, error, appearance = 'default' }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const text = loading ? 'Carregando…' : selected?.label ?? placeholder;

  return (
    <View style={styles.field}>
      <AppText style={[styles.label, appearance === 'editorial' && styles.editorialLabel, appearance === 'setup' && styles.setupLabel]}>{label}</AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}`}
        accessibilityState={{ disabled, expanded: open }}
        disabled={disabled || loading}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, appearance === 'editorial' && styles.triggerEditorial, appearance === 'setup' && styles.setupTrigger, (disabled || loading) && styles.disabled, pressed && styles.pressed]}>
        <AppText style={[styles.value, appearance === 'setup' && styles.setupValue]} color={selected ? Colors.ink : Colors.muted} numberOfLines={1}>{text}</AppText>
        <Icon name="chevronDown" size={18} color={Colors.muted} />
      </Pressable>
      {error ? <AppText style={[styles.error, appearance === 'setup' && styles.setupError]} color={Colors.red}>{error}</AppText> : null}
      <BottomSheet visible={open} onClose={() => setOpen(false)} title={label} contentPanningGesture={false}>
        <View style={styles.options}>
          {options.map((item) => (
            <Pressable
              key={item.value}
              accessibilityRole="radio"
              accessibilityState={{ checked: item.value === value }}
              onPress={() => { onChange(item.value); setOpen(false); }}
              style={({ pressed }) => [styles.option, item.value === value && styles.selected, pressed && styles.pressed]}>
              <AppText style={styles.optionLabel}>{item.label}</AppText>
              {item.value === value ? <Icon name="check" size={18} color={Colors.red} /> : null}
            </Pressable>
          ))}
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: Fonts.bold, fontSize: 13.5, lineHeight: 18 },
  editorialLabel: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  trigger: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: 1.5, borderColor: Colors.ink, borderRadius: Radius.xl, backgroundColor: Colors.paper, paddingLeft: 14, paddingRight: Spacing.two },
  triggerEditorial: {
    borderWidth: 1,
    borderRadius: Radius.sm,
  },
  setupLabel: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 23 },
  setupTrigger: { height: 52, borderWidth: 2, borderColor: Colors.ink, borderRadius: 6, paddingLeft: 14, paddingRight: 16 },
  setupValue: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24 },
  setupError: { fontFamily: Fonts.bold, fontSize: 14, lineHeight: 22 },
  value: { flex: 1, fontSize: 16, lineHeight: 21 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.72 },
  error: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 17 },
  options: { paddingBottom: Spacing.four },
  option: { minHeight: 50, flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingHorizontal: Spacing.two, borderBottomWidth: 1, borderBottomColor: Colors.rule },
  selected: { backgroundColor: Colors.strawLight },
  optionLabel: { flex: 1, fontSize: 15, lineHeight: 21 },
});
