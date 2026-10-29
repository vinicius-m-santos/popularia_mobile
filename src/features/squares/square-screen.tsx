import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { setStatusBarStyle } from 'expo-status-bar';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { BottomSheet, PopulariaBottomSheetTextInput } from '@/components/bottom-sheet';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { KeyboardView } from '@/components/keyboard-view';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAccount, useMe } from '@/features/account/account-context';
import { joinComuna, requestToJoin } from '@/features/comunas/api';
import { useInteractions } from '@/features/interactions/interactions-context';
import { REPORT_REASONS } from '@/features/moderation/constants';
import type { AuthorDto } from '@/lib/api/dto';
import { describeError } from '@/lib/errors';
import { initialsOf } from '@/lib/format';
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
  const locked = s && !s.viewer.canRead;
  const joinLabel = busy ? 'Aguarde…' : s?.viewer.joinRequest === 'pending' ? 'Solicitação pendente' : locked ? 'Solicitar entrada' : 'Participar';
  const notice = s?.status === 'closed' ? 'Praça encerrada · somente leitura' : s?.viewer.isMember && !s.viewer.canWrite ? (account && !account.emailVerified ? 'Confirme seu e-mail para conversar na Praça.' : 'A conversa está disponível somente para leitura.') : 'Participe da comuna para conversar na Praça';

  return <Screen backgroundColor={Colors.ink}>
    <KeyboardView style={styles.flex}>
      <View style={styles.header}>
        <IconButton icon="back" color={Colors.cream} accessibilityLabel="Voltar" onPress={goBack} />
        <View style={styles.heading}>
          <Pressable accessibilityRole="button" accessibilityLabel="Ver comuna" onPress={() => { if (s?.comuna) nav.openComuna(s.comuna.slug); }}><AppText variant="bodyStrong" color={Colors.cream} style={styles.title} numberOfLines={2}>{s?.title ?? 'Praça'}</AppText></Pressable>
          <Pressable onPress={() => openSheet('presence')} disabled={!s?.viewer.canRead || s.status !== 'active'} accessibilityRole="button" accessibilityLabel="Pessoas na Praça" style={styles.presence}>
            <AppText variant="caption" color={Colors.onInkMuted}>Praça · {locked ? 'Comuna privada' : s?.status === 'closed' ? 'Fechada' : <AppText variant="caption" color={Colors.red}>● {s?.presence ?? 0} pessoas na praça</AppText>}</AppText>
          </Pressable>
        </View>
        {s?.viewer.canRead ? <IconButton icon="more" color={Colors.cream} accessibilityLabel="Opções da Praça" onPress={() => openSheet('manage')} /> : null}
      </View>
      {!s ? <StateView kind={chat.loading ? 'loading' : 'error'} message={chat.loading ? 'Carregando Praça' : chat.error ?? 'Não foi possível abrir a Praça.'} onRetry={() => { void chat.reload(); }} /> : locked ? <View style={styles.locked}>
        <AppText variant="heading" style={styles.center}>Esta Praça pertence a uma comuna privada</AppText>
        <AppText style={styles.center}>Participe da comuna para acessar as conversas.</AppText>
        <PillButton label={joinLabel} disabled={busy || s.viewer.joinRequest === 'pending'} onPress={join} variant="dark" />
      </View> : <>
        {chat.syncError ? <Pressable onPress={() => { void chat.reload(); }} accessibilityRole="button" style={styles.sync}><AppText variant="caption" color={Colors.red}>{chat.syncError} Toque para tentar novamente.</AppText></Pressable> : null}
        {/* Older pages append at the visual top in this inverted list; native anchoring can shift its initial offset. */}
        <FlatList
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          automaticallyAdjustsScrollIndicatorInsets={false}
          ref={list} data={chat.messages} inverted keyExtractor={(m) => m.id}
          renderItem={({ item }) => <MessageRow message={item} separator={chat.separatorId === item.id} onOpenPicker={openPicker} onReply={onReply} onReact={chat.react} onOriginal={original} />}
          initialNumToRender={20} maxToRenderPerBatch={12} windowSize={9}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          contentContainerStyle={styles.messages}
          onScroll={(event) => { const bottom = event.nativeEvent.contentOffset.y < 80; atBottom.current = bottom; chat.onBottom(bottom); }} scrollEventThrottle={100}
          onScrollBeginDrag={() => setPicker(null)}
          onEndReached={() => { if (!chat.loading) void chat.loadOlder(); }} onEndReachedThreshold={0.25}
          onScrollToIndexFailed={() => toast.show('Role um pouco mais para encontrar a mensagem original.')}
          ListEmptyComponent={<View>{chat.loading ? <StateView kind="loading" message="Carregando conversa" /> : chat.error ? <StateView kind="error" message={chat.error} onRetry={() => { void chat.reload(); }} /> : <StateView kind="empty" title="Onde a comunidade se encontra" message="Abra a conversa com a primeira mensagem." />}</View>}
          ListFooterComponent={<View>{chat.olderError ? <StateView kind="error" message="Não conseguimos carregar mensagens anteriores." onRetry={() => { void chat.loadOlder(); }} /> : chat.nextCursor ? <PillButton label={chat.loadingOlder ? 'Carregando anteriores…' : 'Mensagens anteriores'} variant="outline" disabled={chat.loadingOlder} onPress={() => { void chat.loadOlder(); }} style={styles.older} /> : null}</View>}
        />
        {chat.newCount > 0 || chat.hasRecentGap ? <PillButton label={chat.newCount > 0 ? `↓ ${chat.newCount} novas mensagens` : '↓ Ir às recentes'} variant="dark" size="sm" style={styles.new} onPress={() => { void chat.jumpRecent().then(() => list.current?.scrollToOffset({ offset: 0, animated: true })); }} /> : null}
        {s.viewer.canWrite ? <SquareComposer inputRef={input} reply={reply} onCancel={() => setReplyId(null)} sending={chat.sending} onSend={send} onStickers={() => openSheet('stickers')} /> : <View style={[styles.notice, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <AppText variant="caption" style={styles.center}>{notice}</AppText>
          {s.status === 'active' && !s.viewer.isMember ? <PillButton label={joinLabel} onPress={join} disabled={busy} variant="dark" /> : account && !account.emailVerified && s.status === 'active' ? <PillButton label="Confirmar e-mail" onPress={() => router.push('/verificar-email')} /> : null}
        </View>}
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
        {people.length ? people.map((p) => <View key={p.id} style={styles.person}><Avatar initials={initialsOf(p.displayName)} tone="red" size={34} /><View style={styles.flex}><AppText variant="bodyStrong">{p.displayName}</AppText><AppText variant="caption">@{p.handle}</AppText></View></View>) : <AppText>Ninguém por aqui no momento.</AppText>}
      </BottomSheet>
      <BottomSheet visible={sheet === 'stickers' && !!s?.viewer.canWrite} onClose={() => setSheet(null)} title="Figurinhas">
        <View style={styles.tabs}>{packs.map((p) => <PillButton key={p.id} label={p.scope === 'popularia' ? 'Popularia' : 'Da comuna'} variant={p.id === packId ? 'dark' : 'outline'} onPress={() => setPackId(p.id)} />)}</View>
        <View style={styles.grid}>{packs.find((p) => p.id === packId)?.stickers.map((sticker) => <Pressable key={sticker.id} accessibilityRole="button" accessibilityLabel={`Enviar figurinha ${sticker.label}`} disabled={busy || chat.sending} onPress={() => sendSticker(sticker)}><StickerTile sticker={sticker} small /></Pressable>)}</View>
        {!packs.find((p) => p.id === packId)?.stickers.length ? <AppText variant="caption">Este pacote ainda não tem figurinhas.</AppText> : null}
      </BottomSheet>
      <BottomSheet visible={sheet === 'manage' && !!s?.viewer.canRead} onClose={() => setSheet(null)} title="Praça">
        <View style={styles.menu}>
          <AppText>A conversa coletiva de {s?.comuna?.name}.</AppText>
          <PillButton label="Ver comuna" variant="outline" onPress={() => { setSheet(null); if (s?.comuna) nav.openComuna(s.comuna.slug); }} />
          {s?.viewer.canManage ? <>
            <PillButton label="Figurinhas da comuna" variant="outline" onPress={() => { setSheet(null); router.push({ pathname: '/praca/figurinhas/[id]', params: { id } }); }} />
            <PillButton label="Fila de denúncias" variant="outline" onPress={() => { setSheet(null); if (s.comuna) openModeration(s.comuna.slug); }} />
          </> : null}
        </View>
      </BottomSheet>
      <BottomSheet visible={!!freshAction && !!s?.viewer.canRead} onClose={() => { setActionsId(null); setForm(null); }} title={form === 'report' ? 'Denunciar mensagem' : form === 'remove' ? 'Remover mensagem' : 'Mensagem'}>
        {form ? <View style={styles.menu}>
          {form === 'report' ? REPORT_REASONS.map((label) => <PillButton key={label} label={label} variant={reason === label ? 'dark' : 'outline'} onPress={() => setReason(label)} />) : null}
          <PopulariaBottomSheetTextInput value={reason} onChangeText={setReason} maxLength={500} multiline accessibilityLabel="Motivo" placeholder="Motivo" style={styles.reason} />
          <PillButton label={busy ? 'Enviando…' : 'Confirmar'} disabled={busy || reason.trim().length < 3} onPress={submitAction} variant="dark" />
        </View> : freshAction ? <View style={styles.menu}>
          {freshAction.viewer.canReply ? <PillButton label="Responder" variant="outline" onPress={() => { setActionsId(null); onReply(freshAction); }} /> : null}
          {freshAction.viewer.canDelete ? <PillButton label="Excluir mensagem" variant="dark" disabled={busy} onPress={() => { void perform(async () => { await api.deleteMessage(id, freshAction.id); setActionsId(null); await chat.reload(); }); }} /> : null}
          {freshAction.viewer.canReport ? <PillButton label="Denunciar" variant="outline" onPress={() => setForm('report')} /> : null}
          {freshAction.viewer.canRemove ? <PillButton label="Remover mensagem" variant="dark" onPress={() => setForm('remove')} /> : null}
        </View> : null}
      </BottomSheet>
    </KeyboardView>
  </Screen>;
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
  flex: { flex: 1, backgroundColor: Colors.cream }, header: { backgroundColor: Colors.ink, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, paddingVertical: 10 }, heading: { flex: 1, minWidth: 0 }, title: { textTransform: 'uppercase', letterSpacing: 0.7 }, presence: { paddingTop: 5, paddingBottom: 3, minHeight: 30 }, messages: { paddingVertical: 10 }, locked: { flex: 1, justifyContent: 'center', padding: 30, gap: 20 }, center: { textAlign: 'center' }, notice: { borderTopWidth: 1, borderColor: Colors.rule, backgroundColor: Colors.strawLight, padding: 16, alignItems: 'center', gap: 12 }, sync: { padding: 10, backgroundColor: Colors.paper }, new: { alignSelf: 'center', marginVertical: 8 }, older: { alignSelf: 'center', margin: 16 }, menu: { gap: 12, paddingBottom: 8 }, person: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }, tabs: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', paddingBottom: 16 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 12 }, reason: { minHeight: 88, maxHeight: 160, padding: 12, borderWidth: 1, borderColor: Colors.rule, borderRadius: 10, color: Colors.ink, fontFamily: Fonts.regular, lineHeight: 22, fontSize: 15, textAlignVertical: 'top' },
  pickerOverlay: { flex: 1 },
  pickerBounds: { position: 'absolute' },
  pickerBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 4, backgroundColor: Colors.paper, borderWidth: 1.5, borderColor: Colors.ink, borderRadius: Radius.pill, boxShadow: '0 5px 16px rgba(0,0,0,0.18)' },
  pickerMeasuring: { opacity: 0 },
  pickerEmoji: { width: 40, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  pickerEmojiText: { fontSize: 22, lineHeight: 30 },
  pickerMore: { width: 44, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
});
