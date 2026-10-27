import type { ComponentProps } from 'react';

import { PillButton } from '@/components/pill-button';
import { useFollow } from '@/features/interactions/use-post-actions';
import type { User } from '@/types/models';

type FollowButtonProps = {
  user: Pick<User, 'id' | 'name' | 'viewerFollowing'>;
  /** Rótulo quando ainda não segue, como "Seguir de volta". */
  idleLabel?: string;
  size?: 'sm' | 'md' | 'lg';
  display?: boolean;
  disabled?: boolean;
  onChanged?: () => void;
  style?: ComponentProps<typeof PillButton>['style'];
};

/** Seguir uma pessoa; na API, só atualiza a UI depois da confirmação do servidor. */
export function FollowButton({ user, idleLabel = 'Seguir', size = 'sm', display, disabled, onChanged, style }: FollowButtonProps) {
  const { canFollow, following, requested, busy, toggleFollow } = useFollow(user.id, user.viewerFollowing);
  if (!canFollow) return null;
  return (
    <PillButton
      label={requested ? 'Pedido enviado' : following ? 'Seguindo' : idleLabel}
      onPress={async () => { if (await toggleFollow()) onChanged?.(); }}
      disabled={busy || disabled}
      variant={following ? 'dark' : 'outline'}
      size={size}
      display={display}
      selected={following}
      accessibilityLabel={`${requested ? 'Pedido enviado para' : following ? 'Seguindo' : idleLabel} ${user.name}`}
      style={style}
    />
  );
}
