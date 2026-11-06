import { router } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Fonts, MaxContentWidth } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { useAsyncData } from '@/hooks/use-async-data';
import { describeError } from '@/lib/errors';
import { haptic } from '@/lib/haptics';
import type { Topic, TopicGroup, TopicId } from '@/types/models';

import { getTopicGroups } from './api';

const P = {
  bg: '#F2EADB',
  paper: '#FBF7EF',
  ink: '#15120F',
  red: '#BF3326',
  secondary: '#5E554A',
  subtitle: '#3E3630',
} as const;

const SUGGESTED_MINIMUM = 3;
const SECTION_ORDER = ['Cultura e lazer', 'Cidade e comunidade', 'Política e direitos'] as const;

const stableTitle = (title: string): string => {
  const value = title.trim();
  if (/cultura|dia a dia|lazer/i.test(value)) return 'Cultura e lazer';
  if (/cidade|comunidade|bem comum/i.test(value)) return 'Cidade e comunidade';
  if (/pol[ií]tica|direitos/i.test(value)) return 'Política e direitos';
  return value;
};

/** Agrupa títulos legados e mantém a ordem editorial: cultura, cidade, política. */
export function interestSections(groups: TopicGroup[]): { title: string; topics: Topic[] }[] {
  const byTitle = new Map<string, Topic[]>();
  for (const group of groups) {
    const title = stableTitle(group.title);
    const topics = byTitle.get(title) ?? [];
    for (const topic of group.topics) {
      if (!topics.some((item) => item.id === topic.id)) topics.push(topic);
    }
    byTitle.set(title, topics);
  }
  const ordered = [
    ...SECTION_ORDER.filter((title) => byTitle.has(title)),
    ...[...byTitle.keys()].filter((title) => !(SECTION_ORDER as readonly string[]).includes(title)),
  ];
  return ordered.map((title) => ({ title, topics: byTitle.get(title) ?? [] }));
}

type Mode = 'onboarding' | 'edit';

