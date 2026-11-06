/**
 * Menu "⋯" de publicações, comentários e perfis, com o fluxo de denúncia (design 2h):
 * menu → motivo → detalhes → confirmação. Um único provedor serve o app inteiro.
 */
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { router } from 'expo-router';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { canonicalUrl } from '@/features/links/destinations';
import { shareDestination } from '@/features/links/share';
import * as Clipboard from 'expo-clipboard';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { BottomSheet, PopulariaBottomSheetTextInput } from '@/components/bottom-sheet';
import { RadioMark } from '@/components/choice-marks';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { apiRequest } from '@/lib/api/client';
import { describeError } from '@/lib/errors';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useMe } from '@/features/account/account-context';
import { useInteractions } from '@/features/interactions/interactions-context';
import { deletePost } from '@/features/posts/api';
import { invalidateAfterPostDeleted } from '@/features/posts/invalidation';
import { queryClient } from '@/lib/query/client';
import { queryKeys } from '@/lib/query/keys';
import { isPinLocked, pinPost, pinStoreVersion, readPinned, subscribePinStore, unpinPost } from '@/features/comunas/pins';
import { knownPost, readSaved, readSavedSnapshot, subscribeSavedPost, toggleSavedPost } from '@/features/posts/save';
import { findComuna } from '@/features/lookup';
import type { ReportTarget } from '@/types/models';

import { cachedBlockedHandles, ensureBlockedHandles, rememberBlocked } from './blocks';
import { CONTENT_REPORT_REASONS, DETAILS_MAX_LENGTH } from './constants';
import { useModeration } from './moderation-context';
import { ReportSuccessSheet } from './report-success-sheet';

type Step = 'menu' | 'reason' | 'details' | 'done';

type ActionsSheetValue = {
  /** Abre o menu "⋯" do conteúdo. `reason` pula o menu e começa na escolha do motivo. */
  open: (target: ReportTarget, start?: 'menu' | 'reason', options?: { onDeleted?: () => void; hideShare?: boolean }) => void;
};

const ActionsSheetContext = createContext<ActionsSheetValue | null>(null);

const TITLES: Record<ReportTarget['kind'], string> = {
  post: 'Denunciar publicação',
  comment: 'Denunciar comentário',
  profile: 'Denunciar perfil',
  comuna: 'Denunciar comuna',
};

export function ActionsSheetProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ReportTarget | null>(null);
  const [onDeleted, setOnDeleted] = useState<(() => void) | undefined>();
  const [hideShare, setHideShare] = useState(false);
  const [step, setStep] = useState<Step>('menu');
  const [reasonCode, setReasonCode] = useState('');
  const [details, setDetails] = useState('');
  const [block, setBlock] = useState(false);
  const [blockedHandles, setBlockedHandles] = useState<string[]>([]);

  const open = useCallback((next: ReportTarget, start: 'menu' | 'reason' = 'menu', options?: { onDeleted?: () => void; hideShare?: boolean }) => {
    setTarget(next);
    setOnDeleted(() => options?.onDeleted);
    setHideShare(options?.hideShare ?? false);
    setStep(start);
    setReasonCode('');
    setDetails('');
    setBlock(false);
    setBlockedHandles(cachedBlockedHandles());
  }, []);

  // A lista do servidor decide se a linha de bloqueio já deve nascer escondida.
  useEffect(() => {
    if (!target || target.kind === 'comuna') return;
    let active = true;
    void ensureBlockedHandles().then((handles) => {
      if (active && handles.length > 0) setBlockedHandles((items) => [...new Set([...items, ...handles])]);
    });
    return () => { active = false; };
  }, [target]);

  const close = useCallback(() => { setTarget(null); setOnDeleted(undefined); setHideShare(false); }, []);
  const value = useMemo(() => ({ open }), [open]);

  return (
    <ActionsSheetContext value={value}>
      {children}
      <BottomSheet
        visible={target !== null}
        onClose={close}
        appearance={step === 'done' ? 'report' : 'paper'}
        accessibilityLabel={step === 'done' ? 'Denúncia enviada' : undefined}>
        {target ? (
          <SheetBody
            target={target}
            step={step}
            setStep={setStep}
            reasonCode={reasonCode}
            setReasonCode={setReasonCode}
            details={details}
            setDetails={setDetails}
            block={block}
            setBlock={setBlock}
            blocked={blockedHandles.includes(target.author.handle)}
            setBlocked={(handle, blocked) => setBlockedHandles((items) => blocked ? [...new Set([...items, handle])] : items.filter((item) => item !== handle))}
            close={close}
            onDeleted={onDeleted}
            hideShare={hideShare}
          />
        ) : null}
      </BottomSheet>
    </ActionsSheetContext>
  );
}

