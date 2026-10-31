import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { BottomSheet } from '@/components/bottom-sheet';
import { RadioMark } from '@/components/choice-marks';
import { EditorialAction } from '@/components/editorial-action';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { KeyboardView } from '@/components/keyboard-view';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAccount, useMe } from '@/features/account/account-context';
import { absoluteMediaUrl } from '@/features/media/media-url';
import { joinComuna, requestToJoin } from '@/features/comunas/api';
import { useInteractions } from '@/features/interactions/interactions-context';
import { REPORT_REASONS } from '@/features/moderation/constants';
import type { AuthorDto } from '@/lib/api/dto';
import { describeError } from '@/lib/errors';
import { dayKey, formatDayRule, initialsOf } from '@/lib/format';
import { goBack, openModeration, useNav } from '@/lib/routes';

import * as api from './api';
import { MessageRow, QUICK_REACTIONS, type MessageAnchor } from './components/message-row';
import { SquareComposer } from './components/square-composer';
import { StickerTile } from './components/sticker-tile';
import { useSquare } from './use-square';

export default function SquareScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Conversation key={id} id={id} />;
}

function Conversation({ id }: { id: string }) {
  const me = useMe();
  const { account } = useAccount();
  const author = useMemo(() => ({ id: account?.id ?? me.id, handle: me.handle, displayName: me.name }), [account?.id, me.id, me.handle, me.name]);
  const chat = useSquare(id, author);
  const { square: s } = chat;
  const nav = useNav();
  const toast = useToast();
  const { setOn } = useInteractions();
  const insets = useSafeAreaInsets();
  const list = useRef<FlatList<api.SquareMessage>>(null);
  const input = useRef<ComponentRef<typeof TextInput>>(null);
  const [replyId, setReplyId] = useState<string | null>(null);
  const reply = chat.messages.find((m) => m.id === replyId && m.status === 'published' && m.viewer.canReply) ?? null;
  const [picker, setPicker] = useState<{ messageId: string; anchor: MessageAnchor } | null>(null);
  const [actionsId, setActionsId] = useState<string | null>(null);
  const actions = chat.messages.find((m) => m.id === actionsId && m.status === 'published') ?? null;
  const [form, setForm] = useState<'report' | 'remove' | null>(null);
  const [reason, setReason] = useState('');
  const [sheet, setSheet] = useState<'stickers' | 'presence' | 'manage' | null>(null);
  const [packs, setPacks] = useState<api.StickerPack[]>([]);
  const [packId, setPackId] = useState<string | null>(null);
  const [people, setPeople] = useState<AuthorDto[]>([]);
  const [busy, setBusy] = useState(false);
  const readable = !!s?.viewer.canRead;
  const [previousReadable, setPreviousReadable] = useState(readable);
  // O estado do servidor delimita os dados temporários, inclusive folhas ainda abertas.
  if (previousReadable !== readable) {
    setPreviousReadable(readable);
    if (!readable) {
      setPacks([]); setPeople([]); setReplyId(null); setPicker(null);
      setActionsId(null); setForm(null); setSheet(null); setReason('');
    }
  }
  const busyRef = useRef(false);
  const atBottom = useRef(true);
  const messageRows = useRef(chat.messages);
  useEffect(() => { messageRows.current = chat.messages; }, [chat.messages]);
  useFocusEffect(useCallback(() => { setStatusBarStyle('light'); return () => setStatusBarStyle('dark'); }, []));

  const onReply = useCallback((m: api.SquareMessage) => { if (!m.viewer.canReply) return; setReplyId(m.id); setPicker(null); input.current?.focus(); }, []);
  const onActions = useCallback((m: api.SquareMessage) => { setActionsId(m.id); setForm(null); setReason(''); }, [setActionsId, setForm, setReason]);
  const openPicker = useCallback((m: api.SquareMessage, anchor: MessageAnchor) => setPicker({ messageId: m.id, anchor }), []);
  const original = useCallback((messageId: string) => {
    const index = messageRows.current.findIndex((m) => m.id === messageId);
    if (index >= 0) list.current?.scrollToIndex({ index, animated: true, viewPosition: 0.5 });
    else toast.show('A mensagem original não está neste trecho do histórico.');
  }, [toast]);
  const perform = async (operation: () => Promise<unknown>, success?: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    try { await operation(); if (success) toast.show(success); }
    catch (e) { toast.show(describeError(e)); }
    finally { busyRef.current = false; setBusy(false); }
  };
  const join = () => {
    if (!s?.comuna || s.viewer.joinRequest === 'pending') return;
    const comuna = s.comuna;
    void perform(async () => {
      if (comuna.visibility === 'private') await requestToJoin(comuna.slug);
      else { await joinComuna(comuna.slug); setOn('joinedComunas', [comuna.slug], true); }
      await chat.reload();
    }, comuna.visibility === 'private' ? 'Solicitação enviada.' : 'Você entrou na comuna.');
  };
  const openSheet = (kind: 'stickers' | 'presence' | 'manage') => {
    if (!s?.viewer.canRead) return;
    void perform(async () => {
      if (kind === 'stickers') { const result = await api.getStickerPacks(id); setPacks(result); setPackId(result[0]?.id ?? null); }
      if (kind === 'presence') setPeople((await api.getPresence(id)).people);
      setSheet(kind);
    });
  };
  const send = async (text: string) => {
    const success = await chat.send({ body: text, ...(reply ? { replyToId: reply.id } : {}) });
    if (success) { setReplyId(null); await chat.jumpRecent(); list.current?.scrollToOffset({ offset: 0, animated: true }); }
    return success;
  };
  const sendSticker = (sticker: api.Sticker) => {
    void perform(async () => {
      if (await chat.send({ stickerId: sticker.id, ...(reply ? { replyToId: reply.id } : {}) }, sticker)) {
        setSheet(null); setReplyId(null); await chat.jumpRecent(); list.current?.scrollToOffset({ offset: 0, animated: true });
      }
    });
  };
  const submitAction = () => {
    if (!actions || !reason.trim()) return;
    void perform(async () => {
      if (form === 'report') await api.reportMessage(id, actions.id, reason.trim());
      else await api.removeMessage(id, actions.id, reason.trim());
      setActionsId(null); setForm(null); await chat.reload();
    }, form === 'report' ? 'Denúncia registrada para a moderação da comuna.' : 'Mensagem removida.');
  };
  const freshAction = actions ? chat.messages.find((m) => m.id === actions.id) ?? actions : null;
  const pickerMessage = picker ? chat.messages.find((m) => m.id === picker.messageId && m.status === 'published') ?? null : null;
  const locked = !!s && !s.viewer.canRead;
  const joinLabel = busy ? 'Aguarde…' : s?.viewer.joinRequest === 'pending' ? 'Solicitação pendente' : locked ? 'Solicitar entrada' : 'Participar';
  const notice = s?.status === 'closed' ? 'Praça encerrada · somente leitura' : s?.viewer.isMember && !s.viewer.canWrite ? (account && !account.emailVerified ? 'Confirme seu e-mail para conversar na Praça.' : 'A conversa está disponível somente para leitura.') : 'Participe da comuna para conversar na Praça';

  return <Screen backgroundColor={Colors.ink}>
    <KeyboardView style={styles.screen}>
      <SquareHeader
        square={s}
        locked={locked}
        onComuna={() => { if (s?.comuna) nav.openComuna(s.comuna.slug); }}
        onPresence={() => openSheet('presence')}
        onManage={() => openSheet('manage')}
      />
      {!s ? (
        <View style={styles.stateWrap}>
          <StateView kind={chat.loading ? 'loading' : 'error'} message={chat.loading ? 'Carregando Praça' : chat.error ?? 'Não foi possível abrir a Praça.'} onRetry={() => { void chat.reload(); }} />
        </View>
      ) : locked ? (
        <View style={styles.locked}>
          <SectionHeading appearance="editorial" label="Comuna privada" />
          <AppText variant="heading" style={styles.center}>Esta Praça pertence a uma comuna privada</AppText>
          <AppText style={styles.center}>Participe da comuna para acessar as conversas.</AppText>
          <EditorialAction
            label={joinLabel}
            icon="plus"
            labelVariant="button"
            tone="red"
            disabled={busy || s.viewer.joinRequest === 'pending'}
            onPress={join}
            style={styles.lockedAction}
          />
        </View>
      ) : <>
        {chat.syncError ? (
          <Pressable onPress={() => { void chat.reload(); }} accessibilityRole="button" style={styles.sync}>
            <AppText variant="caption" color={Colors.red}>Sem atualização da conversa.</AppText>
            <AppText variant="label">Tentar de novo</AppText>
          </Pressable>
        ) : null}
        {/* Páginas antigas entram no topo visual desta lista invertida. */}
        <FlatList
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          ref={list}
          data={chat.messages}
          inverted
          keyExtractor={(m) => m.id}
          renderItem={({ item, index }) => {
            const older = chat.messages[index + 1];
            const newDay = !chat.separatorId && (!older || dayKey(older.createdAt) !== dayKey(item.createdAt));
            return <>
              <MessageRow
                message={item}
                separator={chat.separatorId === item.id}
                inverted
                onOpenPicker={openPicker}
                onReply={onReply}
                onReact={chat.react}
                onOriginal={original}
              />
              {newDay ? <ChatDayRule label={formatDayRule(item.createdAt)} /> : null}
            </>;
          }}
          initialNumToRender={20}
          maxToRenderPerBatch={12}
          windowSize={9}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.messages}
          onScroll={(event) => { const bottom = event.nativeEvent.contentOffset.y < 80; atBottom.current = bottom; chat.onBottom(bottom); }}
          scrollEventThrottle={100}
          onScrollBeginDrag={() => setPicker(null)}
          onEndReached={() => { if (!chat.loading) void chat.loadOlder(); }}
          onEndReachedThreshold={0.25}
          onScrollToIndexFailed={() => toast.show('Role um pouco mais para encontrar a mensagem original.')}
          ListEmptyComponent={<View style={styles.emptyWrap}>{chat.loading ? <StateView kind="loading" message="Carregando conversa" /> : chat.error ? <StateView kind="error" message={chat.error} onRetry={() => { void chat.reload(); }} /> : <StateView kind="empty" title="Onde a comunidade se encontra" message="Abra a conversa com a primeira mensagem." />}</View>}
          ListFooterComponent={<View style={styles.olderWrap}>{chat.olderError ? <StateView kind="error" message="Não conseguimos carregar mensagens anteriores." onRetry={() => { void chat.loadOlder(); }} /> : chat.nextCursor ? <PillButton label={chat.loadingOlder ? 'Carregando anteriores…' : 'Mensagens anteriores'} variant="outline" disabled={chat.loadingOlder} onPress={() => { void chat.loadOlder(); }} style={styles.older} /> : null}</View>}
        />
        {chat.newCount > 0 || chat.hasRecentGap ? (
          <PillButton label={chat.newCount > 0 ? `↓ ${chat.newCount} novas mensagens` : '↓ Ir às recentes'} variant="dark" size="sm" style={styles.new} onPress={() => { void chat.jumpRecent().then(() => list.current?.scrollToOffset({ offset: 0, animated: true })); }} />
        ) : null}
        {s.viewer.canWrite ? (
          <SquareComposer inputRef={input} reply={reply} onCancel={() => setReplyId(null)} sending={chat.sending} onSend={send} onStickers={() => openSheet('stickers')} />
        ) : (
          <View style={[styles.notice, { paddingBottom: Math.max(insets.bottom, Spacing.three) }]}>
            <AppText variant="caption" style={styles.center}>{notice}</AppText>
            {s.status === 'active' && !s.viewer.isMember ? (
              <EditorialAction label={joinLabel} icon="plus" labelVariant="button" tone="red" onPress={join} disabled={busy} style={styles.noticeAction} />
            ) : account && !account.emailVerified && s.status === 'active' ? (
              <EditorialAction label="Confirmar e-mail" icon="check" labelVariant="button" tone="red" onPress={() => router.push('/verificar-email')} style={styles.noticeAction} />
            ) : null}
          </View>
        )}
      </>}

      <ReactionPicker
        message={pickerMessage}
        anchor={picker?.anchor ?? null}
        insets={insets}
        onClose={() => setPicker(null)}
        onReact={(message, emoji) => { void chat.react(message, emoji); setPicker(null); }}
        onMore={(message) => { setPicker(null); onActions(message); }}
      />

      <BottomSheet visible={sheet === 'presence' && !!s?.viewer.canRead} onClose={() => setSheet(null)} title="Na Praça agora">
        <AppText variant="caption">Presença recente, aproximada.</AppText>
        {people.length ? people.map((p, index) => (
          <View key={p.id} style={[styles.person, index > 0 && styles.personRule]}>
            <Avatar initials={initialsOf(p.displayName)} tone="red" size={36} userId={p.id} imageUrl={absoluteMediaUrl(p.avatarUrl)} />
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{p.displayName}</AppText>
              <AppText variant="caption">@{p.handle}</AppText>
            </View>
          </View>
        )) : <AppText variant="caption">Ninguém por aqui no momento.</AppText>}
      </BottomSheet>

      <BottomSheet visible={sheet === 'stickers' && !!s?.viewer.canWrite} onClose={() => setSheet(null)} title="Figurinhas">
        <View style={styles.packTabs}>
          {packs.map((p) => {
            const selected = p.id === packId;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPackId(p.id)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={p.scope === 'popularia' ? 'Pacote Popularia' : 'Pacote da comuna'}
                style={[styles.packTab, selected && styles.packTabOn]}>
                <AppText variant="label" color={selected ? Colors.paper : Colors.ink}>{p.scope === 'popularia' ? 'Popularia' : 'Da comuna'}</AppText>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.stickerGrid}>
          {packs.find((p) => p.id === packId)?.stickers.map((sticker) => (
            <Pressable key={sticker.id} accessibilityRole="button" accessibilityLabel={`Enviar figurinha ${sticker.label}`} disabled={busy || chat.sending} onPress={() => sendSticker(sticker)}>
              <StickerTile sticker={sticker} small />
            </Pressable>
          ))}
        </View>
        {!packs.find((p) => p.id === packId)?.stickers.length ? <AppText variant="caption">Este pacote ainda não tem figurinhas.</AppText> : null}
      </BottomSheet>

      <BottomSheet visible={sheet === 'manage' && !!s?.viewer.canRead} onClose={() => setSheet(null)} title="Praça">
        <View style={styles.menu}>
          <AppText variant="caption">A conversa coletiva de {s?.comuna?.name}.</AppText>
          <SheetAction icon="globe" label="Ver comuna" onPress={() => { setSheet(null); if (s?.comuna) nav.openComuna(s.comuna.slug); }} />
          {s?.viewer.canManage ? <>
            <SheetAction icon="sticker" label="Figurinhas da comuna" onPress={() => { setSheet(null); router.push({ pathname: '/praca/figurinhas/[id]', params: { id } }); }} />
            <SheetAction icon="shield" label="Fila de denúncias" tone="red" onPress={() => { setSheet(null); if (s.comuna) openModeration(s.comuna.slug); }} />
          </> : null}
        </View>
      </BottomSheet>

      <BottomSheet visible={!!freshAction && !!s?.viewer.canRead} onClose={() => { setActionsId(null); setForm(null); }} title={form === 'report' ? 'Denunciar mensagem' : form === 'remove' ? 'Remover mensagem' : 'Mensagem'}>
        {form ? (
          <View style={styles.menu}>
            {form === 'report' ? <>
              <AppText variant="caption">Escolha o motivo que melhor descreve o problema.</AppText>
              <View style={styles.reasons}>
                {REPORT_REASONS.map((label) => {
                  const selected = reason === label;
                  return (
                    <Pressable
                      key={label}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: selected }}
                      accessibilityLabel={label}
                      onPress={() => setReason(label)}
                      style={[styles.reasonRow, selected && styles.reasonRowOn]}>
                      <RadioMark selected={selected} />
                      <AppText style={styles.reasonLabel}>{label}</AppText>
                    </Pressable>
                  );
                })}
              </View>
            </> : <AppText variant="caption">Explique o motivo para a moderação da comuna.</AppText>}
            <TextField
              appearance="editorial"
              label={form === 'report' ? 'Motivo' : 'Motivo da remoção'}
              placeholder={form === 'report' ? 'Ex.: ataque pessoal' : 'Ex.: conteúdo fora das regras'}
              value={reason}
              onChangeText={setReason}
              maxLength={500}
              multiline
            />
            <EditorialAction
              label={busy ? 'Enviando…' : form === 'report' ? 'Enviar denúncia' : 'Remover mensagem'}
              icon={form === 'report' ? 'flag' : 'shield'}
              labelVariant="button"
              tone="red"
              disabled={busy || reason.trim().length < 3}
              onPress={submitAction}
              style={styles.sheetAction}
            />
            <EditorialAction label="Cancelar" icon="close" labelVariant="button" tone="paper" onPress={() => { setForm(null); setReason(''); }} style={styles.sheetSecondary} />
          </View>
        ) : freshAction ? (
          <View style={styles.menu}>
            {freshAction.viewer.canReply ? <SheetAction icon="reply" label="Responder" onPress={() => { setActionsId(null); onReply(freshAction); }} /> : null}
            {freshAction.viewer.canDelete ? <SheetAction icon="trash" label="Excluir mensagem" tone="red" disabled={busy} onPress={() => { void perform(async () => { await api.deleteMessage(id, freshAction.id); setActionsId(null); await chat.reload(); }); }} /> : null}
            {freshAction.viewer.canReport ? <SheetAction icon="flag" label="Denunciar" onPress={() => setForm('report')} /> : null}
            {freshAction.viewer.canRemove ? <SheetAction icon="shield" label="Remover mensagem" tone="red" onPress={() => setForm('remove')} /> : null}
          </View>
        ) : null}
      </BottomSheet>
    </KeyboardView>
  </Screen>;
}

