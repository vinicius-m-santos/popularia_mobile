import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StatRow } from '@/components/stat-row';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { UnderlineTabs, type TabOption } from '@/components/underline-tabs';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAccount, useMe } from '@/features/account/account-context';
import { getComunas } from '@/features/comunas/api';
import { ComunaRow } from '@/features/comunas/components/comuna-row';
import { useInteractions } from '@/features/interactions/interactions-context';
import { useActionsSheet } from '@/features/moderation/actions-sheet';
import { profileTarget } from '@/features/moderation/targets';
import { useModerationQueue } from '@/features/moderation/use-moderation-queue';
import { PostCard } from '@/features/posts/components/post-card';
import { useLocalFeedItems } from '@/features/posts/use-local-posts';
import { useAsyncData, type AsyncData } from '@/hooks/use-async-data';
import { NotFoundError } from '@/lib/errors';
import { formatPeople } from '@/lib/format';
import { goBack, openModeration, useNav } from '@/lib/routes';
import type { Comuna, CreatorInfo, FeedItem, Profile } from '@/types/models';

import { getProfile, getUserPosts } from './api';
import { FollowButton } from './components/follow-button';

type ProfileTab = 'posts' | 'episodios' | 'comunas';

/**
 * Perfil pessoal (2i) na aba Perfil e perfil de outras pessoas (2j), inclusive
 * criadoras com podcast. Sem `id` na rota, mostra o perfil da própria pessoa.
 */
export default function ProfileScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? 'me';
  const isMe = id === 'me';
  const isTabRoot = params.id === undefined;

  const loadProfile = useCallback(() => getProfile(id), [id]);
  const loadPosts = useCallback(() => getUserPosts(id), [id]);
  const loadComunas = useCallback(() => getComunas(), []);
  const profile = useAsyncData(loadProfile);
  const posts = useAsyncData(loadPosts);
  const comunas = useAsyncData(loadComunas);

  const header = (handle?: string, onMore?: () => void) => (
    <ProfileBar isMe={isMe} canGoBack={!isTabRoot} handle={handle} onMore={onMore} />
  );

  if (profile.status === 'loading') {
    return (
      <Screen>
        {header()}
        <StateView kind="loading" message="Carregando perfil" />
      </Screen>
    );
  }

  if (profile.status === 'error' || !profile.data) {
    const notFound = profile.error instanceof NotFoundError;
    return (
      <Screen>
        {header()}
        {notFound ? (
          <StateView kind="empty" title="Perfil não encontrado" message="A conta pode ter sido removida." />
        ) : (
          <StateView kind="error" message="Não conseguimos carregar este perfil." onRetry={profile.reload} />
        )}
      </Screen>
    );
  }

  return (
    <ProfileContent
      profile={profile.data}
      isMe={isMe}
      header={header}
      posts={posts}
      allComunas={comunas.data ?? []}
    />
  );
}

type ContentProps = {
  profile: Profile;
  isMe: boolean;
  header: (handle?: string, onMore?: () => void) => ReactNode;
  posts: AsyncData<FeedItem[]>;
  allComunas: Comuna[];
};

