import { shareDestination } from '@/features/links/share';
import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { EditorialAction } from '@/components/editorial-action';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useMe } from '@/features/account/account-context';
import { useInteractions } from '@/features/interactions/interactions-context';
import { formatPeople } from '@/lib/format';
import { useActionsSheet } from '@/features/moderation/actions-sheet';
import { comunaTarget } from '@/features/moderation/targets';
import { ImageChangeSheet } from '@/features/media/image-change-sheet';
import { publishMark } from '@/features/media/image-cache';
import { tryLockImageUpload, unlockImageUpload } from '@/features/media/image-lock';
import type { PickedImage } from '@/features/media/pick-image';
import { uploadMark } from '@/features/media/upload-image';
import { describeError } from '@/lib/errors';
import { goBack, openManageComuna, openModeration } from '@/lib/routes';
import type { ComunaDetails } from '@/types/models';

import { ComunaCover } from './comuna-cover';
import { cancelJoinRequest, requestToJoin, respondToTransfer, roleLabel } from '../api';
import { comunaErrorMessage } from '../errors';
import { useComunaMembership } from '../use-membership';

const COVER_HEIGHT = 160;
const MARK_SIZE = 88;

/** Capa, identidade, números e ações da comuna (design 1b). `onChanged` recarrega a comuna. */
export function ComunaHero({ comuna, onChanged, postCountLabel = '0' }: { comuna: ComunaDetails; onChanged?: () => void; postCountLabel?: string }) {
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
  const markEditable = !DEMO_MODE && !archived && !!perms?.canEditDetails;
  const [markSheetOpen, setMarkSheetOpen] = useState(false);
  const [markPreview, setMarkPreview] = useState<string | null>(null);
  const [markUploading, setMarkUploading] = useState(false);
  const markShown = markPreview ?? comuna.markUrl ?? null;

  const sendMark = async (image: PickedImage) => {
    const lock = `mark:${comuna.id}`;
    if (!tryLockImageUpload(lock)) return;
    setMarkPreview(image.uri);
    setMarkUploading(true);
    try {
      const url = await uploadMark(comuna.id, image);
      publishMark(comuna, url);
      try { await Image.prefetch(url); } catch { /* a marca local continua até a URL nova entrar */ }
      onChanged?.();
      setMarkPreview(null);
    } catch (error) {
      setMarkPreview(null);
      toast.show(describeError(error));
    } finally {
      setMarkUploading(false);
      unlockImageUpload(lock);
    }
  };
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

  const joinDisabled = archived && !joined ? true : requestsEntry ? pending : membership.pending || (archived && !joined);
  const joinLabel = archived && !joined
    ? 'Comuna arquivada'
    : requestsEntry
      ? pending ? 'Enviando…' : requested ? 'Pedido enviado · retirar' : 'Pedir para entrar'
      : membership.pending
        ? joined ? 'Saindo…' : 'Entrando…'
        : joined ? 'Participando' : 'Participar da comuna';
  const joinTone: 'paper' | 'red' = archived && !joined ? 'paper' : requestsEntry ? requested ? 'paper' : 'red' : joined ? 'paper' : 'red';
  const miniJoinLabel = archived && !joined
    ? 'Arquivada'
    : requestsEntry
      ? pending ? 'Enviando…' : requested ? 'Pedido enviado' : 'Pedir entrada'
      : membership.pending
        ? 'Aguarde…'
        : joined ? 'Participando' : 'Participar';
  const onJoin = () => {
    if (archived && !joined) return;
    if (requestsEntry) { void onRequest(); return; }
    if (!joined || !perms || DEMO_MODE) { void membership.toggleJoin(); return; }
    Alert.alert(
      'Sair da comuna?',
      `Você deixa de participar de c/${comuna.handle}.${comuna.visibility === 'private' ? ' Como ela é privada, você perde o acesso às publicações e precisará pedir para entrar de novo.' : ''} A comuna continua existindo.`,
      [
        { text: 'Ficar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: () => membership.toggleJoin().then(() => onChanged?.()) },
      ],
    );
  };

  return (
    <View>
      <View style={styles.coverFrame}>
        <View style={styles.cover}>
          <ComunaCover comuna={comuna} canEdit={!DEMO_MODE && !archived && !!perms?.canEditDetails} />
          <View style={styles.coverButtons}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Voltar"
              onPress={goBack}
              hitSlop={4}
              style={({ pressed }) => [styles.coverBack, pressed && styles.pressed]}>
              <View style={styles.coverBackIcon}><Icon name="back" size={29} color={Colors.ink} /></View>
              <View style={styles.coverBackIcon}><Icon name="back" size={24} color={Colors.paper} /></View>
            </Pressable>
            <MiniJoin
              label={miniJoinLabel}
              tone={joinTone}
              disabled={joinDisabled}
              onPress={onJoin}
              accessibilityLabel={joinLabel}
              accessibilityHint={joined ? 'Toque para sair da comuna' : undefined}
            />
          </View>
        </View>
        {markEditable ? (
          <Pressable
            style={styles.mark}
            accessibilityRole="button"
            accessibilityLabel={markUploading ? 'Enviando marca da comuna' : 'Alterar marca da comuna'}
            accessibilityHint="Abre a escolha de uma nova imagem"
            accessibilityState={{ busy: markUploading, disabled: markUploading }}
            disabled={markUploading}
            onPress={() => { if (!markUploading) setMarkSheetOpen(true); }}>
            <AppText style={styles.markText} color={Colors.paper} maxFontSizeMultiplier={1}>
              {comuna.initials}
            </AppText>
            {markShown ? <Image source={{ uri: markShown }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={markShown} style={StyleSheet.absoluteFill} accessible={false} /> : null}
            <View style={styles.markBadge} pointerEvents="none">
              {markUploading ? <ActivityIndicator color={Colors.paper} size="small" /> : <Icon name="camera" size={15} color={Colors.paper} />}
            </View>
          </Pressable>
        ) : (
          <View style={styles.mark} accessible={false}>
            <AppText style={styles.markText} color={Colors.paper} maxFontSizeMultiplier={1}>
              {comuna.initials}
            </AppText>
            {markShown ? <Image source={{ uri: markShown }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={markShown} style={StyleSheet.absoluteFill} accessible={false} /> : null}
          </View>
        )}
      </View>

      <View style={styles.topActions}>
        <IconButton icon="more" size={20} accessibilityLabel="Mais opções da comuna" onPress={() => setMenuVisible(true)} color={Colors.ink} />
      </View>

      <View style={styles.content}>
        <View style={styles.titleRow}>
          <AppText accessibilityRole="header" style={styles.title}>{comuna.name}</AppText>
          <AppText style={styles.meta} color={Colors.inkSoft}>
            c/{comuna.handle} · {comuna.place} · desde {comuna.foundedYear}
          </AppText>
        </View>

        <View style={styles.chips}>
          {!DEMO_MODE && comuna.viewerRole ? (
            <View style={[styles.roleChip, comuna.viewerRole === 'founder' && styles.roleChipRed]}>
              <AppText variant="label" color={Colors.paper}>{roleLabel(comuna.viewerRole)}</AppText>
            </View>
          ) : null}
          {comuna.primaryTopic ? (
            <View style={styles.topicChip}>
              <View style={styles.topicMark} />
              <AppText variant="label">{comuna.primaryTopic.shortLabel}</AppText>
            </View>
          ) : null}
        </View>

        {archived ? (
          <View style={styles.archived} accessibilityRole="summary">
            <AppText style={styles.archivedTitle} color={Colors.cream}>Comuna arquivada</AppText>
            <AppText style={styles.archivedText} color={Colors.onInkSoft}>
              O histórico continua para leitura de quem participa. Não há novas publicações, comentários nem membros.
            </AppText>
          </View>
        ) : null}

        <AppText style={styles.description}>{comuna.description}</AppText>

        <View style={styles.stats}>
          <ComunaStat value={formatPeople(memberCount)} label={memberCount === 1 ? 'Membro' : 'Membros'} />
          <ComunaStat value={postCountLabel} label="Publicações" divider />
          <ComunaStat value={String(comuna.rules.length)} label="Regras" divider />
        </View>

        {incoming ? (
          <View style={styles.offer}>
            <View style={styles.offerHead}>
              <View style={styles.offerMark}><Icon name="shield" size={17} color={Colors.red} /></View>
              <AppText style={styles.offerTitle}>Uma comuna para você</AppText>
            </View>
            <AppText style={styles.offerText}>
              {incoming.from.name} quer passar a comuna para você. Até você aceitar, nada muda.
            </AppText>
            <View style={styles.offerActions}>
              <EditorialAction label="Recusar" icon="close" labelVariant="button" onPress={() => onTransfer(false)} disabled={pending} style={[styles.offerAction, styles.secondaryAction]} />
              <EditorialAction label="Aceitar a comuna" icon="check" labelVariant="button" tone="red" onPress={() => onTransfer(true)} disabled={pending} style={styles.offerAction} />
            </View>
          </View>
        ) : null}

        {moderates ? (
          <Pressable
            onPress={() => openModeration(comuna.id)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.modTools, pressed && styles.pressed]}>
            <Icon name="shield" size={20} color={Colors.red} />
            <AppText style={styles.modLabel} color={Colors.cream}>Ferramentas de moderação</AppText>
            <Icon name="chevronRight" size={18} color={Colors.cream} />
          </Pressable>
        ) : null}
      </View>

      <BottomSheet visible={menuVisible} onClose={() => setMenuVisible(false)} title="Opções da comuna" scrollable={false}>
        <ComunaMenuAction
          icon="bell"
          label="Avisos da comuna"
          tone={notify ? 'red' : 'ink'}
          detail={notify ? 'Ligados' : 'Desligados'}
          selected={notify}
          onPress={onNotify}
        />
        <ComunaMenuAction
          icon="shareNodes"
          label="Compartilhar comuna"
          onPress={() => {
            setMenuVisible(false);
            void shareDestination({ kind: 'comuna', id: comuna.handle }).catch(() => toast.show('Não conseguimos compartilhar esta comuna.'));
          }}
        />
        {comuna.viewerRole !== 'founder' ? (
          <ComunaMenuAction
            icon="flag"
            tone="red"
            label="Denunciar comuna"
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
            style={styles.manageAction}
          />
        ) : null}
      </BottomSheet>
      {markEditable ? (
        <ImageChangeSheet
          visible={markSheetOpen}
          title="Marca da comuna"
          kind="mark"
          busy={markUploading}
          onClose={() => setMarkSheetOpen(false)}
          onConfirm={(image) => { setMarkSheetOpen(false); void sendMark(image); }}
        />
      ) : null}
    </View>
  );
}

function MiniJoin({ label, tone, disabled, onPress, accessibilityLabel, accessibilityHint }: {
  label: string;
  tone: 'paper' | 'red';
  disabled?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.miniJoin, tone === 'red' ? styles.miniJoinRed : styles.miniJoinPaper, pressed && styles.miniJoinPressed, disabled && styles.miniJoinDisabled]}>
      <AppText style={styles.miniJoinLabel} color={tone === 'red' ? Colors.paper : Colors.ink} numberOfLines={1} maxFontSizeMultiplier={1.3}>
        {label}
      </AppText>
    </Pressable>
  );
}

