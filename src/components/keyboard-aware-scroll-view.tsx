import { createContext, forwardRef, useCallback, useContext, useRef, type ComponentRef } from 'react';
import { ScrollView, type ScrollViewProps } from 'react-native';

type ScrollViewRef = ComponentRef<typeof ScrollView>;
type FieldFocusHandler = (event: { target?: unknown }) => void;

/** Handler instalado por KeyboardAwareScrollView e consumido por TextField. */
export const KeyboardAwareFieldContext = createContext<FieldFocusHandler | null>(null);

export function useKeyboardAwareFieldFocus(): FieldFocusHandler | null {
  return useContext(KeyboardAwareFieldContext);
}

type Props = ScrollViewProps & {
  /** Folga entre o campo focado e a borda inferior da área visível. */
  focusOffset?: number;
};

/**
 * ScrollView de formulário que leva o campo focado para dentro da área visível
 * acima do teclado. É o comportamento nativo do scrollResponder do RN, sem
 * padding artificial e sem biblioteca extra.
 */
export const KeyboardAwareScrollView = forwardRef<ScrollViewRef, Props>(function KeyboardAwareScrollView(
  { focusOffset = 20, ...props },
  forwardedRef,
) {
  const scrollRef = useRef<ScrollViewRef>(null);
  const setRef = useCallback((node: ScrollViewRef | null) => {
    scrollRef.current = node;
    if (typeof forwardedRef === 'function') forwardedRef(node);
    else if (forwardedRef) forwardedRef.current = node;
  }, [forwardedRef]);

  const handleFieldFocus = useCallback<FieldFocusHandler>((event) => {
    const target = event.target;
    // Espera o teclado abrir para o cálculo da área útil ficar correto.
    setTimeout(() => {
      if (target == null) return;
      scrollRef.current?.scrollResponderScrollNativeHandleToKeyboard(target as number, focusOffset, true);
    }, 280);
  }, [focusOffset]);

  return (
    <KeyboardAwareFieldContext.Provider value={handleFieldFocus}>
      <ScrollView {...props} ref={setRef} />
    </KeyboardAwareFieldContext.Provider>
  );
});
