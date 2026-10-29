import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { InsideBottomSheet } from '@/components/bottom-sheet';
import { useContext, useRef, useState, type ComponentProps, type ComponentRef, type ReactNode, type Ref } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Radius } from '@/constants/theme';

type TextFieldProps = Omit<ComponentProps<typeof TextInput>, 'style'> & {
  label: string;
  /** Texto à direita do rótulo, como "opcional · 0/160". */
  labelAside?: string;
  /** Prefixo fixo dentro do campo, como "@". */
  prefix?: string;
  /** Linha abaixo do campo: dica, disponibilidade ou erro. */
  hint?: string;
  hintColor?: string;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  /** Botão dentro do campo, à direita, como "Mostrar" senha. */
  accessory?: ReactNode;
  /** Variante sem cantos arredondados e com rótulo mono para formulários editoriais. */
  appearance?: 'default' | 'editorial';
  /** Altura mínima da caixa quando `multiline` estiver ativo. */
  multilineHeight?: number;
  /** Exibe uma prévia truncada em uma linha quando o campo simples perde o foco. */
  truncateWhenBlurred?: boolean;
};

function updateRef<T>(ref: Ref<T> | undefined, value: T | null) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

/** Campo de formulário do design: rótulo em negrito, borda de tinta e foco vermelho. */
// Gorhom encaminha a instância nativa; seus tipos ainda usam o alias de RNGH 2.
const SheetTextInput = BottomSheetTextInput as unknown as typeof TextInput;

export function TextField({
  label,
  labelAside,
  prefix,
  hint,
  hintColor = Colors.muted,
  multiline,
  numberOfLines,
  inputRef,
  accessory,
  appearance = 'default',
  multilineHeight,
  truncateWhenBlurred = false,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const inSheet = useContext(InsideBottomSheet);
  const Input = inSheet ? SheetTextInput : TextInput;
  const [focused, setFocused] = useState(false);
  const nativeInput = useRef<ComponentRef<typeof TextInput>>(null);
  const isMultiline = multiline === true;
  const showSingleLinePreview = truncateWhenBlurred && !isMultiline && !focused && typeof inputProps.value === 'string' && inputProps.value.length > 0;

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText style={[styles.label, appearance === 'editorial' && styles.editorialLabel]}>{label}</AppText>
        {labelAside ? (
          <AppText style={[styles.aside, appearance === 'editorial' && styles.editorialAside]} color={Colors.muted}>
            {labelAside}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.box, appearance === 'editorial' && styles.editorialBox, isMultiline && styles.boxMultiline, isMultiline && multilineHeight ? { minHeight: multilineHeight } : null, focused && styles.boxFocused]}>
        {prefix ? (
          <AppText style={styles.prefix} color={Colors.muted} accessible={false}>
            {prefix}
          </AppText>
        ) : null}
        <Input
          ref={(node: ComponentRef<typeof TextInput> | null | undefined) => { nativeInput.current = node ?? null; updateRef(inputRef, node ?? null); }}
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={Colors.placeholder}
          multiline={isMultiline}
          numberOfLines={isMultiline ? numberOfLines : undefined}
          textAlignVertical={isMultiline ? 'top' : 'center'}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, isMultiline ? styles.inputMultiline : styles.inputSingleLine, isMultiline && multilineHeight ? { minHeight: multilineHeight - 24 } : null, showSingleLinePreview && styles.inputBehindPreview]}
          {...inputProps}
        />
        {showSingleLinePreview ? <Pressable accessible={false} onPress={() => { setFocused(true); nativeInput.current?.focus(); }} style={styles.singleLinePreview}><AppText accessible={false} numberOfLines={1} ellipsizeMode="tail" style={styles.singleLinePreviewText}>{inputProps.value}</AppText></Pressable> : null}
        {accessory}
      </View>
      {hint ? (
        <AppText style={[styles.hint, appearance === 'editorial' && styles.editorialHint]} color={hintColor} accessibilityLiveRegion="polite">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  label: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  editorialLabel: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  aside: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  editorialAside: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  box: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.xl,
    backgroundColor: Colors.paper,
    paddingHorizontal: 14,
  },
  editorialBox: {
    borderRadius: 0,
  },
  boxMultiline: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  boxFocused: {
    borderColor: Colors.red,
    boxShadow: `0 0 0 3px ${Colors.redSoft}`,
  },
  prefix: {
    fontSize: 16,
    lineHeight: 22,
    marginRight: 2,
  },
  input: {
    flex: 1,
    minHeight: 48,
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 21,
    color: Colors.ink,
    paddingVertical: 0,
    includeFontPadding: false,
    // O foco é indicado pela borda vermelha da caixa; sem o contorno padrão do navegador.
    outlineWidth: 0,
  },
  inputMultiline: {
    minHeight: 64,
    lineHeight: 22,
  },
  inputSingleLine: {
    height: 48,
    maxHeight: 48,
    minWidth: 0,
    flexShrink: 1,
    overflow: 'hidden',
  },
  inputBehindPreview: {
    opacity: 0,
  },
  singleLinePreview: {
    position: 'absolute',
    left: 14,
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  singleLinePreviewText: {
    fontFamily: Fonts.regular,
    fontSize: 16,
    lineHeight: 21,
    color: Colors.ink,
  },
  hint: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 17,
  },
  editorialHint: {
    fontFamily: Fonts.regular,
  },
});
