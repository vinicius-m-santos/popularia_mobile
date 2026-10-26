import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { useInteractions } from '@/features/interactions/interactions-context';
import { plural } from '@/lib/format';

/** "Seu feed está pronto" logo depois do cadastro (design 2d). Some ao fechar. */
export function WelcomeBanner() {
  const { profile, interests, showWelcome, dismissWelcome } = useAccount();
  const { joinedComunaIds } = useInteractions();
  if (!showWelcome) return null;

  const firstName = profile.name.trim().split(/\s+/)[0] || 'camarada';

  return (
    <View style={styles.banner} accessibilityLiveRegion="polite">
      <AppText variant="label" style={styles.kicker} color={Colors.onInkMuted}>
        Boas-vindas
      </AppText>
      <AppText style={styles.title} color={Colors.cream} accessibilityRole="header">
        Seu feed está pronto, {firstName}.
      </AppText>
      <AppText style={styles.text} color={Colors.onInkSoft}>
        Montamos com {plural(interests.length, 'assunto', 'assuntos')} e{' '}
        {plural(joinedComunaIds.length, 'comuna', 'comunas')}. Ajuste quando quiser no seu perfil.
      </AppText>
      <IconButton
        icon="close"
        size={18}
        color={Colors.cream}
        accessibilityLabel="Fechar boas-vindas"
        onPress={dismissWelcome}
        style={styles.close}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginTop: Spacing.four,
    marginHorizontal: Spacing.five,
    padding: Spacing.four,
    paddingRight: 44,
    borderRadius: 14,
    backgroundColor: Colors.ink,
  },
  kicker: {
    fontSize: 10.5,
  },
  title: {
    fontFamily: Fonts.condensed,
    fontSize: 28,
    lineHeight: 28,
    textTransform: 'uppercase',
    marginTop: Spacing.one,
  },
  text: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
  },
  close: {
    position: 'absolute',
    top: 4,
    right: 4,
    borderRadius: Radius.pill,
  },
});
