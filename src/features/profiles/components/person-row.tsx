import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Colors, Spacing } from '@/constants/theme';
import type { User } from '@/types/models';

import { FollowButton } from './follow-button';

type PersonRowProps = {
  user: User;
  subtitle: string;
  onOpen: () => void;
};

/** Pessoa em lista do Explorar: avatar, nome com selo, resumo e Seguir. */
export function PersonRow({ user, subtitle, onOpen }: PersonRowProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="link"
        accessibilityLabel={`${user.name}${user.badge ? `, ${user.badge}` : ''}, ${subtitle}`}
        accessibilityHint="Abre o perfil"
        style={({ pressed }) => [styles.open, pressed && styles.pressed]}>
        <Avatar initials={user.initials} tone={user.tone} size={44} userId={user.id} imageUrl={user.avatarUrl} />
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.name}>
              {user.name}
            </AppText>
            {user.badge ? <Badge label={user.badge} tone="red" /> : null}
          </View>
          <AppText variant="caption" numberOfLines={1}>
            {subtitle}
          </AppText>
        </View>
      </Pressable>
      <FollowButton user={user} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  open: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: 44,
  },
  pressed: {
    opacity: 0.7,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    flexShrink: 1,
  },
});
