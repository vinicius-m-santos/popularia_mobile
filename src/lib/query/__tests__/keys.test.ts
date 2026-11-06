import { describe, expect, it, jest } from '@jest/globals';

import { queryClient } from '../client';
import { discoveryKeys, invalidateLibrary, libraryKeys, squaresKeys } from '../keys';

describe('query keys canônicas', () => {
  it('normaliza filtros vazios e a ordem das chaves do acervo', () => {
    const defaultDocuments = libraryKeys.documents('me', { scope: 'public', origin: 'all', sort: 'recent', q: '' });
    const equivalent = libraryKeys.documents('me', { sort: 'recent', q: '', origin: 'all', scope: 'public', topic: undefined });
    expect(equivalent).toEqual(defaultDocuments);
  });

  it('separa consultas que mudam filtro, assunto ou termo', () => {
    const base = libraryKeys.documents('me', { scope: 'public', q: 'tarifa', origin: 'all' });
    expect(libraryKeys.documents('me', { scope: 'public', q: 'tarifa', origin: 'people' })).not.toEqual(base);
    expect(libraryKeys.documents('me', { scope: 'public', q: 'moradia', origin: 'all' })).not.toEqual(base);
    expect(libraryKeys.collections('me', { scope: 'public' })).not.toEqual(libraryKeys.collections('me', { scope: 'personal' }));
    expect(discoveryKeys.search('me', 'linux', 'posts', 'tec')).not.toEqual(discoveryKeys.search('me', 'linux', 'posts', null));
    expect(squaresKeys.list('me', 'mine', '')).not.toEqual(squaresKeys.list('me', 'discover', ''));
  });

  it('inclui a conta nas consultas para não compartilhar cache entre sessões', () => {
    expect(discoveryKeys.detail('ana', null)).not.toEqual(discoveryKeys.detail('bia', null));
    expect(discoveryKeys.search('ana', '', 'all', null)).not.toEqual(discoveryKeys.search('bia', '', 'all', null));
    expect(libraryKeys.documents('ana', { scope: 'saved' })).not.toEqual(libraryKeys.documents('bia', { scope: 'saved' }));
    expect(libraryKeys.collections('ana', { scope: 'personal' })).not.toEqual(libraryKeys.collections('bia', { scope: 'personal' }));
    expect(libraryKeys.collection('ana', 'collection-1')).not.toEqual(libraryKeys.collection('bia', 'collection-1'));
    expect(squaresKeys.list('ana', 'mine', '')).not.toEqual(squaresKeys.list('bia', 'mine', ''));
  });

  it('invalida e revalida somente consultas ativas da biblioteca', () => {
    const invalidate = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue();

    invalidateLibrary();

    expect(invalidate).toHaveBeenCalledWith({ queryKey: libraryKeys.root, refetchType: 'active' });
    invalidate.mockRestore();
  });
});