function SquareHeader({ square, locked, onComuna, onPresence, onManage }: {
  square: api.Square | null;
  locked: boolean;
  onComuna: () => void;
  onPresence: () => void;
  onManage: () => void;
}) {
  const presence = square?.presence ?? 0;
  const active = square?.status === 'active';
  const presenceText = locked
    ? 'Comuna privada'
    : square?.status === 'closed'
      ? 'Somente leitura · encerrada'
      : presence > 0
        ? `${presence} ${presence === 1 ? 'pessoa' : 'pessoas'} na praça`
        : 'Ninguém na praça agora';

  return <View style={styles.header}>
    <IconButton icon="back" color={Colors.cream} accessibilityLabel="Voltar" onPress={goBack} />
    <View style={styles.headerDivider} />
    <View style={styles.headerText}>
      <Pressable accessibilityRole="button" accessibilityLabel="Ver comuna" onPress={onComuna} disabled={!square?.comuna} style={styles.titlePress}>
        <AppText style={styles.headerTitle} color={Colors.cream} numberOfLines={1}>{square?.title ?? 'Praça'}</AppText>
      </Pressable>
      <Pressable
        onPress={onPresence}
        disabled={!square?.viewer.canRead || !active}
        accessibilityRole="button"
        accessibilityLabel={`Pessoas na Praça. ${presenceText}`}
        hitSlop={{ top: 6, bottom: 6 }}
        style={styles.presence}>
        {active && presence > 0 ? <View style={styles.liveDot} /> : null}
        <AppText style={styles.presenceText} color={Colors.onInkMuted}>{presenceText}</AppText>
      </Pressable>
    </View>
    {square?.viewer.canRead ? <IconButton icon="more" color={Colors.cream} accessibilityLabel="Opções da Praça" onPress={onManage} /> : <View style={styles.headerSpacer} />}
  </View>;
}

