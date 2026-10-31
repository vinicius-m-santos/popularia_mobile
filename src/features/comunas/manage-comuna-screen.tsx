import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { SquareEntry } from '@/features/squares/square-entry';
import { AppText } from '@/components/app-text';
import { KeyboardView } from '@/components/keyboard-view';
import { Avatar } from '@/components/avatar';
import { Badge } from '@/components/badge';
import { BottomSheet } from '@/components/bottom-sheet';
import { EditorialAction } from '@/components/editorial-action';
import { Icon, type IconName } from '@/components/icon';
import { IconButton } from '@/components/icon-button';
import { Kicker } from '@/components/kicker';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { TextField } from '@/components/text-field';
import { useToast } from '@/components/toast';
import { UnderlineTabs, type TabOption } from '@/components/underline-tabs';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { useAsyncData } from '@/hooks/use-async-data';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { SingleTopicField } from '@/features/onboarding/components/single-topic-field';
import { ApiError } from '@/lib/errors';
import { goBack } from '@/lib/routes';
import type { ComunaDetails, ComunaPerson, TopicId } from '@/types/models';

import {
  archiveComuna,
  cancelTransfer,
  decideJoinRequest,
  deleteComuna,
  getComuna,
  getComunaMembers,
  getJoinRequests,
  proposeTransfer,
  removeMember,
  roleLabel,
  setModerator,
  updateComuna,
  type ComunaRuleInput,
} from './api';
import { cleanRules, RulesEditor, rulesViolation } from './components/rules-editor';
import { comunaErrorMessage, deletionNeedsArchive } from './errors';
import { memberActions, type MemberAction } from './member-actions';

type ManageTab = 'membros' | 'pedidos' | 'comuna';

/**
 * Gestão da comuna (só com a API), para quem é proprietário ou modera. Cada aba e cada botão
 * aparecem conforme as permissões que o servidor mandou com a comuna; toda ação é conferida de
 * novo na API, e uma recusa aparece como mensagem, sem mudar nada na tela.
 */
export default function ManageComunaScreen() {
  const { id, aba } = useLocalSearchParams<{ id: string; aba?: string }>();
  const loadComuna = useCallback(() => getComuna(id), [id]);
  const comuna = useAsyncData(loadComuna);
  const [tab, setTab] = useState<ManageTab>(aba === 'pedidos' ? 'pedidos' : 'membros');

  const header = (subtitle?: string) => (
    <View style={styles.bar}>
      <IconButton icon="back" accessibilityLabel="Voltar" onPress={goBack} />
      <View style={styles.barText}>
        <AppText style={styles.barTitle} accessibilityRole="header" numberOfLines={1}>
          Gerir comuna
        </AppText>
        {subtitle ? (
          <AppText variant="caption" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </View>
  );

  if (DEMO_MODE) {
    return (
      <Screen>
        {header()}
        <StateView kind="empty" title="Disponível com o servidor" message="No modo demonstração, a gestão de comunas não é simulada." />
      </Screen>
    );
  }

  if (!comuna.data) {
    return (
      <Screen>
        {header()}
        {comuna.status === 'error' ? (
          <StateView kind="error" message={`Não conseguimos carregar a comuna. ${comunaErrorMessage(comuna.error)}`} onRetry={comuna.reload} />
        ) : (
          <StateView kind="loading" message="Carregando comuna" />
        )}
      </Screen>
    );
  }

  const data = comuna.data;
  const perms = data.viewerPermissions;
  const isOwner = data.viewerRole === 'founder';
  const isModerator = data.viewerRole === 'moderator';
  if (!perms || (!isOwner && !isModerator)) {
    return (
      <Screen>
        {header(`c/${data.handle}`)}
        <StateView kind="empty" title="Você não gere esta comuna" message="Só quem é proprietário ou modera a comuna vê esta tela." />
      </Screen>
    );
  }

  const tabs: TabOption<ManageTab>[] = [
    { key: 'membros', label: 'Membros' },
    ...(perms.canReviewJoinRequests ? [{ key: 'pedidos' as const, label: 'Pedidos' }] : []),
    ...(isOwner ? [{ key: 'comuna' as const, label: 'Comuna' }] : []),
  ];
  const current = tabs.some((t) => t.key === tab) ? tab : 'membros';

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']}>
      <KeyboardView style={{ flex: 1 }}>
        {header(`c/${data.handle} · você é ${isOwner ? 'proprietário' : 'moderação'}`)}
        {comuna.status === 'error' ? (
          <StateView kind="error" message="Não conseguimos atualizar a comuna." onRetry={comuna.reload} />
        ) : null}
        {data.status === 'archived' ? (
          <View style={styles.archived}>
            <AppText style={styles.archivedText} color={Colors.cream}>
              Comuna arquivada: só leitura. Você ainda pode remover pessoas e tirar alguém da moderação.
            </AppText>
          </View>
        ) : null}
        <UnderlineTabs options={tabs} value={current} onChange={setTab} height={46} />
        {current === 'membros' ? <MembersTab comuna={data} onChanged={comuna.reload} /> : null}
        {current === 'pedidos' ? <RequestsTab comuna={data} onChanged={comuna.reload} /> : null}
        {current === 'comuna' ? (
          // A chave muda quando descrição ou regras mudam no servidor: o formulário recomeça com elas.
          <SettingsTab key={JSON.stringify([data.description, data.rules, data.topics])} comuna={data} onChanged={comuna.reload} />
        ) : null}
      </KeyboardView>
    </Screen>
  );
}

type TabProps = { comuna: ComunaDetails; onChanged: () => void };

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

function MembersTab({ comuna, onChanged }: TabProps) {
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
      <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.list}>
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
                <Avatar initials={person.initials} tone={person.tone} size={42} userId={person.id} imageUrl={person.avatarUrl} />
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
      </ScrollView>
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

function RequestsTab({ comuna, onChanged }: TabProps) {
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
    <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} contentContainerStyle={styles.list}>
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
            <Avatar initials={r.user.initials} tone={r.user.tone} size={42} userId={r.user.id} imageUrl={r.user.avatarUrl} />
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
    </ScrollView>
  );
}

