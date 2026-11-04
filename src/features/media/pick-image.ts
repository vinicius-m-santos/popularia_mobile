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
 * Avatar e marca usam o corte nativo quadrado. A capa não: no iOS esse editor é sempre quadrado.
 */
export async function pickProfileImage(kind: 'avatar' | 'cover' | 'mark', source: 'library' | 'camera' = 'library'): Promise<PickedImage | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const square = kind === 'avatar' || kind === 'mark';
  const options = {
    mediaTypes: ['images' as const],
    allowsEditing: square,
    aspect: square ? ([1, 1] as [number, number]) : undefined,
    allowsMultipleSelection: false,
    base64: false,
    exif: false,
    quality: 1,
  };
  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      throw new ApiError(
        403,
        '/errors/camera-permission',
        permission.canAskAgain
          ? 'Permita o acesso à câmera para tirar a foto.'
          : 'Acesso à câmera bloqueado. Libere nas configurações do aparelho ou escolha uma foto da galeria.',
      );
    }
  }
  let result;
  try {
    result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  } catch (error) {
    if (source === 'camera') {
      throw new ApiError(422, '/errors/camera-unavailable', 'Não foi possível abrir a câmera. Escolha uma foto da galeria.');
    }
    throw error;
  }
  if (result.canceled || !result.assets[0]) return null;
  const context = ImageManipulator.manipulate(result.assets[0].uri, { maxWidth: 2048, maxHeight: 2048 });
  const rendered = await context.renderAsync();
  const normalized = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  const size = await sizeOf(normalized.uri);
  if (size < 1 || size > IMAGE_MAX_BYTES) throw new ApiError(422, '/errors/post-media-size', 'A imagem precisa ter conteúdo e no máximo 10 MB.');
  const name = kind === 'avatar' ? 'perfil.jpg' : kind === 'mark' ? 'marca.jpg' : 'capa.jpg';
  return { uri: normalized.uri, name, mimeType: 'image/jpeg', size };
}
