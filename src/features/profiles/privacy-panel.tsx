import { useCallback, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { SectionHeading } from '@/components/section-heading';
import { StateView } from '@/components/state-view';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAccount } from '@/features/account/account-context';
import { updateMe } from '@/features/account/api';
import { revalidateFollowSurfaces } from '@/features/profiles/follow-cache';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { apiRequest } from '@/lib/api/client';
import { describeError } from '@/lib/errors';
import type { Page } from '@/lib/pagination';

type FollowRequest = { id: string; name: string; handle: string };

export function PrivacyPanel() {
  const { account, reloadAccount } = useAccount();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback((cursor: string | null) => apiRequest<Page<FollowRequest>>(`/me/follow-requests?limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { auth: true }), []);
  const requests = usePaginatedData(load);
  const change = () => Alert.alert(account?.isPrivate ? 'Tornar seu perfil público?' : 'Tornar seu perfil privado?', account?.isPrivate ? 'Novas pessoas podem seguir sem pedir. Pedidos pendentes serão aprovados. Cada PDF mantém o acesso escolhido; nenhum vira público sozinho.' : 'Novas pessoas precisam pedir para seguir. Seguidores atuais continuam aprovados. Cada PDF mantém o próprio acesso.', [
    { text: 'Cancelar', style: 'cancel' }, { text: account?.isPrivate ? 'Tornar público' : 'Tornar privado', onPress: async () => {
      if (busy) return;
      setBusy(true); setError('');
      try { await updateMe({ isPrivate: !account?.isPrivate }); await reloadAccount(); requests.refresh(); revalidateFollowSurfaces(); }
      catch (e) { setError(describeError(e)); } finally { setBusy(false); }
    } },
  ]);
  const decide = async (id: string, approve: boolean) => {
    if (busy) return;
    setBusy(true); setError('');
    try { await apiRequest(`/me/follow-requests/${encodeURIComponent(id)}`, { auth: true, method: approve ? 'PUT' : 'DELETE' }); requests.refresh(); revalidateFollowSurfaces(); }
    catch (e) { setError(describeError(e)); } finally { setBusy(false); }
  };

  return <View style={styles.root}>
    <SectionHeading appearance="editorial" label="Privacidade do perfil" />
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <AppText variant="label">Escopo atual</AppText>
        <AppText style={styles.cardTitle}>{account?.isPrivate ? 'Perfil privado' : 'Perfil público'}</AppText>
        <AppText variant="caption">
          {account?.isPrivate
            ? 'Novas pessoas precisam de aprovação para seguir. Quem já segue continua aprovado.'
            : 'Novas pessoas podem seguir sem pedir. Você ainda pode tornar o perfil privado.'}
        </AppText>
      </View>
      <EditorialAction
        label={account?.isPrivate ? 'Tornar perfil público' : 'Tornar perfil privado'}
        icon={account?.isPrivate ? 'globe' : 'shield'}
        labelVariant="button"
        disabled={busy}
        onPress={change}
        style={styles.secondaryAction}
      />
      <AppText variant="caption">Comunas privadas continuam privadas. Cada PDF mantém o acesso que você escolheu.</AppText>
    </View>

    <SectionHeading appearance="editorial" label="Solicitações para seguir" />
    {requests.status === 'loading' ? <StateView kind="loading" message="Carregando solicitações" /> : null}
    {requests.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar as solicitações." onRetry={requests.refresh} /> : null}
    {requests.status === 'success' && requests.items.length === 0 ? (
      <AppText variant="caption">Nenhuma solicitação pendente.</AppText>
    ) : null}
    {requests.items.map((request) => (
      <View key={request.id} style={styles.request}>
        <View style={styles.requestCopy}>
          <AppText style={styles.requestName}>{request.name}</AppText>
          <AppText variant="caption">@{request.handle}</AppText>
        </View>
        <View style={styles.requestActions}>
          <EditorialAction
            label="Aprovar"
            icon="check"
            labelVariant="button"
            onPress={() => { void decide(request.id, true); }}
            disabled={busy}
            accessibilityLabel={`Aprovar solicitação de ${request.name}`}
            style={styles.requestAction}
          />
          <EditorialAction
            label="Recusar"
            icon="close"
            labelVariant="button"
            onPress={() => { void decide(request.id, false); }}
            disabled={busy}
            accessibilityLabel={`Recusar solicitação de ${request.name}`}
            style={[styles.requestAction, styles.secondaryAction]}
          />
        </View>
      </View>
    ))}
    {requests.hasMore ? (
      <EditorialAction
        label={requests.loadingMore ? 'Carregando…' : 'Mais solicitações'}
        icon="arrowRight"
        iconPosition="trailing"
        labelVariant="button"
        disabled={requests.loadingMore}
        onPress={requests.loadMore}
        style={styles.secondaryAction}
      />
    ) : null}
    {requests.loadMoreError ? <StateView kind="error" message="Não conseguimos carregar mais solicitações." onRetry={requests.loadMore} /> : null}
    {error ? <AppText accessibilityLiveRegion="polite" color={Colors.red}>{error}</AppText> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    backgroundColor: Colors.paper,
  },
  cardHead: {
    gap: Spacing.one,
  },
  cardTitle: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: Fonts.bold,
  },
  secondaryAction: {
    borderRadius: Radius.sm,
    borderWidth: 1,
  },
  request: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.rule,
    backgroundColor: Colors.paper,
  },
  requestCopy: {
    gap: 2,
  },
  requestName: {
    fontFamily: Fonts.bold,
    fontSize: 15.5,
    lineHeight: 20,
  },
  requestActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  requestAction: {
    flex: 1,
    borderRadius: Radius.sm,
  },
});
