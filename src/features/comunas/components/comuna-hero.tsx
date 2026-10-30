import { shareDestination } from '@/features/links/share';
import { useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { EditorialAction } from '@/components/editorial-action';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { PillButton } from '@/components/pill-button';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useMe } from '@/features/account/account-context';
import { useInteractions } from '@/features/interactions/interactions-context';
import { formatPeople } from '@/lib/format';
import { useActionsSheet } from '@/features/moderation/actions-sheet';
import { comunaTarget } from '@/features/moderation/targets';
import { goBack, openManageComuna, openModeration } from '@/lib/routes';
import type { ComunaDetails } from '@/types/models';

import { ComunaCover } from './comuna-cover';
import { cancelJoinRequest, requestToJoin, respondToTransfer, roleLabel } from '../api';
import { comunaErrorMessage } from '../errors';
import { useComunaMembership } from '../use-membership';

const COVER_HEIGHT = 218;

/** Capa, identidade, números e ações da comuna (design 1b). `onChanged` recarrega a comuna. */
export function ComunaHero({ comuna, onChanged }: { comuna: ComunaDetails; onChanged?: () => void }) {
  const toast = useToast();
  const sheet = useActionsSheet();
  const { isOn, toggle } = useInteractions();
  const me = useMe();
  const [pending, setPending] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const pendingRef = useRef(false);
  // Modo demonstração: ferramentas fictícias pelo ID local dos mocks. Na API: papel e permissões do servidor.
  const moderates = DEMO_MODE && comuna.moderatorIds.includes(me.id);
  const perms = comuna.viewerPermissions;
  const manages = !DEMO_MODE && (comuna.viewerRole === 'founder' || comuna.viewerRole === 'moderator');
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
  // O total do servidor já inclui a pessoa se ela era membro; ajusta pelo estado local.
  const memberCount = comuna.memberCount - (comuna.viewerIsMember ? 1 : 0) + (joined ? 1 : 0);

  const onNotify = () => {
    const on = toggle('notifyComunas', comuna.id);
    toast.show(on ? 'Avisos ligados nesta simulação. Nada será enviado.' : 'Avisos desta comuna desligados.');
  };

  return (
    <View>
      <View style={styles.coverFrame}>
        <View style={styles.cover}>
          <ComunaCover comuna={comuna} canEdit={!DEMO_MODE && !archived && !!perms?.canEditDetails} />
          <View style={styles.coverButtons}>
            <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} background={Colors.paper} bordered style={styles.coverButton} />
            <IconButton
              icon="more"
              size={20}
              accessibilityLabel="Mais opções da comuna"
              onPress={() => setMenuVisible(true)}
              background={Colors.paper}
              bordered
              style={styles.coverButton}
            />
          </View>
        </View>
        <View style={styles.mark} accessible={false}>
          <AppText style={styles.markText} color={Colors.paper} maxFontSizeMultiplier={1}>
            {comuna.initials}
          </AppText>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            <AppText accessibilityRole="header" style={styles.title}>
              {comuna.name}
            </AppText>
            <AppText style={styles.meta} color={Colors.inkSoft}>
              c/{comuna.handle} · {comuna.place} · desde {comuna.foundedYear}
            </AppText>
          </View>
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
          <View style={styles.roleLine}>
            <AppText style={styles.roleLabel}>Seu papel:</AppText>
            <AppText style={styles.roleValue}>{roleLabel(comuna.viewerRole)}</AppText>
          </View>
        ) : null}

        {comuna.primaryTopic ? <AppText variant="label" style={styles.topic}>Assunto · {comuna.primaryTopic.shortLabel}</AppText> : null}

        <AppText style={styles.description}>{comuna.description}</AppText>

        <View style={styles.summaryDivider} />
        <View style={styles.memberStat} accessible accessibilityLabel={`${formatPeople(memberCount)} membros`}>
          <AppText style={styles.statValue} maxFontSizeMultiplier={1.3}>{formatPeople(memberCount)}</AppText>
          <AppText style={styles.statLabel}>Membros</AppText>
        </View>

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
          {
          archived && !joined ? (
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
            accessibilityLabel={notify ? 'Desligar avisos da comuna' : 'Ligar avisos da comuna'}
            selected={notify}
            onPress={onNotify}
            color={notify ? Colors.paper : Colors.ink}
            background={notify ? Colors.ink : Colors.paper}
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
      <BottomSheet visible={menuVisible} onClose={() => setMenuVisible(false)} title="Opções da comuna" scrollable={false}>
        <EditorialAction label="Compartilhar comuna" icon="shareNodes" onPress={() => {
          setMenuVisible(false);
          void shareDestination({ kind: 'comuna', id: comuna.handle }).catch(() => toast.show('Não conseguimos compartilhar esta comuna.'));
        }} />
        {comuna.viewerRole !== 'founder' ? (
          <EditorialAction
            label="Denunciar comuna"
            icon="flag"
            onPress={() => {
              setMenuVisible(false);
              sheet.open(comunaTarget(comuna), 'reason');
            }}
          />
        ) : null}
        {manages ? (
          <EditorialAction
            label="Gerenciar comuna"
            icon="settings"
            tone="red"
            pinnedLeadingIcon
            onPress={() => {
              setMenuVisible(false);
              openManageComuna(comuna.id);
            }}
          />
        ) : null}
      </BottomSheet>
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
  roleLine: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.three },
  roleLabel: { fontFamily: Fonts.mono, fontSize: 12, lineHeight: 17, letterSpacing: 0.8, textTransform: 'uppercase' },
  roleValue: { fontFamily: Fonts.monoSemibold, fontSize: 13, lineHeight: 18, letterSpacing: 0.5, textTransform: 'uppercase' },
  topic: { color: Colors.red, fontSize: 13, letterSpacing: 0.7 },
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
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: Colors.cream,
  },
  coverFrame: { height: COVER_HEIGHT, position: 'relative' },
  coverButtons: {
    zIndex: 1,
    position: 'absolute',
    top: Spacing.two,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  coverButton: { width: 50, height: 50, borderRadius: 0 },
  content: {
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  mark: {
    position: 'absolute',
    left: Spacing.five,
    bottom: -54,
    width: 108,
    height: 108,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.red,
    overflow: 'visible',
    transform: [{ rotate: '-4deg' }],
  },
  markText: {
    alignSelf: 'stretch',
    fontFamily: Fonts.anton,
    fontSize: 62,
    // A Anton extrapola a métrica nominal no iOS; esta caixa evita recorte no topo.
    lineHeight: 84,
    letterSpacing: -1,
    textAlign: 'center',
    textAlignVertical: 'center',
    // Compensação óptica mínima, sem deslocar o centro da caixa de texto.
    transform: [{ translateY: 1 }],
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingTop: 64,
  },
  titleCopy: { flex: 1, minWidth: 0 },
  title: { fontFamily: Fonts.anton, fontSize: 52, lineHeight: 62, letterSpacing: -1.1, textTransform: 'uppercase' },
  meta: {
    marginTop: Spacing.two,
    fontFamily: Fonts.mono,
    fontSize: 11.5,
    lineHeight: 17,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  description: {
    fontSize: 18,
    lineHeight: 27,
  },
  summaryDivider: { height: 1.5, backgroundColor: Colors.ink, marginTop: Spacing.one },
  memberStat: { gap: 2 },
  statValue: {
    fontFamily: Fonts.anton,
    fontSize: 48,
    // Contadores também usam Anton: não compactar a entrelinha, ou o topo dos algarismos corta.
    lineHeight: 58,
    letterSpacing: -0.6,
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    lineHeight: 17,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  join: {
    flex: 1,
  },
  notify: {
    width: 56,
    height: 56,
    borderRadius: 0,
    borderWidth: 1.5,
  },
  menuEmpty: {
    paddingBottom: Spacing.two,
    fontSize: 15,
    lineHeight: 21,
  },
});
