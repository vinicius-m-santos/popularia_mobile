import { useState, type ComponentRef, type Ref } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';

import { Fonts } from '@/constants/theme';

const AUTH = {
  surface: '#FBF7EF',
  ink: '#15120F',
  red: '#BF3326',
  redText: '#A3261C',
  secondary: '#5E554A',
  placeholder: '#6E6458',
} as const;

type EmailProps = {
  value: string;
  onChangeText: (value: string) => void;
  error?: string;
  failed?: boolean;
  onSubmitEditing?: () => void;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  returnKeyType?: 'next' | 'go' | 'done';
  autoComplete?: 'email' | 'username';
  textContentType?: 'emailAddress' | 'username';
};

type PasswordProps = {
  value: string;
  onChangeText: (value: string) => void;
  showPassword: boolean;
  onToggleShow: () => void;
  error?: string;
  failed?: boolean;
  onSubmitEditing?: () => void;
  inputRef?: Ref<ComponentRef<typeof TextInput>>;
  placeholder?: string;
  returnKeyType?: 'next' | 'go' | 'done';
  autoComplete?: 'current-password' | 'new-password';
  textContentType?: 'password' | 'newPassword';
};

/** Campo de e-mail compartilhado entre entrar e criar conta. */
export function AuthEmailField({ value, onChangeText, error, failed, onSubmitEditing, inputRef, returnKeyType = 'next', autoComplete = 'email', textContentType = 'emailAddress' }: EmailProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>E-mail</Text>
      <View style={[styles.box, { borderColor: error || failed ? AUTH.redText : focused ? AUTH.red : AUTH.ink }]}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="voce@email.com"
          placeholderTextColor={AUTH.placeholder}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel="E-mail"
          style={styles.input}
        />
      </View>
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

/** Campo de senha compartilhado, com Mostrar/Ocultar e estados de erro. */
export function AuthPasswordField({ value, onChangeText, showPassword, onToggleShow, error, failed, onSubmitEditing, inputRef, placeholder = 'Sua senha', returnKeyType = 'go', autoComplete = 'current-password', textContentType = 'password' }: PasswordProps) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>Senha</Text>
      <View style={[styles.box, { borderColor: error || failed ? AUTH.redText : focused ? AUTH.red : AUTH.ink }]}>
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={AUTH.placeholder}
          secureTextEntry={!showPassword}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete={autoComplete}
          textContentType={textContentType}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          accessibilityLabel="Senha"
          style={[styles.input, styles.passwordInput]}
        />
        <Pressable
          onPress={onToggleShow}
          accessibilityRole="button"
          accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          accessibilityState={{ selected: showPassword }}
          style={styles.showButton}>
          <Icon name={showPassword ? 'eyeOff' : 'eye'} size={20} color={AUTH.ink} />
        </Pressable>
      </View>
      {error ? <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { marginTop: 14 },
  label: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 23, color: AUTH.ink },
  box: { position: 'relative', height: 52, marginTop: 6, flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 6, backgroundColor: AUTH.surface, paddingHorizontal: 14 },
  input: { flex: 1, height: 48, paddingVertical: 0, fontFamily: Fonts.regular, fontSize: 16, lineHeight: 24, color: AUTH.ink, outlineWidth: 0 },
  passwordInput: { paddingRight: 52 },
  showButton: { position: 'absolute', right: 4, top: 4, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  error: { marginTop: 5, fontFamily: Fonts.bold, fontSize: 14, lineHeight: 22, color: AUTH.redText },
});
