import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { Colors, Fonts, MaxContentWidth, Spacing } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { getComunas } from '@/features/comunas/api';
import { RecommendationCard } from '@/features/comunas/components/comuna-card';
import { rankByInterests } from '@/features/comunas/rank';
import { useInteractions } from '@/features/interactions/interactions-context';
import { useAsyncData } from '@/hooks/use-async-data';
import { plural } from '@/lib/format';

import { getTopicGroups } from './api';
import { OnboardingFooter, OnboardingProgress } from './components/onboarding-chrome';

const INITIAL_COUNT = 4;

/** "Comunas para você" — etapa 4 do cadastro (design 2c). */
export default function RecommendationsScreen() {
  const loadComunas = useCallback(() => getComunas(), []);
  const loadTopics = useCallback(() => getTopicGroups(), []);
  const comunas = useAsyncData(loadComunas);
  const topicGroups = useAsyncData(loadTopics);
  const { interests, finishSignup } = useAccount();
  const { joinedComunaIds } = useInteractions();
  const [showAll, setShowAll] = useState(false);

  const topics = useMemo(() => (topicGroups.data ?? []).flatMap((g) => g.topics), [topicGroups.data]);
  const ranked = useMemo(() => rankByInterests(comunas.data ?? [], interests), [comunas.data, interests]);
  const visible = showAll ? ranked : ranked.slice(0, INITIAL_COUNT);
  const hidden = ranked.length - visible.length;

  const chosen = interests
    .map((id) => topics.find((t) => t.id === id)?.shortLabel)
    .filter((label): label is string => !!label);
  const subtitle = chosen.length
    ? `A partir do que te move: ${chosen.slice(0, 3).join(', ')}${chosen.length > 3 ? ` e mais ${chosen.length - 3}` : ''}.`
    : 'As comunas mais ativas da Popularia agora.';

  const joinedCount = joinedComunaIds.length;

  return (
    <Screen edges={['top', 'left', 'right']}>
      <OnboardingProgress step={4} />
      <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.content}>
        <View>
          <AppText style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
            Comunas para você
          </AppText>
          <AppText style={styles.sub} color={Colors.inkSoft}>
            {subtitle}
          </AppText>
        </View>
        {comunas.status === 'error' ? (
          <StateView kind="error" message="Não conseguimos carregar as recomendações." onRetry={comunas.reload} />
        ) : comunas.data ? (
          <>
            {visible.map((c) => (
              <RecommendationCard key={c.id} comuna={c} topics={topics} interests={interests} />
            ))}
            {hidden > 0 ? (
              <Pressable
                onPress={() => setShowAll(true)}
                accessibilityRole="button"
                accessibilityLabel={`Ver mais ${hidden} recomendações`}
                style={({ pressed }) => [styles.more, pressed && styles.pressed]}>
                <AppText style={styles.moreLabel}>Ver mais recomendações</AppText>
                <AppText style={styles.moreCount} color={Colors.muted}>
                  +{hidden}
                </AppText>
              </Pressable>
            ) : null}
          </>
        ) : (
          <StateView kind="loading" message="Carregando recomendações" />
        )}
      </ScrollView>
      <OnboardingFooter
        label="Ir para o meu feed"
        onPress={finishSignup}
        hint={
          joinedCount
            ? 'Você pode entrar e sair de comunas quando quiser.'
            : 'Tudo bem pular. Dá para entrar em comunas depois.'
        }
        count={plural(joinedCount, 'comuna', 'comunas')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.one,
    paddingHorizontal: Spacing.five + 2,
    paddingBottom: Spacing.six,
    gap: 14,
  },
  title: {
    fontFamily: Fonts.condensed,
    fontSize: 54,
    lineHeight: 50,
    paddingTop: 6,
    textTransform: 'uppercase',
  },
  sub: {
    marginTop: Spacing.two,
    fontSize: 15,
    lineHeight: 21,
  },
  more: {
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.ink,
    borderRadius: 14,
  },
  pressed: {
    opacity: 0.7,
  },
  moreLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 14.5,
    lineHeight: 19,
  },
  moreCount: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 11,
    lineHeight: 14,
  },
});
