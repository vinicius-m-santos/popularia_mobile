import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Colors, Fonts, Radius } from '@/constants/theme';
import { goBack } from '@/lib/routes';

/** Cabeçalho do progresso: voltar, título mono e a explicação, como no desenho. */
export function ProgressHeader({ onHelp }: { onHelp: () => void }) {
  return (
    <View style={styles.bar}>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        accessibilityLabel="Voltar"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <Icon name="back" size={20} color={Colors.ink} />
      </Pressable>
      <AppText style={styles.title} accessibilityRole="header">Progresso</AppText>
      <Pressable
        onPress={onHelp}
        accessibilityRole="button"
        accessibilityLabel="Como funciona o progresso"
        style={({ pressed }) => [styles.button, pressed && styles.pressed]}>
        <AppText style={styles.help}>?</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 2,
    borderBottomColor: Colors.ink,
  },
  button: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.md,
    backgroundColor: Colors.paper,
  },
  pressed: { opacity: 0.7 },
  title: {
    flex: 1,
    fontFamily: Fonts.monoSemibold,
    fontSize: 14,
    lineHeight: 22,
    letterSpacing: 1.68,
    textTransform: 'uppercase',
    color: Colors.ink,
  },
  help: {
    fontFamily: Fonts.extrabold,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.ink,
  },
});
