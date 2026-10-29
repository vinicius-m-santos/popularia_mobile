import type { ComponentProps } from 'react';

import { PillButton } from '@/components/pill-button';
import { useFollow } from '@/features/interactions/use-post-actions';
import type { User } from '@/types/models';

type FollowButtonProps = {
  user: Pick<User, 'id' | 'name' | 'viewerFollowing' | 'viewerRequested' | 'isPrivate'>;
  /** Rótulo quando ainda não segue, como "Seguir de volta". */
  idleLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  display?: boolean;
  disabled?: boolean;
  onChanged?: () => void;
  style?: ComponentProps<typeof PillButton>['style'];
};

/** Seguir, solicitar ou deixar de seguir. A mesma mutação vale no perfil e nas listas. */
export function FollowButton({ user, idleLabel = 'Seguir', size = 'sm', display, disabled, onChanged, style }: FollowButtonProps) {
  const { canFollow, following, requested, busy, toggleFollow } = useFollow(user.id, user.viewerFollowing, {
    requested: user.viewerRequested,
    isPrivate: user.isPrivate,
  });
  if (!canFollow) return null;
  const label = requested ? 'Solicitado' : following ? 'Seguindo' : idleLabel;
  const hint = requested ? 'Cancela a solicitação' : following ? 'Deixa de seguir' : user.isPrivate ? 'Envia uma solicitação' : 'Passa a seguir este perfil';
  return (
    <PillButton
      label={label}
      onPress={async () => { if (await toggleFollow()) onChanged?.(); }}
      disabled={busy || disabled}
      variant={following ? 'dark' : 'outline'}
      size={size}
      display={display}
      selected={following}
      accessibilityLabel={`${label}, ${user.name}`}
      accessibilityHint={hint}
      style={style}
    />
  );
}
