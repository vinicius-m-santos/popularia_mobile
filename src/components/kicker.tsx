import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors } from '@/constants/theme';

type KickerProps = {
  label: string;
  color?: string;
  /** Cor do quadradinho quando a tela usa uma paleta própria, como a área legal. */
  squareColor?: string;
  textStyle?: StyleProp<TextStyle>;
};

/** Rótulo de seção com quadradinho vermelho: "Chamados da semana", "c/ Tarifa Zero BH". */
export function Kicker({ label, color = Colors.ink, squareColor = Colors.red, textStyle }: KickerProps) {
  return (
    <View style={styles.row}>
      <View style={[styles.square, { backgroundColor: squareColor }]} />
      <AppText variant="label" color={color} style={[{ flexShrink: 1 }, textStyle]}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  square: {
    width: 8,
    height: 8,
    backgroundColor: Colors.red,
  },
});
