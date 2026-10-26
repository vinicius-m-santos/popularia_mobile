import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { PillButton } from '@/components/pill-button';
import { StateView } from '@/components/state-view';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useFollow } from '@/features/interactions/use-post-actions';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { formatPeople } from '@/lib/format';
import type { ComunaDetails, ComunaMember } from '@/types/models';

import { getComunaMembers, roleLabel } from '../api';
import { comunaErrorMessage } from '../errors';

type MembersListProps = {
  members: ComunaMember[];
  /** Total de membros, para o rodapé "Ver todas as N pessoas". */
  totalLabel: string;
};

/** Amostra de membros com papel e botão Seguir. A lista completa vem numa próxima etapa. */
export function MembersList({ members, totalLabel }: MembersListProps) {
  // A API ainda não lista membros: só o total.
  if (members.length === 0) {
    return (
      <View style={styles.wrap}>
        <AppText variant="caption" style={styles.footer}>
          {totalLabel} pessoas participam. A lista de membros chega numa próxima etapa.
        </AppText>
      </View>
    );
  }
  return (
    <View style={styles.wrap}>
      {members.map((m) => (
        <MemberRow key={m.id} member={m} />
      ))}
      <AppText variant="caption" style={styles.footer}>
        Mostrando {members.length} de {totalLabel} pessoas. A lista completa chega numa próxima etapa.
      </AppText>
    </View>
  );
}

/**
 * Membros vindos da API. A lista completa é só para quem participa (pode revelar opiniões);
 * para quem é de fora, aparecem o proprietário e a moderação, que são públicos.
 */
export function ServerMembersList({ comuna }: { comuna: ComunaDetails }) {
  if (!comuna.viewerIsMember) {
    return (
      <View style={styles.wrap}>
        {comuna.members.map((m) => (
          <MemberRow key={m.id} member={m} canFollow={false} />
        ))}
        <AppText variant="caption" style={styles.footer}>
          {formatPeople(comuna.memberCount)} pessoas participam. Só quem participa vê a lista completa.
        </AppText>
      </View>
    );
  }
  return <MemberPages comuna={comuna} />;
}

function MemberPages({ comuna }: { comuna: ComunaDetails }) {
  const load = useCallback((cursor: string | null) => getComunaMembers(comuna.id, cursor), [comuna.id]);
  const members = usePaginatedData(load);
  return (
    <View style={styles.wrap}>
      {members.status === 'loading' ? <StateView kind="loading" message="Carregando membros" /> : null}
      {members.status === 'error' ? (
        <StateView kind="error" message={`Não conseguimos carregar os membros. ${comunaErrorMessage(members.error)}`} onRetry={members.refresh} />
      ) : null}
      {members.items.map((m) => (
        <MemberRow key={m.id} member={{ ...m, role: roleLabel(m.role) }} canFollow={false} />
      ))}
      {members.refreshError ? <StateView kind="error" message="Não conseguimos atualizar os membros." onRetry={members.refresh} /> : null}
      {members.status === 'success' && members.items.length === 0 ? <StateView kind="empty" title="Nenhum membro encontrado" /> : null}
      {members.loadMoreError ? (
        <StateView kind="error" message="Não conseguimos carregar mais membros." onRetry={members.loadMore} />
      ) : members.hasMore ? (
        <PillButton
          label={members.loadingMore ? 'Carregando…' : 'Carregar mais'}
          onPress={members.loadMore}
          disabled={members.loadingMore}
          variant="outline"
          style={styles.more}
        />
      ) : null}
    </View>
  );
}

/** `canFollow`: seguir ainda é fictício; nas listas da API o botão não aparece. */
function MemberRow({ member, canFollow = true }: { member: ComunaMember; canFollow?: boolean }) {
  const { canFollow: allowed, following, toggleFollow } = useFollow(member.id);
  return (
    <View style={styles.row}>
      <View style={styles.identity} accessible accessibilityLabel={`${member.name}, ${member.role}`}>
        <Avatar initials={member.initials} tone={member.tone} size={42} />
        <View style={styles.text}>
          <AppText variant="bodyStrong">{member.name}</AppText>
          <AppText style={styles.role} color={Colors.muted}>
            {member.role}
          </AppText>
        </View>
      </View>
      {!allowed || !canFollow ? null : (
        <PillButton
          label={following ? 'Seguindo' : 'Seguir'}
          onPress={toggleFollow}
          variant={following ? 'dark' : 'outline'}
          size="sm"
          selected={following}
          accessibilityLabel={`Seguir ${member.name}`}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.seven,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  identity: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  role: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 14,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginTop: 2,
  },
  more: {
    alignSelf: 'center',
    marginVertical: Spacing.four,
  },
  footer: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
});
