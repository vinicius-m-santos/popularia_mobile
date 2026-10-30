import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { Colors, Spacing } from '@/constants/theme';
import { goBack } from '@/lib/routes';

import { ContentReportQueue } from './content-queue';

/** Fila da plataforma. Quem não tem o papel recebe 403 do servidor. */
export default function PlatformQueueScreen() {
  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.bar}>
        <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} />
        <View style={styles.divider} />
        <AppText variant="label" style={styles.title} accessibilityRole="header">Moderação da plataforma</AppText>
        <View style={styles.spacer} />
      </View>
      <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.body}>
        <ContentReportQueue slug={null} heading="Denúncias da plataforma e escaladas" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.one, backgroundColor: Colors.cream, borderBottomWidth: 1.5, borderBottomColor: Colors.ink },
  divider: { width: 1.5, height: 28, backgroundColor: Colors.ink, marginRight: Spacing.two },
  title: { flex: 1, fontSize: 12.5 },
  spacer: { width: 44 },
  body: { flex: 1, paddingHorizontal: Spacing.five, paddingBottom: Spacing.six },
});
