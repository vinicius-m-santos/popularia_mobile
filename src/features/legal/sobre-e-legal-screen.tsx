import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Image, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Kicker } from '@/components/kicker';
import { Screen } from '@/components/screen';
import { useToast } from '@/components/toast';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { LegalHardShadow, LegalPaint as P } from '@/features/legal/legal-theme';
import { openSupportMail, SUPPORT_EMAIL } from '@/features/legal/support';
import { goBack } from '@/lib/routes';

type LegalDocument = {
  id: 'regras' | 'termos' | 'privacidade';
  title: string;
  description: string;
  icon: IconName;
  accent: 'red' | 'ink';
};

const DOCUMENTS: LegalDocument[] = [
  { id: 'regras', title: 'Regras da Comunidade', description: 'Convivência, denúncias e moderação', icon: 'shield', accent: 'red' },
  { id: 'termos', title: 'Termos de Uso', description: 'Uso do aplicativo e do seu conteúdo', icon: 'document', accent: 'ink' },
  { id: 'privacidade', title: 'Política de Privacidade', description: 'Dados, sessões e visibilidade', icon: 'lock', accent: 'ink' },
];

/**
 * "Sobre e legal": documentos da comunidade e ajuda básica.
 * Abre do login e do cadastro (sem sessão) e também da Conta, então não depende de conta.
 */
export function SobreELegalScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  // A versão vem do build (app.json), não de uma constante da tela.
  const version = Constants.expoConfig?.version ?? '1.0.0';

  const openSupport = () => {
    void openSupportMail('Ajuda para entrar').then((opened) => {
      if (!opened) toast.show('Não foi possível abrir o aplicativo de e-mail.');
    });
  };

  return (
    <Screen edges={['left', 'right']} backgroundColor={P.bg}>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Math.max(insets.top + 10, 54), paddingBottom: Math.max(insets.bottom + 12, 28) },
        ]}>
        <View style={styles.backRow}>
          <IconButton icon="back" size={22} accessibilityLabel="Voltar" onPress={goBack} color={P.ink} />
        </View>

        <AppText style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          Sobre e legal
        </AppText>
        <AppText style={styles.subtitle}>O combinado entre a gente, escrito com todas as letras.</AppText>

        <View style={styles.documentsKicker}>
          <Kicker label="Documentos" color={P.ink} squareColor={P.red} textStyle={styles.kickerText} />
        </View>
        <View style={styles.cards}>
          {DOCUMENTS.map((doc) => (
            <Pressable
              key={doc.id}
              accessibilityRole="button"
              accessibilityLabel={`${doc.title}, ${doc.description}`}
              onPress={() => router.push({ pathname: '/documento-legal/[id]', params: { id: doc.id } } as never)}
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
              <View style={[styles.cardIcon, doc.accent === 'red' ? styles.cardIconRed : styles.cardIconInk]}>
                <Icon name={doc.icon} size={22} color={P.surface} />
              </View>
              <View style={styles.cardCopy}>
                <AppText style={styles.cardTitle}>{doc.title}</AppText>
                <AppText style={styles.cardDescription}>{doc.description}</AppText>
              </View>
              <Icon name="chevronRight" size={18} color={P.ink} />
            </Pressable>
          ))}
        </View>

        <View style={styles.helpKicker}>
          <Kicker label="Ajuda" color={P.ink} squareColor={P.red} textStyle={styles.kickerText} />
        </View>
        <View style={styles.helpList}>
          <HelpRow
            title="Não consegue entrar?"
            subtitle={SUPPORT_EMAIL}
            icon="external"
            role="link"
            onPress={openSupport}
          />
          <HelpRow
            title="Licenças de código aberto"
            subtitle="Bibliotecas e fontes que usamos"
            icon="chevronRight"
            role="button"
            onPress={() => router.push('/licencas')}
          />
        </View>

        <View style={styles.footer}>
          <View style={styles.symbolClip}>
            <Image
              fadeDuration={0}
              source={require('@/assets/branding/popularia-symbol.png')}
              style={styles.symbol}
              resizeMode="contain"
              accessible={false}
            />
          </View>
          <View style={styles.footerCopy}>
            <AppText style={styles.footerBrand}>Popularia · um lugar nosso</AppText>
            <AppText style={styles.footerVersion}>Versão {version} · Primeiro beta</AppText>
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

function HelpRow({ title, subtitle, icon, role, onPress }: {
  title: string;
  subtitle: string;
  icon: IconName;
  role: 'button' | 'link';
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={`${title}, ${subtitle}`}
      onPress={onPress}
      style={({ pressed }) => [styles.helpRow, pressed && styles.helpRowPressed]}>
      <View style={styles.helpCopy}>
        <AppText style={styles.helpTitle}>{title}</AppText>
        <AppText style={styles.helpSubtitle}>{subtitle}</AppText>
      </View>
      <Icon name={icon} size={18} color={P.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  backRow: {
    flexDirection: 'row',
    // O alvo de 44 tem folga interna; a margem negativa alinha o chevron à guia de 24.
    marginLeft: -10,
  },
  title: {
    marginTop: 12,
    paddingTop: 4,
    fontFamily: Fonts.anton,
    fontSize: 52,
    lineHeight: 60,
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
  documentsKicker: {
    marginTop: 22,
  },
  cards: {
    marginTop: 12,
    gap: 10,
  },
  card: {
    minHeight: 76,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 6,
    backgroundColor: P.surface,
  },
  cardPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    boxShadow: LegalHardShadow,
  },
  cardIcon: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 4,
  },
  cardIconRed: {
    backgroundColor: P.red,
  },
  cardIconInk: {
    backgroundColor: P.ink,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  cardTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 17,
    lineHeight: 25,
    color: P.ink,
  },
  cardDescription: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: P.secondary,
  },
  helpKicker: {
    marginTop: 26,
  },
  helpList: {
    marginTop: 12,
    borderTopWidth: 2,
    borderTopColor: P.ink,
  },
  helpRow: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 7,
    borderBottomWidth: 2,
    borderStyle: 'dashed',
    borderBottomColor: P.ink,
  },
  helpRowPressed: {
    opacity: 0.65,
  },
  helpCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  helpTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
    color: P.ink,
  },
  helpSubtitle: {
    fontFamily: Fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    color: P.secondary,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  // O PNG da marca tem margem transparente; o recorte entrega o símbolo em 40×37.
  symbolClip: {
    width: 40,
    height: 37,
    overflow: 'hidden',
  },
  symbol: {
    width: 48,
    height: 48,
    marginLeft: -3.5,
    marginTop: -6.1,
  },
  footerCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  footerBrand: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 19,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: P.ink,
  },
  footerVersion: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 19,
    letterSpacing: 0.66,
    textTransform: 'uppercase',
    color: P.secondary,
  },
});
