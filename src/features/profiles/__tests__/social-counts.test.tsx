import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { SocialCounts, socialCountLabel } from '../components/social-counts';

describe('contagens sociais', () => {
  it('singulariza seguidor e mantém seguindo', () => {
    expect(socialCountLabel(1, 'followers')).toBe('1 seguidor');
    expect(socialCountLabel(0, 'followers')).toBe('0 seguidores');
    expect(socialCountLabel(74, 'following')).toBe('74 seguindo');
  });

  it('abre seguidores e seguindo', async () => {
    const onFollowers = jest.fn();
    const onFollowing = jest.fn();
    await render(<SocialCounts followers={128} following={74} onFollowers={onFollowers} onFollowing={onFollowing} />);
    fireEvent.press(screen.getByLabelText('128 seguidores'));
    fireEvent.press(screen.getByLabelText('74 seguindo'));
    expect(onFollowers).toHaveBeenCalledTimes(1);
    expect(onFollowing).toHaveBeenCalledTimes(1);
  });
});
