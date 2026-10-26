import { useSegments } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts } from '@/constants/theme';

/** Telas que, com a API configurada, mostram só dados reais (o feed marca os chamados à parte). */
function showsOnlyRealData(segments: string[]): boolean {
  const last = segments.at(-1) ?? '';
  const isFeed = segments.length === 2 && segments[0] === '(tabs)' && segments[1] === '(inicio)';
  return isFeed || last === 'criar' || segments.includes('comuna') || segments.includes('post');
}

/**
 * Selo discreto, só em desenvolvimento, lembrando quais telas ainda mostram dados fictícios.
 * Com a API configurada, some nas telas já migradas (feed, comuna, discussão, criar).
 */
export function MockDataNotice() {
  const insets = useSafeAreaInsets();
  const segments = useSegments() as string[];
  if (!__DEV__) return null;
  if (!DEMO_MODE && showsOnlyRealData(segments)) return null;
  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 2 }]} importantForAccessibility="no-hide-descendants">
      <AppText style={styles.text} color={Colors.red} maxFontSizeMultiplier={1}>
        DADOS FICTÍCIOS
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    right: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: Colors.red,
    borderRadius: 4,
    backgroundColor: Colors.paper,
    opacity: 0.85,
  },
  text: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 8.5,
    lineHeight: 11,
  },
});
