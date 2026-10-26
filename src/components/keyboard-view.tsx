import type { ComponentProps } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Dentro de Screen: compensa o topo seguro no iOS; Android já redimensiona a janela. */
export function KeyboardView(props: ComponentProps<typeof KeyboardAvoidingView>) {
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={insets.top}
      {...props}
    />
  );
}
