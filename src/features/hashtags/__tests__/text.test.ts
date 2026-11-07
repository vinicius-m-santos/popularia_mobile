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

  it('reaproveita a tokenização para o mesmo texto e as mesmas menções', () => {
    const text = '@ana, olha #tecnologia em https://popularia.com.br';
    const mentions = [{ userId: 'ana', handle: 'ana', displayName: 'Ana', avatarUrl: null, start: 0, end: 4 }];
    const first = tokenizePostText(text, mentions);
    expect(tokenizePostText(text, mentions)).toBe(first);

    const renamed = tokenizePostText(text, [{ ...mentions[0], displayName: 'Ana Silva' }]);
    expect(renamed).not.toBe(first);
    expect(renamed.find((mark) => mark.mention)?.mention?.displayName).toBe('Ana Silva');
  });

  it('separa variantes por hashtags desligadas e por mudança de offsets', () => {
    const text = '@ana e #tecnologia';
    const mentions = [{ userId: 'ana', handle: 'ana', displayName: 'Ana', avatarUrl: null, start: 0, end: 4 }];
    const withHashtags = tokenizePostText(text, mentions);
    const withoutHashtags = tokenizePostText(text, mentions, false);
    expect(withoutHashtags).not.toBe(withHashtags);
    expect(withoutHashtags.some((mark) => mark.hashtag)).toBe(false);
    expect(tokenizePostText(text, [{ ...mentions[0], start: 1, end: 5 }])).not.toBe(withHashtags);
  });
});
