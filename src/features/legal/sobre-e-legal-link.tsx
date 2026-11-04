import { router } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

import { Fonts } from '@/constants/theme';

/** Link editorial para a área legal, com o mesmo tratamento no login e no cadastro. */
export function SobreELegalLink() {
  return (
    <Pressable
      onPress={() => router.push('/sobre-e-legal')}
      accessibilityRole="link"
      accessibilityLabel="Sobre e legal"
      style={styles.link}>
      <Text style={styles.text}>SOBRE E LEGAL</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  link: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10 },
  text: { fontFamily: Fonts.monoSemibold, fontSize: 11, lineHeight: 16, letterSpacing: 0.88, textTransform: 'uppercase', color: '#5E554A' },
});
