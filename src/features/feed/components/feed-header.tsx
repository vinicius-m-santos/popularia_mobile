import { router } from 'expo-router';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { UnderlineTabs, type TabOption } from '@/components/underline-tabs';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import type { FeedTab } from '@/types/models';

const TABS: TabOption<FeedTab>[] = [
  { key: 'para-voce', label: 'Para você' },
  { key: 'minhas', label: 'Minhas comunas' },
  { key: 'perto', label: 'Perto de mim' },
];

type FeedHeaderProps = {
  tab: FeedTab;
  onTabChange: (tab: FeedTab) => void;
};

/** Cabeçalho fixo do feed: marca, busca e abas (design 1a). */
export function FeedHeader({ tab, onTabChange }: FeedHeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.top}>
        <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="Popularia">
            <Image source={require('@/assets/branding/popularia-symbol.png')} style={styles.logo} accessible={false} />
          <AppText style={styles.wordmark} maxFontSizeMultiplier={1.2}>
            POPULARIA
          </AppText>
        </View>
        <IconButton icon="search" accessibilityLabel="Buscar" onPress={() => router.navigate('/explorar')} />
      </View>
      <UnderlineTabs options={TABS} value={tab} onChange={onTabChange} />
    </View>
  );
}

const styles = StyleSheet.create({
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
  },
  wordmark: {
    fontFamily: Fonts.condensed,
    fontSize: 27,
    lineHeight: 30,
  },
});
