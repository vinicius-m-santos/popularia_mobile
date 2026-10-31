import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { PopulariaList } from '@/components/list/popularia-list';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { Spacing } from '@/constants/theme';
import { EventBar } from '@/features/events/chrome';
import { useCachedPages } from '@/hooks/use-cached-pages';
import { ApiError } from '@/lib/errors';
import { contentPolicy } from '@/lib/query/client';
import { useNav, type RelationKind } from '@/lib/routes';
import type { User } from '@/types/models';

import { getRelationPage } from './api';
import { PersonRow } from './components/person-row';

const COPY: Record<RelationKind, { title: string; emptyTitle: string; empty: string }> = {
  seguidores: { title: 'Seguidores', emptyTitle: 'Ninguém por aqui', empty: 'Ninguém segue este perfil ainda.' },
  seguindo: { title: 'Seguindo', emptyTitle: 'Lista vazia', empty: 'Este perfil ainda não segue ninguém.' },
};

/** Lista paginada de seguidores ou de seguindo, na pilha da aba atual. */
export default function RelationsScreen() {
  const params = useLocalSearchParams<{ id?: string; kind?: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const rawKind = Array.isArray(params.kind) ? params.kind[0] : params.kind;
  const kind: RelationKind = rawKind === 'seguindo' ? 'seguindo' : 'seguidores';
  const nav = useNav();
  const load = useCallback((cursor: string | null, signal: AbortSignal) => {
    if (!id) return Promise.resolve({ items: [] as User[], nextCursor: null });
    return getRelationPage(kind, id, cursor, signal);
  }, [id, kind]);
  const list = useCachedPages({ queryKey: ['relations', kind, id ?? ''], load, ...contentPolicy.profile, enabled: !!id });
  const copy = COPY[kind];
  const privateList = list.error instanceof ApiError && list.error.type === '/errors/follow-list-private';

  return (
    <Screen>
      <EventBar title={copy.title} />
      {privateList ? (
        <StateView kind="empty" title="Lista privada" message="Só a própria pessoa e seguidores aprovados veem seguidores e seguindo deste perfil." />
      ) : (
        <PopulariaList
          state={list}
          data={list.items}
          keyExtractor={(user) => user.id}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <PersonRow user={item} subtitle={`@${item.handle}`} onOpen={() => nav.openProfile(item.id)} />
            </View>
          )}
          emptyTitle={copy.emptyTitle}
          emptyMessage={copy.empty}
          contentContainerStyle={styles.list}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.seven,
  },
  row: {
    maxWidth: 640,
    width: '100%',
    alignSelf: 'center',
  },
});
