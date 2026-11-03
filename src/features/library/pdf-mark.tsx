import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Radius } from '@/constants/theme';

/**
 * Capa de PDF dos mockups: folha de papel, tarja vermelha com o formato e linhas de texto.
 * É decorativa; o título do documento continua sendo o texto acessível do cartão.
 */
export function PdfMark({ size = 'small', locked = false }: { size?: 'small' | 'large'; locked?: boolean }) {
  const large = size === 'large';
  return (
    <View
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      style={[styles.sheet, large ? styles.sheetLarge : styles.sheetSmall, locked && styles.sheetLocked]}>
      <View style={[styles.tab, large ? styles.tabLarge : styles.tabSmall, locked && styles.tabLocked]}>
        <AppText variant="label" color={Colors.paper} style={large ? styles.tabTextLarge : styles.tabTextSmall}>PDF</AppText>
      </View>
      <View style={[styles.body, large ? styles.bodyLarge : styles.bodySmall]}>
        {large ? <>
          <View style={[styles.line, styles.lineStrong, styles.lineStrongLarge]} />
          <View style={[styles.line, styles.lineLarge]} />
          <View style={[styles.line, styles.lineShort, styles.lineLarge]} />
          <View style={[styles.line, styles.lineLarge]} />
          <View style={[styles.line, styles.lineShort, styles.lineLarge]} />
        </> : <>
          <View style={styles.line} />
          <View style={[styles.line, styles.lineShort]} />
          <View style={[styles.line, styles.lineSmall]} />
          <View style={styles.line} />
        </>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  sheetSmall: {
    width: 56,
    height: 80,
  },
  sheetLarge: {
    width: 100,
    height: 124,
    transform: [{ rotate: '-3deg' }],
  },
  sheetLocked: {
    borderColor: Colors.inkSoft,
    opacity: 0.6,
  },
  tab: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    backgroundColor: Colors.red,
  },
  tabSmall: {
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLarge: {
    height: 26,
    paddingHorizontal: 10,
  },
  tabLocked: {
    backgroundColor: Colors.inkSoft,
  },
  tabTextSmall: {
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
  tabTextLarge: {
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
  },
  body: {
    gap: 4,
    padding: 6,
  },
  bodySmall: {
    padding: 7,
    gap: 5,
  },
  bodyLarge: {
    padding: 10,
    gap: 5,
  },
  line: {
    height: 4,
    width: '100%',
    backgroundColor: Colors.straw,
  },
  lineStrong: {
    height: 5,
    width: '72%',
    backgroundColor: Colors.ink,
  },
  lineFaint: {
    backgroundColor: Colors.strawLight,
  },
  lineShort: {
    width: '62%',
  },
  lineSmall: {
    width: '40%',
  },
  lineStrongLarge: {
    height: 7,
  },
  lineLarge: {
    height: 5,
  },
});
