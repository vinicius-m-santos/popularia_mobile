import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import type { FeedItem } from '@/types/models';

import { selectTrendingPosts, TrendingNowSection, TrendingNowSkeleton } from '../trending-now';

function item(patch: Partial<FeedItem> & { id: string }): FeedItem {
  return {
    authorId: 'ana',
    author: { id: 'ana', name: 'Ana', handle: 'ana', initials: 'AN', tone: 'red' },
    comunaId: 'devs',
    comuna: { id: 'devs', name: 'Devs do Brasil', status: 'active' },
    createdAt: new Date(Date.now() - 60 * 60_000).toISOString(),
    text: 'Publicação',
    supportCount: 0,
    commentCount: 0,
    echoCount: 0,
    event: null,
    topCommentAuthor: null,
    ...patch,
  };
}

describe('Em alta agora', () => {
  it('pega as três com mais interação nas últimas 48h', () => {
    const now = Date.now();
    const recent = (id: string, score: number, hoursAgo = 1) => item({
      id,
      supportCount: score,
      createdAt: new Date(now - hoursAgo * 60 * 60_000).toISOString(),
    });
    const posts = [
      recent('baixa', 1),
      recent('topo', 300),
      recent('meio', 120),
      recent('velha', 900, 49),
      recent('terceira', 80),
    ];

    expect(selectTrendingPosts(posts, now).map((post) => post.id)).toEqual(['topo', 'meio', 'terceira']);
  });

  it('mostra número, comuna, título e meta com enquete ou chamado', async () => {
    const posts = [
      item({ id: 'um', title: 'Qual livro vamos ler?', poll: { id: 'p', question: 'Qual livro vamos ler?', totalVotes: 0, votedOptionId: null, endsAt: null, options: [] }, commentCount: 9 }),
      item({ id: 'dois', title: 'Ato pela tarifa', event: { id: 'e', title: 'Ato', kind: 'Ato', comunaId: 'devs', startsAt: new Date().toISOString(), place: 'Praça', attendeeCount: 2, tone: 'red' }, commentCount: 4 }),
      item({ id: 'tres', title: 'Mutirão de sábado', commentCount: 1 }),
    ];
    const onOpen = jest.fn();
    await render(<TrendingNowSection posts={posts} onOpenPost={onOpen} onSeeAll={jest.fn()} />);

    expect(screen.getByText('01')).toBeTruthy();
    expect(screen.getByText('02')).toBeTruthy();
    expect(screen.getByText('03')).toBeTruthy();
    expect(screen.getAllByText('c/ Devs do Brasil')).toHaveLength(3);
    expect(screen.getByText(/9 comentários/)).toBeTruthy();
    expect(screen.getByText(/· enquete/)).toBeTruthy();
    expect(screen.getByText(/· chamado/)).toBeTruthy();
    expect(screen.getByText(/1 comentário/)).toBeTruthy();

    await fireEvent.press(screen.getByRole('link', { name: 'Abrir publicação de Ana: Qual livro vamos ler?' }));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'um' }));
  });

  it('não renderiza a seção sem publicações', async () => {
    await render(<TrendingNowSection posts={[]} onOpenPost={jest.fn()} onSeeAll={jest.fn()} />);
    expect(screen.queryByText('Em alta agora')).toBeNull();
  });

  it('mostra o esqueleto de três linhas no card e nenhum atalho', async () => {
    await render(<TrendingNowSkeleton />);
    expect(screen.getByTestId('trending-skeleton')).toBeTruthy();
    expect(screen.getByLabelText('Carregando publicações em alta')).toBeTruthy();
    expect(screen.queryByText('Ver todas')).toBeNull();
  });
});
