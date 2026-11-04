import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { Image, Pressable, StyleSheet, Text, useWindowDimensions, View, type ImageStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';

const WELCOME = {
  red: '#BF3326',
  paper: '#FBF7EF',
  ink: '#15120F',
  buttonText: '#F2EADB',
  shadow: '#F2EADB',
} as const;

const POINTS = [
  'Entre em comunas do seu bairro, do seu trabalho e do que você gosta',
  'Convoque e confirme chamados, do mutirão à assembleia',
  'Converse, se organize e construa junto',
];

/** Boas-vindas (referência 390×844): cartaz editorial, sem rolagem. */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { startSignup } = useAccount();

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  const compact = height < 820;
  const veryCompact = height < 700;
  const baseTitle = veryCompact ? 54 : compact ? 60 : 68;
  const titleSize = Math.min(baseTitle, Math.round(width * 0.185));
  // Anton tem o topo do desenho acima da caixa da linha; o piso de +8 e o
  // padding impedem o corte que acontecia com line-height apertado.
  const titleLineHeight = titleSize + 14;
  const raysHeight = Math.round((width * 240) / 390);
  const top = compact ? Math.max(insets.top + 8, 44) : Math.max(insets.top + 11, 58);
  const bottom = compact ? Math.max(insets.bottom, 18) : Math.max(insets.bottom, 30);

  const signup = () => {
    startSignup();
    router.push({ pathname: '/boas-vindas/conta', params: { modo: 'cadastro' } });
  };
  const login = () => router.push({ pathname: '/boas-vindas/conta', params: { modo: 'entrar' } });
  const legal = (id: 'termos' | 'privacidade') => router.push({ pathname: '/documento-legal/[id]', params: { id } } as never);

  return (
    <View style={styles.root}>
      <Image
        fadeDuration={0}
        source={require('@/assets/onboarding/raios-topo.png')}
        style={[styles.rays, { width, height: raysHeight }]}
        resizeMode="stretch"
        accessible={false}
        pointerEvents="none"
        importantForAccessibility="no-hide-descendants"
      />
      <View style={[styles.content, { paddingTop: top, paddingBottom: bottom }]}>
        <View style={[styles.brand, compact && styles.brandCompact]} accessible accessibilityRole="image" accessibilityLabel="Popularia">
          <Image fadeDuration={0} source={require('@/assets/branding/logo-creme.png')} style={styles.logo} resizeMode="contain" accessible={false} />
        </View>

        <View style={[styles.middle, compact && styles.middleCompact]}>
          <View style={styles.kickerRow}>
            <View style={styles.kicker}>
              <View style={styles.kickerSquare} />
              <Text style={styles.kickerText} maxFontSizeMultiplier={1.2}>UM LUGAR NOSSO</Text>
            </View>
            <View style={styles.stampOuter} accessible={false} importantForAccessibility="no-hide-descendants">
              <View style={styles.stampInner}>
                <Text style={styles.stampText} maxFontSizeMultiplier={1.2}>PRIMEIRO BETA</Text>
              </View>
            </View>
          </View>

          <AppText
            style={[styles.title, { fontSize: titleSize, lineHeight: titleLineHeight }, compact && styles.titleCompact]}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.1}>
            A REDE É{'\n'}DE QUEM{'\n'}PARTICIPA.
          </AppText>

          <View style={[styles.points, compact && styles.pointsCompact]}>
            {POINTS.map((point, index) => (
              <View key={point} style={[styles.point, compact && styles.pointCompact]}>
                <Text style={styles.pointNumber} maxFontSizeMultiplier={1.2}>{String(index + 1).padStart(2, '0')}</Text>
                <Text style={[styles.pointText, compact && styles.pointTextCompact]} maxFontSizeMultiplier={1.2}>{point}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.actions, compact && styles.actionsCompact]}>
          <View style={styles.buttonWrap}>
            <View pointerEvents="none" style={styles.buttonShadow} />
            <Pressable
              onPress={signup}
              accessibilityRole="button"
              accessibilityLabel="Criar minha conta"
              style={({ pressed }) => [styles.button, compact && styles.buttonCompact, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonLabel} maxFontSizeMultiplier={1.2}>CRIAR MINHA CONTA</Text>
              <Icon name="arrowRight" size={18} color={WELCOME.buttonText} />
            </Pressable>
          </View>

          <Pressable onPress={login} accessibilityRole="link" accessibilityLabel="Já tem conta? Entrar" style={[styles.loginLink, compact && styles.loginLinkCompact]}>
            <Text style={styles.loginText} maxFontSizeMultiplier={1.2}>
              Já tem conta? <Text style={styles.loginStrong}>Entrar</Text>
            </Text>
          </Pressable>

          <Text style={styles.legal} maxFontSizeMultiplier={1.2}>
            Ao criar sua conta, você concorda com os{' '}
            <Text style={styles.legalLink} accessibilityRole="link" onPress={() => legal('termos')}>Termos de Uso</Text>
            {' '}e a{' '}
            <Text style={styles.legalLink} accessibilityRole="link" onPress={() => legal('privacidade')}>Política de Privacidade</Text>.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WELCOME.red, overflow: 'hidden' },
  rays: { position: 'absolute', top: 0, left: 0, backgroundColor: 'transparent' } as ImageStyle,
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  brand: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
  brandCompact: { minHeight: 36 },
  logo: { width: 139, height: 34 } as ImageStyle,
  middle: { flex: 1, justifyContent: 'center', paddingTop: 12, paddingBottom: 6 },
  middleCompact: { paddingTop: 8, paddingBottom: 4 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  kickerSquare: { width: 9, height: 9, backgroundColor: WELCOME.paper },
  kickerText: { fontFamily: Fonts.monoSemibold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: WELCOME.paper },
  stampOuter: { borderWidth: 2, borderColor: WELCOME.paper, borderRadius: 6, padding: 1, transform: [{ translateY: -6 }, { rotate: '-7deg' }] },
  stampInner: { borderWidth: 2, borderColor: WELCOME.paper, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  stampText: { fontFamily: Fonts.anton, fontSize: 15, lineHeight: 19, letterSpacing: 0.75, textTransform: 'uppercase', color: WELCOME.paper, textAlign: 'center' },
  title: { marginTop: 14, paddingTop: 4, includeFontPadding: true, fontFamily: Fonts.anton, color: WELCOME.paper, textTransform: 'uppercase' },
  titleCompact: { marginTop: 10 },
  points: { marginTop: 16, borderTopWidth: 2, borderTopColor: WELCOME.paper },
  pointsCompact: { marginTop: 12 },
  point: { flexDirection: 'row', alignItems: 'baseline', gap: 14, paddingVertical: 9, borderBottomWidth: 2, borderBottomColor: WELCOME.paper },
  pointCompact: { paddingVertical: 7 },
  pointNumber: { width: 22, fontFamily: Fonts.monoSemibold, fontSize: 12, lineHeight: 16, color: WELCOME.paper },
  pointText: { flex: 1, fontFamily: Fonts.bold, fontSize: 17, lineHeight: 23, color: WELCOME.paper },
  pointTextCompact: { fontSize: 16, lineHeight: 22 },
  actions: { gap: 4 },
  actionsCompact: { gap: 3 },
  buttonWrap: { position: 'relative' },
  buttonShadow: { position: 'absolute', top: 3, left: 3, width: '100%', height: '100%', borderRadius: 6, backgroundColor: WELCOME.shadow },
  button: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, borderWidth: 2, borderColor: WELCOME.ink, borderRadius: 6, backgroundColor: WELCOME.ink },
  buttonCompact: { minHeight: 52 },
  buttonPressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  buttonLabel: { fontFamily: Fonts.anton, fontSize: 22, lineHeight: 26, letterSpacing: 0.88, textTransform: 'uppercase', color: WELCOME.buttonText },
  loginLink: { minHeight: 48, marginTop: 4, alignItems: 'center', justifyContent: 'center' },
  loginLinkCompact: { minHeight: 42, marginTop: 2 },
  loginText: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 22, color: WELCOME.paper, textAlign: 'center' },
  loginStrong: { fontFamily: Fonts.extrabold, textDecorationLine: 'underline' },
  legal: { marginTop: 2, fontFamily: Fonts.regular, fontSize: 12, lineHeight: 18, color: WELCOME.paper, textAlign: 'center' },
  legalLink: { fontFamily: Fonts.bold, textDecorationLine: 'underline' },
});
