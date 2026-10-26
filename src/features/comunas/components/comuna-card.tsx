import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { StripedPlaceholder } from '@/components/striped-placeholder';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { formatPeople } from '@/lib/format';
import type { Comuna, Topic, TopicId } from '@/types/models';

import { ComunaMark } from './comuna-mark';
import { JoinButton } from './join-button';

/** Largura do cartão na faixa horizontal do Explorar. */
export const COMPACT_CARD_WIDTH = 226;

type RecommendationCardProps = {
  comuna: Comuna;
  /** Assuntos com rótulo curto, para as etiquetas. */
  topics: Topic[];
  /** Interesses da pessoa: etiquetas em comum ficam escuras. */
  interests: TopicId[];
};

/** Cartão largo das recomendações do onboarding (2c): capa, selo, descrição e assuntos. */
export function RecommendationCard({ comuna, topics, interests }: RecommendationCardProps) {
  const tags = comuna.topics
    .map((id) => topics.find((t) => t.id === id))
    .filter((t): t is Topic => t !== undefined);
  return (
    <View style={styles.card}>
      <View style={styles.wideCover}>
        <StripedPlaceholder label={comuna.coverAlt} prefix="capa" showLabel={false} style={styles.coverFill} />
        <AppText style={styles.coverLabel} accessible={false}>
          capa: {comuna.coverAlt}
        </AppText>
        <ComunaMark initials={comuna.initials} tone={comuna.tone} size={54} raised style={styles.wideMark} />
      </View>
      <View style={styles.wideBody}>
        <View style={styles.titleRow}>
          <View style={styles.titleText}>
            <AppText style={styles.wideName} accessibilityRole="header">
              {comuna.name}
            </AppText>
            <AppText style={styles.mono} color={Colors.muted}>
              {formatPeople(comuna.memberCount)} membros · {comuna.place}
            </AppText>
          </View>
          <JoinButton comuna={comuna} height={40} />
        </View>
        <AppText style={styles.wideDesc} color={Colors.inkSoft} numberOfLines={2}>
          {comuna.description}
        </AppText>
        <View style={styles.tags} accessibilityLabel={`Assuntos: ${tags.map((t) => t.shortLabel).join(', ')}`}>
          {tags.map((t) => {
            const mine = interests.includes(t.id);
            return (
              <View key={t.id} style={[styles.tag, mine && styles.tagMine]}>
                <AppText style={styles.tagText} color={mine ? Colors.cream : Colors.ink}>
                  {t.shortLabel}
                </AppText>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

type CompactCardProps = {
  comuna: Comuna;
  onOpen: () => void;
};

/** Cartão estreito da faixa "Comunas para você" no Explorar (2e). */
export function CompactComunaCard({ comuna, onOpen }: CompactCardProps) {
  return (
    <View style={[styles.card, styles.compact]}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="link"
        accessibilityLabel={`${comuna.name}, ${formatPeople(comuna.memberCount)} membros. ${comuna.description}`}
        accessibilityHint="Abre a comuna"
        style={({ pressed }) => [styles.compactOpen, pressed && styles.pressed]}>
        <View style={styles.compactCover}>
          <StripedPlaceholder label={comuna.coverAlt} prefix="capa" showLabel={false} style={styles.coverFill} />
          <ComunaMark initials={comuna.initials} tone={comuna.tone} size={44} raised style={styles.compactMark} />
        </View>
        <View style={styles.compactBody}>
          <AppText style={styles.compactName} numberOfLines={2}>
            {comuna.name}
          </AppText>
          <AppText style={styles.mono} color={Colors.muted}>
            {formatPeople(comuna.memberCount)} membros
          </AppText>
          <AppText style={styles.compactDesc} color={Colors.inkSoft} numberOfLines={2}>
            {comuna.description}
          </AppText>
        </View>
      </Pressable>
      <View style={styles.compactAction}>
        <JoinButton comuna={comuna} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: Colors.paper,
  },
  coverFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 0,
  },
  wideCover: {
    height: 78,
  },
  coverLabel: {
    position: 'absolute',
    top: 10,
    right: Spacing.three,
    fontFamily: Fonts.mono,
    fontSize: 10,
    lineHeight: 13,
    color: '#5A5047',
  },
  wideMark: {
    position: 'absolute',
    left: 14,
    bottom: -22,
  },
  wideBody: {
    paddingTop: 30,
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: Spacing.two,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two + 2,
  },
  titleText: {
    flex: 1,
    minWidth: 0,
  },
  wideName: {
    fontFamily: Fonts.condensed,
    fontSize: 25,
    lineHeight: 26,
    textTransform: 'uppercase',
  },
  mono: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.4,
    marginTop: 4,
  },
  wideDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tag: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.straw,
  },
  tagMine: {
    backgroundColor: Colors.ink,
  },
  tagText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10.5,
    lineHeight: 13,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  compact: {
    width: COMPACT_CARD_WIDTH,
  },
  compactOpen: {
    flex: 1,
  },
  pressed: {
    opacity: 0.8,
  },
  compactCover: {
    height: 64,
  },
  compactMark: {
    position: 'absolute',
    left: Spacing.three,
    bottom: -18,
  },
  compactBody: {
    paddingTop: Spacing.six,
    paddingHorizontal: Spacing.three,
    gap: 6,
    flex: 1,
  },
  compactName: {
    fontFamily: Fonts.condensed,
    fontSize: 21,
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  compactDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  compactAction: {
    padding: Spacing.three,
    paddingTop: Spacing.two,
  },
});
