/**
 * Criação e gestão de comunas com a API configurada: caminhos, corpos enviados, conversão das
 * respostas e as mensagens das recusas (formatos de popularia_backend/docs/openapi.json).
 */
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

import { apiRequest } from '@/lib/api/client';
import type { ComunaDto } from '@/lib/api/dto';
import { ApiError, NetworkError } from '@/lib/errors';
import type { ComunaPerson } from '@/types/models';

import {
  archiveComuna,
  cancelJoinRequest,
  checkComunaName,
  createComuna,
  decideJoinRequest,
  deleteComuna,
  getComunaMembers,
  getComunaQuota,
  getJoinRequests,
  proposeTransfer,
  removeMember,
  requestToJoin,
  respondToTransfer,
  setModerator,
  toComunaDetails,
  updateComuna,
} from '../api';
import { comunaErrorMessage, deletionNeedsArchive } from '../errors';
import { memberActions } from '../member-actions';

jest.mock('@/constants/config', () => ({
  API_BASE_URL: 'http://api.test/api/v1',
  API_TIMEOUT_MS: 1000,
  DEMO_MODE: false,
  USE_MOCKS: true,
  MOCK_LATENCY_MS: 0,
}));

jest.mock('@/lib/api/client', () => ({ apiRequest: jest.fn() }));

const api = jest.mocked(apiRequest);

const owner = { id: '0192a7b0-0000-7000-8000-000000000001', handle: 'dona.ponto', displayName: 'Dona Souza' };
const heir = { id: '0192a7b0-0000-7000-8000-000000000002', handle: 'herdeira', displayName: 'Herdeira Lima' };

const permissions = {
  canPost: true,
  canLeave: false,
  canEditDetails: true,
  canManageModerators: true,
  canRemoveMembers: true,
  canReviewJoinRequests: true,
  canModerateContent: true,
  canArchive: true,
  canDelete: true,
  canTransferOwnership: true,
};

const comunaDto: ComunaDto = {
  id: '0192a7b0-0000-7000-8000-0000000000c1',
  slug: 'hortas-do-bairro',
  name: 'Hortas do Bairro',
  description: 'Mutirões.',
  place: '',
  visibility: 'private',
  status: 'active',
  archivedAt: null,
  tone: 'red',
  topics: [],
  foundedYear: 2026,
  memberCount: 2,
  moderationNote: '',
  rules: [{ title: 'Respeito', body: '' }],
  owner,
  moderation: [{ ...owner, role: 'founder', joinedAt: '2026-10-26T12:00:00+00:00' }],
  viewer: {
    isMember: true,
    role: 'founder',
    permissions,
    joinRequest: null,
    ownershipTransfer: { direction: 'outgoing', from: owner, to: heir, createdAt: '2026-10-26T13:00:00+00:00' },
  },
};

beforeEach(() => {
  api.mockReset();
});

describe('criação', () => {
  it('cria uma única relação com assunto e edita o principal pelo contrato autorizado', async () => {
    api.mockResolvedValue({ ...comunaDto, topics: ['tec'] });
    await createComuna({ name: 'Linux', description: 'Software livre', visibility: 'public', rules: [], topic: 'tec' });
    expect(api).toHaveBeenLastCalledWith('/comunas', expect.objectContaining({ body: expect.objectContaining({ topics: ['tec'] }) }));
    await updateComuna('linux', { topic: 'trab' });
    expect(api).toHaveBeenLastCalledWith('/comunas/linux', { method: 'PATCH', body: { topic: 'trab' }, auth: true, contentType: 'application/merge-patch+json' });
  });

  it('manda só os dados da comuna (nunca proprietário, endereço ou estado)', async () => {
    api.mockResolvedValue(comunaDto);
    const created = await createComuna({ name: 'Hortas do Bairro', description: 'Mutirões.', visibility: 'private', rules: [{ title: 'Respeito', body: '' }] });

    expect(api).toHaveBeenCalledWith('/comunas', {
      method: 'POST',
      body: { name: 'Hortas do Bairro', description: 'Mutirões.', visibility: 'private', rules: [{ title: 'Respeito', body: '' }] },
      auth: true,
    });
    expect(created).toMatchObject({ id: 'hortas-do-bairro', serverId: comunaDto.id, viewerRole: 'founder' });
  });

  it('consulta a cota e a disponibilidade do nome com a sessão', async () => {
    api.mockResolvedValue({});
    await getComunaQuota();
    await checkComunaName('Hortas & Cia');
    expect(api).toHaveBeenNthCalledWith(1, '/me/comuna-quota', { auth: true });
    expect(api).toHaveBeenNthCalledWith(2, '/comuna-names/availability?name=Hortas%20%26%20Cia', { auth: true });
  });
});

