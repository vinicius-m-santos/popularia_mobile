import { createContext, use, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';

const DURATION_MS = 2600;

type ToastValue = { show: (message: string) => void };

const ToastContext = createContext<ToastValue | null>(null);

/**
 * Aviso curto na parte de baixo da tela, como no design. Também é anunciado
 * pelo leitor de tela (TalkBack/VoiceOver).
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();

  const show = useCallback(
    (next: string) => {
      if (timer.current) clearTimeout(timer.current);
      setMessage(next);
      AccessibilityInfo.announceForAccessibility(next);
      Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
      timer.current = setTimeout(() => {
        Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() =>
          setMessage(null),
        );
      }, DURATION_MS);
    },
    [opacity],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return (
    <ToastContext value={{ show }}>
      {children}
      {message ? (
        <View pointerEvents="none" style={[styles.wrap, { bottom: insets.bottom + 96 }]}>
          <Animated.View style={[styles.toast, { opacity }]} importantForAccessibility="no-hide-descendants">
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
