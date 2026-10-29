import { Linking, type GestureResponderEvent, type TextStyle } from 'react-native';
import type { ReactNode } from 'react';

import { AppText } from '@/components/app-text';
import { Colors } from '@/constants/theme';

const URL = /\b(?:https?:\/\/|www\.)[^\s<>]+/gi;
const TRAILING = /[),.!?:;]+$/;

export function PostBody({ text, style, numberOfLines }: { text: string; style?: TextStyle; numberOfLines?: number }) {
  const children: ReactNode[] = [];
  let cursor = 0;
  for (const match of text.matchAll(URL)) {
    const index = match.index ?? 0;
    let label = match[0];
    const trailing = label.match(TRAILING)?.[0] ?? '';
    if (trailing) label = label.slice(0, -trailing.length);
    if (index > cursor) children.push(text.slice(cursor, index));
    const href = label.startsWith('www.') ? `https://${label}` : label;
    children.push(<AppText key={`${index}-${label}`} accessibilityRole="link" style={{ color: Colors.red, textDecorationLine: 'underline' }} onPress={(event: GestureResponderEvent) => { event.stopPropagation(); Linking.openURL(href).catch(() => {}); }}>{label}</AppText>);
    if (trailing) children.push(trailing);
    cursor = index + match[0].length;
  }
  if (cursor < text.length) children.push(text.slice(cursor));
  return <AppText style={style} numberOfLines={numberOfLines}>{children}</AppText>;
}
