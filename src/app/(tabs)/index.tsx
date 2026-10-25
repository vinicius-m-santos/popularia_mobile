import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { Colors, Spacing } from '@/constants/theme';
import { getFeed } from '@/features/feed/api';
import { PostCard } from '@/features/feed/components/post-card';
import { useAsyncData } from '@/hooks/use-async-data';

export default function FeedScreen() {
  const feed = useAsyncData(getFeed);

  if (feed.status === 'loading' && !feed.data) {
    return (
      <Screen>
        <StateView kind="loading" message="Carregando o feed" />
      </Screen>
    );
  }

  if (feed.status === 'error' && !feed.data) {
    return (
      <Screen>
        <StateView
          kind="error"
          message="Não conseguimos carregar o feed. Verifique sua conexão."
          onRetry={feed.reload}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <FlatList
        data={feed.data ?? []}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <PostCard item={item} showRule={index > 0} />}
        ListHeaderComponent={<Masthead />}
        ListEmptyComponent={
          <StateView kind="empty" title="Nada por aqui" message="Participe de comunas para ver publicações." />
        }
        refreshControl={
          <RefreshControl
            refreshing={feed.status === 'loading'}
            onRefresh={feed.reload}
            tintColor={Colors.red}
            colors={[Colors.red]}
          />
        }
        contentContainerStyle={styles.list}
      />
    </Screen>
  );
}

function Masthead() {
  return (
    <View style={styles.masthead}>
      <AppText variant="display" accessibilityRole="header">
        Popularia
      </AppText>
      <View style={styles.mastheadRule} />
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    paddingBottom: Spacing.six,
  },
  masthead: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    gap: Spacing.two,
  },
  mastheadRule: {
    height: 3,
    backgroundColor: Colors.ink,
  },
});
