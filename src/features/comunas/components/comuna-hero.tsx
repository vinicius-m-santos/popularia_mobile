import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { TONE_COLORS, AvatarStack } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { StripedPlaceholder } from '@/components/striped-placeholder';
import { useToast } from '@/components/toast';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useMe } from '@/features/account/account-context';
import { useInteractions } from '@/features/interactions/interactions-context';
import { formatPeople } from '@/lib/format';
import { goBack, openModeration } from '@/lib/routes';
import type { ComunaDetails } from '@/types/models';

import { useComunaMembership } from '../use-membership';

const COVER_HEIGHT = 170;

/** Capa, identidade, números e ações da comuna (design 1b). */
export function ComunaHero({ comuna }: { comuna: ComunaDetails }) {
  const toast = useToast();
  const { isOn, toggle } = useInteractions();
  const me = useMe();
  // Na API, a moderação ainda não é listada (moderatorIds vem vazio): as ferramentas, fictícias, não aparecem.
  const moderates = comuna.moderatorIds.includes(me.id);
  const membership = useComunaMembership(comuna);
  const { joined } = membership;
  const notify = isOn('notifyComunas', comuna.id);
  const tone = TONE_COLORS[comuna.tone];

  // O total do servidor já inclui a pessoa se ela era membro; ajusta pelo estado local.
  const memberCount = comuna.memberCount - (comuna.viewerIsMember ? 1 : 0) + (joined ? 1 : 0);
  const others = Math.max(0, memberCount - 2);
  const [first, second] = comuna.featuredMembers;

  const onNotify = () => {
    const on = toggle('notifyComunas', comuna.id);
    toast.show(on ? 'Avisos ligados nesta simulação. Nada será enviado.' : 'Avisos desta comuna desligados.');
  };

  return (
    <View>
      <StripedPlaceholder
        label={comuna.coverAlt}
        prefix="capa"
        variant="dark"
        style={styles.cover}
      />
      <View style={styles.coverButtons}>
        <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} background={Colors.cream} />
        <IconButton
          icon="more"
          size={20}
          accessibilityLabel="Mais opções da comuna"
          onPress={() => toast.show('Compartilhar e denunciar chegam numa próxima etapa.')}
          background={Colors.cream}
        />
      </View>

      <View style={styles.content}>
        <View style={styles.identityRow}>
          <View style={[styles.mark, { backgroundColor: tone.bg }]} accessible={false}>
            <AppText style={styles.markText} color={tone.fg} maxFontSizeMultiplier={1}>
              {comuna.initials}
            </AppText>
          </View>
          {comuna.onlineCount !== undefined ? (
            <View style={styles.online}>
              <View style={styles.onlineDot} />
              <AppText variant="label" style={styles.onlineText}>
                {comuna.onlineCount} online agora
              </AppText>
            </View>
          ) : null}
        </View>

        <View>
          <AppText variant="display" accessibilityRole="header" style={styles.name}>
            {comuna.name}
          </AppText>
          <AppText style={styles.meta} color={Colors.muted}>
            c/{comuna.handle} · {comuna.place} · desde {comuna.foundedYear}
          </AppText>
        </View>

        <AppText style={styles.description}>{comuna.description}</AppText>

        <View style={styles.stats}>
          {comuna.stats.map((s, i) => (
            <View
              key={s.label}
              style={[styles.stat, i > 0 && styles.statDivider]}
              accessible
              accessibilityLabel={`${i === 0 ? formatPeople(memberCount) : s.value} ${s.label}`}>
              <AppText style={styles.statValue} maxFontSizeMultiplier={1.3}>
                {i === 0 ? formatPeople(memberCount) : s.value}
              </AppText>
              <AppText style={styles.statLabel} color={Colors.muted} numberOfLines={1}>
                {s.label}
              </AppText>
            </View>
          ))}
        </View>

        {first && second ? (
          <View style={styles.faces}>
            <AvatarStack people={comuna.featuredMembers} />
            <AppText style={styles.facesText} color={Colors.inkSoft}>
              {first.name.split(' ')[0]}, {second.name.split(' ')[0]} e mais {formatPeople(others)} pessoas
            </AppText>
          </View>
        ) : null}

        <View style={styles.actions}>
          <PillButton
            label={membership.pending ? (joined ? 'Saindo…' : 'Entrando…') : joined ? 'Participando' : 'Participar da comuna'}
            icon={joined && !membership.pending ? 'check' : undefined}
            onPress={membership.toggleJoin}
            disabled={membership.pending}
            variant={joined ? 'outline' : 'primary'}
            size="lg"
            display
            selected={joined}
            accessibilityHint={joined ? 'Toque para sair da comuna' : undefined}
            style={styles.join}
          />
          <IconButton
            icon="bell"
            accessibilityLabel="Avisos da comuna"
            selected={notify}
            onPress={onNotify}
            color={notify ? Colors.cream : Colors.ink}
            background={notify ? Colors.ink : undefined}
            bordered
            style={styles.notify}
          />
        </View>

        {moderates ? (
          <Pressable
            onPress={() => openModeration(comuna.id)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.modTools, pressed && styles.pressed]}>
            <Icon name="shield" size={20} color={Colors.red} />
            <AppText style={styles.modLabel} color={Colors.cream}>
              Ferramentas de moderação
            </AppText>
            <Icon name="chevronRight" size={18} color={Colors.cream} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modTools: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: Colors.ink,
  },
  modLabel: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 14,
    lineHeight: 19,
  },
  pressed: {
    opacity: 0.8,
  },
  cover: {
    height: COVER_HEIGHT,
    borderRadius: 0,
    alignItems: 'flex-end',
    paddingRight: Spacing.four,
    paddingBottom: Spacing.three,
  },
  coverButtons: {
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  content: {
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.four,
    gap: 14,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginTop: -42,
  },
  mark: {
    width: 86,
    height: 86,
    borderRadius: 16,
    borderWidth: 3,
    borderColor: Colors.cream,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-4deg' }],
    boxShadow: `0 5px 0 ${Colors.ink}`,
  },
  markText: {
    fontFamily: Fonts.condensed,
    fontSize: 40,
    lineHeight: 44,
  },
  online: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 4,
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.red,
  },
  onlineText: {
    textTransform: 'none',
    letterSpacing: 0.4,
  },
  name: {
    lineHeight: 38,
  },
  meta: {
    marginTop: Spacing.two,
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 15,
  },
  stats: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: Colors.ink,
  },
  stat: {
    flex: 1,
    paddingVertical: Spacing.two + 2,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.rule,
    paddingLeft: Spacing.three,
  },
  statValue: {
    fontFamily: Fonts.condensed,
    fontSize: 28,
    lineHeight: 30,
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 3,
  },
  faces: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  facesText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  join: {
    flex: 1,
  },
  notify: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 2,
  },
});
