import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { useAsyncData } from '@/hooks/use-async-data';
import { describeError } from '@/lib/errors';
import type { TopicId } from '@/types/models';

import { getTopicGroups } from './api';
import { OnboardingFooter } from './components/onboarding-chrome';
import { TopicPicker } from './components/topic-picker';
import { TopicsTitle } from './topics-screen';

/** Editar interesses a partir do perfil. Só vale depois de salvar. */
export default function InterestsScreen() {
  const load = useCallback(() => getTopicGroups(), []);
  const groups = useAsyncData(load);
  const { interests, saveInterests, account } = useAccount();
  const toast = useToast();
  const [draft, setDraft] = useState<TopicId[]>(interests);

  const toggle = (id: TopicId) =>
    setDraft((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveInterests(draft);
      toast.show(account ? 'Interesses atualizados.' : 'Interesses atualizados neste aparelho.');
      if (router.canGoBack()) router.back();
      else router.replace('/perfil');
    } catch (error) {
      toast.show(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'left', 'right']}>
      <View style={styles.bar}>
        <IconButton icon="close" size={20} accessibilityLabel="Fechar sem salvar" onPress={() => router.back()} />
        <AppText style={styles.barTitle} accessibilityRole="header">
          Interesses
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <TopicsTitle />
        {groups.status === 'error' ? (
          <StateView kind="error" message="Não conseguimos carregar os assuntos." onRetry={groups.reload} />
        ) : groups.data ? (
          <TopicPicker groups={groups.data} selected={draft} onToggle={toggle} />
        ) : (
          <StateView kind="loading" message="Carregando assuntos" />
        )}
      </ScrollView>
      <OnboardingFooter
        label="Salvar interesses"
        onPress={save}
        hint="As recomendações do Explorar seguem estes assuntos."
        count={`${draft.length} escolhidos`}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
  },
  barTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 21,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.five + 2,
    paddingBottom: 28,
  },
});
