import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { BottomSheet } from '@/components/bottom-sheet';
import { EditorialAction } from '@/components/editorial-action';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { KeyboardAwareScrollView } from '@/components/keyboard-aware-scroll-view';
import { PillButton } from '@/components/pill-button';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import type { ComunaPerson } from '@/types/models';

import {
  decideJoinRequest,
  getComunaMembers,
  getJoinRequests,
  proposeTransfer,
  removeMember,
  roleLabel,
  setModerator,
} from '../api';
import { comunaErrorMessage } from '../errors';
import { memberActions, type MemberAction } from '../member-actions';
import type { ManageTabProps } from './manage-comuna-types';

const ACTION_LABELS: Record<MemberAction, string> = {
  appoint: 'Nomear para a moderação',
  dismiss: 'Tirar da moderação',
  transfer: 'Passar a comuna para esta pessoa',
  remove: 'Remover da comuna',
};
const ACTION_ICONS: Record<MemberAction, IconName> = {
  appoint: 'shield',
  dismiss: 'user',
  transfer: 'shareNodes',
  remove: 'trash',
};

/** Aba Membros: lista paginada, ações por papel e confirmação destrutiva. */
export function MembersTab({ comuna, onChanged }: ManageTabProps) {
  const toast = useToast();
  const { account } = useAccount();
  const load = useCallback((cursor: string | null) => getComunaMembers(comuna.id, cursor), [comuna.id]);
  const members = usePaginatedData(load);
  const [selected, setSelected] = useState<ComunaPerson | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const viewer = { handle: account?.handle ?? '', role: comuna.viewerRole, archived: comuna.status === 'archived' };

  const run = async (work: () => Promise<void>, success: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await work();
      toast.show(success);
      members.refresh();
      onChanged();
    } catch (error) {
      toast.show(comunaErrorMessage(error));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const confirm = (person: ComunaPerson, action: MemberAction) => {
    setSelected(null);
    const who = `${person.name} (@${person.handle})`;
    if (action === 'appoint') {
      return run(() => setModerator(comuna.id, person.handle, true), `${person.name} agora modera a comuna.`);
    }
    if (action === 'dismiss') {
      return run(() => setModerator(comuna.id, person.handle, false), `${person.name} saiu da moderação e continua membro.`);
    }
    if (action === 'transfer') {
      return Alert.alert(
        'Passar a comuna?',
        `${who} vai receber um pedido para aceitar a comuna. Até a pessoa aceitar, você continua proprietário. Depois do aceite, você vira membro comum e perde os poderes de proprietário.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          { text: 'Enviar proposta', onPress: () => run(() => proposeTransfer(comuna.id, person.handle), 'Proposta enviada. Aguarde o aceite.') },
        ],
      );
    }
    Alert.alert(
      'Remover da comuna?',
      `${who} deixa de participar na hora${comuna.visibility === 'private' ? ' e perde o acesso às publicações desta comuna privada' : ''}. As publicações dela continuam na comuna.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Remover', style: 'destructive', onPress: () => run(() => removeMember(comuna.id, person.handle), `${person.name} foi removido da comuna.`) },
      ],
    );
  };

  return (
    <>
      <KeyboardAwareScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.list}>
        {members.status === 'loading' ? <StateView kind="loading" message="Carregando membros" /> : null}
        {members.status === 'error' ? (
          <StateView kind="error" message={`Não conseguimos carregar os membros. ${comunaErrorMessage(members.error)}`} onRetry={members.refresh} />
        ) : null}
        {members.refreshError ? <StateView kind="error" message="Não conseguimos atualizar os membros." onRetry={members.refresh} /> : null}
        {members.status === 'success' && members.items.length === 0 ? <StateView kind="empty" title="Nenhum membro encontrado" /> : null}
        {members.items.map((person) => {
          const actions = memberActions(person, viewer);
          return (
            <View key={person.id} style={styles.row}>
              <View style={styles.identity} accessible accessibilityLabel={`${person.name}, @${person.handle}, ${roleLabel(person.role)}`}>
                <Avatar initials={person.initials} tone={person.tone} size={42} shape="square" outline font="anton" userId={person.id} imageUrl={person.avatarUrl} />
                <View style={styles.rowText}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {person.name}
                  </AppText>
                  <AppText variant="caption" numberOfLines={1}>
                    @{person.handle}
                  </AppText>
                </View>
                {person.role !== 'member' ? <Badge label={roleLabel(person.role)} tone={person.role === 'founder' ? 'red' : 'ink'} /> : null}
              </View>
              {actions.length > 0 ? (
                <IconButton
                  icon="more"
                  size={20}
                  accessibilityLabel={`Ações para ${person.name}`}
                  onPress={() => setSelected(person)}
                />
              ) : null}
            </View>
          );
        })}
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
      </KeyboardAwareScrollView>
      <BottomSheet visible={selected !== null} onClose={() => setSelected(null)} title={selected?.name}>
        {selected
          ? memberActions(selected, viewer).map((action) => (
              <Pressable
                key={action}
                onPress={() => confirm(selected, action)}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [styles.sheetOption, pressed && styles.pressed]}>
                <View style={[styles.sheetIcon, action === 'remove' && styles.sheetIconRed]}>
                  <Icon name={ACTION_ICONS[action]} size={19} color={action === 'remove' ? Colors.red : Colors.ink} />
                </View>
                <AppText style={styles.sheetLabel} color={action === 'remove' ? Colors.red : Colors.ink}>
                  {ACTION_LABELS[action]}
                </AppText>
                <Icon name="chevronRight" size={18} color={Colors.muted} />
              </Pressable>
            ))
          : null}
        <EditorialAction label="Fechar" icon="close" labelVariant="button" tone="paper" onPress={() => setSelected(null)} style={styles.sheetClose} />
      </BottomSheet>
    </>
  );
}

