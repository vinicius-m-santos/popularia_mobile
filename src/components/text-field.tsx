import { useState, type ComponentProps, type ComponentRef, type ReactNode, type Ref } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

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
};

/** Campo de formulário do design: rótulo em negrito, borda de tinta e foco vermelho. */
export function TextField({
  label,
  labelAside,
  prefix,
  hint,
  hintColor = Colors.muted,
  multiline,
  inputRef,
  accessory,
  onFocus,
  onBlur,
  ...inputProps
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <View style={styles.labelRow}>
        <AppText style={styles.label}>{label}</AppText>
        {labelAside ? (
          <AppText style={styles.aside} color={Colors.muted}>
            {labelAside}
          </AppText>
        ) : null}
      </View>
      <View style={[styles.box, multiline && styles.boxMultiline, focused && styles.boxFocused]}>
        {prefix ? (
          <AppText style={styles.prefix} color={Colors.muted} accessible={false}>
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          ref={inputRef}
          accessibilityLabel={label}
          accessibilityHint={hint}
          placeholderTextColor={Colors.placeholder}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, multiline && styles.inputMultiline]}
          {...inputProps}
        />
        {accessory}
      </View>
      {hint ? (
        <AppText style={styles.hint} color={hintColor} accessibilityLiveRegion="polite">
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
  aside: {
    fontSize: 13.5,
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
  hint: {
    fontFamily: Fonts.bold,
    fontSize: 13,
    lineHeight: 17,
  },
});