describe('detalhe para a gestão', () => {
  it('papel, permissões, proprietário e transferência vêm do servidor', () => {
    const details = toComunaDetails(comunaDto);
    expect(details).toMatchObject({
      viewerRole: 'founder',
      viewerPermissions: permissions,
      owner: { handle: 'dona.ponto', name: 'Dona Souza' },
      ownershipTransfer: { direction: 'outgoing', to: { handle: 'herdeira' } },
      status: 'active',
      moderators: [{ handle: 'dona.ponto', role: 'founder' }],
    });
    // Nenhum ID fictício: a moderação é identificada pelos IDs reais da API.
    expect(details.moderators[0].id).toBe(owner.id);
  });
});

describe('gestão', () => {
  beforeEach(() => {
    api.mockResolvedValue(undefined);
  });

  it('edita descrição e regras com merge-patch, sem mandar o nome', async () => {
    api.mockResolvedValueOnce(comunaDto);
    await updateComuna('hortas-do-bairro', { description: 'Nova', rules: [] });
    expect(api).toHaveBeenCalledWith('/comunas/hortas-do-bairro', {
      method: 'PATCH',
      body: { description: 'Nova', rules: [] },
      auth: true,
      contentType: 'application/merge-patch+json',
    });
  });

  it('arquiva, exclui, remove e muda moderação pelos endereços da API', async () => {
    api.mockResolvedValueOnce({ ...comunaDto, status: 'archived' });
    await expect(archiveComuna('hortas-do-bairro')).resolves.toMatchObject({ status: 'archived' });
    await deleteComuna('hortas-do-bairro');
    await removeMember('hortas-do-bairro', 'dona.ponto');
    await setModerator('hortas-do-bairro', 'herdeira', true);
    await setModerator('hortas-do-bairro', 'herdeira', false);

    expect(api.mock.calls.map(([path, options]) => [options?.method, path])).toEqual([
      ['POST', '/comunas/hortas-do-bairro/archive'],
      ['DELETE', '/comunas/hortas-do-bairro'],
      ['DELETE', '/comunas/hortas-do-bairro/members/dona.ponto'],
      ['PUT', '/comunas/hortas-do-bairro/moderators/herdeira'],
      ['DELETE', '/comunas/hortas-do-bairro/moderators/herdeira'],
    ]);
  });

  it('pedidos de entrada e transferência', async () => {
    await requestToJoin('fechada');
    await cancelJoinRequest('fechada');
    await decideJoinRequest('fechada', 'r1', true);
    await decideJoinRequest('fechada', 'r2', false);
    await proposeTransfer('fechada', 'herdeira');
    await respondToTransfer('fechada', true);
    await respondToTransfer('fechada', false);

    expect(api.mock.calls.map(([path, options]) => [options?.method, path, options?.body])).toEqual([
      ['PUT', '/comunas/fechada/join-request', undefined],
      ['DELETE', '/comunas/fechada/join-request', undefined],
      ['POST', '/comunas/fechada/join-requests/r1/approve', undefined],
      ['POST', '/comunas/fechada/join-requests/r2/reject', undefined],
      ['PUT', '/comunas/fechada/ownership-transfer', { handle: 'herdeira' }],
      ['POST', '/comunas/fechada/ownership-transfer/accept', undefined],
      ['POST', '/comunas/fechada/ownership-transfer/decline', undefined],
    ]);
  });

  it('listas paginadas de membros e pedidos convertem a resposta', async () => {
    api.mockResolvedValueOnce({ items: [{ ...heir, role: 'moderator', joinedAt: 'x' }], nextCursor: 'c2' });
    const members = await getComunaMembers('fechada', 'c1');
    expect(api).toHaveBeenLastCalledWith('/comunas/fechada/members?cursor=c1', { auth: true });
    expect(members).toMatchObject({ items: [{ handle: 'herdeira', role: 'moderator', initials: 'HL' }], nextCursor: 'c2' });

    api.mockResolvedValueOnce({ items: [{ id: 'r1', comunaSlug: 'fechada', user: heir, status: 'pending', createdAt: 'x', decidedAt: null }], nextCursor: null });
    const requests = await getJoinRequests('fechada', null);
    expect(api).toHaveBeenLastCalledWith('/comunas/fechada/join-requests', { auth: true });
    expect(requests.items[0]).toMatchObject({ id: 'r1', user: { handle: 'herdeira' } });
  });

  it('erros da API são repassados (a tela mostra o erro, nunca dados fictícios)', async () => {
    api.mockReset();
    api.mockRejectedValue(new NetworkError());
    await expect(getComunaMembers('fechada', null)).rejects.toBeInstanceOf(NetworkError);
    await expect(deleteComuna('fechada')).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('mensagens das recusas', () => {
  it('explica as regras conhecidas e oferece arquivar quando a exclusão não é possível', () => {
    const hasMembers = new ApiError(409, '/errors/comuna-has-members', 'x');
    const hasContent = new ApiError(409, '/errors/comuna-has-content', 'x');
    expect(comunaErrorMessage(hasMembers)).toContain('arquivá-la');
    expect(deletionNeedsArchive(hasMembers)).toBe(true);
    expect(deletionNeedsArchive(hasContent)).toBe(true);
    expect(deletionNeedsArchive(new ApiError(403, '/errors/not-comuna-owner', 'x'))).toBe(false);
    expect(comunaErrorMessage(new ApiError(409, '/errors/comuna-limit-reached', 'x'))).toContain('até 3');
    expect(comunaErrorMessage(new ApiError(409, '/errors/comuna-creation-interval', 'Espere 7 dias.'))).toBe('Espere 7 dias.');
    expect(comunaErrorMessage(new NetworkError())).toContain('Sem conexão');
  });
});

describe('ações oferecidas por pessoa', () => {
  const person = (handle: string, role: ComunaPerson['role']): ComunaPerson => ({
    id: handle,
    name: handle,
    handle,
    initials: 'XX',
    tone: 'red',
    role,
    joinedAt: '',
  });

  it('proprietário: nomeia, transfere e remove; nunca age sobre si', () => {
    const viewer = { handle: 'dona', role: 'founder' as const, archived: false };
    expect(memberActions(person('ana', 'member'), viewer)).toEqual(['appoint', 'transfer', 'remove']);
    expect(memberActions(person('mod', 'moderator'), viewer)).toEqual(['dismiss', 'transfer', 'remove']);
    expect(memberActions(person('dona', 'founder'), viewer)).toEqual([]);
  });

  it('moderação: só remove membros comuns; ninguém remove o proprietário', () => {
    const viewer = { handle: 'mod', role: 'moderator' as const, archived: false };
    expect(memberActions(person('ana', 'member'), viewer)).toEqual(['remove']);
    expect(memberActions(person('outro', 'moderator'), viewer)).toEqual([]);
    expect(memberActions(person('dona', 'founder'), viewer)).toEqual([]);
    expect(memberActions(person('ana', 'member'), { ...viewer, role: 'member' })).toEqual([]);
  });

  it('comuna arquivada: sem nomear nem transferir', () => {
    const viewer = { handle: 'dona', role: 'founder' as const, archived: true };
    expect(memberActions(person('ana', 'member'), viewer)).toEqual(['remove']);
    expect(memberActions(person('mod', 'moderator'), viewer)).toEqual(['dismiss', 'remove']);
  });
});
