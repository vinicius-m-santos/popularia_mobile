import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { CommentComposer } from '@/features/discussion/components/comment-composer';
import { queryClient } from '@/lib/query/client';
import type { ContentMention } from '@/types/models';

import { searchMentionPeople } from '../api';

jest.mock('../api', () => ({ searchMentionPeople: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() }, useSegments: () => [] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('@/hooks/use-keyboard-visible', () => ({ useKeyboardVisible: () => true }));

const ana = { userId: 'user-ana', handle: 'ana', displayName: 'Ana Souza', avatarUrl: null };

async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe('comentário e resposta com menção', () => {
  beforeEach(() => {
    queryClient.clear();
    jest.mocked(searchMentionPeople).mockReset();
  });

  afterEach(() => {
    queryClient.clear();
  });

  it('não abre sugestão dentro de e-mail', async () => {
    const onSend = jest.fn<(text: string, mentions: ContentMention[]) => Promise<boolean>>().mockResolvedValue(true);
    await render(<CommentComposer replyingTo={null} onCancelReply={jest.fn()} onSend={onSend} />);
    await fireEvent.changeText(screen.getByLabelText('Escrever comentário'), 'teste@email.com');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(searchMentionPeople).not.toHaveBeenCalled();
    expect(screen.queryByText('Digite pelo menos 3 letras')).toBeNull();
    await flush();
  });

  it('insere a menção com o teclado aberto e publica a referência', async () => {
    jest.mocked(searchMentionPeople).mockResolvedValue([ana]);
    const onSend = jest.fn<(text: string, mentions: ContentMention[]) => Promise<boolean>>().mockResolvedValue(true);
    await render(<CommentComposer replyingTo="Bia" onCancelReply={jest.fn()} onSend={onSend} />);
    expect(screen.getByLabelText('Resposta para Bia')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Resposta para Bia'), 'Valeu @ana');
    expect(searchMentionPeople).not.toHaveBeenCalled();
    fireEvent(await screen.findByRole('button', { name: 'Ana Souza, @ana' }), 'pressIn');
    await waitFor(() => expect(screen.getByLabelText('Resposta para Bia').props.value).toBe('Valeu @ana '));
    await fireEvent.changeText(screen.getByLabelText('Resposta para Bia'), 'Valeu @ana também');
    await fireEvent.press(screen.getByLabelText('Enviar comentário'));

    expect(onSend).toHaveBeenCalledWith('Valeu @ana também', [
      expect.objectContaining({ userId: 'user-ana', handle: 'ana', start: 6, end: 10 }),
    ]);
    await flush();
  });
});
