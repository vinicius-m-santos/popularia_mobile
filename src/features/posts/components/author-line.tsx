import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Colors, Fonts, Spacing } from '@/constants/theme';
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
  /** No cartão de publicação a identidade é um selo quadrado, como no mock do feed. */
  appearance?: 'default' | 'card';
};

export function AuthorLine({ author, meta, avatarSize = 40, trailing, onPress, appearance = 'default' }: AuthorLineProps) {
  const card = appearance === 'card';
  const size = card ? 42 : avatarSize;
  return (
    <View style={[styles.row, card && styles.rowCard]}>
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole={onPress ? 'link' : undefined}
        accessibilityHint={onPress ? 'Abre o perfil' : undefined}
        style={[styles.identity, card && styles.identityCard]}
        accessible
        accessibilityLabel={`${author.name}${author.badge ? `, ${author.badge}` : ''}, @${author.handle}${meta ? `, ${meta}` : ''}`}>
        <Avatar
          initials={author.initials}
          tone={author.tone}
          size={size}
          userId={author.id}
          imageUrl={author.avatarUrl}
          shape={card ? 'square' : 'circle'}
          outline={card}
          font={card ? 'anton' : 'condensed'}
        />
        <View style={styles.text}>
          <View style={styles.nameRow}>
            <AppText style={[styles.name, card && styles.nameCard]}>{author.name}</AppText>
            {author.badge ? <Badge label={author.badge} /> : null}
          </View>
          <AppText variant="caption" style={card ? styles.metaCard : undefined} numberOfLines={1}>
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
  rowCard: {
    minHeight: 44,
    gap: Spacing.three,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  identityCard: {
    gap: Spacing.three,
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
  name: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 20,
    color: Colors.ink,
  },
  nameCard: {
    fontFamily: Fonts.extrabold,
    fontSize: 15,
    lineHeight: 18,
  },
  metaCard: {
    fontSize: 13,
    lineHeight: 17,
  },
});
