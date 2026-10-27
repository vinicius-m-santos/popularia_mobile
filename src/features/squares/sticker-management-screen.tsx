import { useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { IconButton } from '@/components/icon-button';
import { KeyboardView } from '@/components/keyboard-view';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAsyncData } from '@/hooks/use-async-data';
import { ApiError, describeError } from '@/lib/errors';
import { goBack } from '@/lib/routes';

import { addSticker, deleteSticker, getSquare, getStickerPacks } from './api';
import { StickerTile } from './components/sticker-tile';

const SYMBOLS = ['✊', '📢', '❤️', '🤝', '🔥', '📚', '🌱', '☕', '💪', '🎉', '⭐', '💡'];
export default function StickerManagementScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const data = useAsyncData(useCallback(async () => {
    const square = await getSquare(id);
    if (!square.viewer.canManage) throw new ApiError(403, '/errors/not-comuna-moderator', 'Só a moderação pode gerenciar figurinhas.');
    return { square, packs: await getStickerPacks(id) };
  }, [id]));
  const toast = useToast();
  const [label, setLabel] = useState('');
  const [symbol, setSymbol] = useState(SYMBOLS[0]);
  const [tone, setTone] = useState<'red' | 'black' | 'cream'>('red');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const pack = data.data?.packs.find((p) => p.scope === 'comuna');
  const run = async (fn: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(); data.reload(); }
    catch (e) { toast.show(describeError(e)); if (e instanceof ApiError && [403, 404].includes(e.status)) data.reload(); }
    finally { lock.current = false; setBusy(false); }
  };
  return <Screen edges={['top', 'left', 'right', 'bottom']}>
    <KeyboardView style={styles.flex}>
      <View style={styles.header}><IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} /><AppText variant="heading" style={styles.title}>Figurinhas da comuna</AppText></View>
      {!data.data ? <StateView kind={data.status === 'error' ? 'error' : 'loading'} message={data.status === 'error' ? describeError(data.error) : 'Carregando figurinhas'} onRetry={data.reload} /> : <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <AppText variant="label">{pack?.stickers.length ?? 0} / 40 figurinhas</AppText>
        <View style={styles.grid}>{pack?.stickers.map((sticker) => <View key={sticker.id} style={styles.item}><StickerTile sticker={sticker} small /><PillButton label="Remover" accessibilityLabel={`Remover ${sticker.label}`} size="sm" variant="outline" disabled={busy || data.data?.square.status === 'closed'} onPress={() => { void run(() => deleteSticker(id, sticker.id)); }} /></View>)}</View>
        {data.data.square.status === 'closed' ? <AppText>Praça encerrada. O pacote está disponível somente para consulta.</AppText> : <>
          <AppText variant="heading">Adicionar figurinha</AppText>
          <AppText variant="caption">Escolha um símbolo e uma frase curta para a sua comuna.</AppText>
          <View style={styles.grid}>{SYMBOLS.map((emoji) => <Pressable key={emoji} accessibilityRole="button" accessibilityLabel={`Símbolo ${emoji}`} accessibilityState={{ selected: symbol === emoji }} style={[styles.symbol, symbol === emoji && styles.chosen]} onPress={() => setSymbol(emoji)}><AppText style={styles.symbolText}>{emoji}</AppText></Pressable>)}</View>
          <TextInput value={label} onChangeText={setLabel} maxLength={24} placeholder="Frase da figurinha" accessibilityLabel="Frase da figurinha" style={styles.input} />
          <View style={styles.grid}>{(['red', 'black', 'cream'] as const).map((t) => <PillButton key={t} label={t === 'red' ? 'Vermelho' : t === 'black' ? 'Preto' : 'Creme'} variant={tone === t ? 'dark' : 'outline'} selected={tone === t} onPress={() => setTone(t)} />)}</View>
          <PillButton label={busy ? 'Salvando…' : 'Adicionar'} disabled={busy || !label.trim() || (pack?.stickers.length ?? 0) >= 40} variant="dark" onPress={() => { void run(async () => { await addSticker(id, { label: label.trim(), symbol, tone }); setLabel(''); }); }} />
        </>}
      </ScrollView>}
    </KeyboardView>
  </Screen>;
}
const styles = StyleSheet.create({ flex: { flex: 1 }, header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: Colors.rule, padding: 8 }, title: { flex: 1, lineHeight: 28 }, body: { padding: Spacing.five, gap: 18 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, item: { gap: 8 }, symbol: { minWidth: 48, minHeight: 48, borderWidth: 1, borderColor: Colors.rule, borderRadius: 8, alignItems: 'center', justifyContent: 'center' }, chosen: { backgroundColor: Colors.redSoft, borderColor: Colors.red }, symbolText: { fontSize: 25, lineHeight: 34 }, input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: Colors.ink, borderRadius: 8, fontFamily: Fonts.regular, fontSize: 15, color: Colors.ink } });
