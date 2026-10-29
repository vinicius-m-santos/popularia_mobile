import { FlashList, type FlashListProps, type FlashListRef } from '@shopify/flash-list';
import { createElement, isValidElement, type ReactElement, type Ref } from 'react';
import { ActivityIndicator, RefreshControl, StyleSheet, View } from 'react-native';

import { StateView } from '@/components/state-view';
import { Colors, Spacing } from '@/constants/theme';
import { PopulariaListSkeleton } from './popularia-list-skeleton';

export type ListState = {
  status: 'loading' | 'success' | 'error';
  hasMore: boolean;
  loadingMore: boolean;
  loadMoreError: Error | null;
  isRefreshing: boolean;
  refreshError: Error | null;
  refresh: () => void;
  loadMore: () => void;
};

type Props<T> = FlashListProps<T> & {
  ref?: Ref<FlashListRef<T>>;
  state?: ListState;
  emptyTitle?: string;
  emptyMessage?: string;
  loadingComponent?: ReactElement;
};

/** Defaults editoriais; a API da FlashList continua disponível para cada tela. */
export function PopulariaList<T>({ state, emptyTitle = 'Nada por aqui', emptyMessage,
  loadingComponent, ListEmptyComponent, ListFooterComponent, ...props }: Props<T>) {
  const empty = !props.data?.length;
  const footer = isValidElement(ListFooterComponent) ? ListFooterComponent : ListFooterComponent ? createElement(ListFooterComponent) : null;
  return <FlashList
    contentInsetAdjustmentBehavior="never"
    automaticallyAdjustContentInsets={false}
    automaticallyAdjustsScrollIndicatorInsets={false}
    keyboardShouldPersistTaps="handled"
    keyboardDismissMode="on-drag"
    onEndReachedThreshold={0.4}
    onEndReached={state?.hasMore && !state.loadingMore && !state.loadMoreError && !state.isRefreshing ? state.loadMore : undefined}
    refreshControl={state ? <RefreshControl refreshing={state.isRefreshing} onRefresh={state.refresh} tintColor={Colors.red} colors={[Colors.red]} /> : undefined}
    {...props}
    ListEmptyComponent={ListEmptyComponent ?? (empty && state?.status === 'loading'
      ? loadingComponent ?? <PopulariaListSkeleton />
      : state?.status === 'error'
        ? <PopulariaListError onRetry={state.refresh} />
        : <PopulariaListEmpty title={emptyTitle} message={emptyMessage} />)}
    ListFooterComponent={<>
      {state?.refreshError && !empty ? <PopulariaListError message="Não foi possível atualizar. O conteúdo anterior continua disponível." onRetry={state.refresh} /> : null}
      {state?.loadMoreError ? <PopulariaListError message="Não foi possível carregar mais itens." onRetry={state.loadMore} /> : state?.loadingMore ? <View style={styles.footer}><ActivityIndicator color={Colors.red} accessibilityLabel="Carregando mais itens" /></View> : null}
      {footer}
    </>}
  />;
}

export function PopulariaListEmpty({ title, message }: { title: string; message?: string }) {
  return <StateView kind="empty" title={title} message={message} />;
}

export function PopulariaListError({ message = 'Não foi possível carregar. Tente novamente.', onRetry }: { message?: string; onRetry: () => void }) {
  return <StateView kind="error" message={message} onRetry={onRetry} />;
}

const styles = StyleSheet.create({ footer: { padding: Spacing.five } });
