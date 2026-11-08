import { StyleSheet } from 'react-native';

import { FilterChipRow } from '@/components/filter-chips';
import { Colors, Fonts } from '@/constants/theme';

type ChipOption<K extends string> = { key: K; label: string };

type ChipRowProps<K extends string> = {
  options: ChipOption<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
};

/**
 * Filtros em caixa que rolam na horizontal: o ativo fica preenchido de tinta.
 * A rolagem automática e a semântica de radiogroup vivem em `FilterChipRow`.
 */
export function ChipRow<K extends string>({ options, value, onChange, accessibilityLabel }: ChipRowProps<K>) {
  return (
    <FilterChipRow
      options={options}
      value={value}
      onChange={onChange}
      accessibilityLabel={accessibilityLabel}
      labelStyle={styles.label}
      singleLine
      activeLabelColor={Colors.cream}
    />
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
});
