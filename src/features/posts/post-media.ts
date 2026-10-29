import * as Crypto from 'expo-crypto';
import { File as ExpoFile } from 'expo-file-system';

import { apiRequest } from '@/lib/api/client';
import { ApiError } from '@/lib/errors';

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const VIDEO_MAX_DURATION_MS = 30_000;

export type LocalPostMedia = {
  clientId: string;
  kind: 'image' | 'video';
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  width: number;
  height: number;
  durationMs: number | null;
  file?: File;
  uploaded?: PostMediaDto;
};

export type PostMediaDto = {
  id: string;
  type: 'image' | 'video';
  mimeType: string;
  byteSize: number;
  width: number;
  height: number;
  durationMs: number | null;
  url: string | null;
};

async function sizeOf(uri: string, known?: number, webFile?: File): Promise<number> {
  if (known !== undefined) return known;
  if (webFile) return webFile.size;
  try { return new ExpoFile(uri).size; } catch { return (await (await fetch(uri)).blob()).size; }
}

export async function pickPostImage(): Promise<LocalPostMedia | null> {
  // Carregamento tardio: um development build anterior continua abrindo e mostra erro só ao usar a função.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ImageManipulator, SaveFormat } = require('expo-image-manipulator') as typeof import('expo-image-manipulator');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: false, allowsMultipleSelection: false, base64: false, exif: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const context = ImageManipulator.manipulate(asset.uri, { maxWidth: 2048, maxHeight: 2048 });
  const rendered = await context.renderAsync();
  const normalized = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG });
  const size = await sizeOf(normalized.uri);
  if (size < 1 || size > IMAGE_MAX_BYTES) throw new ApiError(422, '/errors/post-media-size', 'A imagem precisa ter conteúdo e no máximo 10 MB.');
  return { clientId: Crypto.randomUUID(), kind: 'image', uri: normalized.uri, name: 'imagem.jpg', mimeType: 'image/jpeg', size, width: normalized.width, height: normalized.height, durationMs: null };
}

export async function pickPostVideo(): Promise<LocalPostMedia | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ImagePicker = require('expo-image-picker') as typeof import('expo-image-picker');
  const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], allowsEditing: false, allowsMultipleSelection: false, base64: false });
  if (result.canceled || !result.assets[0]) return null;
  const asset = result.assets[0];
  const size = await sizeOf(asset.uri, asset.fileSize, asset.file);
  const durationMs = asset.duration ?? 0;
  if (size < 1 || size > VIDEO_MAX_BYTES) throw new ApiError(422, '/errors/post-media-size', 'O vídeo precisa ter conteúdo e no máximo 100 MB.');
  if (durationMs < 1 || durationMs > VIDEO_MAX_DURATION_MS) throw new ApiError(422, '/errors/post-media-duration', 'O vídeo pode ter no máximo 30 segundos.');
  const mimeType = asset.mimeType && ['video/mp4', 'video/quicktime'].includes(asset.mimeType) ? asset.mimeType : asset.fileName?.toLowerCase().endsWith('.mov') ? 'video/quicktime' : 'video/mp4';
  return { clientId: Crypto.randomUUID(), kind: 'video', uri: asset.uri, name: asset.fileName ?? (mimeType === 'video/quicktime' ? 'video.mov' : 'video.mp4'), mimeType, size, width: asset.width, height: asset.height, durationMs, file: asset.file };
}

export function uploadPostMedia(media: LocalPostMedia, progress: (percent: number) => void, signal: AbortSignal): Promise<PostMediaDto> {
  if (media.uploaded) return Promise.resolve(media.uploaded);
  const body = new FormData();
  body.append('metadata', JSON.stringify({ clientId: media.clientId, kind: media.kind }));
  if (media.file) body.append('file', media.file, media.name);
  else body.append('file', { uri: media.uri, name: media.name, type: media.mimeType } as unknown as Blob);
  return apiRequest<PostMediaDto>('/post-media', { auth: true, method: 'POST', timeoutMs: 240000, signal,
    transfer: (url, headers, abortSignal) => new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      const cleanup = () => abortSignal.removeEventListener('abort', abort);
      xhr.open('POST', url);
      Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)); };
      xhr.onload = () => { cleanup(); resolve(new Response(xhr.responseText, { status: xhr.status, headers: { 'Content-Type': 'application/json' } })); };
      xhr.onerror = () => { cleanup(); reject(new Error('Conexão interrompida. Tente enviar novamente.')); };
      xhr.onabort = () => { cleanup(); reject(new Error('Envio interrompido.')); };
      abortSignal.addEventListener('abort', abort);
      if (abortSignal.aborted) { cleanup(); reject(new Error('Envio cancelado.')); return; }
      xhr.send(body);
    }),
  });
}

export function durationLabel(durationMs: number | null): string {
  if (!durationMs) return '';
  const seconds = Math.ceil(durationMs / 1000);
  return `0:${String(seconds).padStart(2, '0')}`;
}
