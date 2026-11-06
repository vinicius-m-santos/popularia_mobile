import { describe, expect, it } from '@jest/globals';

import { discoveryKeys, libraryKeys, squaresKeys } from '../keys';

describe('query keys canônicas', () => {
  it('normaliza filtros vazios e a ordem das chaves do acervo', () => {
    const defaultDocuments = libraryKeys.documents({ scope: 'public', origin: 'all', sort: 'recent', q: '' });
    const equivalent = libraryKeys.documents({ sort: 'recent', q: '', origin: 'all', scope: 'public', topic: undefined });
    expect(equivalent).toEqual(defaultDocuments);
  });

  it('separa consultas que mudam filtro, assunto ou termo', () => {
    const base = libraryKeys.documents({ scope: 'public', q: 'tarifa', origin: 'all' });
    expect(libraryKeys.documents({ scope: 'public', q: 'tarifa', origin: 'people' })).not.toEqual(base);
    expect(libraryKeys.documents({ scope: 'public', q: 'moradia', origin: 'all' })).not.toEqual(base);
    expect(libraryKeys.collections({ scope: 'public' })).not.toEqual(libraryKeys.collections({ scope: 'personal' }));
    expect(discoveryKeys.search('me', 'linux', 'posts', 'tec')).not.toEqual(discoveryKeys.search('me', 'linux', 'posts', null));
    expect(squaresKeys.list('mine', '')).not.toEqual(squaresKeys.list('discover', ''));
  });

  it('inclui a conta nas consultas para não compartilhar cache entre sessões', () => {
    expect(discoveryKeys.detail('ana', null)).not.toEqual(discoveryKeys.detail('bia', null));
    expect(discoveryKeys.search('ana', '', 'all', null)).not.toEqual(discoveryKeys.search('bia', '', 'all', null));
  });
});