function ChatDayRule({ label }: { label: string }) {
  return <View style={styles.dayRule} accessibilityRole="header">
    <AppText variant="label">{label}</AppText>
    <View style={styles.dayRuleLine} />
  </View>;
}

/** Ação de folha com ícone colorido: cor no ícone e superfície discreta. */
function SheetAction({ icon, label, tone = 'ink', disabled = false, onPress }: {
  icon: IconName;
  label: string;
  tone?: 'ink' | 'red';
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed, disabled && styles.sheetRowDisabled]}>
      <View style={[styles.sheetIcon, tone === 'red' ? styles.sheetIconRed : styles.sheetIconInk]}>
        <Icon name={icon} size={19} color={tone === 'red' ? Colors.red : Colors.ink} />
      </View>
      <AppText style={styles.sheetLabel}>{label}</AppText>
      <Icon name="chevronRight" size={18} color={Colors.muted} />
    </Pressable>
  );
}

function ReactionPicker({ message, anchor, insets, onClose, onReact, onMore }: {
  message: api.SquareMessage | null;
  anchor: MessageAnchor | null;
  insets: { top: number; bottom: number; left: number; right: number };
  onClose: () => void;
  onReact: (message: api.SquareMessage, emoji: string) => void;
  onMore: (message: api.SquareMessage) => void;
}) {
  const { width, height } = useWindowDimensions();
  const [pickerHeight, setPickerHeight] = useState(0);
  if (!message || !anchor) return null;
  const margin = Spacing.two;
  const safeTop = insets.top + margin;
  const safeBottom = height - insets.bottom - margin;
  const above = anchor.y - pickerHeight - margin;
  const below = anchor.y + anchor.height + margin;
  const top = above >= safeTop ? above : Math.min(below, Math.max(safeTop, safeBottom - pickerHeight));
  const alignItems = anchor.x + anchor.width / 2 < width / 2 ? 'flex-start' : 'flex-end';
  return <Modal transparent animationType="fade" presentationStyle="overFullScreen" visible onRequestClose={onClose} statusBarTranslucent>
    <View style={styles.pickerOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} />
      <View pointerEvents="box-none" style={[styles.pickerBounds, { top, left: insets.left + margin, right: insets.right + margin, alignItems }]}>
        <View
          accessibilityLabel="Reações rápidas"
          onLayout={(event) => setPickerHeight(event.nativeEvent.layout.height)}
          style={[styles.pickerBar, pickerHeight === 0 && styles.pickerMeasuring]}>
          {message.viewer.canReact ? QUICK_REACTIONS.map((emoji) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Reagir ${emoji}`} onPress={() => onReact(message, emoji)} style={styles.pickerEmoji}><AppText style={styles.pickerEmojiText}>{emoji}</AppText></Pressable>) : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Mais ações da mensagem" onPress={() => onMore(message)} style={styles.pickerMore}><Icon name="more" size={20} /></Pressable>
        </View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.cream,
  },
  header: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
    backgroundColor: Colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: Colors.inkRule,
  },
  headerDivider: {
    width: 1.5,
    height: 28,
    backgroundColor: Colors.cream,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titlePress: {
    minHeight: 22,
    justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.monoSemibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  presence: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  presenceText: {
    fontFamily: Fonts.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.red,
  },
  headerSpacer: { width: 44 },
  stateWrap: { flex: 1 },
  locked: {
    flex: 1,
    justifyContent: 'center',
    padding: Spacing.six,
    gap: Spacing.four,
  },
  lockedAction: {
    alignSelf: 'stretch',
    borderRadius: Radius.sm,
  },
  center: { textAlign: 'center' },
  sync: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two,
    backgroundColor: Colors.paper,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  messages: { paddingVertical: Spacing.two },
  emptyWrap: { minHeight: 280 },
  olderWrap: { paddingVertical: Spacing.three },
  older: { alignSelf: 'center' },
  new: { alignSelf: 'center', marginVertical: Spacing.two },
  notice: {
    borderTopWidth: 1,
    borderTopColor: Colors.ink,
    backgroundColor: Colors.strawLight,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    alignItems: 'center',
    gap: Spacing.three,
  },
  noticeAction: {
    alignSelf: 'stretch',
    borderRadius: Radius.sm,
  },
  menu: { gap: Spacing.two, paddingBottom: Spacing.one },
  sheetAction: { borderRadius: Radius.sm },
  sheetSecondary: { borderRadius: Radius.sm, borderWidth: 1 },
  sheetRow: {
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
  sheetRowPressed: {
    backgroundColor: Colors.strawLight,
  },
  sheetRowDisabled: {
    opacity: 0.55,
  },
  sheetIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetIconInk: {
    backgroundColor: Colors.strawLight,
  },
  sheetIconRed: {
    backgroundColor: Colors.redSoft,
  },
  sheetLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.extrabold,
    fontSize: 14.5,
    lineHeight: 19,
  },
  person: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two + 2,
  },
  personRule: {
    borderTopWidth: 1,
    borderTopColor: Colors.rule,
  },
  flex: { flex: 1, minWidth: 0 },
  packTabs: {
    flexDirection: 'row',
    gap: Spacing.two,
    flexWrap: 'wrap',
    paddingBottom: Spacing.three,
  },
  packTab: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  packTabOn: {
    backgroundColor: Colors.ink,
    borderColor: Colors.ink,
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  reasons: { gap: Spacing.one },
  reasonRow: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderWidth: 1,
    borderColor: Colors.rule,
  },
  reasonRowOn: {
    borderColor: Colors.ink,
    backgroundColor: Colors.strawLight,
  },
  reasonLabel: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 20,
  },
  dayRule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.one,
  },
  dayRuleLine: {
    flex: 1,
    height: 1,
    backgroundColor: Colors.rule,
  },
  pickerOverlay: { flex: 1 },
  pickerBounds: { position: 'absolute' },
  pickerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.one,
    backgroundColor: Colors.paper,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
    boxShadow: '0 5px 16px rgba(0,0,0,0.18)',
  },
  pickerMeasuring: { opacity: 0 },
  pickerEmoji: {
    width: 40,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerEmojiText: {
    fontSize: 22,
    lineHeight: 30,
  },
  pickerMore: {
    width: 44,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
