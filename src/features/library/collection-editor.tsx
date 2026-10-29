import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';
import { EditorialAction } from '@/components/editorial-action';
import { TextField } from '@/components/text-field';
import { Colors, Spacing } from '@/constants/theme';
import { describeError } from '@/lib/errors';
import { createCollection, deleteCollection, editCollection } from './api';
import type { LibraryCollection } from './types';

export function CollectionEditor({ visible, onClose, onDone, comuna, initial }: { visible: boolean; onClose: () => void; onDone: (collection: LibraryCollection | null) => void; comuna?: string; initial?: LibraryCollection }) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const save = async () => {
    if (busy || !name.trim()) { setError('Dê um nome para a coleção.'); return; }
    setBusy(true); setError('');
    try {
      const collection = initial ? await editCollection(initial.id, name.trim(), description.trim()) : await createCollection(name.trim(), description.trim(), comuna);
      onDone(collection); onClose();
    } catch (e) { setError(describeError(e)); } finally { setBusy(false); }
  };
  const remove = () => Alert.alert('Excluir coleção?', 'A coleção só pode ser excluída se estiver vazia. Os documentos são preservados.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: async () => {
      if (!initial || busy) return;
      setBusy(true); setError('');
      try { await deleteCollection(initial.id); onDone(null); onClose(); }
      catch (e) { setError(describeError(e)); } finally { setBusy(false); }
    } },
  ]);
  return <BottomSheet dismissible={!busy} visible={visible} onClose={() => { if (!busy) onClose(); }} title={initial ? 'Editar coleção' : 'Nova coleção'}>
    <View style={styles.content}>
      <AppText style={styles.intro}>{initial ? 'Atualize o nome e a descrição desta coleção.' : 'Organize documentos relacionados em um mesmo espaço.'}</AppText>
      <TextField
        appearance="editorial"
        label="Nome da coleção"
        labelAside={`${name.length}/100`}
        placeholder="Ex.: Formação popular"
        value={name}
        onChangeText={setName}
        maxLength={100}
        editable={!busy}
      />
      <TextField
        appearance="editorial"
        label="Descrição da coleção"
        labelAside={`opcional · ${description.length}/500`}
        placeholder="Ex.: Cartilhas, estudos e materiais de referência"
        value={description}
        onChangeText={setDescription}
        maxLength={500}
        multiline
        multilineHeight={112}
        editable={!busy}
      />
      {error ? <AppText color={Colors.error} accessibilityLiveRegion="polite">{error}</AppText> : null}
      <EditorialAction label={busy ? 'Salvando…' : initial ? 'Salvar coleção' : 'Criar e selecionar'} icon={initial ? 'check' : 'plus'} tone="red" disabled={busy} onPress={save} />
      {initial ? <EditorialAction label="Excluir coleção vazia" icon="trash" disabled={busy} onPress={remove} /> : null}
    </View>
  </BottomSheet>;
}

const styles = StyleSheet.create({
  content: {
    gap: Spacing.four,
    paddingBottom: Spacing.two,
  },
  intro: {
    fontSize: 16,
    lineHeight: 22,
    color: Colors.muted,
  },
});
