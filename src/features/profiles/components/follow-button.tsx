import type { ComponentProps } from 'react';

import { PillButton } from '@/components/pill-button';
import { useFollow } from '@/features/interactions/use-post-actions';
import type { User } from '@/types/models';

type FollowButtonProps = {
  user: Pick<User, 'id' | 'name'>;
  /** Rótulo quando ainda não segue, como "Seguir de volta". */
  idleLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  display?: boolean;
  style?: ComponentProps<typeof PillButton>['style'];
};

/** Seguir uma pessoa. Fica só neste aparelho, como as demais interações. */
export function FollowButton({ user, idleLabel = 'Seguir', size = 'sm', display, style }: FollowButtonProps) {
  const { following, toggleFollow } = useFollow(user.id);
  return (
    <PillButton
      label={following ? 'Seguindo' : idleLabel}
      onPress={toggleFollow}
      variant={following ? 'dark' : 'outline'}
      size={size}
      display={display}
      selected={following}
      accessibilityLabel={`${following ? 'Seguindo' : idleLabel} ${user.name}`}
      style={style}
    />
  );
}
