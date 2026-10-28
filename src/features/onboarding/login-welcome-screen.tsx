import { router, useFocusEffect } from 'expo-router';
import { Asset } from 'expo-asset';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated as NativeAnimated, Easing, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Fonts } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';

const COLORS = {
  paper: '#F5E9D4',
  ink: '#0A0A08',
  red: '#BE361E',
  divider: '#1A1914',
  continue: '#fff',
} as const;

// Cadência editorial, breve o bastante para não cansar em logins recorrentes.
const FADE_DURATION = 500;
const FADE_GAP = 250;
const LAST_MESSAGE_DELAY = (FADE_DURATION + FADE_GAP) * 2;
const MESSAGES_END = LAST_MESSAGE_DELAY + FADE_DURATION;
const MESSAGES_HOLD = 1350;
const MESSAGES_EXIT_DURATION = 300;
const PAPER_PAUSE = 75;
const POSTER_FADE_DURATION = 750;
const POSTER_SETTLE_DURATION = 900;
const POSTER_HOLD_DURATION = 1500;
const CONTINUE_AUTO_ADVANCE_DELAY = 1000;
const POSTER_ASPECT_RATIO = 941 / 1672;

const MESSAGE_ILLUSTRATION = require('@/assets/onboarding/login-welcome-illustration.png');
const POSTER_ILLUSTRATION = require('@/assets/onboarding/login-welcome-poster.png');

function entering(delay: number) {
  return FadeIn.delay(delay).duration(FADE_DURATION).reduceMotion(ReduceMotion.System);
}

