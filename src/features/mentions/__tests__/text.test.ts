import { describe, expect, it } from '@jest/globals';

import type { ContentMention } from '@/types/models';

import { activeMentionQuery, insertMention, mentionPayload, normalizeContentText, reconcileMentions } from '../text';

const ana = { userId: 'user-ana', handle: 'ana', displayName: 'Ana Souza', avatarUrl: null };
const bia = { userId: 'user-bia', handle: 'bia', displayName: 'Bia Lima', avatarUrl: null };

function mention(start: number, end: number, person = ana): ContentMention {
  return { ...person, start, end };
}

describe('autocomplete de menção', () => {
  it('reconhece @ no começo e depois de espaço', () => {
    expect(activeMentionQuery('@vin', 4)).toEqual({ start: 0, query: 'vin' });
    expect(activeMentionQuery('Oi @vin', 7)).toEqual({ start: 3, query: 'vin' });
    expect(activeMentionQuery('Oi\n@vin', 7)).toEqual({ start: 3, query: 'vin' });
  });

  it('não abre no meio de um e-mail', () => {
    expect(activeMentionQuery('teste@email.com', 6)).toBeNull();
    expect(activeMentionQuery('teste@email.com', 14)).toBeNull();
  });

  it('fecha quando o token deixa de ser um handle', () => {
    expect(activeMentionQuery('Oi @vin ', 8)).toBeNull();
    expect(activeMentionQuery('Oi @vin!', 'Oi @vin!'.length)).toBeNull();
  });
});

describe('inserção estruturada', () => {
  it('substitui o texto digitado pela menção e deixa o cursor depois do espaço', () => {
    const next = insertMention('Oi @vi', 6, ana, []);
    expect(next.text).toBe('Oi @ana ');
    expect(next.cursor).toBe(8);
    expect(next.mentions).toEqual([mention(3, 7)]);
  });

  it('permite continuar escrevendo e inserir outra pessoa', () => {
    const first = insertMention('Oi @an', 6, ana, []);
    const continued = `${first.text}e @bi`;
    const kept = reconcileMentions(first.text, continued, first.mentions);
    const second = insertMention(continued, continued.length, bia, kept);
    expect(second.text).toBe('Oi @ana e @bia ');
    expect(second.mentions.map((item) => item.userId)).toEqual(['user-ana', 'user-bia']);
    expect(second.text.slice(second.mentions[1].start, second.mentions[1].end)).toBe('@bia');
  });

  it('descarta a referência se o trecho for apagado e limita a dez', () => {
    let text = '';
    let mentions: ContentMention[] = [];
    for (let index = 0; index < 11; index += 1) {
      text = `${text}@an`;
      const next = insertMention(text, text.length, { ...ana, userId: `user-${index}` }, mentions);
      text = next.text;
      mentions = next.mentions;
    }
    expect(mentions).toHaveLength(10);
    const broken = reconcileMentions(text, text.replace('@ana', 'ana'), mentions);
    expect(broken.length).toBeLessThan(mentions.length);
  });

  it('mantém @fulano como texto quando ninguém foi escolhido', () => {
    expect(mentionPayload('Olha @fulano', []).mentions).toEqual([]);
  });

  it('converte o rascunho para pontos de código depois da normalização', () => {
    const text = '  Olá @ana  ';
    const draft = mention(6, 10);
    expect(normalizeContentText(text)).toBe('Olá @ana');
    expect(mentionPayload(text, [draft])).toEqual({
      body: 'Olá @ana',
      mentions: [mention(4, 8)],
    });
  });

  it('conta emoji como um ponto de código', () => {
    const text = '😀 @ana';
    expect(mentionPayload(text, [mention(3, 7)])).toEqual({
      body: text,
      mentions: [mention(2, 6)],
    });
  });
});