export function useActionsSheet(): ActionsSheetValue {
  const ctx = use(ActionsSheetContext);
  if (!ctx) throw new Error('useActionsSheet precisa estar dentro de <ActionsSheetProvider>.');
  return ctx;
}

type BodyProps = {
  target: ReportTarget;
  step: Step;
  setStep: (s: Step) => void;
  reasonCode: string;
  setReasonCode: (code: string) => void;
  details: string;
  setDetails: (d: string) => void;
  block: boolean;
  setBlock: (b: boolean) => void;
  blocked: boolean;
  setBlocked: (handle: string, blocked: boolean) => void;
  close: () => void;
  onDeleted?: () => void;
  hideShare: boolean;
};

function SheetBody(props: BodyProps) {
  const { target, step, setStep, reasonCode, setReasonCode, details, setDetails, block, setBlock, blocked, setBlocked, close, onDeleted, hideShare } =
    props;
  const toast = useToast();
  const me = useMe();
  const { isOn, toggle, setOn } = useInteractions();
  // O menu mostra um alvo por vez: acompanhar o store global faria o sheet
  // re-renderizar quando qualquer outro cartão fosse salvo.
  const subscribeSavedTarget = useCallback((listener: () => void) => subscribeSavedPost(target.id, listener), [target.id]);
  const savedSnapshot = useCallback(() => readSavedSnapshot(target.id), [target.id]);
  useSyncExternalStore(subscribeSavedTarget, savedSnapshot, savedSnapshot);
  useSyncExternalStore(subscribePinStore, pinStoreVersion, pinStoreVersion);
  const { submitReport } = useModeration();
  const sending = useRef(false);
  const [busy, setBusy] = useState(false);

  const handle = target.author.handle;
  // Conteúdo da API traz a autoria decidida pelo servidor; nos mocks, compara com o ID local "me".
  const isMine = target.isOwn ?? target.author.id === me.id;
  const comuna = findComuna(target.comunaId);
  const comunaName = comuna ? `c/ ${comuna.name}` : 'Popularia';
  const title = TITLES[target.kind];
  const reasonLabel = CONTENT_REPORT_REASONS.find((item) => item.code === reasonCode)?.label ?? '';
  const reviews = target.kind === 'profile' || target.kind === 'comuna' || !target.comunaId ? 'a equipe do Popularia' : `a moderação de ${comunaName}`;

  if (step === 'menu' && target.kind === 'comuna') {
    return (
      <View>
        {!isMine ? <MenuItem icon="flag" label={title} danger last onPress={() => setStep('reason')} /> : null}
      </View>
    );
  }

  if (step === 'menu') {
    const savedPost = knownPost(target.id);
    const saved = DEMO_MODE ? isOn('savedPosts', target.id) : readSaved(target.id, savedPost?.viewer?.saved);
    const muted = isOn('mutedUsers', target.author.handle);
    return (
      <View>
        {isMine && target.kind === 'post' ? (
          <MenuItem icon="edit" label="Editar publicação" onPress={() => { close(); router.push({ pathname: '/editar-publicacao/[id]', params: { id: target.id } }); }} />
        ) : null}
        {isMine && target.kind === 'post' ? (
          <MenuItem icon="trash" label="Excluir publicação" danger onPress={async () => {
            if (busy) return;
            setBusy(true);
            try {
              if (!DEMO_MODE) await deletePost(target.id);
              close();
              // A publicação aberta some junto; a pessoa volta ao feed, não a uma tela de 404.
              router.dismissAll();
              router.replace('/');
              invalidateAfterPostDeleted({ postId: target.id, author: target.author.handle, comunaId: target.comunaId });
              toast.show('Publicação excluída.');
            } catch (error) {
              toast.show(`Não foi possível excluir a publicação. ${describeError(error)}`);
            } finally {
              setBusy(false);
            }
          }} />
        ) : null}
        {target.kind === 'post' && !DEMO_MODE && savedPost?.viewer?.canPin ? (
          <MenuItem
            icon="pin"
            label={readPinned(target.id, savedPost.viewer.pinned) ? 'Desafixar publicação' : 'Fixar publicação'}
            onPress={() => {
              if (isPinLocked(target.id)) return;
              const pinnedNow = readPinned(target.id, savedPost.viewer?.pinned);
              close();
              void (pinnedNow ? unpinPost(savedPost, toast.show) : pinPost(savedPost, toast.show));
            }}
          />
        ) : null}
        {target.kind === 'post' ? (
          <MenuItem
            icon="bookmark"
            label={saved ? 'Remover dos salvos' : 'Salvar publicação'}
            onPress={() => {
              close();
              if (DEMO_MODE) {
                const on = toggle('savedPosts', target.id);
                toast.show(on ? 'Salvo neste aparelho até fechar o app.' : 'Removido dos salvos.');
                return;
              }
              if (!savedPost) return;
              void toggleSavedPost(savedPost, toast.show, me.id);
            }}
          />
        ) : null}
        {!isMine ? (
          <MenuItem
            icon="mute"
            label={muted ? `Deixar de silenciar @${handle}` : `Silenciar @${handle}`}
            onPress={() => {
              const on = toggle('mutedUsers', target.author.handle);
              close();
              toast.show(
                on
                  ? `@${handle} silenciado neste aparelho. As publicações somem do seu feed.`
                  : `@${handle} não está mais silenciado.`,
              );
            }}
          />
        ) : null}
        {!hideShare ? <MenuItem icon="shareNodes" label={target.kind === 'comment' ? 'Compartilhar comentário' : target.kind === 'profile' ? 'Compartilhar perfil' : 'Compartilhar publicação'} onPress={async () => {
          try {
            const shareTarget = target.kind === 'comment'
              ? { kind: 'post' as const, id: target.postId ?? target.id }
              : { kind: target.kind as 'post' | 'profile', id: target.id };
            await shareDestination(shareTarget);
            close();
          } catch { toast.show('Não conseguimos compartilhar este conteúdo.'); }
        }} /> : null}
        {target.kind === 'profile' ? <MenuItem icon="link" label="Copiar link" onPress={async () => {
          try { await Clipboard.setStringAsync(canonicalUrl({ kind: 'profile', id: target.id })); close(); toast.show('Link copiado.'); }
          catch { toast.show('Este conteúdo ainda não possui um link público.'); }
        }} /> : null}
        {!isMine && !DEMO_MODE ? <MenuItem icon="mute" label={blocked ? `Desbloquear @${handle}` : `Bloquear @${handle}`} danger onPress={async () => {
          try {
            await apiRequest(`/me/blocks/${encodeURIComponent(handle)}`, { auth: true, method: blocked ? 'DELETE' : 'PUT' });
            rememberBlocked(handle, !blocked);
            setBlocked(handle, !blocked);
            setOn('mutedUsers', [target.author.handle], !blocked);
            if (blocked) void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
            close();
            toast.show(blocked ? `@${handle} desbloqueado.` : 'Pessoa bloqueada no serviço.');
          }
          catch (e) { toast.show(describeError(e)); }
        }} /> : null}
        {!isMine ? (
          <MenuItem icon="flag" label={title} danger last onPress={() => setStep('reason')} />
        ) : target.kind === 'comment' ? (
          <MenuItem icon="trash" label="Excluir comentário" danger last onPress={async () => {
            if (busy) return;
            setBusy(true);
            try {
              if (!DEMO_MODE) await apiRequest(`/comments/${encodeURIComponent(target.id)}`, { method: 'DELETE', auth: true });
              onDeleted?.();
              close();
              toast.show('Comentário apagado.');
            } catch (error) {
              toast.show(`Não foi possível apagar o comentário. ${describeError(error)}`);
            } finally {
              setBusy(false);
            }
          }} />
        ) : null}
      </View>
    );
  }

  if (step === 'reason') {
    return (
      <View style={styles.stack}>
        <StepHeader label="Etapa 1 de 2" onClose={close} />
        <AppText style={styles.title} accessibilityRole="header">
          {title}
        </AppText>
        <AppText style={styles.lead} color={Colors.inkSoft}>
          Por que você está denunciando isso?
        </AppText>
        <View accessibilityRole="radiogroup">
          {CONTENT_REPORT_REASONS.map((item) => (
            <Pressable
              key={item.code}
              onPress={() => {
                setReasonCode(item.code);
                setStep('details');
              }}
              accessibilityRole="radio"
              accessibilityLabel={item.label}
              accessibilityState={{ checked: reasonCode === item.code, selected: reasonCode === item.code }}
              style={({ pressed }) => [styles.reason, pressed && styles.pressed]}>
              <RadioMark selected={reasonCode === item.code} />
              <AppText style={styles.reasonLabel}>{item.label}</AppText>
              <Icon name="chevronRight" size={16} color={Colors.muted} />
            </Pressable>
          ))}
        </View>
      </View>
    );
  }

  if (step === 'details') {
    const submit = async () => {
      if (sending.current) return;
      sending.current = true; setBusy(true);
      try {
        await submitReport({ target, reasonCode, reasonLabel, details });
        setStep('done');
      } catch (e) { toast.show(describeError(e)); }
      finally { sending.current = false; setBusy(false); }
    };
    return (
      <View style={styles.stack}>
        <View style={styles.stepRow}>
          <Pressable
            onPress={() => setStep('reason')}
            accessibilityRole="button"
            accessibilityLabel="Voltar aos motivos. Etapa 2 de 2"
            style={styles.stepBack}>
            <Icon name="back" size={14} color={Colors.muted} />
            <AppText variant="label" color={Colors.muted} style={styles.stepLabel}>
              Etapa 2 de 2
            </AppText>
          </Pressable>
          <IconButton icon="close" size={18} accessibilityLabel="Fechar" onPress={close} style={styles.closeBtn} />
        </View>
        <AppText style={styles.title} accessibilityRole="header">
          {title}
        </AppText>
        <View style={styles.reasonChip}>
          <Icon name="flag" size={14} color={Colors.cream} />
          <AppText style={styles.reasonChipText} color={Colors.cream}>
            {reasonLabel}
          </AppText>
        </View>
        <View style={styles.field}>
          <AppText style={styles.fieldLabel}>Conte mais, se quiser</AppText>
          <PopulariaBottomSheetTextInput
            value={details}
            onChangeText={setDetails}
            maxLength={DETAILS_MAX_LENGTH}
            multiline
            textAlignVertical="top"
            placeholder="Ex.: o que aconteceu e onde"
            placeholderTextColor={Colors.placeholder}
            accessibilityLabel="Conte mais, se quiser"
            style={styles.textarea}
          />
        </View>
        <AppText style={styles.note} color={Colors.muted}>
          A denúncia vai para {reviews}. Quem foi denunciado não fica sabendo quem denunciou.
        </AppText>
        <EditorialAction label={busy ? 'Enviando…' : 'Enviar denúncia'} icon="flag" labelVariant="button" tone="red" disabled={busy} onPress={submit} style={styles.primaryAction} />
        <EditorialAction label="Cancelar" icon="close" labelVariant="button" tone="paper" onPress={close} style={styles.secondaryAction} />
      </View>
    );
  }

  const blockedName = target.author.name.trim() || `@${handle}`;
  const canBlock = target.kind !== 'comuna' && !isMine;

  const blockPerson = async () => {
    if (sending.current || !canBlock) return;
    sending.current = true;
    setBusy(true);
    try {
      if (!DEMO_MODE) await apiRequest(`/me/blocks/${encodeURIComponent(handle)}`, { auth: true, method: 'PUT' });
      rememberBlocked(handle, true);
      setBlocked(handle, true);
      setOn('mutedUsers', [target.author.handle], true);
      setBlock(true);
      AccessibilityInfo.announceForAccessibility(`${blockedName} foi bloqueado`);
    } catch {
      toast.show('Não deu pra bloquear agora. Tenta de novo.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  const undoBlock = async () => {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    try {
      if (!DEMO_MODE) await apiRequest(`/me/blocks/${encodeURIComponent(handle)}`, { auth: true, method: 'DELETE' });
      rememberBlocked(handle, false);
      setBlocked(handle, false);
      setBlock(false);
      setOn('mutedUsers', [target.author.handle], false);
      void queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
      AccessibilityInfo.announceForAccessibility(`${blockedName} foi desbloqueado`);
    } catch {
      toast.show('Não deu pra desbloquear agora. Tenta de novo.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  };

  return (
    <ReportSuccessSheet
      target={target}
      blockedBefore={blocked}
      blockedNow={block}
      busy={busy}
      canBlock={canBlock}
      onBlock={() => { void blockPerson(); }}
      onUndo={() => { void undoBlock(); }}
      onClose={close}
      onOpenRules={() => {
        close();
        router.push({ pathname: '/documento-legal/[id]', params: { id: 'regras' } });
      }}
    />
  );
}

function MenuItem({
  icon,
  label,
  onPress,
  danger = false,
  last = false,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  danger?: boolean;
  last?: boolean;
}) {
  const color = danger ? Colors.red : Colors.ink;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.menuItem, !last && styles.menuDivider, pressed && styles.pressed]}>
      <Icon name={icon} size={21} color={color} />
      <AppText style={[styles.menuLabel, danger && styles.menuDanger]} color={color}>
        {label}
      </AppText>
    </Pressable>
  );
}

function StepHeader({ label, onClose }: { label: string; onClose: () => void }) {
  return (
    <View style={styles.stepRow}>
      <AppText variant="label" color={Colors.muted} style={styles.stepLabel}>
        {label}
      </AppText>
      <IconButton icon="close" size={18} accessibilityLabel="Fechar" onPress={onClose} style={styles.closeBtn} />
    </View>
  );
}

/** Botão principal escuro das folhas de denúncia e moderação. */
export function DarkButton({ label, onPress, stretch = false }: { label: string; onPress: () => void; stretch?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.dark, stretch && styles.darkStretch, pressed && styles.pressed]}>
      <AppText style={styles.darkLabel} color={Colors.cream}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressed: {
    opacity: 0.7,
  },
  menuItem: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2D6C1',
  },
  menuLabel: {
    fontFamily: Fonts.bold,
    fontSize: 16,
    lineHeight: 21,
  },
  menuDanger: {
    fontFamily: Fonts.extrabold,
  },
  stack: {
    gap: Spacing.three,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepBack: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  stepLabel: {
    fontSize: 10.5,
  },
  closeBtn: {
    marginRight: -10,
  },
  title: {
    fontFamily: Fonts.condensed,
    fontSize: 32,
    lineHeight: 32,
    textTransform: 'uppercase',
  },
  lead: {
    fontSize: 14.5,
    lineHeight: 20,
  },
  reason: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: '#E2D6C1',
  },
  reasonLabel: {
    flex: 1,
    fontFamily: Fonts.bold,
    fontSize: 15.5,
    lineHeight: 20,
  },
  primaryAction: {
    borderRadius: Radius.sm,
  },
  secondaryAction: {
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  reasonChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.sm,
    backgroundColor: Colors.ink,
  },
  reasonChipText: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  field: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: Fonts.bold,
    fontSize: 13.5,
    lineHeight: 18,
  },
  fieldLabelSoft: {
    fontFamily: Fonts.regular,
    fontSize: 13.5,
  },
  textarea: {
    minHeight: 96,
    borderRadius: Radius.xl,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.cream,
    paddingHorizontal: 14,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.three,
    fontFamily: Fonts.regular,
    fontSize: 15.5,
    lineHeight: 21,
    color: Colors.ink,
    outlineWidth: 0,
  },
  check: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  checkLabel: {
    fontFamily: Fonts.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  note: {
    fontSize: 13,
    lineHeight: 18,
  },
  dark: {
    height: 54,
    borderRadius: Radius.sm,
    backgroundColor: Colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.five,
  },
  darkStretch: {
    alignSelf: 'stretch',
    marginTop: 6,
  },
  darkLabel: {
    fontFamily: Fonts.condensed,
    fontSize: 20,
    lineHeight: 23,
    textTransform: 'uppercase',
  },
});
