import { useRef, type ComponentRef, type ReactNode } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { AppText, type TextVariant } from '@/components/app-text';
import { Colors, Fonts, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { useAutoScrollToSelection } from '@/hooks/use-auto-scroll-to-selection';

export type FilterOption<K extends string> = {
  key: K;
  label: string;
  /** Rótulo completo para leitor de tela quando o chip mostra a versão curta. */
  accessibilityLabel?: string;
};

export type FilterChipAppearance = 'boxed' | 'soft';

type FilterChipRowProps<K extends string> = {
  options: readonly FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
  /** Caixa com contorno ou fundo palha sem contorno, como no Explorar. */
  appearance?: FilterChipAppearance;
  /** Altura visual do chip; o hitSlop completa o alvo de toque até 44. */
  minHeight?: number;
  /** Espaço entre as opções. */
  gap?: number;
  /** Recuo horizontal do trilho. */
  inset?: number;
  /** Conteúdo no fim do trilho, como a ação "Mais assuntos". */
  trailing?: ReactNode;
  /** Traz a opção ativa para a área visível quando a seleção muda por outro caminho. */
  autoScroll?: boolean;
  /** Área de toque vertical extra; por padrão completa a altura visual até 44. */
  hitSlop?: number;
  labelVariant?: TextVariant;
  labelStyle?: StyleProp<TextStyle>;
  /** Mantém o rótulo em uma linha; os chips compactos usam esse recorte. */
  singleLine?: boolean;
  /** Cor do rótulo quando a opção está ativa; o padrão é papel. */
  activeLabelColor?: string;
  optionStyle?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Trilho horizontal de filtros com semântica de radiogroup. A seleção continua
 * sendo do consumidor; aqui ficam a rolagem automática, o alvo de toque e o
 * estado visual comum aos chips.
 */
export function FilterChipRow<K extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  appearance = 'boxed',
  minHeight = appearance === 'soft' ? MinTouchTarget : 36,
  gap = 6,
  inset = Spacing.five,
  trailing,
  autoScroll = true,
  hitSlop,
  labelVariant,
  labelStyle,
  singleLine = false,
  activeLabelColor = Colors.paper,
  optionStyle,
  pressedStyle,
  contentContainerStyle,
  testID,
}: FilterChipRowProps<K>) {
  const scrollerRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const { onOptionLayout } = useAutoScrollToSelection(value, scrollerRef, autoScroll);
  const verticalHitSlop = hitSlop ?? Math.max(0, (MinTouchTarget - minHeight) / 2);

  return (
    <ScrollView
      ref={scrollerRef}
      testID={testID}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={[styles.row, { gap, paddingHorizontal: inset }, contentContainerStyle]}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}>
      {options.map((option) => (
        <FilterChip
          key={option.key}
          option={option}
          active={option.key === value}
          appearance={appearance}
          minHeight={minHeight}
          verticalHitSlop={verticalHitSlop}
          labelVariant={labelVariant}
          labelStyle={labelStyle}
          singleLine={singleLine}
          activeLabelColor={activeLabelColor}
          optionStyle={optionStyle}
          pressedStyle={pressedStyle}
          onPress={() => onChange(option.key)}
          onLayout={(event) => onOptionLayout(option.key, event)}
        />
      ))}
      {trailing}
    </ScrollView>
  );
}

type FilterChipProps<K extends string> = {
  option: FilterOption<K>;
  active: boolean;
  appearance: FilterChipAppearance;
  minHeight: number;
  verticalHitSlop: number;
  labelVariant?: TextVariant;
  labelStyle?: StyleProp<TextStyle>;
  /** Mantém o rótulo em uma linha; os chips compactos usam esse recorte. */
  singleLine?: boolean;
  /** Cor do rótulo quando a opção está ativa; o padrão é papel. */
  activeLabelColor?: string;
  optionStyle?: StyleProp<ViewStyle>;
  pressedStyle?: StyleProp<ViewStyle>;
  onPress: () => void;
  onLayout: (event: LayoutChangeEvent) => void;
};

function FilterChip<K extends string>({
  option,
  active,
  appearance,
  minHeight,
  verticalHitSlop,
  labelVariant,
  labelStyle,
  singleLine = false,
  activeLabelColor = Colors.paper,
  optionStyle,
  pressedStyle,
  onPress,
  onLayout,
}: FilterChipProps<K>) {
  return (
    <Pressable
      onPress={onPress}
      onLayout={onLayout}
      accessibilityRole="radio"
      accessibilityLabel={option.accessibilityLabel}
      accessibilityState={{ checked: active }}
      hitSlop={verticalHitSlop ? { top: verticalHitSlop, bottom: verticalHitSlop } : undefined}
      style={({ pressed }) => [
        styles.chip,
        appearance === 'soft' ? styles.chipSoft : styles.chipBoxed,
        { minHeight },
        optionStyle,
        active && styles.chipActive,
        pressed && (pressedStyle ?? styles.pressed),
      ]}>
      <AppText
        variant={labelVariant}
        style={labelStyle}
        color={active ? activeLabelColor : Colors.ink}
        numberOfLines={singleLine ? 1 : undefined}>
        {option.label}
      </AppText>
    </Pressable>
  );
}

type FilterSegmentsProps<K extends string> = {
  options: readonly FilterOption<K>[];
  value: K;
  onChange: (key: K) => void;
  accessibilityLabel: string;
  /** Em telas estreitas ou com fonte ampliada, empilha as opções. */
  stacked?: boolean;
};

/**
 * Segmentos de largura igual, como a origem dos documentos da Biblioteca. O
 * contorno fica no grupo; a seleção preenche o segmento com tinta.
 */
export function FilterSegments<K extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
  stacked = false,
}: FilterSegmentsProps<K>) {
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.segments, stacked && styles.segmentsStacked]}>
      {options.map((option, index) => {
        const active = option.key === value;
        return (
          <Pressable
            key={option.key}
            accessibilityRole="radio"
            accessibilityLabel={option.accessibilityLabel}
            accessibilityState={{ checked: active }}
            onPress={() => onChange(option.key)}
            style={({ pressed }) => [
              styles.segment,
              index > 0 && styles.segmentRule,
              active && styles.segmentActive,
              pressed && styles.pressed,
            ]}>
            <AppText style={styles.segmentLabel} color={active ? Colors.paper : Colors.ink}>
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    borderRadius: Radius.sm,
  },
  chipBoxed: {
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
    paddingHorizontal: 14,
  },
  chipSoft: {
    backgroundColor: Colors.strawLight,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chipActive: {
    backgroundColor: Colors.ink,
  },
  pressed: {
    opacity: 0.75,
  },
  segments: {
    flexDirection: 'row',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  segmentsStacked: {
    flexDirection: 'column',
  },
  segment: {
    flexGrow: 1,
    flexBasis: 0,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.one,
  },
  segmentRule: {
    borderLeftWidth: 2,
    borderLeftColor: Colors.ink,
  },
  segmentActive: {
    backgroundColor: Colors.ink,
  },
  segmentLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 15,
    lineHeight: 23,
  },
});
