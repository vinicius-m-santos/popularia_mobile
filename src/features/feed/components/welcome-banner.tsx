import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { Kicker } from '@/components/kicker';
import { Fonts } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { useInteractions } from '@/features/interactions/interactions-context';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

const P = {
  card: '#15120F',
  paper: '#FBF7EF',
  secondary: '#C9BFAE',
  yellow: '#F4C534',
  red: '#BF3326',
  tagBorder: '#F2EADB',
} as const;

const CLOSE_MS = 200;

function countTag(count: number, singular: string, plural: string): string | null {
  if (count <= 0) return null;
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Card de boas-vindas do feed: aparece uma vez, depois do cadastro. */
export function WelcomeBanner() {
  const { profile, interests, showWelcome, dismissWelcome } = useAccount();
  const { joinedComunaIds } = useInteractions();
  const [measuredHeight, setMeasuredHeight] = useState(0);
  const [closing, setClosing] = useState(false);
  const [progress] = useState(() => new Animated.Value(1));
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!showWelcome) return;
    progress.setValue(1);
    // A folha pode reaparecer num novo cadastro sem o feed desmontar.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClosing(false);
    setMeasuredHeight(0);
  }, [progress, showWelcome]);

  const firstName = profile.name.trim().split(/\s+/)[0] ?? '';
  const hasName = firstName.length > 0;
  const firstNameUpper = firstName.toUpperCase();
  const title = hasName ? `SEU FEED ESTÁ PRONTO, ${firstNameUpper}.` : 'SEU FEED ESTÁ PRONTO.';
  const topicsTag = countTag(interests.length, 'ASSUNTO', 'ASSUNTOS');
  const comunasTag = countTag(joinedComunaIds.length, 'COMUNA', 'COMUNAS');

  const close = useCallback(() => {
    if (closing) return;
    setClosing(true);
    Animated.timing(progress, {
      toValue: 0,
      duration: reducedMotion ? 0 : CLOSE_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) dismissWelcome();
    });
  }, [closing, dismissWelcome, progress, reducedMotion]);

  if (!showWelcome) return null;

  const animatedStyle = closing && measuredHeight > 0 ? {
    height: progress.interpolate({ inputRange: [0, 1], outputRange: [0, measuredHeight] }),
    opacity: progress,
    overflow: 'hidden' as const,
  } : undefined;

  return (
    <View style={styles.positioner}>
      <Animated.View style={[styles.animation, animatedStyle]}>
        <View pointerEvents="none" style={styles.hardShadow} />
        <View style={styles.card} onLayout={(event) => {
          const next = event.nativeEvent.layout.height;
          setMeasuredHeight((current) => current === next ? current : next);
        }}>
          <View accessible accessibilityRole="header" accessibilityLabel={title}>
            <View style={styles.kickerRow}>
              <Kicker
                label="Boas-vindas"
                color={P.secondary}
                squareColor={P.red}
                squareSize={9}
                gap={8}
                textStyle={styles.kicker}
              />
            </View>
            <AppText style={styles.title} color={P.paper}>
              {hasName ? 'SEU FEED ESTÁ PRONTO,' : 'SEU FEED ESTÁ PRONTO.'}
              {hasName ? <>{'\n'}<AppText style={styles.name} color={P.yellow}>{firstNameUpper}.</AppText></> : null}
            </AppText>
            <AppText style={styles.text} color={P.secondary}>
              Montamos com base no que te move.
            </AppText>
            {topicsTag || comunasTag ? (
              <View style={styles.tags}>
                {topicsTag ? <View style={styles.tag}><AppText style={styles.tagText} color={P.paper}>{topicsTag}</AppText></View> : null}
                {comunasTag ? <View style={styles.tag}><AppText style={styles.tagText} color={P.paper}>{comunasTag}</AppText></View> : null}
              </View>
            ) : null}
          </View>
          <IconButton
            icon="close"
            size={18}
            strokeWidth={2.8}
            color={P.paper}
            accessibilityLabel="Fechar boas-vindas"
            onPress={close}
            style={styles.close}
          />
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  positioner: {
    marginTop: 18,
    marginHorizontal: 16,
    // O card de missões tem 16 de margem própria; 2 completam os 18 de respiro.
    marginBottom: 2,
  },
  animation: {
    position: 'relative',
  },
  hardShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: P.red,
  },
  card: {
    position: 'relative',
    paddingTop: 14,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderWidth: 2,
    borderColor: P.card,
    borderRadius: 6,
    backgroundColor: P.card,
  },
  kickerRow: {
    minHeight: 25,
    paddingRight: 46,
    justifyContent: 'center',
  },
  kicker: {
    fontSize: 11,
    lineHeight: 18,
    letterSpacing: 1.1,
  },
  close: {
    position: 'absolute',
    top: -2,
    right: -2,
  },
  title: {
    marginTop: 2,
    fontFamily: Fonts.anton,
    fontSize: 36,
    lineHeight: 44,
    textTransform: 'uppercase',
  },
  name: {
    fontFamily: Fonts.anton,
    fontSize: 36,
    lineHeight: 44,
    textTransform: 'uppercase',
  },
  text: {
    marginTop: 8,
    fontFamily: Fonts.regular,
    fontSize: 15,
    lineHeight: 22,
  },
  tags: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderWidth: 2,
    borderColor: P.tagBorder,
    borderRadius: 4,
  },
  tagText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 19,
    letterSpacing: 0.88,
  },
});
