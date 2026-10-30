import { describe, expect, it } from '@jest/globals';
import { tokenizePostText } from '../text';

describe('tokens de texto de publicação', () => {
  it('reserva URL e menção antes de interpretar hashtags Unicode', () => {
    const text = '@ana, olha isso:\nhttps://popularia.com.br/alguma-coisa#comentarios\n\nAchei #tecnologia e #SãoPaulo.';
    const tokens = tokenizePostText(text, [{ userId: 'ana', handle: 'ana', displayName: 'Ana', avatarUrl: null, start: 0, end: 4 }]);
    expect(tokens.map(({ label, hashtag, href, mention }) => ({ label, hashtag, href, mention: mention?.userId }))).toEqual([
      { label: '@ana', hashtag: undefined, href: undefined, mention: 'ana' },
      { label: 'https://popularia.com.br/alguma-coisa#comentarios', hashtag: undefined, href: 'https://popularia.com.br/alguma-coisa#comentarios', mention: undefined },
      { label: '#tecnologia', hashtag: 'tecnologia', href: undefined, mention: undefined },
      { label: '#SãoPaulo', hashtag: 'saopaulo', href: undefined, mention: undefined },
    ]);
  });

  it('não cria tópico no meio de palavra ou a partir de # sozinho', () => {
    const tokens = tokenizePostText('abc#nada email#teste ### # #___ (#2026) #política #किताब');
    expect(tokens.map((token) => token.hashtag)).toEqual(['2026', 'politica', 'किताब']);
  });
});
