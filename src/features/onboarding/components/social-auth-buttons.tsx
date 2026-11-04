import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { AppText } from '@/components/app-text';
import { Fonts } from '@/constants/theme';

const APPLE_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#15120F" d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>`;

type SocialProps = { label: string; icon: ReactNode; onPress: () => void; disabled?: boolean };

function SocialButton({ label, icon, onPress, disabled }: SocialProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.button, (pressed || disabled) && styles.muted]}>
      <View style={styles.icon}>{icon}</View>
      <AppText style={styles.label}>{label}</AppText>
    </Pressable>
  );
}

type Props = { onGoogle: () => void; onApple: () => void; disabled?: boolean };

/** Botões de provedores usados no login e no cadastro. Mesma altura, logo e destaque. */
export function SocialAuthButtons({ onGoogle, onApple, disabled = false }: Props) {
  const [appleAvailable, setAppleAvailable] = useState(Platform.OS === 'ios');

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  return (
    <View style={styles.buttons}>
      <SocialButton
        label="Continuar com Google"
        icon={<Image source={require('@/assets/onboarding/google-g.png')} style={styles.logo} resizeMode="contain" />}
        onPress={onGoogle}
        disabled={disabled}
      />
      {Platform.OS === 'ios' && appleAvailable ? (
        <View pointerEvents={disabled ? 'none' : 'auto'} style={disabled ? styles.muted : undefined}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE_OUTLINE}
            cornerRadius={6}
            style={styles.appleNative}
            onPress={onApple}
          />
        </View>
      ) : (
        <SocialButton
          label="Continuar com a Apple"
          icon={<SvgXml xml={APPLE_SVG} width={20} height={20} />}
          onPress={onApple}
          disabled={disabled}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  buttons: { gap: 10 },
  button: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#15120F',
    borderRadius: 6,
    backgroundColor: '#FBF7EF',
  },
  icon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  logo: { width: 20, height: 20 },
  label: { fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22, color: '#15120F' },
  appleNative: { height: 52, width: '100%' },
  muted: { opacity: 0.55 },
});
