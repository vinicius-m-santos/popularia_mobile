import type { ReactNode } from 'react';
import { Linking, Text, type GestureResponderEvent, type TextStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts } from '@/constants/theme';
import { tokenizePostText } from '@/features/hashtags/text';
import { useNav } from '@/lib/routes';
import type { ContentMention } from '@/types/models';

export function PostBody({
  text,
  mentions = [],
  style,
  numberOfLines,
  onMentionPress,
  hashtagsEnabled = true,
}: {
  text: string;
  mentions?: ContentMention[];
  style?: TextStyle;
  numberOfLines?: number;
  onMentionPress?: (userId: string) => void;
  hashtagsEnabled?: boolean;
}) {
  const nav = useNav();
  const openMention = (userId: string) => (onMentionPress ? onMentionPress(userId) : nav.openProfile(userId));
  return <AppText style={style} numberOfLines={numberOfLines}>{renderPieces(text, mentions, openMention, nav.openHashtag, hashtagsEnabled)}</AppText>;
}

function renderPieces(text: string, mentions: ContentMention[], openMention: (userId: string) => void, openHashtag: (slug: string) => void, hashtagsEnabled: boolean): ReactNode[] {
  const marks = tokenizePostText(text, mentions, hashtagsEnabled);
  const children: ReactNode[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start < cursor) continue;
    if (mark.start > cursor) children.push(text.slice(cursor, mark.start));
    if (mark.mention) {
      const mention = mark.mention;
      children.push(
        <Text
          key={`mention-${mark.start}`}
          accessibilityRole="link"
          accessibilityLabel={`Menção a ${mention.displayName}, @${mention.handle}`}
          maxFontSizeMultiplier={1.8}
          suppressHighlighting={false}
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation();
            openMention(mention.userId);
          }}
          style={mentionStyle}>
          {mark.label}
        </Text>,
      );
    } else if (mark.hashtag) {
      children.push(<AppText key={`hashtag-${mark.start}`} accessibilityRole="link" accessibilityLabel={`Abrir tópico ${mark.label.slice(1)}`} style={linkStyle} onPress={(event: GestureResponderEvent) => {
        event.stopPropagation();
        openHashtag(mark.hashtag!);
      }}>{mark.label}</AppText>);
    } else {
      children.push(
        <AppText
          key={`link-${mark.start}`}
          accessibilityRole="link"
          style={linkStyle}
          onPress={(event: GestureResponderEvent) => {
            event.stopPropagation();
            if (mark.href) Linking.openURL(mark.href).catch(() => {});
          }}>
          {mark.label}
        </AppText>,
      );
    }
    cursor = mark.end;
  }
  if (cursor < text.length) children.push(text.slice(cursor));
  return children;
}

const mentionStyle: TextStyle = { fontFamily: Fonts.bold, color: Colors.ink };
const linkStyle: TextStyle = { color: Colors.red, textDecorationLine: 'underline' };
