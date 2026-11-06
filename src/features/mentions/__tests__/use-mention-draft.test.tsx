import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, renderHook } from '@testing-library/react-native';

import { clearScreenMemory, readScreenMemory } from '@/lib/screen-memory';

import { useMentionDraft } from '../use-mention-draft';

beforeEach(() => { clearScreenMemory(); });
afterEach(async () => { await cleanup(); clearScreenMemory(); });

describe('rascunho de menções', () => {
  it('restaura texto, menções e cursor ao remontar a discussão', async () => {
    const key = 'discussion:post-1:draft';
    const first = await renderHook(() => useMentionDraft(key));
    await act(async () => { first.result.current.onChangeText('Olá, @ana'); });
    await act(async () => { first.result.current.onSelectionChange({ start: 4, end: 4 }); });
    await act(async () => {
      first.result.current.insert({ userId: 'ana', handle: 'ana', displayName: 'Ana' });
    });
    const saved = first.result.current;
    expect(saved.text).toBe('Olá, @ana');
    await first.unmount();

    const next = await renderHook(() => useMentionDraft(key));
    expect(next.result.current.text).toBe(saved.text);
    expect(next.result.current.mentions).toEqual(saved.mentions);
    expect(next.result.current.cursor).toBe(saved.cursor);
    expect(next.result.current.selection).toEqual(saved.selection);
  });

  it('limpa o rascunho depois do envio, sem deixar texto para a próxima abertura', async () => {
    const key = 'discussion:post-2:draft';
    const first = await renderHook(() => useMentionDraft(key));
    await act(async () => { first.result.current.onChangeText('Comentário enviado'); });
    await act(async () => { first.result.current.reset(); });
    expect(readScreenMemory(key)).toBeUndefined();

    await first.unmount();
    const next = await renderHook(() => useMentionDraft(key));
    expect(next.result.current.text).toBe('');
    expect(next.result.current.cursor).toBe(0);
  });
});
