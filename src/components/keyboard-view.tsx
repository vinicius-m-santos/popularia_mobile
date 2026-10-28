import type { ComponentProps } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Ajusta o offset pelo topo seguro porque este wrapper vive dentro de Screen. */
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
