import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Motion } from '@/constants/motion';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

type HeaderAction = {
  icon: IconName;
  label: string;
  onPress: () => void;
  /** Estado visual de alternância, como "salvo". */
  active?: boolean;
  /** Sem caixa, borda ou fundo: o mockup usa três pontos soltos na Coleção. */
  plain?: boolean;
};

type Props = {
  title?: string;
  subtitle?: string;
  onBack: () => void;
  backLabel?: string;
  /** Ações à direita, em caixas de 44 como o voltar. */
  actions?: HeaderAction[];
  /** Conteúdo à direita no lugar das ações (por exemplo, o botão "Prévia"). */
  right?: ReactNode;
  tone?: 'light' | 'dark';
  /** Linha de 2 embaixo do chrome, como nos mockups. */
  rule?: boolean;
};

/**
 * Chrome interno dos mockups: voltar em caixa, título mono e ações em caixa.
 * O fundo claro mantém o creme; a variante escura é usada na conversa da Praça.
 */
export function EditorialHeader({ title, subtitle, onBack, backLabel = 'Voltar', actions = [], right, tone = 'light', rule = true }: Props) {
  const dark = tone === 'dark';
  const ink = dark ? Colors.cream : Colors.ink;
  return (
    <View style={[styles.bar, dark && styles.barDark, rule && (dark ? styles.ruleDark : styles.rule)]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={backLabel}
        onPress={onBack}
        style={({ pressed }) => [styles.box, dark && styles.boxDark, pressed && styles.pressed]}>
        <Icon name="arrowLeft" size={24} color={ink} />
      </Pressable>
      <View style={styles.copy}>
        {title ? <AppText style={[styles.title, { color: ink }]} numberOfLines={1}>{title}</AppText> : null}
        {subtitle ? <AppText style={[styles.subtitle, dark && styles.subtitleDark]} numberOfLines={1}>{subtitle}</AppText> : null}
      </View>
      {right}
      {actions.map((action) => (
        <Pressable
          key={action.label}
          accessibilityRole="button"
          accessibilityLabel={action.label}
          accessibilityState={{ selected: action.active }}
          onPress={action.onPress}
          style={({ pressed }) => [styles.box, dark && styles.boxDark, action.plain && styles.boxPlain, action.active && !action.plain && (dark ? styles.boxActiveDark : styles.boxActive), pressed && styles.pressed]}>
          <Icon name={action.icon} size={22} color={action.active && !action.plain && !dark ? Colors.paper : ink} filled={!!action.active && !!action.plain} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    backgroundColor: Colors.cream,
  },
  barDark: {
    backgroundColor: Colors.ink,
  },
  rule: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.ink,
  },
  ruleDark: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.inkRule,
  },
  box: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  boxDark: {
    borderColor: Colors.cream,
    backgroundColor: Colors.ink,
  },
  boxPlain: {
    borderWidth: 0,
    backgroundColor: 'transparent',
  },
  boxActive: {
    backgroundColor: Colors.ink,
  },
  boxActiveDark: {
    backgroundColor: Colors.cream,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  title: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.muted,
  },
  subtitleDark: {
    color: Colors.onInkMuted,
  },
  pressed: {
    opacity: Motion.feedback.pressed.opacity,
  },
});
