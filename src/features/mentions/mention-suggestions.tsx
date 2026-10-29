import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Colors, Fonts, MinTouchTarget, Spacing } from '@/constants/theme';
import { toneFor } from '@/features/posts/api';
import { initialsOf } from '@/lib/format';
import { queryClient } from '@/lib/query/client';

import { searchMentionPeople, type MentionCandidate } from './api';

const DEBOUNCE_MS = 350;

/** Sugestões depois de `@`. A busca espera o debounce e no mínimo 3 caracteres. */
export function MentionSuggestions({ query, onSelect }: { query: string; onSelect: (person: MentionCandidate) => void }) {
  const [debounced, setDebounced] = useState<string | null>(null);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query]);

  const searchable = debounced !== null && debounced.length >= 3 && /[a-z0-9]{3}/i.test(debounced);
  const settled = debounced === query;
  const result = useQuery({
    queryKey: ['mention-suggestions', (debounced ?? '').toLocaleLowerCase()],
    enabled: searchable && settled,
    queryFn: ({ signal }) => searchMentionPeople(debounced ?? '', signal),
    staleTime: 15_000,
    gcTime: 60_000,
    retry: false,
  }, queryClient);

  return (
    <View style={styles.panel} accessibilityRole="list">
      {!searchable || !settled ? (
        <AppText style={styles.hint} color={Colors.inkSoft}>
          {query.length < 3 ? 'Digite pelo menos 3 letras' : 'Buscando pessoas…'}
        </AppText>
      ) : result.isPending ? (
        <View style={styles.hintRow}>
          <ActivityIndicator color={Colors.ink} />
          <AppText style={styles.hint} color={Colors.inkSoft}>Buscando pessoas…</AppText>
        </View>
      ) : result.isError ? (
        <AppText style={styles.hint} color={Colors.inkSoft}>Não conseguimos buscar agora.</AppText>
      ) : !result.data || result.data.length === 0 ? (
        <AppText style={styles.hint} color={Colors.inkSoft}>Nenhuma pessoa com esse nome.</AppText>
      ) : (
        result.data.map((person) => (
          <Pressable
            key={person.userId}
            accessibilityRole="button"
            accessibilityLabel={`${person.displayName}, @${person.handle}`}
            onPressIn={() => onSelect(person)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
            <Avatar initials={initialsOf(person.displayName)} tone={toneFor(person.userId)} size={32} userId={person.userId} imageUrl={person.avatarUrl} />
            <View style={styles.names}>
              <AppText style={styles.name} numberOfLines={1}>{person.displayName}</AppText>
              <AppText style={styles.handle} color={Colors.inkSoft} numberOfLines={1}>@{person.handle}</AppText>
            </View>
          </Pressable>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    maxHeight: 240,
    marginBottom: Spacing.two,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.paper,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    minHeight: MinTouchTarget,
  },
  hint: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 14,
    lineHeight: 20,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: MinTouchTarget,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.rule,
  },
  pressed: { backgroundColor: Colors.cream },
  names: { flex: 1, minWidth: 0 },
  name: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 20 },
  handle: { fontSize: 13, lineHeight: 18 },
});
