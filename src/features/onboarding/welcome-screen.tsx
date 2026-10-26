import { router, useFocusEffect } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';

const POINTS = [
  'Entre em comunas do seu bairro, do seu trabalho e do que você gosta',
  'Convoque e confirme chamados, do mutirão à assembleia',
  'Converse e decida junto, com moderação eleita',
];

/** Boas-vindas (design 2a). Os dois botões levam à tela de conta, em modo cadastro ou entrar. */
export default function WelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { startSignup } = useAccount();

  // Fundo vermelho até a barra de status: ícones claros enquanto esta tela está em foco.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('light');
      return () => setStatusBarStyle('dark');
    }, []),
  );

  // Archivo Narrow é mais larga que a Archivo condensada do design: 66 pt em 390 de largura cabe "PARTICIPA.".
  const titleSize = Math.min(78, Math.round(Math.min(width, MaxContentWidth) * 0.17));

  const signup = () => {
    startSignup();
    router.push({ pathname: '/boas-vindas/conta', params: { modo: 'cadastro' } });
  };

  const login = () => router.push({ pathname: '/boas-vindas/conta', params: { modo: 'entrar' } });

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, Spacing.four) + 14 }]}
        bounces={false}>
        <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="Popularia">
          <View style={styles.logo}>
            <Image source={require('@/assets/branding/popularia-symbol.png')} style={styles.symbol} accessible={false} />
          </View>
          <AppText style={styles.wordmark} color={Colors.paper} maxFontSizeMultiplier={1.2}>
            POPULARIA
          </AppText>
        </View>

        <View style={styles.middle}>
          <AppText
            style={[styles.title, { fontSize: titleSize, lineHeight: Math.round(titleSize * 0.9) }]}
            color={Colors.paper}
            maxFontSizeMultiplier={1.1}
            accessibilityRole="header">
            A rede é de quem participa.
          </AppText>
          <View style={styles.points}>
            {POINTS.map((p, i) => (
              <View key={p} style={styles.point}>
                <AppText style={styles.pointNumber} color={Colors.paper}>
                  {String(i + 1).padStart(2, '0')}
                </AppText>
                <AppText style={styles.pointText} color={Colors.paper}>
                  {p}
                </AppText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={signup}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, styles.primary, pressed && styles.pressed]}>
            <AppText style={styles.buttonLabel} color={Colors.cream}>
              Criar minha conta
            </AppText>
          </Pressable>
          <Pressable
            onPress={login}
            accessibilityRole="button"
            style={({ pressed }) => [styles.button, styles.secondary, pressed && styles.pressed]}>
            <AppText style={styles.buttonLabel} color={Colors.paper}>
              Já tenho conta
            </AppText>
          </Pressable>
          <AppText style={styles.terms} color={Colors.paper}>
            {DEMO_MODE
              ? 'Modo demonstração: nenhum dado sai deste aparelho e tudo some ao fechar o app.'
              : 'Versão de testes: as comunas e publicações ainda são fictícias.'}
          </AppText>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.red,
  },
  scroll: {
    flexGrow: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: 14,
    paddingHorizontal: Spacing.six,
    gap: Spacing.six,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  logo: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
  },
  symbol: {
    width: 32,
    height: 32,
    resizeMode: 'contain',
  },
  wordmark: {
    fontFamily: Fonts.condensed,
    fontSize: 26,
    lineHeight: 28,
  },
  middle: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.six,
  },
  title: {
    fontFamily: Fonts.condensed,
    textTransform: 'uppercase',
    paddingTop: 6,
  },
  points: {
    borderTopWidth: 1.5,
    borderTopColor: Colors.paper,
  },
  point: {
    flexDirection: 'row',
    gap: 14,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.paper,
  },
  pointNumber: {
    fontFamily: Fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    paddingTop: 3,
  },
  pointText: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 16,
    lineHeight: 21,
  },
  actions: {
    gap: Spacing.two + 2,
  },
  button: {
    height: 56,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {
    backgroundColor: Colors.ink,
  },
  secondary: {
    borderWidth: 2,
    borderColor: Colors.paper,
  },
  pressed: {
    opacity: 0.8,
  },
  buttonLabel: {
    fontFamily: Fonts.condensed,
    fontSize: 21,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
  terms: {
    fontSize: 12.5,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: Spacing.one,
  },
});
