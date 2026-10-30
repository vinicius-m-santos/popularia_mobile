import { fireEvent, render, screen } from '@testing-library/react-native';
import { describe, expect, it, jest } from '@jest/globals';
import type { CommentWithAuthor, ContentMention } from '@/types/models';
import { CommentComposer } from './comment-composer';
import { CommentRow } from './comment-row';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() }, useSegments: () => [] }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ bottom: 0 }) }));
jest.mock('@/hooks/use-keyboard-visible', () => ({ useKeyboardVisible: () => false }));

const author = { id: 'person-1', name: 'Camila', handle: 'camila', initials: 'C', tone: 'red' as const };
const comment = (id: string, parentId: string | null): CommentWithAuthor => ({
  id, postId: 'post-1', parentId, authorId: author.id, author, createdAt: '2026-10-28T10:00:00Z',
  text: 'Vamos conversar.', supportCount: 4,
});
const row = (id: string, parentId: string | null) => ({
  comment: comment(id, parentId), depth: parentId ? 1 : 0, replyCount: 0, collapsed: false,
});

describe('ações de comentário e resposta', () => {
  it('mantém o mesmo apoio por linha e mostra a contagem uma única vez', async () => {
    const onSupport = jest.fn();
    const onMore = jest.fn();
    await render(
      <>
        <CommentRow row={row('comment-1', null)} authorLabel={null} supported={false} supportCount={4}
          onSupport={onSupport} onToggleCollapse={jest.fn()} onMore={onMore} />
        <CommentRow row={row('reply-1', 'comment-1')} authorLabel={null} supported={false} supportCount={4}
          onSupport={onSupport} onToggleCollapse={jest.fn()} onMore={onMore} />
      </>,
    );
    const actions = screen.getAllByLabelText('Apoiar comentário, 4');
    expect(actions).toHaveLength(2);
    expect(screen.getAllByText('4')).toHaveLength(2);
    await fireEvent.press(actions[1]);
    expect(onSupport).toHaveBeenCalledWith('reply-1');
  });

  it('mantém as respostas quando o comentário pai foi removido pela moderação', async () => {
    const removed = comment('comment-1', null);
    removed.status = 'removed';
    removed.text = 'Comentário removido pela moderação.';
    await render(
      <CommentRow row={{ comment: removed, depth: 0, replyCount: 2, collapsed: false }} authorLabel={null}
        supported={false} supportCount={0} onSupport={jest.fn()} onToggleCollapse={jest.fn()} onMore={jest.fn()} />,
    );
    expect(screen.getByText('Comentário removido pela moderação.')).toBeTruthy();
    expect(screen.getByText('Ocultar')).toBeTruthy();
    expect(screen.queryByLabelText('Mais opções do comentário de Camila')).toBeNull();
  });

  it('remove o avatar do campo fixo de comentário sem alterar o envio', async () => {
    const onSend = jest.fn<(text: string, mentions: ContentMention[]) => Promise<boolean>>().mockResolvedValue(true);
    await render(<CommentComposer replyingTo={null} onCancelReply={jest.fn()} onSend={onSend} />);
    expect(screen.queryByText('C')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Escrever comentário'), 'Minha contribuição');
    await fireEvent.press(screen.getByLabelText('Enviar comentário'));
    expect(onSend).toHaveBeenCalledWith('Minha contribuição', []);
  });
});
