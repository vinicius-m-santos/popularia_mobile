import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { useAsyncData } from '@/hooks/use-async-data';
import { describeError } from '@/lib/errors';

import { getTopicGroups } from './api';
import { OnboardingFooter, OnboardingProgress } from './components/onboarding-chrome';
import { TopicPicker } from './components/topic-picker';

/** Sugestão de mínimo para o feed ter variedade; não é obrigatório. */
const SUGGESTED_MINIMUM = 3;

/** "O que move você?" — etapa 3 do cadastro (design 2b). */
export default function TopicsScreen() {
  const load = useCallback(() => getTopicGroups(), []);
  const groups = useAsyncData(load);
  const { interests, toggleInterest, saveInterests } = useAccount();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const total = groups.data?.reduce((n, g) => n + g.topics.length, 0) ?? 0;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <OnboardingProgress step={3} />
      <ScrollView contentContainerStyle={styles.content}>
        <TopicsTitle />
        {groups.status === 'error' ? (
          <StateView kind="error" message="Não conseguimos carregar os assuntos." onRetry={groups.reload} />
        ) : groups.data ? (
          <TopicPicker groups={groups.data} selected={interests} onToggle={toggleInterest} />
        ) : (
          <StateView kind="loading" message="Carregando assuntos" />
        )}
      </ScrollView>
      <OnboardingFooter
        label={interests.length > 0 ? 'Continuar' : 'Pular por agora'}
        onPress={async () => {
          if (busy) return;
          setBusy(true);
          try {
            // Interesses são dado privado: só aparecem para a própria pessoa (GET /me).
            await saveInterests(interests);
            router.push('/boas-vindas/comunas');
          } catch (error) {
            toast.show(describeError(error));
          } finally {
            setBusy(false);
          }
        }}
        hint={
          interests.length < SUGGESTED_MINIMUM
            ? 'Sugerimos pelo menos 3 para um feed mais certeiro.'
            : 'Boa escolha. Dá para ajustar depois no perfil.'
        }
        count={total ? `${interests.length} de ${total}` : undefined}
      />
    </Screen>
  );
}

/** Título "O que move você?" com "você?" em vermelho; também usado na edição de interesses. */
export function TopicsTitle() {
  return (
    <View>
      <AppText style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
        O que move <AppText style={styles.title} color={Colors.red}>você?</AppText>
      </AppText>
      <AppText style={styles.sub} color={Colors.inkSoft}>
        Escolha os assuntos que quer acompanhar na Popularia
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.one,
    paddingHorizontal: Spacing.five + 2,
    paddingBottom: 28,
  },
  title: {
    fontFamily: Fonts.condensed,
    fontSize: 62,
    lineHeight: 56,
    paddingTop: 8,
    textTransform: 'uppercase',
  },
  sub: {
    marginTop: Spacing.two + 2,
    fontSize: 16,
    lineHeight: 22,
  },
});
