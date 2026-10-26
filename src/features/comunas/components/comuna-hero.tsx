import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { TONE_COLORS, AvatarStack } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { StripedPlaceholder } from '@/components/striped-placeholder';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useMe } from '@/features/account/account-context';
import { useInteractions } from '@/features/interactions/interactions-context';
import { formatPeople } from '@/lib/format';
import { goBack, openManageComuna, openModeration } from '@/lib/routes';
import type { ComunaDetails } from '@/types/models';

import { cancelJoinRequest, requestToJoin, respondToTransfer, roleLabel } from '../api';
import { comunaErrorMessage } from '../errors';
import { useComunaMembership } from '../use-membership';

const COVER_HEIGHT = 170;

/** Capa, identidade, números e ações da comuna (design 1b). `onChanged` recarrega a comuna. */
export function ComunaHero({ comuna, onChanged }: { comuna: ComunaDetails; onChanged?: () => void }) {
  const toast = useToast();
  const { isOn, toggle } = useInteractions();
  const me = useMe();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
  // Modo demonstração: ferramentas fictícias pelo ID local dos mocks. Na API: papel e permissões do servidor.
  const moderates = DEMO_MODE && comuna.moderatorIds.includes(me.id);
  const perms = comuna.viewerPermissions;
  const manages = !DEMO_MODE && (comuna.viewerRole === 'founder' || comuna.viewerRole === 'moderator');
  const isOwner = !DEMO_MODE && comuna.viewerRole === 'founder';
  const archived = comuna.status === 'archived';
  const membership = useComunaMembership(comuna);
  const { joined } = membership;
  // Comuna privada, na API, sem participação: a entrada é por pedido aprovado pela moderação.
  const requestsEntry = !DEMO_MODE && comuna.visibility === 'private' && !joined;
  const requested = comuna.viewerJoinRequest === 'pending';
  const incoming = comuna.ownershipTransfer?.direction === 'incoming' ? comuna.ownershipTransfer : null;

  const act = async (work: () => Promise<void>, success: string) => {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await work();
      toast.show(success);
      onChanged?.();
    } catch (error) {
      toast.show(comunaErrorMessage(error));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  };

  const onRequest = () =>
    requested
      ? act(() => cancelJoinRequest(comuna.id), 'Pedido retirado.')
      : act(() => requestToJoin(comuna.id), 'Pedido enviado. A moderação da comuna vai analisar.');

  const onTransfer = (accept: boolean) => {
    if (!incoming) return;
    if (!accept) return act(() => respondToTransfer(comuna.id, false), 'Você recusou a comuna.');
    Alert.alert(
      'Aceitar a comuna?',
      `Você passa a ser proprietário de c/${comuna.handle} e a responder pela gestão dela. ${incoming.from.name} vira membro comum. A comuna conta no seu limite de 3 comunas ativas.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Aceitar', onPress: () => act(() => respondToTransfer(comuna.id, true), `Agora você é proprietário de c/${comuna.handle}.`) },
      ],
    );
  };
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
          <AppText variant="display" accessibilityRole="header">
            {comuna.name}
          </AppText>
          <AppText style={styles.meta} color={Colors.muted}>
            c/{comuna.handle} · {comuna.place} · desde {comuna.foundedYear}
          </AppText>
        </View>

        {archived ? (
          <View style={styles.archived} accessibilityRole="summary">
            <AppText style={styles.archivedTitle} color={Colors.cream}>
              Comuna arquivada
            </AppText>
            <AppText style={styles.archivedText} color={Colors.onInkSoft}>
              O histórico continua para leitura de quem participa. Não há novas publicações, comentários nem membros.
            </AppText>
          </View>
        ) : null}

        {!DEMO_MODE && comuna.viewerRole ? (
          <AppText style={styles.role} color={Colors.inkSoft}>
            Seu papel: {roleLabel(comuna.viewerRole)}
          </AppText>
        ) : null}

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

        {incoming ? (
          <View style={styles.offer}>
            <AppText style={styles.offerText}>
              {incoming.from.name} quer passar a comuna para você. Até você aceitar, nada muda.
            </AppText>
            <View style={styles.offerActions}>
              <PillButton label="Recusar" onPress={() => onTransfer(false)} disabled={pending} variant="outline" size="sm" />
              <PillButton label="Aceitar a comuna" onPress={() => onTransfer(true)} disabled={pending} size="sm" />
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          {isOwner ? (
            // Quem é proprietário não sai por aqui: as opções ficam na gestão.
            <PillButton label="Proprietário · Gerir" icon="settings" onPress={() => openManageComuna(comuna.id)} variant="dark" size="lg" display style={styles.join} />
          ) : archived && !joined ? (
            <PillButton label="Comuna arquivada" onPress={() => {}} disabled variant="outline" size="lg" display style={styles.join} />
          ) : requestsEntry ? (
            <PillButton
              label={pending ? 'Enviando…' : requested ? 'Pedido enviado · retirar' : 'Pedir para entrar'}
              onPress={onRequest}
              disabled={pending}
              variant={requested ? 'outline' : 'primary'}
              size="lg"
              display
              accessibilityHint={requested ? 'Retira o pedido de entrada' : 'A moderação da comuna aprova ou recusa'}
              style={styles.join}
            />
          ) : (
            <PillButton
              label={membership.pending ? (joined ? 'Saindo…' : 'Entrando…') : joined ? 'Participando' : 'Participar da comuna'}
              icon={joined && !membership.pending ? 'check' : undefined}
              onPress={() => {
                if (!joined || !perms || DEMO_MODE) return membership.toggleJoin();
                // Sair de uma comuna é diferente de arquivá-la ou excluí-la: só a sua participação termina.
                Alert.alert(
                  'Sair da comuna?',
                  `Você deixa de participar de c/${comuna.handle}.${comuna.visibility === 'private' ? ' Como ela é privada, você perde o acesso às publicações e precisará pedir para entrar de novo.' : ''} A comuna continua existindo.`,
                  [
                    { text: 'Ficar', style: 'cancel' },
                    { text: 'Sair', style: 'destructive', onPress: () => membership.toggleJoin().then(() => onChanged?.()) },
                  ],
                );
              }}
              disabled={membership.pending || (archived && !joined)}
              variant={joined ? 'outline' : 'primary'}
              size="lg"
              display
              selected={joined}
              accessibilityHint={joined ? 'Toque para sair da comuna' : undefined}
              style={styles.join}
            />
          )}
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

        {manages && !isOwner ? (
          <Pressable
            onPress={() => openManageComuna(comuna.id)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.modTools, pressed && styles.pressed]}>
            <Icon name="shield" size={20} color={Colors.red} />
            <AppText style={styles.modLabel} color={Colors.cream}>
              Gerir comuna (moderação)
            </AppText>
            <Icon name="chevronRight" size={18} color={Colors.cream} />
          </Pressable>
        ) : null}

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
  archived: {
    backgroundColor: Colors.ink,
    borderRadius: 12,
    padding: Spacing.three,
    gap: 2,
  },
  archivedTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 19,
    lineHeight: 22,
    textTransform: 'uppercase',
  },
  archivedText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
  role: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  offer: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: Colors.red,
    borderRadius: 12,
    backgroundColor: Colors.paper,
  },
  offerText: {
    fontSize: 14,
    lineHeight: 20,
  },
  offerActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
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
