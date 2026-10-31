import { useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { Icon } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { KeyboardView } from '@/components/keyboard-view';
import { Screen } from '@/components/screen';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { Colors, Radius, Spacing } from '@/constants/theme';
import { EventBar } from '@/features/events/chrome';
import { useAsyncData } from '@/hooks/use-async-data';
import { ApiError, describeError } from '@/lib/errors';

import { addSticker, deleteSticker, getSquare, getStickerPacks } from './api';
import { StickerTile } from './components/sticker-tile';

const SYMBOLS = ['✊', '📢', '❤️', '🤝', '🔥', '📚', '🌱', '☕', '💪', '🎉', '⭐', '💡'];
const TONES = ['red', 'black', 'cream'] as const;

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
  const closed = data.data?.square.status === 'closed';
  const run = async (fn: () => Promise<unknown>) => {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    try { await fn(); data.reload(); }
    catch (e) { toast.show(describeError(e)); if (e instanceof ApiError && [403, 404].includes(e.status)) data.reload(); }
    finally { lock.current = false; setBusy(false); }
  };

  return <Screen edges={['top', 'left', 'right', 'bottom']}>
    <KeyboardView style={styles.flex}>
      <EventBar title="Figurinhas" />
      {!data.data ? (
        <StateView kind={data.status === 'error' ? 'error' : 'loading'} message={data.status === 'error' ? describeError(data.error) : 'Carregando figurinhas'} onRetry={data.reload} />
      ) : (
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled">
          <View style={styles.sectionHead}>
            <SectionHeading appearance="editorial" label="Pacote da comuna" />
            <AppText variant="label" color={Colors.muted}>{pack?.stickers.length ?? 0} / 40 figurinhas</AppText>
          </View>

          <View style={styles.grid}>
            {pack?.stickers.map((sticker) => (
              <View key={sticker.id} style={styles.stickerItem}>
                <StickerTile sticker={sticker} small />
                {!closed ? (
                  <IconButton
                    icon="trash"
                    size={16}
                    accessibilityLabel={`Remover ${sticker.label}`}
                    onPress={() => { if (!busy) void run(() => deleteSticker(id, sticker.id)); }}
                    style={styles.remove}
                  />
                ) : null}
              </View>
            ))}
          </View>
          {pack?.stickers.length === 0 ? <AppText variant="caption">O pacote ainda não tem figurinhas.</AppText> : null}
          {closed ? <AppText variant="caption">Praça encerrada. O pacote está disponível somente para consulta.</AppText> : null}

          {!closed ? <>
            <SectionHeading appearance="editorial" label="Adicionar figurinha" />
            <AppText variant="caption">Escolha um símbolo e uma frase curta para a sua comuna.</AppText>

            <TextField
              appearance="editorial"
              label="Frase da figurinha"
              placeholder="Ex.: BORA!"
              value={label}
              onChangeText={setLabel}
              maxLength={24}
              labelAside={`${label.length}/24`}
            />

            <View style={styles.symbols}>
              {SYMBOLS.map((emoji) => {
                const selected = symbol === emoji;
                return (
                  <Pressable
                    key={emoji}
                    accessibilityRole="button"
                    accessibilityLabel={`Símbolo ${emoji}`}
                    accessibilityState={{ selected }}
                    style={[styles.symbol, selected && styles.symbolOn]}
                    onPress={() => setSymbol(emoji)}>
                    <AppText style={styles.symbolText}>{emoji}</AppText>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.tones}>
              {TONES.map((item) => {
                const selected = tone === item;
                return (
                  <Pressable
                    key={item}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`Cor ${item === 'red' ? 'vermelha' : item === 'black' ? 'preta' : 'creme'}`}
                    onPress={() => setTone(item)}
                    style={[styles.tone, { backgroundColor: item === 'red' ? Colors.red : item === 'black' ? Colors.ink : Colors.straw }, selected && styles.toneOn]}>
                    <AppText variant="label" color={item === 'cream' ? Colors.ink : Colors.paper}>{item === 'red' ? 'Vermelho' : item === 'black' ? 'Preto' : 'Creme'}</AppText>
                    {selected ? <Icon name="check" size={14} color={item === 'cream' ? Colors.ink : Colors.paper} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <EditorialAction
              label={busy ? 'Salvando…' : 'Adicionar figurinha'}
              icon="plus"
              labelVariant="button"
              tone="red"
              disabled={busy || !label.trim() || (pack?.stickers.length ?? 0) >= 40}
              onPress={() => { void run(async () => { await addSticker(id, { label: label.trim(), symbol, tone }); setLabel(''); }); }}
              style={styles.add}
            />
          </> : null}
        </ScrollView>
      )}
    </KeyboardView>
  </Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  body: {
    padding: Spacing.five,
    paddingBottom: Spacing.seven,
    gap: Spacing.three,
  },
  sectionHead: {
    gap: Spacing.one,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.four,
    paddingVertical: Spacing.two,
  },
  stickerItem: {
    width: 88,
  },
  remove: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.paper,
    borderWidth: 1,
    borderColor: Colors.ink,
  },
  symbols: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  symbol: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.rule,
    borderRadius: Radius.sm,
    backgroundColor: Colors.paper,
  },
  symbolOn: {
    backgroundColor: Colors.redSoft,
    borderColor: Colors.red,
  },
  symbolText: {
    fontSize: 25,
    lineHeight: 34,
  },
  tones: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  tone: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.ink,
    borderRadius: Radius.sm,
  },
  toneOn: {
    borderWidth: 2,
  },
  add: {
    borderRadius: Radius.sm,
  },
});
