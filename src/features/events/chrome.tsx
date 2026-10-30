import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { Colors, Spacing } from '@/constants/theme';
import { goBack } from '@/lib/routes';

export function EventBar({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={styles.bar}>
      <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} />
      <View style={styles.divider} />
      <AppText variant="label" style={styles.title}>{title}</AppText>
      {action ?? <View style={styles.spacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    backgroundColor: Colors.cream,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
  },
  divider: { width: 1.5, height: 28, backgroundColor: Colors.ink, marginRight: Spacing.two },
  title: { flex: 1 },
  spacer: { width: 44 },
});
