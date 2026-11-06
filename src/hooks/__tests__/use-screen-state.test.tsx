import { afterEach, beforeEach, describe, expect, it } from '@jest/globals';
import { act, cleanup, renderHook } from '@testing-library/react-native';

import { clearScreenMemory } from '@/lib/screen-memory';

import { useScreenState } from '../use-screen-state';

beforeEach(() => { clearScreenMemory(); });
afterEach(async () => { await cleanup(); clearScreenMemory(); });

describe('estado de tela', () => {
  it('devolve filtro e texto digitado ao remontar a mesma tela', async () => {
    const first = await renderHook(() => useScreenState('library:public:query', ''));
    await act(async () => { first.result.current[1]('organização popular'); });
    await first.unmount();

    const next = await renderHook(() => useScreenState('library:public:query', ''));
    expect(next.result.current[0]).toBe('organização popular');
  });

  it('não mistura telas diferentes nem parâmetro explícito da rota', async () => {
    const first = await renderHook(() => useScreenState('library:public:query', ''));
    await act(async () => { first.result.current[1]('tarifa'); });
    await first.unmount();

    const other = await renderHook(() => useScreenState('library:comuna:query', ''));
    expect(other.result.current[0]).toBe('');

    const explicit = await renderHook(() =>
      useScreenState('library:public:query', 'assunto do link', { restore: false }),
    );
    expect(explicit.result.current[0]).toBe('assunto do link');
  });
});