/** Aba Pedidos: aprovar ou recusar entradas, com um pedido em andamento por vez. */
export function RequestsTab({ comuna, onChanged }: ManageTabProps) {
  const toast = useToast();
  const load = useCallback((cursor: string | null) => getJoinRequests(comuna.id, cursor), [comuna.id]);
  const requests = usePaginatedData(load);
  const [busyId, setBusyId] = useState<string | null>(null);
  const busyRef = useRef(false);

  const decide = async (requestId: string, name: string, approve: boolean) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(requestId);
    try {
      await decideJoinRequest(comuna.id, requestId, approve);
      toast.show(approve ? `${name} agora participa da comuna.` : `Pedido de ${name} recusado.`);
      requests.refresh();
      onChanged();
    } catch (error) {
      toast.show(comunaErrorMessage(error));
    } finally {
      busyRef.current = false;
      setBusyId(null);
    }
  };

  return (
    <KeyboardAwareScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.list}>
      {requests.status === 'loading' ? <StateView kind="loading" message="Carregando pedidos" /> : null}
      {requests.status === 'error' ? (
        <StateView kind="error" message={`Não conseguimos carregar os pedidos. ${comunaErrorMessage(requests.error)}`} onRetry={requests.refresh} />
      ) : null}
      {requests.refreshError ? <StateView kind="error" message="Não conseguimos atualizar os pedidos." onRetry={requests.refresh} /> : null}
      {requests.status === 'success' && requests.items.length === 0 ? (
        <StateView kind="empty" title="Nenhum pedido em aberto" message="Quando alguém pedir para entrar, o pedido aparece aqui." />
      ) : null}
      {requests.items.map((r) => (
        <View key={r.id} style={styles.row}>
          <View style={styles.identity}>
            <Avatar initials={r.user.initials} tone={r.user.tone} size={42} shape="square" outline font="anton" userId={r.user.id} imageUrl={r.user.avatarUrl} />
            <View style={styles.rowText}>
              <AppText variant="bodyStrong" numberOfLines={1}>
                {r.user.name}
              </AppText>
              <AppText variant="caption" numberOfLines={1}>
                @{r.user.handle}
              </AppText>
            </View>
          </View>
          <PillButton
            label="Recusar"
            onPress={() => decide(r.id, r.user.name, false)}
            disabled={busyId !== null}
            variant="outline"
            size="sm"
            accessibilityLabel={`Recusar pedido de ${r.user.name}`}
          />
          <PillButton
            label="Aprovar"
            onPress={() => decide(r.id, r.user.name, true)}
            disabled={busyId !== null}
            size="sm"
            accessibilityLabel={`Aprovar pedido de ${r.user.name}`}
          />
        </View>
      ))}
      {requests.loadMoreError ? (
        <StateView kind="error" message="Não conseguimos carregar mais pedidos." onRetry={requests.loadMore} />
      ) : requests.hasMore ? (
        <PillButton label={requests.loadingMore ? 'Carregando…' : 'Carregar mais'} disabled={requests.loadingMore} onPress={requests.loadMore} variant="outline" style={styles.more} />
      ) : null}
    </KeyboardAwareScrollView>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.seven,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
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
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  more: {
    alignSelf: 'center',
    marginVertical: Spacing.five,
  },
  sheetOption: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderBottomWidth: 1,
    borderBottomColor: Colors.rule,
  },
  sheetIcon: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.strawLight,
  },
  sheetIconRed: {
    backgroundColor: Colors.redSoft,
  },
  sheetLabel: {
    flex: 1,
    minWidth: 0,
    fontFamily: Fonts.extrabold,
    fontSize: 14.5,
    lineHeight: 19,
  },
  sheetClose: {
    marginTop: Spacing.two,
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  pressed: {
    opacity: 0.75,
  },
});