function SettingsTab({ comuna, onChanged }: TabProps) {
  const toast = useToast();
  const perms = comuna.viewerPermissions;
  const [description, setDescription] = useState(comuna.description);
  const [topic, setTopic] = useState<TopicId | null>(comuna.topics[0] ?? null);
  const [rules, setRules] = useState<ComunaRuleInput[]>(comuna.rules.map((r) => ({ title: r.title, body: r.description })));
  const [violations, setViolations] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const run = async (work: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await work();
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const save = () =>
    run(async () => {
      setViolations({});
      try {
        await updateComuna(comuna.id, { description: description.trim(), rules: cleanRules(rules), ...(topic ? { topic } : {}) });
        toast.show('Dados da comuna salvos.');
        onChanged();
      } catch (error) {
        if (error instanceof ApiError && error.status === 422) setViolations(error.violations);
        else toast.show(comunaErrorMessage(error));
      }
    });

  const archive = () =>
    Alert.alert(
      'Arquivar a comuna?',
      'A comuna e o histórico ficam preservados para leitura de quem participa (se for privada, continua fechada). Ninguém poderá publicar, comentar ou entrar. Ninguém é removido. Arquivar é definitivo pelo app e libera uma vaga no seu limite de comunas ativas.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Arquivar',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              try {
                await archiveComuna(comuna.id);
                toast.show(`c/${comuna.handle} foi arquivada.`);
                onChanged();
              } catch (error) {
                toast.show(comunaErrorMessage(error));
              }
            }),
        },
      ],
    );

  const offerArchive = (message: string) =>
    Alert.alert('Não é possível excluir', message, [
      { text: 'Agora não', style: 'cancel' },
      ...(perms?.canArchive ? [{ text: 'Arquivar', onPress: archive }] : []),
    ]);

  const remove = () => {
    // Dica imediata pela contagem; o servidor confere de novo, com a comuna travada.
    if (comuna.memberCount > 1) {
      return offerArchive(
        'Esta comuna tem outros membros, por isso só pode ser arquivada. Ninguém será removido para permitir a exclusão.',
      );
    }
    Alert.alert(
      'Excluir definitivamente?',
      `• c/${comuna.handle} será excluída para sempre, com as suas publicações nela.\n• O nome ficará livre e a vaga no limite de comunas ativas será liberada imediatamente, sem espera.\n• Registros de segurança e de auditoria são mantidos, como manda a política de retenção.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: () =>
            run(async () => {
              try {
                await deleteComuna(comuna.id);
                toast.show(`c/${comuna.handle} foi excluída.`);
                router.dismissTo('/perfil');
              } catch (error) {
                if (deletionNeedsArchive(error)) offerArchive(comunaErrorMessage(error));
                else toast.show(comunaErrorMessage(error));
              }
            }),
        },
      ],
    );
  };

  const transfer = comuna.ownershipTransfer;

  return (
    <ScrollView contentInsetAdjustmentBehavior="never" automaticallyAdjustContentInsets={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.settings}>
      <SquareEntry slug={comuna.id} />
      {transfer?.direction === 'outgoing' ? (
        <View style={styles.card}>
          <Kicker label="Transferência pendente" />
          <AppText>
            Você propôs passar a comuna para {transfer.to.name} (@{transfer.to.handle}). Até o aceite, nada muda.
          </AppText>
          <PillButton
            label="Cancelar proposta"
            variant="outline"
            disabled={busy}
            onPress={() =>
              run(async () => {
                try {
                  await cancelTransfer(comuna.id);
                  toast.show('Proposta cancelada.');
                  onChanged();
                } catch (error) {
                  toast.show(comunaErrorMessage(error));
                }
              })
            }
          />
        </View>
      ) : null}

      {perms?.canEditDetails ? (
        <View style={styles.section}>
          <Kicker label="Dados da comuna" />
          <SingleTopicField value={topic} onChange={setTopic} error={violations.topic} disabled={busy} />
          <AppText variant="caption">O nome ({comuna.name}) e o endereço c/{comuna.handle} não mudam.</AppText>
          <TextField
            label="Descrição"
            labelAside={`${description.length}/500`}
            value={description}
            onChangeText={setDescription}
            maxLength={500}
            multiline
            hint={violations.description}
            hintColor={Colors.red}
          />
          <RulesEditor rules={rules} onChange={setRules} error={rulesViolation(violations)} />
          <PillButton label={busy ? 'Salvando…' : 'Salvar'} onPress={save} disabled={busy} size="lg" display />
        </View>
      ) : null}

      <View style={styles.section}>
        <Kicker label="Sair, arquivar ou excluir" />
        <Explainer
          title="Sair"
          text="Quem é proprietário não sai da comuna. Para deixar de responder por ela, passe-a para outro membro (aba Membros)."
        />
        <Explainer
          title="Arquivar"
          text="Preserva a comuna e o histórico para leitura de quem participa. Ninguém publica, comenta ou entra mais. É definitivo pelo app."
        />
        <Explainer
          title="Excluir definitivamente"
          text="Só quando você é o único membro e não há publicações ou comentários de outras pessoas. Não pode ser desfeito."
        />
        {perms?.canArchive ? <PillButton label="Arquivar comuna" onPress={archive} disabled={busy} variant="dark" size="lg" display /> : null}
        {perms?.canDelete ? (
          <PillButton label="Excluir definitivamente" onPress={remove} disabled={busy} variant="outline" size="lg" display />
        ) : null}
        {comuna.status === 'archived' ? (
          <AppText variant="caption">Esta comuna está arquivada. A exclusão definitiva não está disponível pelo app.</AppText>
        ) : null}
      </View>
    </ScrollView>
  );
}

function Explainer({ title, text }: { title: string; text: string }) {
  return (
    <View style={styles.explainer}>
      <Icon name="chevronRight" size={16} color={Colors.red} />
      <View style={styles.rowText}>
        <AppText variant="bodyStrong">{title}</AppText>
        <AppText variant="caption">{text}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 58,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderBottomWidth: 1.5,
    borderBottomColor: Colors.ink,
  },
  barText: {
    flex: 1,
  },
  barTitle: {
    fontFamily: Fonts.condensed,
    fontSize: 21,
    lineHeight: 24,
    textTransform: 'uppercase',
  },
  archived: {
    backgroundColor: Colors.ink,
    paddingHorizontal: Spacing.five,
    paddingVertical: Spacing.two + 2,
  },
  archivedText: {
    fontSize: 13.5,
    lineHeight: 18,
  },
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
  settings: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    padding: Spacing.five,
    paddingBottom: Spacing.eight,
    gap: Spacing.six,
  },
  section: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.three,
    padding: 14,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    borderRadius: Radius.xl,
    backgroundColor: Colors.paper,
  },
  explainer: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
});
