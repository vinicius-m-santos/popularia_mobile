import { describe, expect, it } from '@jest/globals';

import { queryKeys } from '../keys';

describe('factory de chaves por domínio', () => {
  it('mantém abas e escopos do feed sob a mesma raiz', () => {
    expect(queryKeys.feed.list('para-voce', '')).toEqual(['feed', 'para-voce', '']);
    expect(queryKeys.feed.list('minhas', 'hortas,vila')).toEqual(['feed', 'minhas', 'hortas,vila']);
    expect(queryKeys.feed.list('seguindo', '', 'ana')).toEqual(['feed', 'seguindo', '', 'ana']);
    expect(queryKeys.feed.all).toEqual(['feed']);
  });

  it('coloca posts, fixados, Praça e eventos abaixo do detalhe da comuna', () => {
    const detail = queryKeys.comuna.detail('hortas');
    expect(detail).toEqual(['comuna', 'hortas']);
    expect(queryKeys.comuna.posts('hortas')).toEqual(['comuna', 'hortas', 'posts']);
    expect(queryKeys.comuna.pins('hortas')).toEqual(['comuna', 'hortas', 'pins']);
    expect(queryKeys.comuna.square('hortas')).toEqual(['comuna', 'hortas', 'square']);
    expect(queryKeys.comuna.events('hortas', 'upcoming')).toEqual(['comuna', 'hortas', 'events', 'upcoming']);
    // Overlays de imagem continuam fora do detalhe: URL curta não substitui o payload completo.
    expect(queryKeys.comuna.cover('hortas')).toEqual(['comuna-cover', 'hortas']);
    expect(queryKeys.comuna.mark('hortas')).toEqual(['comuna-mark', 'hortas']);
  });

  it('normaliza assunto ausente e separa descoberta de busca digitada', () => {
    expect(queryKeys.discovery.home('me')).toEqual(['discovery', 'home', 'me', null]);
    expect(queryKeys.discovery.home('me', 'tec', 'tec')).toEqual(['discovery', 'home', 'me', 'tec', 'tec']);
    expect(queryKeys.discovery.search('Linux', 'all')).toEqual(['search', 'Linux', 'all', null]);
    expect(queryKeys.discovery.search('Linux', 'all', 'tec')).toEqual(['search', 'Linux', 'all', 'tec']);
    expect(queryKeys.discovery.searchAll).toEqual(['search']);
  });

  it('identifica listas de posts/eventos da comuna sem confundir com o detalhe', () => {
    expect(queryKeys.comuna.isPostsKey(queryKeys.comuna.posts('hortas'))).toBe(true);
    expect(queryKeys.comuna.isPostsKey(queryKeys.comuna.detail('hortas'))).toBe(false);
    expect(queryKeys.comuna.isPostsKey(['feed', 'para-voce'])).toBe(false);
    expect(queryKeys.comuna.isEventsKey(queryKeys.comuna.events('hortas', 'past'))).toBe(true);
    expect(queryKeys.comuna.isEventsKey(queryKeys.comuna.pins('hortas'))).toBe(false);
  });

  it('mantém detalhe e preview de publicação em chaves distintas e previsíveis', () => {
    expect(queryKeys.post.detail('p1')).toEqual(['post', 'p1']);
    expect(queryKeys.post.preview('p1')).toEqual(['post-preview', 'p1']);
    expect(queryKeys.saved.all).toEqual(['saved-posts']);
    expect(queryKeys.profile.posts('ana')).toEqual(['profile-posts', 'ana']);
  });
});
