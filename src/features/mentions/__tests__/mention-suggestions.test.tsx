import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { queryClient } from '@/lib/query/client';

import { searchMentionPeople } from '../api';
import { MentionSuggestions } from '../mention-suggestions';

jest.mock('../api', () => ({ searchMentionPeople: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() }, useSegments: () => [] }));

const ana = { userId: 'user-ana', handle: 'ana', displayName: 'Ana Souza', avatarUrl: null };

describe('sugestões de menção', () => {
  beforeEach(() => {
    queryClient.clear();
    jest.mocked(searchMentionPeople).mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('espera o debounce e não busca a cada letra', async () => {
    jest.mocked(searchMentionPeople).mockResolvedValue([ana]);
    const view = await render(<MentionSuggestions query="an" onSelect={jest.fn()} />);
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(searchMentionPeople).not.toHaveBeenCalled();

    view.rerender(<MentionSuggestions query="ana" onSelect={jest.fn()} />);
    expect(searchMentionPeople).not.toHaveBeenCalled();
    await waitFor(() => expect(searchMentionPeople).toHaveBeenCalledTimes(1));
    expect(searchMentionPeople).toHaveBeenCalledWith('ana', expect.anything());
    expect(await screen.findByRole('button', { name: 'Ana Souza, @ana' })).toBeTruthy();
  });

  it('mostra lista vazia e erro de busca', async () => {
    jest.mocked(searchMentionPeople).mockResolvedValueOnce([]);
    const view = await render(<MentionSuggestions query="ana" onSelect={jest.fn()} />);
    expect(await screen.findByText('Nenhuma pessoa com esse nome.')).toBeTruthy();

    jest.mocked(searchMentionPeople).mockRejectedValueOnce(new Error('falhou'));
    view.rerender(<MentionSuggestions query="anab" onSelect={jest.fn()} />);
    expect(await screen.findByText('Não conseguimos buscar agora.')).toBeTruthy();
  });

  it('escolhe a pessoa pelo toque', async () => {
    jest.mocked(searchMentionPeople).mockResolvedValue([ana]);
    const onSelect = jest.fn();
    await render(<MentionSuggestions query="ana" onSelect={onSelect} />);
    fireEvent(await screen.findByRole('button', { name: 'Ana Souza, @ana' }), 'pressIn');
    expect(onSelect).toHaveBeenCalledWith(ana);
  });
});
