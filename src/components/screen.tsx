import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Colors, MaxContentWidth, Spacing } from '@/constants/theme';

type ScreenProps = {
  /** Título editorial no topo da tela. */
  title?: string;
  children: ReactNode;
  /** As abas já tratam a borda inferior; telas modais podem precisar dela. */
  edges?: Edge[];
  backgroundColor?: string;
};

/** Contêiner padrão de tela: fundo creme, área segura e largura máxima. */
export function Screen({ title, children, edges = ['top', 'left', 'right'], backgroundColor = Colors.cream }: ScreenProps) {
  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor }]} edges={edges}>
      <View style={styles.content}>
        {title ? (
          <AppText variant="display" accessibilityRole="header" style={styles.title}>
            {title}
          </AppText>
        ) : null}
        {children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  content: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  title: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.three,
  },
});