/** "O que move você?" — cadastro e Conta › Interesses. */
export function InterestsPickerScreen({ mode }: { mode: Mode }) {
  const load = useCallback(() => getTopicGroups(), []);
  const groups = useAsyncData(load);
  const { interests, toggleInterest, saveInterests } = useAccount();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<TopicId[]>(interests);
  const [busy, setBusy] = useState(false);
  const [footerHeight, setFooterHeight] = useState(0);
  const [pressed, setPressed] = useState(false);
  const editing = mode === 'edit';
  const selection = editing ? draft : interests;
  const count = selection.length;
  const sections = useMemo(() => interestSections(groups.data ?? []), [groups.data]);
  const progress = Math.min(count, SUGGESTED_MINIMUM);

  const toggle = useCallback((id: TopicId) => {
    haptic('selection');
    if (editing) {
      setDraft((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
      return;
    }
    toggleInterest(id);
  }, [editing, toggleInterest]);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await saveInterests(selection);
      if (editing) {
        toast.show('Interesses atualizados.');
        if (router.canGoBack()) router.back();
        else router.replace('/perfil');
      } else {
        router.push('/boas-vindas/comunas');
      }
    } catch (error) {
      toast.show(describeError(error));
    } finally {
      setBusy(false);
    }
  };

  const skip = () => router.push('/boas-vindas/comunas');

  return (
    <Screen edges={['left', 'right']} backgroundColor={P.bg}>
      <ScrollView
        style={styles.scroll}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: footerHeight + 24 }]}>
        <View style={styles.top}>
          <IconButton icon="back" size={22} strokeWidth={2.6} accessibilityLabel="Voltar" onPress={() => router.back()} />
          {!editing ? (
            <Pressable onPress={skip} accessibilityRole="button" accessibilityLabel="Pular" style={({ pressed }) => [styles.skip, pressed && styles.pressed]}>
              <AppText style={styles.skipLabel}>Pular</AppText>
            </Pressable>
          ) : null}
        </View>

        <AppText style={styles.title} accessibilityRole="header" maxFontSizeMultiplier={1.2}>
          O QUE MOVE{'\n'}<AppText style={styles.title} color={P.red}>VOCÊ?</AppText>
        </AppText>
        <AppText style={styles.subtitle} color={P.subtitle}>Escolha os assuntos que quer acompanhar. Dá pra mudar depois.</AppText>

        {groups.status === 'error' ? (
          <StateView kind="error" message="Não conseguimos carregar os assuntos." onRetry={groups.reload} />
        ) : groups.data ? (
          <View>
            {sections.map((section, index) => (
              <View key={section.title} style={styles.section}>
                <View style={styles.sectionHead} accessibilityRole="header">
                  <AppText style={styles.sectionNumber} color={P.red}>{String(index + 1).padStart(2, '0')}</AppText>
                  <AppText style={styles.sectionName}>{section.title}</AppText>
                  <View style={styles.sectionRule} />
                </View>
                <View style={styles.chips}>
                  {section.topics.map((topic) => {
                    const checked = selection.includes(topic.id);
                    return (
                      <Pressable
                        key={topic.id}
                        onPress={() => toggle(topic.id)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked }}
                        accessibilityLabel={topic.label}
                        style={({ pressed: chipPressed }) => [styles.chip, checked && styles.chipOn, chipPressed && styles.pressed]}>
                        <Icon name={checked ? 'check' : 'plus'} size={16} strokeWidth={3} color={checked ? P.paper : P.ink} />
                        <AppText style={styles.chipLabel} color={checked ? P.paper : P.ink}>{topic.label}</AppText>
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

      <View style={[styles.footer, { paddingBottom: 26 + insets.bottom }]} onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}>
        <View style={styles.status}>
          <View style={styles.progress} accessible={false} importantForAccessibility="no-hide-descendants">
            {Array.from({ length: 3 }, (_, index) => <View key={index} style={[styles.progressSquare, index < progress && styles.progressSquareOn]} />)}
          </View>
          <AppText style={styles.counter} accessibilityLiveRegion="polite">
            {count < SUGGESTED_MINIMUM ? `${count} DE ${SUGGESTED_MINIMUM}` : `${count} ESCOLHIDOS ✓`}
          </AppText>
          <AppText style={styles.hint} color={P.secondary} accessibilityLiveRegion="polite">
            {count < SUGGESTED_MINIMUM
              ? 'Escolha pelo menos 3 pra um feed mais certeiro.'
              : 'Boa! Seu feed já começa com a sua cara.'}
          </AppText>
        </View>
        <View style={styles.ctaWrap}>
          <View pointerEvents="none" style={[styles.ctaShadow, pressed && styles.ctaShadowPressed]} />
          <Pressable
            onPress={() => { void submit(); }}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            accessibilityRole="button"
            accessibilityState={{ busy }}
            accessibilityLabel={editing ? 'Salvar interesses' : 'Continuar'}
            style={[styles.cta, pressed && styles.ctaPressed]}>
            <AppText style={styles.ctaLabel} color={P.paper}>{editing ? 'Salvar' : 'Continuar'}</AppText>
            <Icon name="arrowRight" size={18} strokeWidth={3} color={P.paper} />
          </Pressable>
        </View>
      </View>
    </Screen>
  );
}

export default InterestsPickerScreen;

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
  top: {
    marginHorizontal: -10,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  skip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  skipLabel: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textDecorationLine: 'underline',
    color: P.ink,
  },
  title: {
    marginTop: 14,
    fontFamily: Fonts.anton,
    fontSize: 64,
    lineHeight: 72,
    textTransform: 'uppercase',
    color: P.ink,
  },
  subtitle: {
    marginTop: 12,
    fontFamily: Fonts.regular,
    fontSize: 17,
    lineHeight: 25,
  },
  section: {
    marginTop: 26,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionNumber: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionName: {
    flexShrink: 1,
    fontFamily: Fonts.monoSemibold,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    color: P.ink,
  },
  sectionRule: {
    flex: 1,
    borderTopWidth: 2,
    borderTopColor: P.ink,
  },
  chips: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 10,
    paddingRight: 13,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 6,
    backgroundColor: P.paper,
  },
  chipOn: {
    backgroundColor: P.ink,
  },
  chipLabel: {
    flexShrink: 1,
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 23,
  },
  pressed: {
    opacity: 0.85,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 14,
    paddingHorizontal: 24,
    paddingBottom: 26,
    gap: 12,
    borderTopWidth: 2,
    borderTopColor: P.ink,
    backgroundColor: P.bg,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progress: {
    flexDirection: 'row',
    gap: 4,
  },
  progressSquare: {
    width: 14,
    height: 14,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 3,
    backgroundColor: P.paper,
  },
  progressSquareOn: {
    backgroundColor: P.red,
  },
  counter: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 12,
    lineHeight: 19,
    letterSpacing: 0.96,
    color: P.ink,
  },
  hint: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  ctaWrap: {
    position: 'relative',
  },
  ctaShadow: {
    position: 'absolute',
    top: 3,
    left: 3,
    right: -3,
    bottom: -3,
    borderRadius: 6,
    backgroundColor: P.ink,
  },
  ctaShadowPressed: {
    top: 1,
    left: 1,
    right: -1,
    bottom: -1,
  },
  cta: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 6,
    backgroundColor: P.red,
  },
  ctaPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  ctaLabel: {
    fontFamily: Fonts.anton,
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: 0.88,
    textTransform: 'uppercase',
  },
});
