import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View, type ImageStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';

const WELCOME = {
  red: '#BF3326',
  rays: '#AD2C21',
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

/** Boas-vindas (referência 390×844): fundo vermelho, raios, cartaz editorial e criação de conta. */
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

  // Em telas baixas, o título desce para 64 e a tela inteira rola.
  const titleSize = height < 700 ? 64 : Math.min(76, Math.round(width * 0.195));
  // Anton precisa de headroom; line-height apertado corta o topo das maiúsculas.
  const titleLineHeight = Math.max(Math.round(titleSize * 1.1), titleSize + 8);
  const raysHeight = Math.round((width * 240) / 390);

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
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        bounces={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: Math.max(insets.top + 11, 58), paddingBottom: Math.max(insets.bottom, 30) },
        ]}>
        <View style={styles.brand} accessible accessibilityRole="image" accessibilityLabel="Popularia">
          <Image fadeDuration={0} source={require('@/assets/branding/logo-creme.png')} style={styles.logo} resizeMode="contain" accessible={false} />
        </View>

        <View style={styles.middle}>
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
            style={[styles.title, { fontSize: titleSize, lineHeight: titleLineHeight }]}
            accessibilityRole="header"
            maxFontSizeMultiplier={1.1}>
            A REDE É{'\n'}DE QUEM{'\n'}PARTICIPA.
          </AppText>

          <View style={styles.points}>
            {POINTS.map((point, index) => (
              <View key={point} style={styles.point}>
                <Text style={styles.pointNumber} maxFontSizeMultiplier={1.2}>{String(index + 1).padStart(2, '0')}</Text>
                <Text style={styles.pointText} maxFontSizeMultiplier={1.2}>{point}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <View style={styles.buttonWrap}>
            <View pointerEvents="none" style={styles.buttonShadow} />
            <Pressable
              onPress={signup}
              accessibilityRole="button"
              accessibilityLabel="Criar minha conta"
              style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
              <Text style={styles.buttonLabel} maxFontSizeMultiplier={1.2}>CRIAR MINHA CONTA</Text>
              <Icon name="arrowRight" size={18} color={WELCOME.buttonText} />
            </Pressable>
          </View>

          <Pressable onPress={login} accessibilityRole="link" accessibilityLabel="Já tem conta? Entrar" style={styles.loginLink}>
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
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: WELCOME.red, overflow: 'hidden' },
  rays: { position: 'absolute', top: 0, left: 0, backgroundColor: 'transparent' } as ImageStyle,
  scroll: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  brand: { minHeight: 44, justifyContent: 'center', alignItems: 'flex-start' },
  logo: { width: 139, height: 34 } as ImageStyle,
  middle: { flex: 1, justifyContent: 'center', paddingTop: 24, paddingBottom: 12 },
  kickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  kickerSquare: { width: 9, height: 9, backgroundColor: WELCOME.paper },
  kickerText: { fontFamily: Fonts.monoSemibold, fontSize: 12, lineHeight: 16, letterSpacing: 1.2, textTransform: 'uppercase', color: WELCOME.paper },
  stampOuter: { borderWidth: 2, borderColor: WELCOME.paper, borderRadius: 6, padding: 1, transform: [{ translateY: -6 }, { rotate: '-7deg' }] },
  stampInner: { borderWidth: 2, borderColor: WELCOME.paper, borderRadius: 3, paddingVertical: 3, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center' },
  stampText: { fontFamily: Fonts.anton, fontSize: 15, lineHeight: 19, letterSpacing: 0.75, textTransform: 'uppercase', color: WELCOME.paper, textAlign: 'center' },
  title: { marginTop: 22, fontFamily: Fonts.anton, color: WELCOME.paper, textTransform: 'uppercase' },
  points: { marginTop: 30, borderTopWidth: 2, borderTopColor: WELCOME.paper },
  point: { flexDirection: 'row', alignItems: 'baseline', gap: 14, paddingVertical: 13, borderBottomWidth: 2, borderBottomColor: WELCOME.paper },
  pointNumber: { width: 22, fontFamily: Fonts.monoSemibold, fontSize: 12, lineHeight: 16, color: WELCOME.paper },
  pointText: { flex: 1, fontFamily: Fonts.bold, fontSize: 17, lineHeight: 23, color: WELCOME.paper },
  actions: { gap: 6 },
  buttonWrap: { position: 'relative' },
  buttonShadow: { position: 'absolute', top: 3, left: 3, width: '100%', height: '100%', borderRadius: 6, backgroundColor: WELCOME.shadow },
  button: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 12, borderWidth: 2, borderColor: WELCOME.ink, borderRadius: 6, backgroundColor: WELCOME.ink },
  buttonPressed: { transform: [{ translateX: 2 }, { translateY: 2 }] },
  buttonLabel: { fontFamily: Fonts.anton, fontSize: 22, lineHeight: 26, letterSpacing: 0.88, textTransform: 'uppercase', color: WELCOME.buttonText },
  loginLink: { minHeight: 48, marginTop: 6, alignItems: 'center', justifyContent: 'center' },
  loginText: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 22, color: WELCOME.paper, textAlign: 'center' },
  loginStrong: { fontFamily: Fonts.extrabold, textDecorationLine: 'underline' },
  legal: { marginTop: 2, fontFamily: Fonts.regular, fontSize: 12, lineHeight: 18, color: WELCOME.paper, textAlign: 'center' },
  legalLink: { fontFamily: Fonts.bold, textDecorationLine: 'underline' },
});
