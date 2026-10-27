import { apiRequest, apiResponse } from '@/lib/api/client';
import type { Page } from '@/lib/pagination';
import type { DocumentMetadata, LibraryCollection, LibraryDocument, LibraryFilters, PickedPdf } from './types';

function query(filters: LibraryFilters, cursor: string | null) {
  const params = new URLSearchParams({ limit: '20' });
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  if (cursor) params.set('cursor', cursor);
  return params.toString();
}
export const listDocuments = (filters: LibraryFilters, cursor: string | null = null) =>
  apiRequest<Page<LibraryDocument>>(filters.scope === 'saved' ? `/me/saved-documents?${query(filters, cursor)}` : `/library/documents?${query(filters, cursor)}`, { auth: true });
export const listCollections = (filters: LibraryFilters, cursor: string | null = null) =>
  apiRequest<Page<LibraryCollection>>(`/library/collections?${query(filters, cursor)}`, { auth: true });
export const getDocument = (id: string) => apiRequest<LibraryDocument>(`/library/documents/${encodeURIComponent(id)}`, { auth: true });
export const getCollection = (id: string) => apiRequest<LibraryCollection>(`/library/collections/${encodeURIComponent(id)}`, { auth: true });
export const createCollection = (name: string, description: string, comunaSlug?: string) =>
  apiRequest<LibraryCollection>('/library/collections', { auth: true, method: 'POST', body: { name, description, ...(comunaSlug ? { comunaSlug } : {}) } });
export const editCollection = (id: string, name: string, description: string) =>
  apiRequest<LibraryCollection>(`/library/collections/${encodeURIComponent(id)}`, { auth: true, method: 'PATCH', body: { name, description } });
export const deleteCollection = (id: string) => apiRequest<void>(`/library/collections/${encodeURIComponent(id)}`, { auth: true, method: 'DELETE' });
export const editDocument = (id: string, metadata: Partial<DocumentMetadata>) =>
  apiRequest<LibraryDocument>(`/library/documents/${encodeURIComponent(id)}`, { auth: true, method: 'PATCH', body: metadata });
export const deleteDocument = (id: string) => apiRequest<void>(`/library/documents/${encodeURIComponent(id)}`, { auth: true, method: 'DELETE' });
export const saveDocument = (id: string, saved: boolean) => apiRequest<void>(`/library/documents/${encodeURIComponent(id)}/saved`, { auth: true, method: saved ? 'PUT' : 'DELETE' });
export const shareDocument = (id: string, slug: string, active: boolean) =>
  apiRequest<void>(`/library/documents/${encodeURIComponent(id)}/comunas/${encodeURIComponent(slug)}`, { auth: true, method: active ? 'PUT' : 'DELETE' });
export const reportDocument = (id: string, reason: string, comunaSlug?: string) =>
  apiRequest<void>(`/library/documents/${encodeURIComponent(id)}/reports`, { auth: true, method: 'POST', body: { reason, ...(comunaSlug ? { comunaSlug } : {}) } });
export const removeDocument = (id: string, reason: string, comunaSlug?: string) =>
  apiRequest<void>(`/library/documents/${encodeURIComponent(id)}/removal`, { auth: true, method: 'POST', body: { reason, ...(comunaSlug ? { comunaSlug } : {}) } });

/** Um clientId acompanha retries e refresh do token. Nunca faz um segundo upload ao publicar. */
export function uploadDocument(file: PickedPdf, metadata: DocumentMetadata, progress: (percent: number) => void, signal: AbortSignal): Promise<LibraryDocument> {
  const body = new FormData();
  body.append('metadata', JSON.stringify(metadata));
  if (file.file) body.append('file', file.file, file.name);
  else body.append('file', { uri: file.uri, name: file.name, type: 'application/pdf' } as unknown as Blob);
  return apiRequest<LibraryDocument>('/library/documents', { auth: true, method: 'POST', timeoutMs: 180000, signal,
    transfer: (url, headers, abortSignal) => new Promise<Response>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      const abort = () => xhr.abort();
      const cleanup = () => abortSignal.removeEventListener('abort', abort);
      xhr.open('POST', url);
      Object.entries(headers).forEach(([key, value]) => xhr.setRequestHeader(key, value));
      xhr.upload.onprogress = (event) => { if (event.lengthComputable) progress(Math.round(event.loaded / event.total * 100)); };
      xhr.onload = () => { cleanup(); resolve(new Response(xhr.responseText, { status: xhr.status, headers: { 'Content-Type': 'application/json' } })); };
      xhr.onerror = () => { cleanup(); reject(new Error('Conexão interrompida. Tente enviar novamente.')); };
      xhr.onabort = () => { cleanup(); reject(new Error('Envio interrompido. Tente novamente quando estiver pronto.')); };
      abortSignal.addEventListener('abort', abort);
      if (abortSignal.aborted) { cleanup(); reject(new Error('Envio cancelado.')); return; }
      xhr.send(body);
    }),
  });
}

/** Baixa com o mesmo controle de autenticação e refresh das chamadas JSON. */
export async function downloadPdf(id: string, transport?: Parameters<typeof apiResponse>[1]) {
  return apiResponse(`/library/documents/${encodeURIComponent(id)}/file`, { auth: true, timeoutMs: 180000, ...transport });
}
