import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { Colors, Spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  return (
    <Screen>
      <StateView kind="empty" title="Página não encontrada" message="Este endereço não existe no app." />
      <Link href="/" style={styles.link}>
        <AppText variant="button" color={Colors.red}>
          Voltar ao início
        </AppText>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: {
    alignSelf: 'center',
    padding: Spacing.four,
    marginBottom: Spacing.eight,
  },
});
