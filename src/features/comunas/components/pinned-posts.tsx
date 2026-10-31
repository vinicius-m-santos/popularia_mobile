import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { SectionHeading } from '@/components/section-heading';
import { Colors, Spacing } from '@/constants/theme';
import type { FeedItem } from '@/types/models';

type PinnedPostsProps = {
  items: FeedItem[];
  /** loading não ocupa a página: a seção só aparece quando há o que mostrar ou quando a leitura falhou. */
  status?: 'loading' | 'success' | 'error';
  canReorder?: boolean;
  pending?: boolean;
  onRetry?: () => void;
  onOpen: (postId: string) => void;
  onMove?: (postId: string, position: number) => void;
};

function excerpt(item: FeedItem): string {
  const text = item.text.replace(/\s+/g, ' ').trim();
  if (text) return text;
  if (item.poll?.question) return item.poll.question;
  if (item.document?.title) return item.document.title;
  if (item.attachment) return 'Publicação com mídia';
  return 'Publicação';
}

function indexLabel(index: number): string {
  return String(index + 1).padStart(2, '0');
}

/** Faixa editorial no topo da comuna. No máximo três publicações, na ordem recebida. */
export function PinnedPosts({ items, status = 'success', canReorder = false, pending = false, onRetry, onOpen, onMove }: PinnedPostsProps) {
  if (status === 'error' && items.length === 0) {
    return (
      <View style={styles.section}>
        <SectionHeading appearance="editorial" label="Fixados" />
        <Pressable accessibilityRole="button" accessibilityLabel="Não conseguimos carregar as publicações fixadas. Tentar de novo" onPress={onRetry} style={styles.errorRow}>
          <AppText variant="caption">Não conseguimos carregar as publicações fixadas.</AppText>
        </Pressable>
      </View>
    );
  }
  if (items.length === 0) return null;

  const reorder = canReorder && items.length > 1 && onMove;
  return (
    <View style={styles.section}>
      <SectionHeading appearance="editorial" label="Fixados" />
      <View style={styles.list} accessibilityRole="list">
        {items.map((item, index) => {
          const label = indexLabel(index);
          const summary = excerpt(item);
          const detail = item.attachment ? `${item.author.name} · com mídia` : item.author.name;
          return (
            <View key={item.id} style={[styles.entry, index > 0 && styles.entryRule]} accessibilityRole="none">
              <View style={styles.meta}>
                <AppText variant="label">{`Fixado ${label}`}</AppText>
                {reorder ? (
                  <View style={styles.moves}>
                    {index > 0 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Mover fixado ${label} para cima`}
                        accessibilityState={{ disabled: pending }}
                        disabled={pending}
                        onPress={() => onMove(item.id, index)}
                        style={styles.move}>
                        <AppText variant="label">Subir</AppText>
                      </Pressable>
                    ) : null}
                    {index < items.length - 1 ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Mover fixado ${label} para baixo`}
                        accessibilityState={{ disabled: pending }}
                        disabled={pending}
                        onPress={() => onMove(item.id, index + 2)}
                        style={styles.move}>
                        <AppText variant="label">Descer</AppText>
                      </Pressable>
                    ) : null}
                  </View>
                ) : null}
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Fixado ${label}. ${summary}. ${detail}`}
                accessibilityHint="Abre a publicação"
                onPress={() => onOpen(item.id)}
                style={styles.body}>
                <AppText numberOfLines={2}>{summary}</AppText>
                <AppText variant="caption" numberOfLines={1}>{detail}</AppText>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginHorizontal: Spacing.five,
    marginTop: Spacing.four,
    marginBottom: Spacing.two,
    gap: Spacing.three,
  },
  list: {
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    backgroundColor: Colors.paper,
  },
  entry: {
    backgroundColor: Colors.paper,
  },
  entryRule: {
    borderTopWidth: 1,
    borderTopColor: Colors.rule,
  },
  meta: {
    minHeight: 40,
    paddingLeft: Spacing.three,
    paddingRight: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  moves: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  move: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    minHeight: 44,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: 4,
  },
  errorRow: {
    minHeight: 44,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    backgroundColor: Colors.paper,
    paddingHorizontal: Spacing.three,
  },
});
