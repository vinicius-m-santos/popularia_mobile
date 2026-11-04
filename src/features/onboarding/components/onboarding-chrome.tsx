import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';

const ONBOARDING = { red: '#BF3326', ink: '#15120F', paper: '#FBF7EF', cream: '#F2EADB', disabled: '#E8DDC8', disabledText: '#6E6458' } as const;

/** Etapas do cadastro depois das boas-vindas: conta, perfil, assuntos e comunas. */
export const ONBOARDING_STEPS = 4;

/** Cabeçalho único das etapas: usar este wrapper evita divergência de layout entre 1, 2, 3 e 4. */
export function OnboardingHeader({ step }: { step: number }) {
  return <View style={styles.header}><OnboardingProgress step={step} /></View>;
}

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
      <AppText style={styles.progressLabel} accessible={false}>
        {step} DE {ONBOARDING_STEPS}
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
    <View style={[styles.footer, { paddingBottom: keyboardVisible ? Spacing.three : Math.max(insets.bottom, 26) }]}>
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
      <View style={styles.ctaWrap}>
        {!disabled ? <View pointerEvents="none" style={styles.ctaShadow} /> : null}
        <Pressable
          onPress={onPress}
          disabled={disabled}
          accessibilityState={{ disabled, busy: disabled }}
          accessibilityRole="button"
          accessibilityHint={accessibilityHint}
          style={({ pressed }) => [styles.cta, disabled && styles.ctaDisabled, pressed && !disabled && styles.ctaPressed]}>
          <AppText style={styles.ctaLabel} color={disabled ? ONBOARDING.disabledText : ONBOARDING.paper}>
            {label}
          </AppText>
          <Icon name="arrowRight" size={18} color={disabled ? ONBOARDING.disabledText : ONBOARDING.paper} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { width: '100%' },
  progress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginLeft: -10,
    paddingTop: 2,
    paddingBottom: 8,
    paddingRight: 0,
  },
  segments: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
  },
  segment: {
    flex: 1,
    height: 8,
    borderWidth: 2,
    borderColor: ONBOARDING.ink,
    borderRadius: 3,
    backgroundColor: ONBOARDING.paper,
  },
  segmentDone: {
    backgroundColor: ONBOARDING.red,
  },
  progressLabel: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1.2,
    color: ONBOARDING.ink,
  },
  footer: {
    paddingTop: 14,
    paddingHorizontal: 24,
    gap: 4,
    borderTopWidth: 2,
    borderTopColor: ONBOARDING.ink,
    backgroundColor: ONBOARDING.cream,
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
  ctaWrap: { position: 'relative' },
  ctaShadow: { position: 'absolute', top: 3, left: 3, width: '100%', height: '100%', borderRadius: 6, backgroundColor: ONBOARDING.ink },
  cta: {
    minHeight: 56,
    borderWidth: 2,
    borderColor: ONBOARDING.ink,
    borderRadius: 6,
    backgroundColor: ONBOARDING.red,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  ctaDisabled: { backgroundColor: ONBOARDING.disabled },
  ctaPressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  ctaLabel: {
    fontFamily: Fonts.anton,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
  },
});
