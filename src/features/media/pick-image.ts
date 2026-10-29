import { File as ExpoFile } from 'expo-file-system';

import { ApiError } from '@/lib/errors';
import { IMAGE_MAX_BYTES } from '@/features/posts/post-media';

export type PickedImage = {
  uri: string;
  name: string;
  mimeType: 'image/jpeg';
  size: number;
};

async function sizeOf(uri: string): Promise<number> {
  try { return new ExpoFile(uri).size; } catch { return (await (await fetch(uri)).blob()).size; }
}

/**
 * Galeria, com o mesmo redimensionamento JPEG das imagens de publicação.
 * O avatar usa o corte nativo quadrado. A capa não: no iOS esse editor é sempre quadrado.
 */
export async function pickProfileImage(kind: 'avatar' | 'cover'): Promise<PickedImage | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: kind === 'avatar',
    aspect: kind === 'avatar' ? [1, 1] : undefined,
    allowsMultipleSelection: false,
    base64: false,
    exif: false,
    quality: 1,
  });
  if (result.canceled || !result.assets[0]) return null;
  const context = ImageManipulator.manipulate(result.assets[0].uri, { maxWidth: 2048, maxHeight: 2048 });
  const rendered = await context.renderAsync();
  const normalized = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  const size = await sizeOf(normalized.uri);
  if (size < 1 || size > IMAGE_MAX_BYTES) throw new ApiError(422, '/errors/post-media-size', 'A imagem precisa ter conteúdo e no máximo 10 MB.');
  return { uri: normalized.uri, name: kind === 'avatar' ? 'perfil.jpg' : 'capa.jpg', mimeType: 'image/jpeg', size };
}
