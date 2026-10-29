import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Image as RasterImage, Pressable, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { Colors, Spacing } from '@/constants/theme';
import { ImageChangeSheet } from '@/features/media/image-change-sheet';
import { publishCover } from '@/features/media/image-cache';
import { tryLockImageUpload, unlockImageUpload } from '@/features/media/image-lock';
import type { PickedImage } from '@/features/media/pick-image';
import { uploadCover } from '@/features/media/upload-image';
import { describeError } from '@/lib/errors';
import type { Comuna } from '@/types/models';

type ComunaCoverProps = {
  comuna: Pick<Comuna, 'id' | 'serverId' | 'name' | 'coverAlt' | 'coverUrl'>;
  canEdit: boolean;
};

/** Capa da comuna. Quem pode editar os detalhes troca a imagem tocando nela. */
export function ComunaCover({ comuna, canEdit }: ComunaCoverProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<{ base: string | null; url: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const base = comuna.coverUrl ?? null;
  const remote = uploaded && uploaded.base === base ? uploaded.url : base;
  const shown = preview ?? remote;
  const lock = `cover:${comuna.id}`;

  const send = async (image: PickedImage) => {
    if (!tryLockImageUpload(lock)) return;
    setPreview(image.uri);
    setUploading(true);
    try {
      const url = await uploadCover(comuna.id, image);
      publishCover(comuna, url);
      try { await Image.prefetch(url); } catch { /* a capa local continua até a URL nova entrar */ }
      setUploaded({ base, url });
      setPreview(null);
    } catch (error) {
      setPreview(null);
      toast.show(describeError(error));
    } finally {
      setUploading(false);
      unlockImageUpload(lock);
    }
  };

  const art = shown
    ? <Image source={{ uri: shown }} contentFit="cover" cachePolicy="memory-disk" recyclingKey={shown} style={StyleSheet.absoluteFill} accessibilityLabel="" />
    : <RasterImage source={require('@/assets/comunas/comuna-hero-people.png')} resizeMode="cover" style={styles.art} accessible={false} />;
  const badge = canEdit ? <View style={styles.badge} pointerEvents="none">
    {uploading ? <ActivityIndicator color={Colors.ink} size="small" /> : <Icon name="camera" size={16} color={Colors.ink} />}
  </View> : null;

  if (!canEdit) {
    return <View style={StyleSheet.absoluteFill} accessible accessibilityRole="image" accessibilityLabel={`Capa: ${comuna.coverAlt}`}>{art}</View>;
  }

  return <>
    <Pressable
      style={StyleSheet.absoluteFill}
      accessibilityRole="button"
      accessibilityLabel={uploading ? 'Enviando capa da comuna' : 'Alterar capa da comuna'}
      accessibilityHint={`Capa: ${comuna.coverAlt}. Abre a escolha de uma nova imagem`}
      accessibilityState={{ busy: uploading, disabled: uploading }}
      disabled={uploading}
      onPress={() => { if (!uploading) setOpen(true); }}>
      {art}
      {badge}
    </Pressable>
    <ImageChangeSheet visible={open} title="Capa da comuna" kind="cover" busy={uploading} onClose={() => setOpen(false)} onConfirm={(image) => { setOpen(false); void send(image); }} />
  </>;
}

const styles = StyleSheet.create({
  art: { width: '100%', height: '100%' },
  badge: {
    position: 'absolute', right: Spacing.three, bottom: Spacing.three, width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.paper, borderWidth: 1.5, borderColor: Colors.ink,
  },
});
