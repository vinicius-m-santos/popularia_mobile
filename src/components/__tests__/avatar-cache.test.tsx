import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, render, screen } from '@testing-library/react-native';

import { Avatar } from '@/components/avatar';
import { clearAvatarCache } from '@/lib/avatar-cache';
import { queryClient } from '@/lib/query/client';

import { publishAvatar } from '@/features/media/image-cache';

jest.mock('expo-image', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native');
  const Image = ({ source, ...props }: { source?: { uri?: string } }) => React.createElement(View, {
    ...props,
    testID: source?.uri ? `image:${source.uri}` : 'image',
  });
  return { Image };
});

afterEach(() => {
  cleanup();
  clearAvatarCache();
  queryClient.clear();
});

function person(index: number) {
  return {
    id: `user-${index}`,
    initials: `U${index}`,
    imageUrl: index % 2 === 0 ? `https://cdn/${index}.jpg` : null,
  };
}

describe('cache de avatar', () => {
  it('não cria query nem observer de query para 250 avatares', async () => {
    const people = Array.from({ length: 250 }, (_, index) => person(index));
    const view = await render(<>
      {people.map((item) => (
        <Avatar
          key={item.id}
          userId={item.id}
          initials={item.initials}
          tone="red"
          imageUrl={item.imageUrl}
        />
      ))}
    </>);

    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
    expect(queryClient.getQueryCache().getAll().reduce((total, query) => total + query.getObserversCount(), 0)).toBe(0);
    // A entrada publicada no upload não fica Infinity: o GC padrão do overlay é finito.
    expect(queryClient.getQueryDefaults(['user-avatar', 'user-1']).gcTime).toBe(5 * 60_000);

    view.unmount();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it('atualiza todos os avatares da pessoa após a publicação da foto, sem observer de query', async () => {
    await render(<>
      <Avatar userId="user-1" initials="AN" tone="red" imageUrl="https://cdn/old.jpg" />
      <Avatar userId="user-1" initials="AN" tone="red" />
      <Avatar userId="user-2" initials="BI" tone="black" imageUrl="https://cdn/bia.jpg" />
    </>);

    expect(screen.getByTestId('image:https://cdn/old.jpg', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.queryByTestId('image:https://cdn/new.jpg', { includeHiddenElements: true })).toBeNull();

    await act(async () => { publishAvatar('user-1', 'https://cdn/new.jpg'); });

    expect(screen.getAllByTestId('image:https://cdn/new.jpg', { includeHiddenElements: true })).toHaveLength(2);
    expect(screen.queryByTestId('image:https://cdn/old.jpg', { includeHiddenElements: true })).toBeNull();
    expect(screen.getByTestId('image:https://cdn/bia.jpg', { includeHiddenElements: true })).toBeTruthy();
    expect(queryClient.getQueryData(['user-avatar', 'user-1'])).toBe('https://cdn/new.jpg');

    const avatarQueries = queryClient.getQueryCache().getAll();
    expect(avatarQueries).toHaveLength(1);
    expect(avatarQueries[0]?.getObserversCount()).toBe(0);
  });

  it('acompanha quem grava direto na query, preservando o contrato anterior', async () => {
    await render(<Avatar userId="user-cache" initials="CA" tone="red" imageUrl="https://cdn/old-cache.jpg" />);

    await act(async () => {
      queryClient.setQueryData(['user-avatar', 'user-cache'], 'https://cdn/new-cache.jpg');
    });

    expect(screen.getByTestId('image:https://cdn/new-cache.jpg', { includeHiddenElements: true })).toBeTruthy();
    expect(queryClient.getQueryCache().getAll()[0]?.getObserversCount()).toBe(0);
  });

  it('recolhe a query publicada depois do gcTime quando nenhum observer fica montado', () => {
    jest.useFakeTimers();
    try {
      publishAvatar('user-gc', 'https://cdn/gc.jpg');
      expect(queryClient.getQueryCache().findAll({ queryKey: ['user-avatar'] })).toHaveLength(1);

      jest.advanceTimersByTime(5 * 60_000);

      expect(queryClient.getQueryCache().findAll({ queryKey: ['user-avatar'] })).toHaveLength(0);
    } finally {
      jest.useRealTimers();
    }
  });

  it('mantém a foto local e limpa a foto compartilhada ao sair da conta', async () => {
    await render(<>
      <Avatar userId="user-1" initials="AN" tone="red" imageUrl="https://cdn/old.jpg" />
      <Avatar userId="user-1" initials="AN" tone="red" imageUrl="file:///preview.jpg" />
    </>);

    await act(async () => { publishAvatar('user-1', 'https://cdn/new.jpg'); });
    expect(screen.getByTestId('image:https://cdn/new.jpg', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('image:file:///preview.jpg', { includeHiddenElements: true })).toBeTruthy();

    await act(async () => { clearAvatarCache(); });

    expect(screen.getByTestId('image:https://cdn/old.jpg', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByTestId('image:file:///preview.jpg', { includeHiddenElements: true })).toBeTruthy();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });
});
