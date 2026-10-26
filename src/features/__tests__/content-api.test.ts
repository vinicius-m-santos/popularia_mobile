/**
 * Comunas, feed, publicações e comentários com a API configurada: caminhos, corpos enviados
 * e conversão das respostas (formatos de popularia_backend/docs/openapi.json).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { getComuna, getComunaPosts, getMyComunas, joinComuna, leaveComuna, toComuna } from '@/features/comunas/api';
import { createComment, getComments, toComment } from '@/features/discussion/api';
import { buildThread } from '@/features/discussion/thread';
import { getFeed } from '@/features/feed/api';
import { createPost, getPost, toFeedItem } from '@/features/posts/api';
import { apiRequest } from '@/lib/api/client';
import type { CommentDto, ComunaDto, PostDto } from '@/lib/api/dto';
import { ApiError, NotFoundError } from '@/lib/errors';

jest.mock('@/constants/config', () => ({
  API_BASE_URL: 'http://api.test/api/v1',
  API_TIMEOUT_MS: 1000,
  DEMO_MODE: false,
  USE_MOCKS: true,
  MOCK_LATENCY_MS: 0,
}));

jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));

const api = jest.mocked(apiRequest);

const author = { id: '0192a7b0-0000-7000-8000-000000000001', handle: 'ana', displayName: 'Ana Souza' };

const postDto: PostDto = {
  id: '0192a7b0-0000-7000-8000-0000000000aa',
  body: 'Mutirão no sábado',
  createdAt: '2026-10-20T12:00:00+00:00',
  author,
  comuna: { id: '0192a7b0-0000-7000-8000-0000000000c1', slug: 'hortas', name: 'Hortas da Zona Leste' },
  commentCount: 3,
  viewer: { isAuthor: false, canComment: true, canDelete: false },
};

const comunaDto: ComunaDto = {
  id: '0192a7b0-0000-7000-8000-0000000000c1',
  slug: 'hortas',
  name: 'Hortas da Zona Leste',
  description: 'Rede de hortas.',
  place: 'São Paulo · SP',
  visibility: 'public',
  tone: 'red',
  topics: ['clima', 'comun'],
  foundedYear: 2023,
  memberCount: 12,
  moderationNote: 'Votação a cada seis meses.',
  rules: [{ title: 'Respeito sempre', body: 'Sem ataques.' }],
  viewer: { isMember: true, role: 'member' },
};

function comment(overrides: Partial<CommentDto>): CommentDto {
  return {
    id: 'c1',
    postId: postDto.id,
    parentId: null,
    status: 'published',
    body: 'Vou levar mudas',
    author,
    createdAt: '2026-10-20T13:00:00+00:00',
    viewer: { isAuthor: false },
    ...overrides,
  };
}

beforeEach(() => {
  api.mockReset();
});

describe('publicações', () => {
  it('converte a publicação usando o slug como ID da comuna e as permissões do servidor', () => {
    const item = toFeedItem(postDto);
    expect(item).toMatchObject({
      id: postDto.id,
      text: 'Mutirão no sábado',
      comunaId: 'hortas',
      comuna: { id: 'hortas', name: 'Hortas da Zona Leste' },
      commentCount: 3,
      viewer: { isAuthor: false, canComment: true },
      author: { id: author.id, name: 'Ana Souza', handle: 'ana', initials: 'AS' },
    });
  });

  it('cria mandando só o texto e a comuna (nunca autoria ou contagens)', async () => {
    api.mockResolvedValue(postDto);
    await createPost({ comunaServerId: comunaDto.id, text: 'Olá' });
    expect(api).toHaveBeenCalledWith('/posts', {
      method: 'POST',
      body: { comunaId: comunaDto.id, body: 'Olá' },
      auth: true,
    });
  });

  it('publicação invisível (404) vira NotFoundError', async () => {
    api.mockRejectedValue(new ApiError(404, '/errors/not-found', 'Publicação não encontrada.'));
    await expect(getPost('x')).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('feed', () => {
  it('pede a aba e o cursor e devolve o próximo cursor', async () => {
    api.mockResolvedValue({ items: [postDto], nextCursor: 'abc' });
    const page = await getFeed({ tab: 'minhas', joinedComunaIds: [], cursor: 'xyz' });
    expect(api).toHaveBeenCalledWith('/feed?tab=minhas&cursor=xyz', { auth: true });
    expect(page.nextCursor).toBe('abc');
    expect(page.items[0].id).toBe(postDto.id);
  });

  it('"Perto de mim" não existe na API: não faz requisição', async () => {
    const page = await getFeed({ tab: 'perto', joinedComunaIds: [], cursor: null });
    expect(api).not.toHaveBeenCalled();
    expect(page).toEqual({ items: [], nextCursor: null });
  });
});

describe('comunas', () => {
  it('converte a comuna: slug como ID, UUID guardado para publicar, regras e participação', () => {
    expect(toComuna(comunaDto)).toMatchObject({
      id: 'hortas',
      serverId: comunaDto.id,
      viewerIsMember: true,
      memberCount: 12,
      foundedYear: '2023',
      rules: [{ title: 'Respeito sempre', description: 'Sem ataques.' }],
      pinned: null,
      moderatorIds: [],
    });
  });

  it('detalhe pelo slug; 404 vira NotFoundError', async () => {
    api.mockResolvedValueOnce(comunaDto);
    await expect(getComuna('hortas')).resolves.toMatchObject({ viewerIsMember: true, viewerRole: 'member', members: [] });
    expect(api).toHaveBeenCalledWith('/comunas/hortas', { auth: true });

    api.mockRejectedValueOnce(new ApiError(404, '/errors/not-found', 'Comuna não encontrada.'));
    await expect(getComuna('nao-existe')).rejects.toBeInstanceOf(NotFoundError);
  });

  it('publicações da comuna com cursor; comuna privada repassa o 403', async () => {
    api.mockResolvedValueOnce({ items: [postDto], nextCursor: null });
    await getComunaPosts('hortas', 'c9');
    expect(api).toHaveBeenCalledWith('/comunas/hortas/posts?cursor=c9', { auth: true });

    api.mockRejectedValueOnce(new ApiError(403, '/errors/comuna-private', 'Esta comuna é privada.'));
    await expect(getComunaPosts('entregadores', null)).rejects.toMatchObject({ type: '/errors/comuna-private' });
  });

  it('comunas de que a pessoa participa: percorre as páginas e filtra pelo servidor', async () => {
    const other = { ...comunaDto, id: 'u2', slug: 'tarifa', viewer: { isMember: false, role: null } };
    api
      .mockResolvedValueOnce({ items: [comunaDto, other], nextCursor: 'tarifa' })
      .mockResolvedValueOnce({ items: [{ ...comunaDto, id: 'u3', slug: 'cursinho' }], nextCursor: null });

    const mine = await getMyComunas();

    expect(mine.map((c) => c.id)).toEqual(['hortas', 'cursinho']);
    expect(api).toHaveBeenNthCalledWith(1, '/comunas?limit=50', { auth: true });
    expect(api).toHaveBeenNthCalledWith(2, '/comunas?limit=50&cursor=tarifa', { auth: true });
  });

  it('entrar e sair usam PUT e DELETE em /membership, sem corpo', async () => {
    api.mockResolvedValue(undefined);
    await joinComuna('hortas');
    await leaveComuna('hortas');
    expect(api).toHaveBeenNthCalledWith(1, '/comunas/hortas/membership', { method: 'PUT', auth: true });
    expect(api).toHaveBeenNthCalledWith(2, '/comunas/hortas/membership', { method: 'DELETE', auth: true });
  });
});

describe('comentários', () => {
  it('lista com cursor e converte a autoria do servidor', async () => {
    api.mockResolvedValue({ items: [comment({ viewer: { isAuthor: true } })], nextCursor: 'c1' });
    const page = await getComments(postDto.id, 'c0');
    expect(api).toHaveBeenCalledWith(`/posts/${postDto.id}/comments?cursor=c0`, { auth: true });
    expect(page.items[0]).toMatchObject({ text: 'Vou levar mudas', isOwn: true, author: { name: 'Ana Souza' } });
    expect(page.nextCursor).toBe('c1');
  });

  it('cria resposta mandando só o texto e o comentário pai', async () => {
    api.mockResolvedValue(comment({ id: 'c2', parentId: 'c1' }));
    await createComment({ postId: postDto.id, parentId: 'c1', text: 'Combinado' });
    expect(api).toHaveBeenCalledWith(`/posts/${postDto.id}/comments`, {
      method: 'POST',
      body: { body: 'Combinado', parentId: 'c1' },
      auth: true,
    });
  });

  it('comentários apagados, removidos ou ocultos viram marcadores sem texto nem autoria', () => {
    const hidden = toComment(comment({ id: 'h', status: 'hidden', body: null, author: null }));
    const removed = toComment(comment({ id: 'r', status: 'removed', body: null, author: null }));
    expect(hidden).toMatchObject({ status: 'hidden', authorId: '', text: 'Comentário indisponível.' });
    expect(removed.text).toBe('Comentário removido pela moderação.');
    expect(hidden.author.name).toBe('Indisponível');
  });

  it('respostas a um comentário oculto continuam encadeadas abaixo dele', () => {
    const list = [
      toComment(comment({ id: 'pai', status: 'hidden', body: null, author: null })),
      toComment(comment({ id: 'filho', parentId: 'pai', createdAt: '2026-10-20T14:00:00+00:00' })),
    ];
    const rows = buildThread(list, { sort: 'recent', collapsed: {} });
    expect(rows.map((r) => [r.comment.id, r.depth])).toEqual([
      ['pai', 0],
      ['filho', 1],
    ]);
  });
});
