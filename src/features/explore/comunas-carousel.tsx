import { Image } from 'expo-image';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Icon } from '@/components/icon';
import { Fonts } from '@/constants/theme';
import { prepareComuna } from '@/features/comunas/queries';
import type { Comuna, TopicId } from '@/types/models';

import { ExploreSectionHeading } from './explore-section-heading';
import { useExploreMembership } from './use-explore-membership';

const CARD_WIDTH = 200;
const CARD_GAP = 10;
const MAX_SUGGESTIONS = 8;

const P = {
  bg: '#F2EADB',
  paper: '#FBF7EF',
  ink: '#15120F',
  red: '#BF3326',
  redText: '#A3261C',
  secondary: '#5E554A',
} as const;

/** Cores de marca pedidas no mockup, alternadas pela posição do card. */
const MARKS = [
  { bg: '#F4C534', fg: P.ink },
  { bg: P.ink, fg: P.bg },
  { bg: P.red, fg: P.paper },
  { bg: '#E8DDC8', fg: P.ink },
] as const;

/** Comunas abertas que a pessoa ainda não participa, priorizando cidade e interesses. */
export function suggestedComunas(comunas: Comuna[], interests: TopicId[], city: string): Comuna[] {
  const cityName = city.split(' · ')[0]?.trim() ?? city;
  const wanted = new Set(interests);
  const score = (comuna: Comuna) => {
    const sameCity = !!cityName && (comuna.place === city || comuna.place.startsWith(`${cityName} ·`) || comuna.place === cityName);
    const matchedTopics = (comuna.topics ?? []).filter((topic) => wanted.has(topic)).length;
    return (sameCity ? 2 : 0) + matchedTopics;
  };

  return comunas
    .filter((comuna) => !comuna.viewerIsMember && comuna.visibility !== 'private' && comuna.status !== 'archived')
    .map((comuna, index) => ({ comuna, index, score: score(comuna) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ comuna }) => comuna)
    .slice(0, MAX_SUGGESTIONS);
}

type ComunasToKnowProps = {
  comunas: Comuna[];
  interests: TopicId[];
  city: string;
  onOpenComuna: (comuna: Comuna) => void;
  onSeeAll: () => void;
};

/** Carrossel horizontal de comunas sugeridas, com entrada otimista. */
export function ComunasToKnowSection({ comunas, interests, city, onOpenComuna, onSeeAll }: ComunasToKnowProps) {
  const suggestions = useMemo(() => suggestedComunas(comunas, interests, city), [comunas, interests, city]);
  if (!suggestions.length) return null;

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <ExploreSectionHeading label="Comunas para conhecer" actionLabel="Ver todas" onAction={onSeeAll} />
      </View>
      <FlatList
        horizontal
        data={suggestions}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => <ComunaSuggestionCard comuna={item} index={index} onOpen={() => onOpenComuna(item)} />}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_GAP}
        decelerationRate="fast"
        contentContainerStyle={styles.carousel}
        accessibilityLabel="Comunas para conhecer"
      />
    </View>
  );
}

function ComunaSuggestionCard({ comuna, index, onOpen }: { comuna: Comuna; index: number; onOpen: () => void }) {
  const [pressed, setPressed] = useState(false);
  const palette = MARKS[index % MARKS.length] ?? MARKS[0];
  const description = comuna.description.trim();
  const label = description ? `${comuna.name}, ${description}` : comuna.name;

  return (
    <View style={[styles.card, pressed && styles.cardPressed]}>
      <Pressable
        onPress={onOpen}
        onPressIn={() => { setPressed(true); void prepareComuna(comuna); }}
        onPressOut={() => setPressed(false)}
        accessibilityRole="link"
        accessibilityLabel={label}
        accessibilityHint="Abre a comuna"
        style={styles.cardBody}>
        <View style={[styles.mark, { backgroundColor: palette.bg, borderColor: P.ink }]} accessible={false} importantForAccessibility="no-hide-descendants">
          <AppText style={styles.initials} color={palette.fg} maxFontSizeMultiplier={1}>{comuna.initials}</AppText>
          {comuna.markUrl ? <Image source={{ uri: comuna.markUrl }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={comuna.markUrl} style={StyleSheet.absoluteFill} accessible={false} /> : null}
        </View>
        <View style={styles.copy}>
          <AppText style={styles.name} numberOfLines={1} ellipsizeMode="tail">{comuna.name}</AppText>
          <AppText style={styles.description} color={P.secondary} numberOfLines={2} ellipsizeMode="tail">{description}</AppText>
        </View>
      </Pressable>
      <ExploreJoinButton comuna={comuna} />
    </View>
  );
}

function ExploreJoinButton({ comuna }: { comuna: Pick<Comuna, 'id' | 'name' | 'viewerIsMember'> }) {
  const { joined, pending, toggleJoin } = useExploreMembership(comuna);
  return (
    <Pressable
      onPress={() => { void toggleJoin(); }}
      disabled={pending}
      accessibilityRole="button"
      accessibilityLabel={joined ? `Participando de ${comuna.name}` : `Participar de ${comuna.name}`}
      accessibilityHint={joined ? 'Toque para sair da comuna' : 'Toque para entrar na comuna'}
      accessibilityState={{ selected: joined, busy: pending, disabled: pending }}
      style={({ pressed }) => [
        styles.join,
        joined ? styles.joined : styles.idle,
        pressed && !pending && styles.joinPressed,
      ]}>
      {joined ? <Icon name="check" size={14} color={P.ink} strokeWidth={3} /> : null}
      <AppText style={styles.joinLabel} color={joined ? P.ink : P.paper} numberOfLines={1}>
        {joined ? 'Participando' : 'Participar'}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    paddingTop: 26,
  },
  header: {
    paddingHorizontal: 16,
  },
  carousel: {
    paddingHorizontal: 16,
    paddingBottom: 6,
    paddingTop: 10,
    gap: CARD_GAP,
  },
  card: {
    width: CARD_WIDTH,
    minHeight: 204,
    justifyContent: 'space-between',
    gap: 10,
    padding: 12,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 6,
    backgroundColor: P.paper,
  },
  cardPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowColor: P.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  cardBody: {
    gap: 10,
  },
  mark: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  initials: {
    fontFamily: Fonts.anton,
    fontSize: 19,
    lineHeight: 27,
  },
  copy: {
    minHeight: 68,
    gap: 8,
  },
  name: {
    fontFamily: Fonts.extrabold,
    fontSize: 16,
    lineHeight: 24,
  },
  description: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  join: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
    borderWidth: 2,
    borderColor: P.ink,
    borderRadius: 6,
  },
  idle: {
    backgroundColor: P.red,
  },
  joined: {
    backgroundColor: P.paper,
  },
  joinPressed: {
    transform: [{ translateX: 2 }, { translateY: 2 }],
    shadowColor: P.ink,
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 3,
  },
  joinLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 14,
    lineHeight: 20,
  },
});
