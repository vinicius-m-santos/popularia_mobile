import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { useFollow } from '@/features/interactions/use-post-actions';
import type { User } from '@/types/models';

import { FollowButton } from '../components/follow-button';

jest.mock('@/features/interactions/use-post-actions', () => ({ useFollow: jest.fn() }));

const user: Pick<User, 'id' | 'name' | 'viewerFollowing' | 'viewerRequested' | 'isPrivate'> = {
  id: 'ana',
  name: 'Ana',
  viewerFollowing: false,
  viewerRequested: true,
  isPrivate: true,
};

const toggleFollow = jest.fn<() => Promise<boolean>>();

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(useFollow).mockReturnValue({
    canFollow: true,
    following: false,
    requested: true,
    busy: true,
    toggleFollow,
  });
});

describe('feedback acessível de seguir', () => {
  it('anuncia a solicitação pendente e o bloqueio da mutação no perfil', async () => {
    await render(<FollowButton user={user} appearance="editorial" />);
    expect(screen.getByLabelText('Solicitado, Ana').props.accessibilityState).toMatchObject({
      disabled: true,
      busy: true,
    });
  });

  it('anuncia a solicitação pendente e o bloqueio da mutação na lista', async () => {
    await render(<FollowButton user={user} />);
    expect(screen.getByLabelText('Solicitado, Ana').props.accessibilityState).toMatchObject({
      selected: false,
      disabled: true,
      busy: true,
    });
  });

  it('só chama onChanged quando a mutação confirma', async () => {
    toggleFollow.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const onChanged = jest.fn();
    jest.mocked(useFollow).mockReturnValue({
      canFollow: true,
      following: false,
      requested: false,
      busy: false,
      toggleFollow,
    });
    await render(<FollowButton user={{ ...user, viewerRequested: false }} onChanged={onChanged} />);
    await fireEvent.press(screen.getByLabelText('Seguir, Ana'));
    expect(onChanged).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Seguir, Ana'));
    expect(onChanged).toHaveBeenCalledTimes(1);
  });
});
