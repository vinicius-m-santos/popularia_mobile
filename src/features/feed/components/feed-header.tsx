import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { UnderlineTabs, type TabOption } from '@/components/underline-tabs';
import { useUnreadCount } from '@/features/notifications/use-unread-count';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import type { FeedTab } from '@/types/models';

const TABS: TabOption<FeedTab>[] = [
  { key: 'para-voce', label: 'Para você' },
  { key: 'seguindo', label: 'Seguindo' },
  { key: 'minhas', label: 'Minhas comunas' },
  { key: 'perto', label: 'Perto de mim' },
];

type FeedHeaderProps = {
  tab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
};

/** Cabeçalho fixo do feed: marca, avisos e abas (design 1a). */
export function FeedHeader({ tab, onTabChange }: FeedHeaderProps) {
  const unread = useUnreadCount();
  return (
    <View style={styles.header}>
      <View style={styles.top}>
        <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="Popularia">
            <Image source={require('@/assets/branding/popularia-symbol.png')} style={styles.logo} accessible={false} />
          <AppText style={styles.wordmark} maxFontSizeMultiplier={1.2}>
            POPULARIA
          </AppText>
        </View>
        <View>
          <IconButton icon="bell" accessibilityLabel={`Avisos${unread ? `, ${unread} não lidos` : ''}`} onPress={() => router.push('/avisos')} />
          {unread > 0 ? <View style={styles.unread} pointerEvents="none"><AppText style={styles.unreadText} color={Colors.paper}>{unread > 99 ? '99+' : unread}</AppText></View> : null}
        </View>
      </View>
      <UnderlineTabs options={TABS} value={tab} onChange={onTabChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  unread: { position: 'absolute', top: 0, right: 0, minWidth: 18, borderRadius: 10, paddingHorizontal: 4, backgroundColor: Colors.red, alignItems: 'center' },
  unreadText: { fontSize: 10, lineHeight: 16 },
  header: {
    backgroundColor: Colors.cream,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: Spacing.five,
    paddingRight: 14,
    paddingVertical: 6,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logo: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
    transform: [{ translateY: -2 }],
  },
  wordmark: {
    fontFamily: Fonts.condensed,
    fontSize: 27,
    lineHeight: 30,
  },
});
