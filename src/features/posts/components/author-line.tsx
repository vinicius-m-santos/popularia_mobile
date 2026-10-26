import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Spacing } from '@/constants/theme';
import type { User } from '@/types/models';

type AuthorLineProps = {
  author: User;
  /** Texto depois do @handle, como "2 h". */
  meta?: string;
  avatarSize?: number;
  /** Botão à direita (⋯ ou Seguir). */
  trailing?: ReactNode;
  /** Abre o perfil da pessoa. */
  onPress?: () => void;
};

export function AuthorLine({ author, meta, avatarSize = 40, trailing, onPress }: AuthorLineProps) {
  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'link' : undefined}
        accessibilityHint={onPress ? 'Abre o perfil' : undefined}
        style={styles.identity}
        accessible
        accessibilityLabel={`${author.name}${author.badge ? `, ${author.badge}` : ''}, @${author.handle}${meta ? `, ${meta}` : ''}`}>
        <Avatar initials={author.initials} tone={author.tone} size={avatarSize} />
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <AppText variant="bodyStrong">{author.name}</AppText>
            {author.badge ? <Badge label={author.badge} /> : null}
          </View>
          <AppText variant="caption" numberOfLines={1}>
            @{author.handle}
            {meta ? ` · ${meta}` : ''}
          </AppText>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
});
