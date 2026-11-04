import { SectionList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { Kicker } from '@/components/kicker';
import { Screen } from '@/components/screen';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { FONT_LICENSES, LIBRARY_LICENSES, type LicenseEntry } from '@/features/legal/licenses.generated';
import { LegalPaint as P } from '@/features/legal/legal-theme';
import { goBack } from '@/lib/routes';

const SECTIONS: { title: string; data: LicenseEntry[] }[] = [
  { title: 'Fontes', data: FONT_LICENSES },
  { title: `Bibliotecas · ${LIBRARY_LICENSES.length}`, data: LIBRARY_LICENSES },
];

/**
 * Lista de licenças das bibliotecas e fontes usadas no app.
 * O conteúdo é gerado por `npm run licenses`, não escrito à mão.
 */
export function LicensesScreen() {
  const insets = useSafeAreaInsets();
  return (
    <Screen edges={['left', 'right']} backgroundColor={P.bg}>
      <View style={[styles.topBar, { paddingTop: Math.max(insets.top + 10, 54) }]}>
        <IconButton icon="back" size={22} accessibilityLabel="Voltar" onPress={goBack} color={P.ink} />
      </View>
      <SectionList
        sections={SECTIONS}
        keyExtractor={(item) => item.name}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom + 12, 28) }]}
        ListHeaderComponent={
          <View>
            <AppText style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
              Licenças de código aberto
            </AppText>
            <AppText style={styles.subtitle}>Bibliotecas e fontes que usamos, com a licença de cada uma.</AppText>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Kicker label={section.title} color={P.ink} squareColor={P.red} textStyle={styles.kickerText} />
          </View>
        )}
        renderItem={({ item }) => <LicenseRow entry={item} />}
        ListFooterComponent={
          <AppText style={styles.note}>
            Lista gerada a partir das dependências diretas do app. O texto completo de cada licença acompanha o pacote original.
          </AppText>
        }
      />
    </Screen>
  );
}

function LicenseRow({ entry }: { entry: LicenseEntry }) {
  return (
    <View style={styles.row}>
      <AppText style={styles.name}>{entry.name}</AppText>
      <AppText style={styles.meta}>{entry.version ? `${entry.version} · ${entry.license}` : entry.license}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    paddingHorizontal: 14,
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 12,
    paddingTop: 4,
    fontFamily: Fonts.anton,
    fontSize: 40,
    // Título em duas linhas com cedilha ("LICENÇAS"): o leading precisa passar de 1.3
    // para o descendente não encostar na linha de baixo.
    lineHeight: 54,
    textTransform: 'uppercase',
    color: P.ink,
  },
  subtitle: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 23,
    color: P.subtitle,
  },
  kickerText: {
    fontSize: 12,
    lineHeight: 20,
    letterSpacing: 1.2,
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 8,
  },
  row: {
    paddingVertical: 10,
    gap: 1,
    borderBottomWidth: 1,
    borderBottomColor: P.rule,
  },
  name: {
    fontFamily: Fonts.extrabold,
    fontSize: 15,
    lineHeight: 23,
    color: P.ink,
  },
  meta: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: P.secondary,
  },
  note: {
    marginTop: 24,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: P.secondary,
  },
});
