import { Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Motion } from '@/constants/motion';
import { Colors, Fonts, PressedColors, Radius } from '@/constants/theme';
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
        // `height` é um piso: com fonte ampliada o botão cresce em vez de cortar o rótulo.
        { minHeight: height },
        // O fundo muda e o rótulo continua opaco: em vermelho, apagar o botão
        // inteiro derrubaria `paper` para 3,19:1 de contraste.
        joined ? (pressed ? styles.joinedPressed : styles.joined) : (pressed ? styles.idlePressed : styles.idle),
        pending && styles.pending,
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
    borderRadius: Radius.sm,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  idle: {
    backgroundColor: Colors.red,
    borderColor: Colors.red,
  },
  idlePressed: {
    backgroundColor: PressedColors.red,
    borderColor: PressedColors.red,
  },
  joined: {
    backgroundColor: 'transparent',
    borderColor: Colors.ink,
  },
  joinedPressed: {
    backgroundColor: PressedColors.paper,
    borderColor: Colors.ink,
  },
  pending: {
    opacity: Motion.feedback.pressed.opacity,
  },
  label: {
    fontFamily: Fonts.extrabold,
    fontSize: 13.5,
    lineHeight: 18,
  },
});
