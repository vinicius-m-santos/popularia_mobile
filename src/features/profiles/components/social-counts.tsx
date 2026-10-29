import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Spacing } from '@/constants/theme';
import { formatPeople } from '@/lib/format';

type SocialCountsProps = {
  followers: number;
  following: number;
  onFollowers: () => void;
  onFollowing: () => void;
};

export function socialCountLabel(count: number, kind: 'followers' | 'following') {
  const value = formatPeople(count);
  if (kind === 'following') return `${value} seguindo`;
  return `${value} ${count === 1 ? 'seguidor' : 'seguidores'}`;
}

/** Contagens compactas do cabeçalho. O texto é pequeno; a área de toque não. */
export function SocialCounts({ followers, following, onFollowers, onFollowing }: SocialCountsProps) {
  return (
    <View style={styles.row}>
      <Count label={socialCountLabel(followers, 'followers')} hint="Abre a lista de seguidores" onPress={onFollowers} />
      <Count label={socialCountLabel(following, 'following')} hint="Abre a lista de quem este perfil segue" onPress={onFollowing} />
    </View>
  );
}

function Count({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [styles.hit, pressed && styles.pressed]}>
      <AppText variant="bodyStrong" numberOfLines={1}>{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  hit: {
    minHeight: 44,
    justifyContent: 'center',
    paddingRight: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});
