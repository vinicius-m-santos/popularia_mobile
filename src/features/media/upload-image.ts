import { apiRequest } from '@/lib/api/client';
import type { ComunaDto } from '@/lib/api/dto';
import type { MeDto } from '@/features/account/api';

import { absoluteMediaUrl } from './media-url';
import type { PickedImage } from './pick-image';

function uploadFile<T>(path: string, image: PickedImage): Promise<T> {
  const body = new FormData();
  body.append('file', { uri: image.uri, name: image.name, type: image.mimeType } as unknown as Blob);
  return apiRequest<T>(path, {
    auth: true,
    method: 'POST',
    timeoutMs: 120000,
    transfer: (url, headers, signal) => new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      const cleanup = () => signal.removeEventListener('abort', abort);
      xhr.open('POST', url);
      Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
      xhr.onload = () => { cleanup(); resolve(new Response(xhr.responseText, { status: xhr.status, headers: { 'Content-Type': 'application/json' } })); };
      xhr.onerror = () => { cleanup(); reject(new Error('Conexão interrompida. Tente enviar novamente.')); };
      xhr.onabort = () => { cleanup(); reject(new Error('Envio interrompido.')); };
      signal.addEventListener('abort', abort);
      if (signal.aborted) { cleanup(); reject(new Error('Envio cancelado.')); return; }
      xhr.send(body);
    }),
  });
}

export async function uploadAvatar(image: PickedImage): Promise<string> {
  const me = await uploadFile<MeDto>('/me/avatar', image);
  const url = absoluteMediaUrl(me.avatarUrl);
  if (!url) throw new Error('Resposta sem foto.');
  return url;
}

export async function uploadCover(slug: string, image: PickedImage): Promise<string> {
  const comuna = await uploadFile<ComunaDto>(`/comunas/${encodeURIComponent(slug)}/cover`, image);
  const url = absoluteMediaUrl(comuna.coverUrl);
  if (!url) throw new Error('Resposta sem capa.');
  return url;
}