/** Mensagem exibida depois de cada login, antes de liberar a navegação principal. */
export default function LoginWelcomeScreen() {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const { dismissLoginWelcome } = useAccount();
  const hasContinued = useRef(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [posterStarted, setPosterStarted] = useState(false);
  const [illustrationOpacity] = useState(() => new NativeAnimated.Value(0));
  const [messagesOpacity] = useState(() => new NativeAnimated.Value(1));
  const [posterOpacity] = useState(() => new NativeAnimated.Value(0));
  const [posterScale] = useState(() => new NativeAnimated.Value(1.012));

  const continueToApp = useCallback(() => {
    if (hasContinued.current) return;
    hasContinued.current = true;
    dismissLoginWelcome();
    router.replace('/');
  }, [dismissLoginWelcome]);

  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle('dark');
    }, []),
  );

  // Os dois arquivos já estão no aparelho quando a cronologia começa: não há pop no pôster.
  useEffect(() => {
    let active = true;
    Asset.loadAsync([MESSAGE_ILLUSTRATION, POSTER_ILLUSTRATION])
      .catch(() => undefined)
      .finally(() => {
        if (active) setAssetsReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!assetsReady) return;
    const showContinueTimer = setTimeout(
      () => setPosterStarted(true),
      MESSAGES_END +
        MESSAGES_HOLD +
        MESSAGES_EXIT_DURATION +
        PAPER_PAUSE +
        POSTER_SETTLE_DURATION +
        POSTER_HOLD_DURATION,
    );
    const autoContinueTimer = setTimeout(
      continueToApp,
      MESSAGES_END + MESSAGES_HOLD + MESSAGES_EXIT_DURATION + PAPER_PAUSE + POSTER_SETTLE_DURATION + POSTER_HOLD_DURATION + CONTINUE_AUTO_ADVANCE_DELAY,
    );
    const transition = NativeAnimated.sequence([
      NativeAnimated.delay(MESSAGES_END + MESSAGES_HOLD),
      NativeAnimated.timing(messagesOpacity, { toValue: 0, duration: MESSAGES_EXIT_DURATION, useNativeDriver: true }),
      NativeAnimated.delay(PAPER_PAUSE),
      NativeAnimated.parallel([
        NativeAnimated.timing(posterOpacity, {
          toValue: 1,
          duration: POSTER_FADE_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        NativeAnimated.timing(posterScale, {
          toValue: 1,
          duration: POSTER_SETTLE_DURATION,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
    ]);
    transition.start();
    return () => {
      clearTimeout(showContinueTimer);
      clearTimeout(autoContinueTimer);
      transition.stop();
    };
  }, [assetsReady, continueToApp, messagesOpacity, posterOpacity, posterScale]);

  const horizontal = Math.max(32, Math.min(40, Math.round(width * 0.095)));
  const contentWidth = Math.min(width, 480) - horizontal * 2;
  const titleSize = Math.min(56, Math.max(45, Math.round(contentWidth * 0.176)));
  // A Anton ultrapassa a caixa de uma entrelinha compacta no iOS. A folga evita o corte superior.
  const titleLineHeight = Math.round(titleSize * 1.2);
  const contentTop = Math.max(insets.top + 38, Math.round(height * 0.092));
  const actionBottom = Math.max(insets.bottom + 36, Math.round(height * 0.052));
  // Com `contain`, telas muito altas deixam espaço vertical. Deslocamos só esse respiro para cima.
  const posterHeight = Math.min(height, width / POSTER_ASPECT_RATIO);
  const posterBottomOffset = Math.max(0, (height - posterHeight) / 2);
  const titleStyle = useMemo(
    () => [styles.title, { fontSize: titleSize, lineHeight: titleLineHeight }],
    [titleLineHeight, titleSize],
  );

  return (
    <View style={styles.root}>
      {assetsReady ? (
        <>
          <NativeAnimated.View style={[styles.firstStage, { opacity: messagesOpacity }]} pointerEvents="none">
            <NativeAnimated.Image
              source={MESSAGE_ILLUSTRATION}
              resizeMode="cover"
              style={[styles.illustration, { opacity: illustrationOpacity }]}
              onLoadEnd={() => NativeAnimated.timing(illustrationOpacity, { toValue: 1, duration: 900, useNativeDriver: true }).start()}
              accessible={false}
            />
            <View style={[styles.content, { paddingHorizontal: horizontal, paddingTop: contentTop }]}>
              <Animated.View entering={entering(0)}>
                <AppText style={titleStyle} color={COLORS.ink} accessibilityRole="header" maxFontSizeMultiplier={1.05}>
                  SEJA{'\n'}VOCÊ MESMO.
                </AppText>
              </Animated.View>
              <Animated.View entering={entering(FADE_DURATION + FADE_GAP)} style={styles.dividerFirst} accessible={false}>
                <View style={styles.dividerLong} />
              </Animated.View>
              <Animated.View entering={entering(FADE_DURATION + FADE_GAP)}>
                <AppText style={titleStyle} color={COLORS.ink} maxFontSizeMultiplier={1.05}>
                  SE{'\n'}ORGANIZE.
                </AppText>
              </Animated.View>
              <Animated.View entering={entering(LAST_MESSAGE_DELAY)} style={styles.dividerSecond} accessible={false}>
                <View style={styles.dividerShort} />
              </Animated.View>
              <Animated.View entering={entering(LAST_MESSAGE_DELAY)}>
                <AppText style={titleStyle} color={COLORS.red} maxFontSizeMultiplier={1.05}>
                  NÃO SEJA{'\n'}BABACA.
                </AppText>
              </Animated.View>
            </View>
          </NativeAnimated.View>
          <NativeAnimated.Image
            source={POSTER_ILLUSTRATION}
            resizeMode="contain"
            style={[
              styles.poster,
              { opacity: posterOpacity, transform: [{ translateY: posterBottomOffset }, { scale: posterScale }] },
            ]}
            accessible={false}
          />
        </>
      ) : null}
      {posterStarted ? (
        <Pressable
          onPress={continueToApp}
          accessibilityRole="button"
          accessibilityLabel="Continuar para o aplicativo"
          hitSlop={8}
          style={({ pressed }) => [styles.continue, { right: horizontal, bottom: actionBottom }, pressed && styles.continuePressed]}>
          <Icon name="arrowRight" size={28} color={COLORS.continue} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  illustration: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  firstStage: {
    ...StyleSheet.absoluteFill,
  },
  poster: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  content: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
  },
  title: {
    fontFamily: Fonts.anton,
    fontWeight: '400',
    letterSpacing: -1.2,
    textTransform: 'uppercase',
  },
  dividerFirst: {
    marginTop: 10,
    marginBottom: 10,
  },
  dividerSecond: {
    marginTop: 10,
    marginBottom: 10,
  },
  dividerLong: {
    height: 3,
    width: '100%',
    backgroundColor: COLORS.divider,
  },
  dividerShort: {
    height: 3,
    width: '76%',
    backgroundColor: COLORS.divider,
  },
  continue: {
    position: 'absolute',
    width: 54,
    height: 54,
    borderWidth: 1.5,
    borderColor: COLORS.continue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continuePressed: {
    opacity: 0.62,
  },
});
