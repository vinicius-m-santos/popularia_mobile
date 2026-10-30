import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';

/** Etapas do cadastro depois das boas-vindas: conta, perfil, assuntos e comunas. */
export const ONBOARDING_STEPS = 4;

/** Voltar e barra de progresso segmentada ("2 de 4"). */
export function OnboardingProgress({ step }: { step: number }) {
  return (
    <View style={styles.progress}>
      <IconButton icon="back" accessibilityLabel="Voltar" onPress={() => router.back()} />
      <View
        style={styles.segments}
        accessibilityRole="progressbar"
        accessibilityLabel={`Etapa ${step} de ${ONBOARDING_STEPS}`}
        accessibilityValue={{ min: 0, max: ONBOARDING_STEPS, now: step }}>
        {Array.from({ length: ONBOARDING_STEPS }, (_, i) => (
          <View key={i} style={[styles.segment, i < step && styles.segmentDone]} />
        ))}
      </View>
      <AppText variant="label" accessible={false}>
        {step} de {ONBOARDING_STEPS}
      </AppText>
    </View>
  );
}

type FooterProps = {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  hint?: string;
  /** Contador à direita da dica, como "4 de 18". */
  count?: string;
  accessibilityHint?: string;
};

/** Rodapé fixo com o botão de avançar. */
export function OnboardingFooter({ label, onPress, hint, count, accessibilityHint, disabled = false }: FooterProps) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  return (
    <View style={[styles.footer, { paddingBottom: keyboardVisible ? Spacing.three : Math.max(insets.bottom, Spacing.four) + Spacing.two }]}>
      {hint ? (
        <View style={styles.hintRow}>
          <AppText style={styles.hint} color={Colors.inkSoft}>
            {hint}
          </AppText>
          {count ? (
            <AppText style={styles.count} accessibilityLiveRegion="polite">
              {count}
            </AppText>
          ) : null}
        </View>
      ) : null}
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityState={{ disabled, busy: disabled }}
        accessibilityRole="button"
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}>
        <AppText style={styles.ctaLabel} color={Colors.paper}>
          {label}
        </AppText>
        <Icon name="arrowRight" size={20} color={Colors.paper} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingTop: 2,
    paddingBottom: Spacing.two,
    paddingLeft: 6,
    paddingRight: Spacing.five,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: Spacing.one,
  },
  segment: {
    flex: 1,
    height: 5,
    borderRadius: 3,
    backgroundColor: Colors.straw,
  },
  segmentDone: {
    backgroundColor: Colors.red,
  },
  footer: {
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.five,
    gap: Spacing.two + 2,
    borderTopWidth: 1.5,
    borderTopColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two + 2,
  },
  hint: {
    flex: 1,
    fontSize: 13,
    lineHeight: 17,
  },
  count: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 14,
  },
  cta: {
    height: 54,
    borderRadius: Radius.sm,
    backgroundColor: Colors.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  ctaPressed: {
    backgroundColor: Colors.redPressed,
  },
  ctaLabel: {
    fontFamily: Fonts.condensed,
    fontSize: 21,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
});