function ProfileContent({ profile, isMe, header, posts, allComunas }: ContentProps) {
  const toast = useToast();
  const nav = useNav();
  const sheet = useActionsSheet();
  const me = useMe();
  const { profile: account } = useAccount();
  const { membershipOf } = useInteractions();
  const localPosts = useLocalFeedItems((p) => isMe && p.authorId === 'me');
  const [tab, setTab] = useState<ProfileTab>('posts');

  // No próprio perfil, nome, @, bio, cidade e comunas vêm do cadastro e do estado local.
  const user = isMe ? me : profile.user;
  const bio = isMe ? account.bio.trim() || profile.bio : profile.bio;
  const meta = isMe ? [account.city.trim(), profile.meta].filter(Boolean).join(' · ') : profile.meta;
  const postItems = [...localPosts, ...(posts.data ?? [])];
  const stats = isMe ? [{ value: String(postItems.length), label: 'Publicações' }, ...profile.stats] : profile.stats;
  // Própria conta: participação local ou, na API, a informada pelo servidor com cada comuna.
  const comunas = useMemo(
    () =>
      isMe
        ? allComunas.filter((c) => membershipOf(c.id) ?? c.viewerIsMember ?? false)
        : profile.comunaIds.map((cid) => allComunas.find((c) => c.id === cid)).filter((c): c is Comuna => !!c),
    [isMe, membershipOf, profile.comunaIds, allComunas],
  );

  const tabs: TabOption<ProfileTab>[] = [
    { key: 'posts', label: 'Publicações' },
    ...(profile.creator ? [{ key: 'episodios' as const, label: 'Episódios' }] : []),
    { key: 'comunas', label: 'Comunas' },
  ];

  const soon = (what: string) => () => toast.show(`${what} chega numa próxima etapa.`);

  return (
    <Screen>
      {header(user.handle, isMe ? undefined : () => sheet.open(profileTarget(user, bio)))}
      <ScrollView stickyHeaderIndices={[1]} contentContainerStyle={styles.scroll}>
        <View style={styles.column}>
          {profile.creator ? <Masthead creator={profile.creator} /> : null}
          <View style={styles.identityBlock}>
            <View style={styles.identity}>
              <View style={styles.avatarRing} accessible={false}>
                <Avatar initials={user.initials} tone={user.tone} size={80} />
              </View>
              <View style={styles.names}>
                {user.badge ? (
                  <View style={styles.badge}>
                    <Badge label={user.badge} tone="red" />
                  </View>
                ) : null}
                <AppText style={styles.name} accessibilityRole="header">
                  {user.name}
                </AppText>
                <AppText variant="caption" style={styles.handle}>
                  @{user.handle}
                </AppText>
              </View>
            </View>
            <AppText style={styles.bio}>{bio}</AppText>
            {meta ? (
              <AppText style={styles.meta} color={Colors.muted}>
                {meta}
              </AppText>
            ) : null}
            <StatRow stats={stats} />

            {isMe ? (
              <View style={styles.actions}>
                <PillButton
                  label="Editar perfil"
                  onPress={soon('Editar perfil')}
                  variant="outline"
                  size="lg"
                  display
                  style={styles.action}
                />
                <PillButton
                  label="Interesses"
                  onPress={() => router.push('/interesses')}
                  variant="outline"
                  size="lg"
                  display
                  accessibilityHint="Escolha os assuntos que você acompanha"
                  style={styles.action}
                />
              </View>
            ) : (
              <View style={styles.actions}>
                <FollowButton user={user} size="lg" display style={styles.action} />
                <PillButton
                  label="Mensagem"
                  onPress={soon('Mensagens')}
                  variant="outline"
                  size="lg"
                  display
                  style={styles.action}
                />
              </View>
            )}

            {isMe
              ? allComunas
                  .filter((c) => c.moderatorIds.includes(me.id))
                  .map((c) => <ModeratorShortcut key={c.id} comuna={c} />)
              : null}

            {profile.creator ? <CollectiveSupport creatorName={profile.creator.mastheadTitle} /> : null}
          </View>
        </View>

        <View style={styles.tabs}>
          <View style={styles.column}>
            <UnderlineTabs options={tabs} value={tab} onChange={setTab} height={46} />
          </View>
        </View>

        <View style={styles.column}>
          {tab === 'posts' ? (
            <>
              {posts.status === 'loading' && localPosts.length === 0 ? (
                <StateView kind="loading" message="Carregando publicações" />
              ) : null}
              {posts.status === 'error' ? (
                <StateView kind="error" message="Não conseguimos carregar as publicações." onRetry={posts.reload} />
              ) : null}
              {posts.status === 'success' && postItems.length === 0 ? (
                <AppText style={styles.emptyText} color={Colors.muted}>
                  Nenhuma publicação ainda.
                </AppText>
              ) : null}
              {postItems.map((item, i) => (
                <PostCard key={item.id} item={item} showRule={i > 0} showMuted />
              ))}
            </>
          ) : null}

          {tab === 'episodios' && profile.creator ? (
            <View style={styles.listPad}>
              {profile.creator.episodes.map((e) => (
                <View key={e.number} style={styles.episode}>
                  <AppText style={styles.episodeNumber} maxFontSizeMultiplier={1.1}>
                    {e.number}
                  </AppText>
                  <View style={styles.episodeText}>
                    <AppText style={styles.episodeTitle}>{e.title}</AppText>
                    <AppText style={styles.episodeMeta} color={Colors.muted}>
                      {e.meta}
                    </AppText>
                  </View>
                  <IconButton
                    icon="play"
                    size={16}
                    color={Colors.cream}
                    background={Colors.ink}
                    accessibilityLabel={`Ouvir episódio ${e.number}: ${e.title}`}
                    onPress={soon('O player')}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {tab === 'comunas' ? (
            <View style={styles.listPad}>
              {comunas.length === 0 ? (
                <AppText style={styles.emptyRow} color={Colors.muted}>
                  Ainda não participa de nenhuma comuna.
                </AppText>
              ) : null}
              {comunas.map((c) => (
                <ComunaRow
                  key={c.id}
                  comuna={c}
                  subtitle={`${formatPeople(c.memberCount)} membros · ${c.place}`}
                  onOpen={() => nav.openComuna(c.id)}
                  trailing={<RoleTag label={c.moderatorIds.includes(user.id) ? 'Moderação' : 'Membro'} />}
                />
              ))}
            </View>
          ) : null}
        </View>
      </ScrollView>
    </Screen>
  );
}

type ProfileBarProps = { isMe: boolean; canGoBack: boolean; handle?: string; onMore?: () => void };

function ProfileBar({ isMe, canGoBack, handle, onMore }: ProfileBarProps) {
  return (
    <View style={styles.bar}>
      {canGoBack ? <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} /> : <View style={styles.barSpacer} />}
      <AppText style={styles.barHandle} numberOfLines={1} accessibilityRole="header">
        {handle ? `@${handle}` : ''}
      </AppText>
      {isMe ? (
        <IconButton
          icon="settings"
          accessibilityLabel="Conta e sessões"
          onPress={() => router.push('/conta')}
        />
      ) : onMore ? (
        <IconButton icon="more" size={20} accessibilityLabel="Mais opções do perfil" onPress={onMore} />
      ) : (
        <View style={styles.barSpacerRight} />
      )}
    </View>
  );
}

/** Atalho para a fila de moderação de uma comuna que a pessoa modera (2i). */
function ModeratorShortcut({ comuna }: { comuna: Comuna }) {
  const { pending, overview } = useModerationQueue(comuna.id);
  const status =
    overview.status !== 'success'
      ? 'Carregando a fila…'
      : pending === 0
        ? 'Fila em dia. Nenhuma denúncia pendente.'
        : `${pending} ${pending === 1 ? 'denúncia aguardando' : 'denúncias aguardando'} análise`;
  return (
    <Pressable
      onPress={() => openModeration(comuna.id)}
      accessibilityRole="button"
      accessibilityLabel={`Você modera c/ ${comuna.name}. ${status}`}
      style={({ pressed }) => [styles.modShortcut, pressed && styles.pressed]}>
      <Icon name="shield" size={24} color={Colors.red} />
      <View style={styles.modText}>
        <AppText style={styles.modTitle} color={Colors.cream}>
          Você modera c/ {comuna.name}
        </AppText>
        <AppText style={styles.modSub} color={Colors.onInkMuted}>
          {status}
        </AppText>
      </View>
      <Icon name="chevronRight" size={18} color={Colors.cream} />
    </Pressable>
  );
}

/** Faixa escura de criadora com o nome do podcast (2j). */
function Masthead({ creator }: { creator: CreatorInfo }) {
  return (
    <View style={styles.masthead} accessible accessibilityLabel={`${creator.mastheadTitle}. ${creator.mastheadKicker}`}>
      <AppText style={styles.mastKicker} color={Colors.onInkMuted}>
        {creator.mastheadKicker}
      </AppText>
      <AppText style={styles.mastTitle} color={Colors.cream} maxFontSizeMultiplier={1.1}>
        {creator.mastheadTitle}
      </AppText>
      <View style={styles.mastFoot}>
        <AppText style={styles.mastKicker} color={Colors.onInkMuted}>
          {creator.mastheadLeft}
        </AppText>
        <AppText style={styles.mastKicker} color={Colors.onInkMuted}>
          {creator.mastheadRight}
        </AppText>
      </View>
    </View>
  );
}

const TIERS = [
  { value: 'R$ 5', label: 'Ouvinte' },
  { value: 'R$ 15', label: 'Apoiadora' },
  { value: 'R$ 30', label: 'Coletivo' },
];

/** Apresentação do apoio coletivo. Ainda não existe: nada aqui aceita pagamento. */
function CollectiveSupport({ creatorName }: { creatorName: string }) {
  return (
    <View style={styles.support}>
      <View style={styles.supportHead}>
        <AppText style={styles.supportTitle}>Apoio coletivo</AppText>
        <View style={styles.soonTag}>
          <AppText style={styles.soonText}>Em breve</AppText>
        </View>
      </View>
      <AppText style={styles.supportText} color={Colors.inkSoft}>
        Em breve será possível apoiar o {creatorName} com contribuições mensais. Quem apoia vê para onde vai cada real.
      </AppText>
      <View style={styles.tiers}>
        {TIERS.map((t) => (
          <View key={t.label} style={styles.tier}>
            <AppText style={styles.tierValue} color={Colors.inkSoft}>
              {t.value}
            </AppText>
            <AppText style={styles.tierLabel} color={Colors.muted}>
              {t.label} · por mês
            </AppText>
          </View>
        ))}
      </View>
    </View>
  );
}

function RoleTag({ label }: { label: string }) {
  return (
    <View style={styles.soonTag}>
      <AppText style={styles.soonText}>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  barSpacer: {
    width: 10,
  },
  barSpacerRight: {
    width: 44,
  },
  barHandle: {
    flex: 1,
    fontFamily: Fonts.monoSemibold,
    fontSize: 12.5,
    lineHeight: 16,
  },
  scroll: {
    paddingBottom: Spacing.seven,
  },
  column: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  masthead: {
    backgroundColor: Colors.ink,
    paddingTop: Spacing.four,
    paddingHorizontal: Spacing.five,
    paddingBottom: 14,
    borderBottomWidth: 5,
    borderBottomColor: Colors.red,
  },
  mastKicker: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mastTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 64,
    lineHeight: 60,
    textTransform: 'uppercase',
    marginTop: 6,
    paddingTop: 4,
  },
  mastFoot: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.two,
    marginTop: Spacing.two + 2,
    paddingTop: Spacing.two,
    borderTopWidth: 1,
    borderTopColor: Colors.inkRule,
  },
  identityBlock: {
    paddingTop: Spacing.five,
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.four,
    gap: 14,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarRing: {
    padding: 3,
    borderRadius: 50,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.cream,
  },
  names: {
    flex: 1,
    minWidth: 0,
  },
  badge: {
    alignSelf: 'flex-start',
    marginBottom: 5,
  },
  name: {
    fontFamily: Fonts.condensed,
    fontSize: 34,
    lineHeight: 34,
    textTransform: 'uppercase',
  },
  handle: {
    fontSize: 13.5,
    marginTop: 4,
  },
  bio: {
    fontSize: 15,
    lineHeight: 22,
  },
  meta: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  action: {
    flex: 1,
    minHeight: 46,
  },
  modShortcut: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: 14,
    borderRadius: Radius.xl,
    backgroundColor: Colors.ink,
  },
  pressed: {
    opacity: 0.8,
  },
  modText: {
    flex: 1,
    minWidth: 0,
  },
  modTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 14.5,
    lineHeight: 19,
  },
  modSub: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  support: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Colors.ink,
    borderRadius: 14,
    padding: Spacing.four,
    gap: Spacing.three,
    backgroundColor: Colors.paper,
  },
  supportHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  supportTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 24,
    lineHeight: 26,
    textTransform: 'uppercase',
  },
  supportText: {
    fontSize: 14,
    lineHeight: 20,
  },
  tiers: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  tier: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: Colors.strawDark,
    borderRadius: Radius.lg,
    padding: Spacing.two + 2,
  },
  tierValue: {
    fontFamily: Fonts.condensed,
    fontSize: 24,
    lineHeight: 26,
  },
  tierLabel: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 3,
  },
  soonTag: {
    paddingHorizontal: 7,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.straw,
  },
  soonText: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tabs: {
    backgroundColor: Colors.cream,
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: Colors.ink,
  },
  emptyText: {
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.six,
    fontSize: 14.5,
  },
  listPad: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.one,
  },
  emptyRow: {
    paddingVertical: Spacing.five,
    fontSize: 14.5,
  },
  episode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  episodeNumber: {
    minWidth: 46,
    fontFamily: Fonts.condensed,
    fontSize: 38,
    lineHeight: 36,
    color: Colors.red,
  },
  episodeText: {
    flex: 1,
    minWidth: 0,
  },
  episodeTitle: {
    fontFamily: Fonts.extrabold,
    fontSize: 15.5,
    lineHeight: 20,
  },
  episodeMeta: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 3,
  },
});
