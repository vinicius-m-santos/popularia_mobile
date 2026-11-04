import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Fonts } from '@/constants/theme';
import { useKeyboardVisible } from '@/hooks/use-keyboard-visible';

const AUTH = {
  bg: '#F2EADB',
  ink: '#15120F',
  red: '#BF3326',
  redText: '#A3261C',
  paper: '#FBF7EF',
  disabled: '#E8DDC8',
  disabledText: '#6E6458',
} as const;

type Props = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  error?: string | null;
  secondaryText?: string;
  secondaryAction?: string;
  onSecondary?: () => void;
};

/** Rodapé fixo compartilhado por login e primeira etapa do cadastro. */
export function AuthFooter({ label, onPress, busy = false, disabled = false, error, secondaryText, secondaryAction, onSecondary }: Props) {
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const isDisabled = disabled || busy;

  return (
    <View style={[styles.footer, {
      paddingTop: keyboardVisible ? 8 : 14,
      paddingBottom: keyboardVisible ? 8 : Math.max(insets.bottom, 26),
    }]}>
      {error ? (
        <View style={styles.error} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Icon name="alert" size={18} color={AUTH.redText} />
          <AppText style={styles.errorText}>{error}</AppText>
        </View>
      ) : null}
      <View style={styles.buttonWrap}>
        {!isDisabled ? <View pointerEvents="none" style={styles.buttonShadow} /> : null}
        <Pressable
          onPress={onPress}
          disabled={isDisabled}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ busy, disabled: isDisabled }}
          style={({ pressed }) => [styles.primary, isDisabled && styles.primaryDisabled, pressed && !isDisabled && styles.primaryPressed]}>
          <AppText
            style={[styles.primaryLabel, isDisabled && styles.primaryLabelDisabled]}
            color={isDisabled ? AUTH.disabledText : AUTH.paper}
            maxFontSizeMultiplier={1.2}>
            {label.toUpperCase()}
          </AppText>
          {busy ? <ActivityIndicator color={AUTH.paper} /> : <Icon name="arrowRight" size={18} color={isDisabled ? AUTH.disabledText : AUTH.paper} />}
        </Pressable>
      </View>
      {!keyboardVisible && secondaryText && secondaryAction && onSecondary ? (
        <Pressable onPress={onSecondary} accessibilityRole="link" accessibilityLabel={`${secondaryText} ${secondaryAction}`} style={styles.secondary}>
          <AppText style={styles.secondaryText}>
            {secondaryText} <AppText style={styles.secondaryAction}>{secondaryAction}</AppText>
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { borderTopWidth: 2, borderTopColor: AUTH.ink, backgroundColor: AUTH.bg, paddingHorizontal: 24, gap: 4 },
  error: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  errorText: { flex: 1, fontFamily: Fonts.bold, fontSize: 14, lineHeight: 22, color: AUTH.redText },
  buttonWrap: { position: 'relative' },
  buttonShadow: { position: 'absolute', top: 3, left: 3, width: '100%', height: '100%', borderRadius: 6, backgroundColor: AUTH.ink },
  primary: { minHeight: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 2, borderColor: AUTH.ink, borderRadius: 6, backgroundColor: AUTH.red },
  primaryDisabled: { backgroundColor: AUTH.disabled },
  primaryPressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  primaryLabel: { fontFamily: Fonts.anton, fontSize: 22, lineHeight: 30, letterSpacing: 0.88, color: AUTH.paper, textAlign: 'center' },
  primaryLabelDisabled: { color: AUTH.disabledText },
  secondary: { minHeight: 44, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  secondaryText: { fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21, color: AUTH.ink, textAlign: 'center' },
  secondaryAction: { fontFamily: Fonts.extrabold, color: AUTH.redText, textDecorationLine: 'underline' },
});
