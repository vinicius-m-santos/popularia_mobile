import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Fonts } from '@/constants/theme';

const INK = '#15120F';
const PAPER = '#FBF7EF';

type Props = { accepted: boolean; onToggle: () => void };

/** Aceite legal obrigatório, compartilhado entre cadastro comum e social. */
export function LegalConsentCard({ accepted, onToggle }: Props) {
  const openLegal = (id: 'termos' | 'regras' | 'privacidade') => {
    router.push({ pathname: '/documento-legal/[id]', params: { id } } as never);
  };

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
        accessibilityLabel="Tenho 18 anos ou mais e aceito os termos de uso, as regras da comunidade e a política de privacidade"
        hitSlop={8}
        style={styles.touch}>
        <View style={[styles.box, accepted && styles.boxOn]}>
          {accepted ? <Icon name="check" size={16} color={PAPER} /> : null}
        </View>
      </Pressable>
      <Text style={styles.text}>
        Tenho <Text style={styles.strong}>18 anos ou mais</Text> e aceito os{' '}
        <Text style={styles.link} accessibilityRole="link" onPress={() => openLegal('termos')}>Termos de Uso</Text> e as{' '}
        <Text style={styles.link} accessibilityRole="link" onPress={() => openLegal('regras')}>Regras da Comunidade</Text>. Li a{' '}
        <Text style={styles.link} accessibilityRole="link" onPress={() => openLegal('privacidade')}>Política de Privacidade</Text>.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, marginTop: 14, padding: 16, borderWidth: 2, borderColor: INK, borderRadius: 6, backgroundColor: PAPER },
  touch: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  box: { width: 28, height: 28, borderWidth: 2, borderColor: INK, borderRadius: 4, alignItems: 'center', justifyContent: 'center', backgroundColor: PAPER },
  boxOn: { backgroundColor: INK },
  text: { flex: 1, fontFamily: Fonts.regular, fontSize: 15, lineHeight: 23, color: INK },
  strong: { fontFamily: Fonts.extrabold },
  link: { fontFamily: Fonts.extrabold, textDecorationLine: 'underline' },
});
