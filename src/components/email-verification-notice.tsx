import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { Colors, Fonts, Radius } from '@/constants/theme';

type EmailVerificationNoticeProps = {
  message: string;
  onVerify: () => void;
  actionLabel?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Aviso inline de e-mail não confirmado. Fica no próprio cartão (e não no toast)
 * para explicar a restrição e oferecer o caminho de confirmação.
 */
export function EmailVerificationNotice({
  message,
  onVerify,
  actionLabel = 'Verificar e-mail',
  style,
}: EmailVerificationNoticeProps) {
  return (
    <View style={[styles.notice, style]} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <AppText style={styles.text}>{message}</AppText>
      <PillButton
        label={actionLabel}
        icon="check"
        size="sm"
        variant="outline"
        onPress={onVerify}
        accessibilityLabel={actionLabel}
        accessibilityHint="Abre a confirmação de e-mail"
        style={styles.action}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignItems: 'flex-start',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.inkSoft,
    backgroundColor: Colors.strawLight,
  },
  text: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 19,
    color: Colors.ink,
  },
  action: {
    borderRadius: Radius.sm,
  },
});
