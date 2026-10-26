import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { useMe } from '@/features/account/account-context';

/** Atalho "O que sua comuna precisa saber?" que abre a criação de publicação. */
export function ComposerPrompt() {
  const me = useMe();
  return (
    <Pressable
      onPress={() => router.push('/criar')}
      accessibilityRole="button"
      accessibilityLabel="Criar publicação"
      style={({ pressed }) => [styles.box, pressed && styles.pressed]}>
      <Avatar initials={me.initials} tone={me.tone} size={34} />
      <AppText style={styles.placeholder} color={Colors.muted} numberOfLines={1}>
        O que sua comuna precisa saber?
      </AppText>
      <Icon name="image" size={21} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  box: {
    marginHorizontal: Spacing.five,
    marginBottom: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    padding: Spacing.two,
    paddingRight: Spacing.three,
    minHeight: 50,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.pill,
    backgroundColor: Colors.paper,
  },
  placeholder: {
    flex: 1,
    fontSize: 14.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
