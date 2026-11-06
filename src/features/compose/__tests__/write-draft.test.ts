import { describe, expect, it, jest } from '@jest/globals';

import { createWriteDraftStore } from '../write-draft';

describe('store do rascunho de escrita', () => {
  it('mantém texto, título e composição no mesmo snapshot', () => {
    const store = createWriteDraftStore();
    expect(store.getSnapshot()).toMatchObject({ text: '', title: '', titleEnabled: false, hasContent: false });

    store.onChangeText('  Olá, comuna  ');
    store.setTitleEnabled(true);
    store.setTitle('  Ato na quinta  ');

    const state = store.getSnapshot();
    expect(state.text).toBe('  Olá, comuna  ');
    expect(state.composed.body).toBe('Olá, comuna');
    expect(state.title).toBe('  Ato na quinta  ');
    expect(state.hasContent).toBe(true);
  });

  it('avisa a tela só quando a presença de conteúdo muda', () => {
    const store = createWriteDraftStore();
    const onContent = jest.fn();
    const onDraft = jest.fn();
    store.subscribeContent(onContent);
    store.subscribe(onDraft);

    store.onChangeText('a');
    store.onChangeText('ab');
    store.onChangeText('abc');
    expect(onDraft).toHaveBeenCalledTimes(3);
    expect(onContent).toHaveBeenCalledTimes(1);

    store.onChangeText('');
    expect(onContent).toHaveBeenCalledTimes(2);
  });

  it('título vazio não marca o rascunho como sujo', () => {
    const store = createWriteDraftStore();
    store.setTitleEnabled(true);
    store.setTitle('   ');
    expect(store.getHasContent()).toBe(false);

    store.setTitle('Chamado');
    expect(store.getHasContent()).toBe(true);
    store.clearTitle();
    expect(store.getSnapshot()).toMatchObject({ title: '', titleEnabled: false, hasContent: false });
  });

  it('reconcilia menções e preserva o cursor ao inserir', () => {
    const store = createWriteDraftStore();
    store.onChangeText('Oi @an');
    expect(store.getSnapshot().query).toMatchObject({ query: 'an' });

    store.insert({ userId: 'ana', handle: 'ana', displayName: 'Ana', avatarUrl: null });
    const inserted = store.getSnapshot();
    expect(inserted.text).toBe('Oi @ana ');
    expect(inserted.cursor).toBe(8);
    expect(inserted.composed.mentions).toEqual([
      expect.objectContaining({ userId: 'ana', handle: 'ana', start: 3, end: 7 }),
    ]);
  });

  it('reset limpa texto, título e menções', () => {
    const store = createWriteDraftStore();
    store.onChangeText('Oi @an');
    store.insert({ userId: 'ana', handle: 'ana', displayName: 'Ana' });
    store.setTitleEnabled(true);
    store.setTitle('Título');

    store.reset();

    expect(store.getSnapshot()).toMatchObject({
      text: '',
      title: '',
      titleEnabled: false,
      mentions: [],
      hasContent: false,
    });
  });
});
