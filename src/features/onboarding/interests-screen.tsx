import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { EventBar } from '@/features/events/chrome';
import { useAsyncData } from '@/hooks/use-async-data';
import { describeError } from '@/lib/errors';
import type { TopicId } from '@/types/models';

import { getTopicGroups } from './api';

/** Editar interesses a partir do perfil. Só vale depois de salvar. */
export default function InterestsScreen() {
  const load = useCallback(() => getTopicGroups(), []);
  const groups = useAsyncData(load);
  const { interests, saveInterests, account } = useAccount();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<TopicId[]>(interests);
  const [busy, setBusy] = useState(false);

  const toggle = (id: TopicId) =>
    setDraft((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));

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
      <EventBar title="Interesses" />
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <AppText accessibilityRole="header" style={styles.title}>Seus interesses</AppText>
          <AppText style={styles.subtitle}>Escolha os assuntos que quer acompanhar. Eles ajudam a montar o Explorar e as recomendações.</AppText>
        </View>

        {groups.status === 'error' ? (
          <StateView kind="error" message="Não conseguimos carregar os assuntos." onRetry={groups.reload} />
        ) : groups.data ? (
          <View style={styles.groups}>
            {groups.data.map((group) => (
              <View key={group.title} style={styles.group}>
                <SectionHeading appearance="editorial" label={group.title} />
                <View style={styles.chips}>
                  {group.topics.map((topic) => {
                    const selected = draft.includes(topic.id);
                    return (
                      <Pressable
                        key={topic.id}
                        onPress={() => toggle(topic.id)}
                        role="checkbox"
                        accessibilityState={{ checked: selected }}
                        accessibilityLabel={topic.label}
                        style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.pressed]}>
                        <AppText style={styles.chipLabel} color={selected ? Colors.paper : Colors.ink}>
                          {topic.label}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <StateView kind="loading" message="Carregando assuntos" />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.four) }]}>
        <View style={styles.footerMeta}>
          <AppText variant="caption" style={styles.footerHint}>As recomendações do Explorar seguem estes assuntos.</AppText>
          <AppText variant="label">{draft.length} {draft.length === 1 ? 'escolhido' : 'escolhidos'}</AppText>
        </View>
        <EditorialAction
          label={busy ? 'Salvando…' : 'Salvar interesses'}
          icon="check"
          labelVariant="button"
          tone="red"
          disabled={busy}
          onPress={save}
          style={styles.save}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.six,
    gap: Spacing.five,
  },
  intro: {
    gap: Spacing.two,
  },
  title: {
    fontFamily: Fonts.anton,
    fontSize: 48,
    lineHeight: 54,
    letterSpacing: -0.6,
    textTransform: 'uppercase',
    paddingTop: 2,
  },
  subtitle: {
    fontSize: 15.5,
    lineHeight: 23,
    color: Colors.muted,
  },
  groups: {
    gap: Spacing.five,
  },
  group: {
    gap: Spacing.three,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  chipOn: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  chipLabel: {
    fontFamily: Fonts.bold,
    fontSize: 14.5,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.75,
  },
  footer: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.five,
    borderTopWidth: 1.5,
    borderTopColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  footerMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  footerHint: {
    flex: 1,
  },
  save: {
    borderRadius: Radius.sm,
  },
});
