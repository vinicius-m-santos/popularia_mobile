import { describe, expect, it, jest } from '@jest/globals';
import { renderHook, waitFor } from '@testing-library/react-native';

import { suggestHandle } from '../api';
import { useSuggestedHandle } from '../use-suggested-handle';

jest.mock('../api', () => ({ suggestHandle: jest.fn() }));

describe('sugestão de @ no cadastro', () => {
  it('preenche o campo vazio com a sugestão do servidor', async () => {
    jest.mocked(suggestHandle).mockResolvedValue('quietotter');
    const update = jest.fn();

    await renderHook(() => useSuggestedHandle({ account: null, handle: '', update }));

    await waitFor(() => expect(update).toHaveBeenCalledWith({ handle: 'quietotter' }));
  });

  it('não sobrescreve um nome digitado enquanto a resposta chega', async () => {
    let resolveSuggestion: (value: string) => void = () => undefined;
    jest.mocked(suggestHandle).mockReturnValue(new Promise((resolve) => { resolveSuggestion = resolve; }));
    const update = jest.fn();
    const { rerender } = await renderHook((props: { handle: string }) => useSuggestedHandle({ account: null, handle: props.handle, update }), {
      initialProps: { handle: '' },
    });

    rerender({ handle: 'meunome' });
    resolveSuggestion('quietotter');

    await waitFor(() => expect(update).not.toHaveBeenCalled());
  });
});
