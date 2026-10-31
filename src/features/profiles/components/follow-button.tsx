import type { ComponentProps } from 'react';
import { StyleSheet } from 'react-native';

import { EditorialAction } from '@/components/editorial-action';
import { PillButton } from '@/components/pill-button';
import { Radius } from '@/constants/theme';
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
  /** No perfil, a ação principal usa o vocabulário editorial; nas listas, o botão compacto. */
  appearance?: 'pill' | 'editorial';
};

/** Seguir, solicitar ou deixar de seguir. A mesma mutação vale no perfil e nas listas. */
export function FollowButton({ user, idleLabel = 'Seguir', size = 'sm', display, disabled, onChanged, style, appearance = 'pill' }: FollowButtonProps) {
  const { canFollow, following, requested, busy, toggleFollow } = useFollow(user.id, user.viewerFollowing, {
    requested: user.viewerRequested,
    isPrivate: user.isPrivate,
  });
  if (!canFollow) return null;
  const label = requested ? 'Solicitado' : following ? 'Seguindo' : idleLabel;
  const hint = requested ? 'Cancela a solicitação' : following ? 'Deixa de seguir' : user.isPrivate ? 'Envia uma solicitação' : 'Passa a seguir este perfil';
  const press = async () => { if (await toggleFollow()) onChanged?.(); };

  if (appearance === 'editorial') {
    return (
      <EditorialAction
        label={label}
        icon={following || requested ? 'check' : 'plus'}
        tone={following || requested ? 'paper' : 'red'}
        labelVariant="button"
        onPress={press}
        disabled={busy || disabled}
        accessibilityLabel={`${label}, ${user.name}`}
        style={[styles.editorial, following || requested ? styles.secondary : null, style]}
      />
    );
  }

  return (
    <PillButton
      label={label}
      onPress={press}
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

const styles = StyleSheet.create({
  editorial: {
    flex: 1,
    borderRadius: Radius.sm,
  },
  secondary: {
    borderWidth: 1,
  },
});
