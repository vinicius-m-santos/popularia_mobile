import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { apiRequest } from '@/lib/api/client';
import { createPost } from '@/features/posts/api';
import { deleteDocument, editDocument, listDocuments, saveDocument, shareDocument } from '../api';
import { document } from '../testing/fixtures';

jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));
const api = jest.mocked(apiRequest);
beforeEach(() => { jest.clearAllMocks(); });
describe('contrato da biblioteca', () => {
  it('busca e filtros são enviados ao servidor com cursor', async () => {
    api.mockResolvedValue({ items: [document], nextCursor: 'next' });
    const page = await listDocuments({ scope: 'public', q: 'organização', topic: 'trab', origin: 'people' }, 'previous');
    expect(page.nextCursor).toBe('next');
    const params = new URLSearchParams(String(api.mock.calls[0][0]).split('?')[1]);
    expect(Object.fromEntries(params)).toEqual({ limit: '20', scope: 'public', q: 'organização', topic: 'trab', origin: 'people', cursor: 'previous' });
  });
  it('salvar e compartilhar enviam somente referências', async () => {
    api.mockResolvedValue(undefined);
    await saveDocument('doc-1', true); await shareDocument('doc-1', 'tarifa-zero', true); await shareDocument('doc-1', 'tarifa-zero', false);
    expect(api).toHaveBeenNthCalledWith(1, '/library/documents/doc-1/saved', { auth: true, method: 'PUT' });
    expect(api).toHaveBeenNthCalledWith(2, '/library/documents/doc-1/comunas/tarifa-zero', { auth: true, method: 'PUT' });
    expect(api).toHaveBeenNthCalledWith(3, '/library/documents/doc-1/comunas/tarifa-zero', { auth: true, method: 'DELETE' });
  });
  it('post com PDF não reenvia arquivo nem muda acesso', async () => {
    api.mockResolvedValue({ id: 'post-1', body: 'Leia', author: { id: 'me', handle: 'camila', displayName: 'Camila' }, document, comuna: null, viewer: {}, createdAt: '', commentCount: 0 });
    const post = await createPost({ comunaServerId: null, text: 'Leia', documentId: 'doc-1' });
    expect(post.document).toEqual(document);
    expect(api).toHaveBeenCalledWith('/posts', { method: 'POST', body: { comunaId: null, body: 'Leia', documentId: 'doc-1' }, auth: true });
    expect(api).toHaveBeenCalledTimes(1);
  });
  it('revogar publicação pública e excluir usam o original', async () => {
    api.mockResolvedValue(document);
    await editDocument(document.id, { isPublic: false }); await deleteDocument(document.id);
    expect(api).toHaveBeenNthCalledWith(1, '/library/documents/doc-1', { auth: true, method: 'PATCH', body: { isPublic: false } });
    expect(api).toHaveBeenNthCalledWith(2, '/library/documents/doc-1', { auth: true, method: 'DELETE' });
  });
});
