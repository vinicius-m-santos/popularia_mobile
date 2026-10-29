import { StyleSheet, View } from 'react-native';
import { Colors, Spacing } from '@/constants/theme';

/** Blocos estáticos: sem shimmer, timers ou animação durante o scroll. */
export function PopulariaListSkeleton({ rows = 3, variant = 'post' }: { rows?: number; variant?: 'post' | 'row' }) {
  return <View accessible accessibilityLabel="Carregando conteúdo" accessibilityState={{ busy: true }}>
    {Array.from({ length: rows }, (_, index) => <View key={index} style={[styles.row, variant === 'post' && styles.post]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <View style={styles.author}><View style={styles.avatar} /><View style={[styles.line, styles.name]} /></View>
      <View style={styles.line} /><View style={[styles.line, styles.short]} />
      {variant === 'post' ? <View style={[styles.line, styles.actions]} /> : null}
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  row: { padding: Spacing.five, gap: 12, borderBottomWidth: 1, borderColor: Colors.rule },
  post: { minHeight: 230 },
  author: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.straw },
  line: { height: 16, backgroundColor: Colors.straw, borderRadius: 2 },
  name: { width: '45%' }, short: { width: '75%' }, actions: { width: '55%', marginTop: 24 },
});
