import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { PillButton } from '@/components/pill-button';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useMe } from '@/features/account/account-context';
import { useFollow } from '@/features/interactions/use-post-actions';
import type { ComunaMember } from '@/types/models';

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

function MemberRow({ member }: { member: ComunaMember }) {
  const { following, toggleFollow } = useFollow(member.id);
  const isMe = useMe().id === member.id;
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
      {isMe ? null : (
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
  footer: {
    textAlign: 'center',
    paddingVertical: Spacing.five,
  },
});
