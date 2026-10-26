import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Colors } from '@/constants/theme';

/** Quadrado de marcação (o rótulo e o toque ficam no botão que o contém). */
export function CheckboxMark({ checked }: { checked: boolean }) {
  return (
    <View style={[styles.box, checked && styles.boxOn]} accessible={false}>
      {checked ? <Icon name="check" size={13} color={Colors.cream} /> : null}
    </View>
  );
}

/** Círculo de opção única. */
export function RadioMark({ selected }: { selected: boolean }) {
  return (
    <View style={styles.radio} accessible={false}>
      {selected ? <View style={styles.radioDot} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: {
    backgroundColor: Colors.ink,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.ink,
  },
});
