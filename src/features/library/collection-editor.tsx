import { useState } from 'react';
import { Alert, View } from 'react-native';
import { BottomSheet } from '@/components/bottom-sheet';
import { PillButton } from '@/components/pill-button';
import { TextField } from '@/components/text-field';
import { AppText } from '@/components/app-text';
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
  return <BottomSheet visible={visible} onClose={() => { if (!busy) onClose(); }} title={initial ? 'Editar coleção' : 'Nova coleção'}>
    <View style={{ gap: 14 }}>
      <TextField label="Nome da coleção" value={name} onChangeText={setName} maxLength={100} editable={!busy} />
      <TextField label="Descrição da coleção" labelAside="opcional" value={description} onChangeText={setDescription} maxLength={500} multiline editable={!busy} />
      {error ? <AppText accessibilityLiveRegion="polite">{error}</AppText> : null}
      <PillButton label={busy ? 'Salvando…' : initial ? 'Salvar coleção' : 'Criar e selecionar'} disabled={busy} onPress={save} />
      {initial ? <PillButton label="Excluir coleção vazia" variant="outline" disabled={busy} onPress={remove} /> : null}
    </View>
  </BottomSheet>;
}
