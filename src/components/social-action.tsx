import { ActivityIndicator, StyleSheet, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';

import { AnimatedPressable } from '@/components/animated-pressable';
import { AppText, type TextVariant } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { Colors, Fonts, MinTouchTarget, Radius, Spacing } from '@/constants/theme';
import { usePressFeedback } from '@/hooks/use-press-feedback';
import { useReactionFeedback } from '@/hooks/use-reaction-feedback';
import { formatCount } from '@/lib/format';
import { haptic, type HapticFeedback } from '@/lib/haptics';

/**
 * Aparências das ações sociais. Cada uma preserva a composição onde nasceu:
 * - `feed`: caixa de papel com borda de tinta, usada no cartão do feed;
 * - `editorial`: ação compacta sem caixa da publicação aberta;
 * - `rail`: coluna vertical sobre a mídia em tela cheia;
 * - `comment`: apoio dentro da linha de comentário.
 */
export type SocialActionVariant = 'feed' | 'editorial' | 'rail' | 'comment';

type SocialActionProps = {
  icon: IconName;
  /** Rótulo da ação; o contador visível é acrescentado ao rótulo acessível. */
  label: string;
  onPress: () => void;
  /** Ações que abrem a publicação podem aquecer o detalhe no toque inicial. */
  onPressIn?: () => void;
  count?: number;
  /** Falso esconde o contador visual e falado, como no salvar do rail. */
  showCount?: boolean;
  /** Estado de alternância; ausente em ações de navegação, como Comentar. */
  active?: boolean;
  /** Preenche o ícone no estado ativo. O padrão preenche apenas o apoio. */
  filled?: boolean;
  /** Exceção explícita de tamanho do ícone, como o salvar do feed (20). */
  iconSize?: number;
  /** Mutação em voo: bloqueia o toque, anuncia `busy` e troca o ícone pelo spinner. */
  busy?: boolean;
  disabled?: boolean;
  variant?: SocialActionVariant;
  accessibilityHint?: string;
  /**
   * Tique do gesto. Alternâncias usam `light` por padrão; navegação não vibra.
   * `null` desliga o tique quando o handler compartilhado já o dispara.
   */
  hapticFeedback?: HapticFeedback | null;
  style?: StyleProp<ViewStyle>;
};

type Appearance = {
  container: StyleProp<ViewStyle>;
  content: StyleProp<ViewStyle>;
  iconSize: number;
  color: string;
  activeColor: string;
  textStyle?: TextStyle;
  textVariant?: TextVariant;
  /** No rail o contador fica claro mesmo quando o ícone ativo é vermelho. */
  countColor?: string;
  hitSlop?: { top?: number; bottom?: number; left?: number; right?: number };
};

/**
 * Ação social com ícone, contador, estado ativo, carregamento e acessibilidade.
 * O toque, o pulso local e o tique ficam no mesmo lugar; a aparência só muda a
 * composição, nunca o contrato dos callbacks.
 */
export function SocialAction({
  icon,
  label,
  onPress,
  onPressIn,
  count,
  showCount,
  active,
  filled = icon === 'support' && active === true,
  iconSize,
  busy = false,
  disabled = false,
  variant = 'feed',
  accessibilityHint,
  hapticFeedback,
  style,
}: SocialActionProps) {
  const appearance = APPEARANCES[variant];
  const unavailable = disabled || busy;
  const press = usePressFeedback();
  // Navegação (Comentar) não alterna: o sinal fixo evita um pulso quando a
  // contagem de comentários muda. Apoiar/ecoar/salvar pulsam na troca do estado.
  const reaction = useReactionFeedback(active === undefined ? 'navigation' : active);
  const countVisible = showCount ?? count !== undefined;
  const formattedCount = countVisible && count !== undefined ? formatCount(count) : null;
  const countLabel = formattedCount === null ? '' : `, ${formattedCount}`;
  const color = active ? appearance.activeColor : appearance.color;
  const feedback = hapticFeedback === undefined ? (active === undefined ? null : 'light') : hapticFeedback;

  return (
    <AnimatedPressable
      onPress={() => {
        if (feedback) haptic(feedback);
        onPress();
      }}
      onPressIn={() => {
        press.onPressIn();
        onPressIn?.();
      }}
      onPressOut={press.onPressOut}
      disabled={unavailable}
      accessibilityRole="button"
      accessibilityLabel={`${label}${countLabel}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={
        active === undefined
          ? (unavailable ? { disabled: true, busy } : undefined)
          : { selected: active, disabled: unavailable, busy }
      }
      hitSlop={appearance.hitSlop}
      style={[styles.base, appearance.container, style, unavailable ? styles.unavailable : press.style]}>
      <Animated.View style={[appearance.content, reaction]}>
        {busy ? (
          <ActivityIndicator testID="social-action-loading" size="small" color={color} />
        ) : (
          <Icon name={icon} size={iconSize ?? appearance.iconSize} color={color} filled={filled} />
        )}
        {formattedCount !== null ? (
          <AppText
            variant={appearance.textVariant}
            style={appearance.textStyle}
            color={appearance.countColor ?? color}
            numberOfLines={1}>
            {formattedCount}
          </AppText>
        ) : null}
      </Animated.View>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feed: {
    minWidth: MinTouchTarget,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
  },
  feedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  feedCount: {
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 17,
  },
  editorial: {
    minWidth: 54,
    paddingHorizontal: Spacing.two,
  },
  editorialContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  compactCount: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 17,
  },
  rail: {
    minHeight: MinTouchTarget,
  },
  railContent: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  comment: {
    paddingHorizontal: Spacing.two,
  },
  commentContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  unavailable: {
    opacity: 0.68,
  },
});

const APPEARANCES: Record<SocialActionVariant, Appearance> = {
  feed: {
    container: styles.feed,
    content: styles.feedContent,
    iconSize: 18,
    color: Colors.ink,
    activeColor: Colors.red,
    textStyle: styles.feedCount,
  },
  editorial: {
    container: styles.editorial,
    content: styles.editorialContent,
    iconSize: 19,
    color: Colors.inkSoft,
    activeColor: Colors.red,
    textStyle: styles.compactCount,
  },
  rail: {
    container: styles.rail,
    content: styles.railContent,
    iconSize: 26,
    color: Colors.paper,
    activeColor: Colors.red,
    textVariant: 'label',
    countColor: Colors.paper,
    hitSlop: { top: 4, bottom: 4, left: 8, right: 8 },
  },
  comment: {
    container: styles.comment,
    content: styles.commentContent,
    iconSize: 17,
    color: Colors.inkSoft,
    activeColor: Colors.red,
    textStyle: styles.compactCount,
  },
};
