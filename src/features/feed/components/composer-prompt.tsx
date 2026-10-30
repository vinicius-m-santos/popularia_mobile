import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMe } from '@/features/account/account-context';

/** Convites curtos: o feed propõe uma abertura diferente a cada dia, sem repetir a mesma frase. */
const PROMPTS = [
  'O que sua comuna precisa saber?',
  'Qual pauta move sua praça hoje?',
  'Que conquista merece ser contada?',
  'O que você aprendeu e quer dividir?',
];

export function promptOfTheDay(today = new Date()): string {
  const index = (today.getFullYear() * 372 + today.getMonth() * 31 + today.getDate()) % PROMPTS.length;
  return PROMPTS[index];
}

/** Atalho que abre a criação de publicação, com o convite do dia. */
export function ComposerPrompt({ placeholder }: { placeholder?: string }) {
  const me = useMe();
  const prompt = placeholder ?? promptOfTheDay();
  return (
    <Pressable
      onPress={() => router.push('/criar')}
      accessibilityRole="button"
      accessibilityLabel="Criar publicação"
      style={({ pressed }) => [styles.box, pressed && styles.pressed]}>
      <Avatar initials={me.initials} tone={me.tone} size={32} userId={me.id} imageUrl={me.avatarUrl} />
      <AppText style={styles.placeholder} color={Colors.muted} numberOfLines={1}>
        {prompt}
      </AppText>
      <View style={styles.pen}>
        <Icon name="edit" size={18} color={Colors.muted} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    marginTop: Spacing.four,
    marginHorizontal: Spacing.five,
    marginBottom: Spacing.one,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingLeft: Spacing.two,
    paddingRight: Spacing.three,
    minHeight: 52,
    borderWidth: 1,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  placeholder: {
    flex: 1,
    fontSize: 15.5,
    lineHeight: 22,
  },
  pen: {
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.8,
  },
});
