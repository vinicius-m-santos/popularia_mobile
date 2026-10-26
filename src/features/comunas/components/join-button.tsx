import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors, Fonts, Radius } from '@/constants/theme';
import type { Comuna } from '@/types/models';

import { useComunaMembership } from '../use-membership';

type JoinButtonProps = {
  comuna: Pick<Comuna, 'id' | 'name' | 'viewerIsMember'>;
  /** Rótulo curto ("✓ Dentro") para linhas estreitas. */
  short?: boolean;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

/** "Participar" em vermelho; depois de entrar, contorno com "✓ Participando". */
export function JoinButton({ comuna, short = false, height = 38, style }: JoinButtonProps) {
  const { joined, pending, toggleJoin } = useComunaMembership(comuna);
  const idleLabel = joined ? (short ? '✓ Dentro' : '✓ Participando') : 'Participar';
  const label = pending ? (joined ? 'Saindo…' : 'Entrando…') : idleLabel;
  const extraHit = Math.max(0, (44 - height) / 2);
  return (
    <Pressable
      onPress={toggleJoin}
      disabled={pending}
      accessibilityRole="button"
      accessibilityLabel={joined ? `Participando de ${comuna.name}` : `Participar de ${comuna.name}`}
      accessibilityHint={joined ? 'Toque para sair da comuna' : undefined}
      accessibilityState={{ selected: joined, busy: pending, disabled: pending }}
      hitSlop={extraHit ? { top: extraHit, bottom: extraHit } : undefined}
      style={({ pressed }) => [
        styles.button,
        { height },
        joined ? styles.joined : styles.idle,
        (pressed || pending) && styles.pressed,
        style,
      ]}>
      <AppText style={styles.label} color={joined ? Colors.ink : Colors.paper} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: {
    backgroundColor: Colors.red,
    borderColor: Colors.red,
  },
  joined: {
    backgroundColor: 'transparent',
    borderColor: Colors.ink,
  },
  pressed: {
    opacity: 0.75,
  },
  label: {
    fontFamily: Fonts.extrabold,
    fontSize: 13.5,
    lineHeight: 18,
  },
});