function ComunaStat({ value, label, divider = false }: { value: string; label: string; divider?: boolean }) {
  return (
    <View style={[styles.statCell, divider && styles.statDivider]} accessible accessibilityLabel={`${value} ${label}`}>
      <AppText style={styles.statValue} maxFontSizeMultiplier={1.3}>{value}</AppText>
      <AppText style={styles.statLabel}>{label}</AppText>
    </View>
  );
}

function ComunaMenuAction({ icon, label, tone = 'ink', detail, selected = false, onPress }: {
  icon: IconName;
  label: string;
  tone?: 'ink' | 'red';
  detail?: string;
  selected?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [styles.menuAction, pressed && styles.menuActionPressed]}>
      <View style={[styles.menuIcon, tone === 'red' ? styles.menuIconRed : styles.menuIconInk]}>
        <Icon name={icon} size={19} color={tone === 'red' ? Colors.red : Colors.ink} />
      </View>
      <AppText style={styles.menuLabel}>{label}</AppText>
      {detail ? <AppText variant="label" color={selected ? Colors.red : Colors.muted}>{detail}</AppText> : <Icon name="chevronRight" size={18} color={Colors.muted} />}
    </Pressable>
  );
}


const styles = StyleSheet.create({
  archived: {
    backgroundColor: Colors.ink,
    borderLeftWidth: 3,
    borderLeftColor: Colors.red,
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
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.two,
  },
  roleChip: {
    minHeight: 24,
    justifyContent: 'center',
    paddingHorizontal: 7,
    backgroundColor: Colors.ink,
  },
  roleChipRed: {
    backgroundColor: Colors.red,
  },
  topicChip: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: Spacing.two,
    backgroundColor: Colors.strawLight,
  },
  topicMark: {
    width: 7,
    height: 7,
    backgroundColor: Colors.red,
  },
  offer: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.red,
    backgroundColor: Colors.paper,
  },
  offerHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  offerMark: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.redSoft,
  },
  offerTitle: {
    flex: 1,
    fontFamily: Fonts.extrabold,
    fontSize: 14.5,
    lineHeight: 19,
  },
  offerText: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  offerActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  offerAction: {
    flex: 1,
    borderRadius: Radius.sm,
  },
  secondaryAction: {
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  modTools: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingHorizontal: 14,
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
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coverBack: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBackIcon: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topActions: {
    position: 'absolute',
    top: COVER_HEIGHT + Spacing.two,
    right: Spacing.five,
    zIndex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
  },
  miniJoin: {
    maxWidth: 150,
    minHeight: 30,
    justifyContent: 'center',
    paddingHorizontal: 8,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
  },
  miniJoinRed: {
    backgroundColor: Colors.red,
  },
  miniJoinPaper: {
    backgroundColor: Colors.paper,
  },
  miniJoinPressed: {
    opacity: 0.75,
  },
  miniJoinDisabled: {
    opacity: 0.6,
  },
  miniJoinLabel: {
    fontFamily: Fonts.extrabold,
    fontSize: 11.5,
    lineHeight: 14,
  },
  content: {
    paddingHorizontal: Spacing.five,
    paddingTop: 48,
    paddingBottom: Spacing.four,
    gap: 10,
  },
  mark: {
    position: 'absolute',
    left: Spacing.five,
    bottom: -44,
    width: MARK_SIZE,
    height: MARK_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.red,
    overflow: 'visible',
    transform: [{ rotate: '-4deg' }],
  },
  markBadge: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.red,
    borderWidth: 1.5,
    borderColor: Colors.ink,
  },
  markText: {
    alignSelf: 'stretch',
    fontFamily: Fonts.anton,
    fontSize: 50,
    lineHeight: 68,
    letterSpacing: -1,
    textAlign: 'center',
    textAlignVertical: 'center',
    transform: [{ translateY: 1 }],
  },
  titleRow: {
    gap: Spacing.two,
  },
  title: { fontFamily: Fonts.anton, fontSize: 52, lineHeight: 62, letterSpacing: -1.1, textTransform: 'uppercase' },
  meta: {
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
  stats: {
    flexDirection: 'row',
    borderTopWidth: 1.5,
    borderBottomWidth: 1.5,
    borderColor: Colors.ink,
    marginTop: Spacing.one,
  },
  statCell: {
    flex: 1,
    paddingVertical: 6,
  },
  statDivider: {
    borderLeftWidth: 1,
    borderLeftColor: Colors.rule,
    paddingLeft: Spacing.three,
  },
  statValue: {
    fontFamily: Fonts.anton,
    fontSize: 42,
    lineHeight: 50,
    letterSpacing: -0.6,
  },
  statLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  manageAction: {
    borderRadius: Radius.sm,
  },
  menuAction: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two + 2,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  menuActionPressed: {
    backgroundColor: Colors.strawLight,
  },
  menuIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuIconInk: {
    backgroundColor: Colors.strawLight,
  },
  menuIconRed: {
    backgroundColor: Colors.redSoft,
  },
  menuLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.extrabold,
    fontSize: 14.5,
    lineHeight: 19,
  },
});
