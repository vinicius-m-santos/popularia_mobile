import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Motion, Radius, Spacing } from '@/constants/theme';
import { useReducedMotion } from '@/hooks/use-reduced-motion';

const DURATION_MS = 2600;

type ToastValue = { show: (message: string) => void };

const ToastContext = createContext<ToastValue | null>(null);

/**
 * Aviso curto na parte de baixo da tela, como no design. Também é anunciado
 * pelo leitor de tela (TalkBack/VoiceOver).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<string[]>([]);
  const message = messages[0];
  const [opacity] = useState(() => new Animated.Value(0));
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const reducedMotionRef = useRef(reducedMotion);
  useEffect(() => { reducedMotionRef.current = reducedMotion; }, [reducedMotion]);

  const show = useCallback((next: string) => {
    setMessages((queue) => queue.includes(next) ? queue : [...queue, next]);
  }, []);

  useEffect(() => {
    if (!message) return;
    let disposed = false;
    AccessibilityInfo.announceForAccessibility(message);
    const enterDuration = reducedMotionRef.current ? 0 : Motion.duration.quick;
    const exitDuration = reducedMotionRef.current ? 0 : Motion.duration.base;
    Animated.timing(opacity, {
      toValue: 1,
      duration: enterDuration,
      easing: Motion.easing.standard,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: exitDuration,
        easing: Motion.easing.standard,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished && !disposed) setMessages((queue) => queue.slice(1));
      });
    }, DURATION_MS);
    return () => {
      disposed = true;
      clearTimeout(timer);
      opacity.stopAnimation();
    };
  }, [message, opacity]);

  // A opacidade comanda os dois gestos: aparecer/sumir e o pequeno assentamento vertical.
  const translateY = opacity.interpolate({ inputRange: [0, 1], outputRange: [6, 0] });

  return (
    <ToastContext value={{ show }}>
      {children}
      {message ? (
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96 }]}>
          <Animated.View style={[styles.toast, { opacity, transform: [{ translateY }] }]} importantForAccessibility="no-hide-descendants">
            <AppText style={styles.text} color={Colors.cream}>
              {message}
            </AppText>
          </Animated.View>
        </View>
      ) : null}
    </ToastContext>
  );
}

export function useToast(): ToastValue {
  const ctx = use(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return ctx;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: Spacing.four,
    right: Spacing.four,
    alignItems: 'center',
  },
  toast: {
    maxWidth: 360,
    backgroundColor: Colors.ink,
    borderColor: Colors.red,
    borderWidth: 1.5,
    borderRadius: Radius.xl,
    paddingVertical: 11,
    paddingHorizontal: Spacing.four,
  },
  text: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
    textAlign: 'center',
  },
});
