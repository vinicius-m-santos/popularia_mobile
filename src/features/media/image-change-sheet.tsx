import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { BottomSheet } from '@/components/bottom-sheet';
import { EditorialAction } from '@/components/editorial-action';
import { useToast } from '@/components/toast';
import { Colors } from '@/constants/theme';
import { describeError } from '@/lib/errors';

import { pickProfileImage, type PickedImage } from './pick-image';

type ImageChangeSheetProps = {
  visible: boolean;
  title: string;
  kind: 'avatar' | 'cover';
  busy: boolean;
  onClose: () => void;
  onConfirm: (image: PickedImage) => void;
};

/** Escolha na galeria. A capa mostra a faixa horizontal antes de confirmar; o avatar confirma no corte nativo. */
export function ImageChangeSheet({ visible, title, kind, busy, onClose, onConfirm }: ImageChangeSheetProps) {
  const toast = useToast();
  const [draft, setDraft] = useState<PickedImage | null>(null);
  const picking = useRef(false);
  const close = () => { if (!busy) { setDraft(null); onClose(); } };

  const choose = async () => {
    if (picking.current || busy) return;
    picking.current = true;
    try {
      const image = await pickProfileImage(kind);
      if (!image) return;
      if (kind === 'avatar') {
        setDraft(null);
        onConfirm(image);
        return;
      }
      setDraft(image);
    } catch (error) {
      toast.show(describeError(error));
    } finally {
      picking.current = false;
    }
  };

  return <BottomSheet visible={visible} onClose={close} title={draft ? 'Pré-visualização' : title} scrollable={false} dismissible={!busy}>
    {draft ? <View style={styles.preview} accessible accessibilityRole="image" accessibilityLabel="Pré-visualização da capa">
      <Image source={{ uri: draft.uri }} contentFit="cover" cachePolicy="memory-disk" style={StyleSheet.absoluteFill} />
    </View> : null}
    {draft ? <EditorialAction label="Usar esta capa" icon="image" tone="red" disabled={busy} onPress={() => { const image = draft; setDraft(null); onConfirm(image); }} /> : null}
    <EditorialAction label={draft ? 'Escolher outra' : 'Escolher da galeria'} icon="image" disabled={busy} onPress={() => { void choose(); }} />
    <EditorialAction label="Cancelar" icon="close" disabled={busy} onPress={close} />
  </BottomSheet>;
}

const styles = StyleSheet.create({
  // A capa da comuna é uma faixa de altura fixa, preenchida com cover. O preview repete isso, sem corte quadrado.
  preview: { height: 180, width: '100%', overflow: 'hidden', borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.cream },
});
