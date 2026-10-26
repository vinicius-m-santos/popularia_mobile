import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Colors } from '@/constants/theme';

type KickerProps = {
  label: string;
  color?: string;
};

/** Rótulo de seção com quadradinho vermelho: "Chamados da semana", "c/ Tarifa Zero BH". */
export function Kicker({ label, color = Colors.ink }: KickerProps) {
  return (
    <View style={styles.row}>
      <View style={styles.square} />
      <AppText variant="label" color={color}>
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
