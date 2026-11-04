import { StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors } from '@/constants/theme';

type KickerProps = {
  label: string;
  color?: string;
  /** Cor do quadradinho quando a tela usa uma paleta própria, como a área legal. */
  squareColor?: string;
  /** Tamanho do quadradinho; o padrão é 8. */
  squareSize?: number;
  /** Intervalo entre quadradinho e rótulo; o padrão é 7. */
  gap?: number;
  textStyle?: StyleProp<TextStyle>;
};

/** Rótulo de seção com quadradinho vermelho: "Chamados da semana", "c/ Tarifa Zero BH". */
export function Kicker({ label, color = Colors.ink, squareColor = Colors.red, squareSize = 8, gap = 7, textStyle }: KickerProps) {
  return (
    <View style={[styles.row, { gap }]}>
      <View style={[styles.square, { width: squareSize, height: squareSize, backgroundColor: squareColor }]} />
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
