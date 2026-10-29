import type { ReactNode } from 'react';
import { Linking, Text, type GestureResponderEvent, type TextStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts } from '@/constants/theme';
import { codePointRangeToUtf16 } from '@/features/mentions/text';
import { useNav } from '@/lib/routes';
import type { ContentMention } from '@/types/models';

const URL = /\b(?:https?:\/\/|www\.)[^\s<>]+/gi;
const TRAILING = /[),.!?:;]+$/;

type Mark = {
  start: number;
  end: number;
  label: string;
  mention?: ContentMention;
  href?: string;
  trailing?: string;
};

export function PostBody({
  text,
  mentions = [],
  style,
  numberOfLines,
  onMentionPress,
}: {
  text: string;
  mentions?: ContentMention[];
  style?: TextStyle;
  numberOfLines?: number;
  onMentionPress?: (userId: string) => void;
}) {
  const nav = useNav();
  const openMention = (userId: string) => (onMentionPress ? onMentionPress(userId) : nav.openProfile(userId));
  return <AppText style={style} numberOfLines={numberOfLines}>{renderPieces(text, mentions, openMention)}</AppText>;
}

function renderPieces(text: string, mentions: ContentMention[], openMention: (userId: string) => void): ReactNode[] {
  const marks: Mark[] = [];
  for (const mention of mentions) {
    const range = codePointRangeToUtf16(text, mention.start, mention.end);
    if (!range) continue;
    const label = text.slice(range.start, range.end);
    if (!label.startsWith('@')) continue;
    if (marks.some((mark) => range.start < mark.end && range.end > mark.start)) continue;
    marks.push({ start: range.start, end: range.end, label, mention });
  }
  for (const match of text.matchAll(new RegExp(URL.source, 'gi'))) {
    const index = match.index ?? 0;
    let label = match[0];
    const trailing = label.match(TRAILING)?.[0] ?? '';
    if (trailing) label = label.slice(0, -trailing.length);
    const end = index + match[0].length;
    if (marks.some((mark) => index < mark.end && end > mark.start)) continue;
    const href = label.startsWith('www.') ? `https://${label}` : label;
    marks.push({ start: index, end, label, href, trailing });
  }
  marks.sort((left, right) => left.start - right.start);

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
      if (mark.trailing) children.push(mark.trailing);
    }
    cursor = mark.end;
  }
  if (cursor < text.length) children.push(text.slice(cursor));
  return children;
}

const mentionStyle: TextStyle = { fontFamily: Fonts.bold, color: Colors.ink };
const linkStyle: TextStyle = { color: Colors.red, textDecorationLine: 'underline' };
