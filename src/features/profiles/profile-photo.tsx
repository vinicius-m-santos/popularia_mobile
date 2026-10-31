import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Icon } from '@/components/icon';
import { useToast } from '@/components/toast';
import { Colors } from '@/constants/theme';
import { ImageChangeSheet } from '@/features/media/image-change-sheet';
import { publishAvatar } from '@/features/media/image-cache';
import { tryLockImageUpload, unlockImageUpload } from '@/features/media/image-lock';
import type { PickedImage } from '@/features/media/pick-image';
import { uploadAvatar } from '@/features/media/upload-image';
import { describeError } from '@/lib/errors';
import type { User } from '@/types/models';

type ProfilePhotoProps = {
  user: User;
  editable: boolean;
  onUploaded: (avatarUrl: string) => void;
};

/** Foto do perfil. Só a própria pessoa troca, tocando na imagem. */
export function ProfilePhoto({ user, editable, onUploaded }: ProfilePhotoProps) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const shown = preview ?? user.avatarUrl ?? null;
  const lock = `avatar:${user.id}`;

  const send = async (image: PickedImage) => {
    if (!tryLockImageUpload(lock)) return;
    setPreview(image.uri);
    setUploading(true);
    try {
      const url = await uploadAvatar(image);
      publishAvatar(user.id, url);
      onUploaded(url);
      try { await Image.prefetch(url); } catch { /* a foto local continua até a URL nova entrar */ }
      setPreview(null);
    } catch (error) {
      setPreview(null);
      toast.show(describeError(error));
    } finally {
      setUploading(false);
      unlockImageUpload(lock);
    }
  };

  const photo = <View style={styles.ring}>
    <Avatar initials={user.initials} tone={user.tone} size={80} userId={user.id} imageUrl={shown} />
    {editable ? <View style={styles.badge} pointerEvents="none">
      {uploading ? <ActivityIndicator color={Colors.paper} size="small" /> : <Icon name="camera" size={16} color={Colors.paper} />}
    </View> : null}
  </View>;

  if (!editable) return photo;

  return <>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={uploading ? 'Enviando foto de perfil' : 'Alterar foto de perfil'}
      accessibilityHint="Abre a escolha de uma nova foto"
      accessibilityState={{ busy: uploading, disabled: uploading }}
      disabled={uploading}
      onPress={() => { if (!uploading) setOpen(true); }}
      style={({ pressed }) => [pressed && styles.pressed]}>
      {photo}
    </Pressable>
    <ImageChangeSheet visible={open} title="Foto de perfil" kind="avatar" busy={uploading} onClose={() => setOpen(false)} onConfirm={(image) => { setOpen(false); void send(image); }} />
  </>;
}

const styles = StyleSheet.create({
  ring: { padding: 3, borderRadius: 50, borderWidth: 1.5, borderColor: Colors.ink, backgroundColor: Colors.cream },
  badge: {
    position: 'absolute', right: -3, bottom: -3, width: 30, height: 30,
    alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.red, borderWidth: 1.5, borderColor: Colors.ink,
  },
  pressed: { opacity: 0.92 },
});
