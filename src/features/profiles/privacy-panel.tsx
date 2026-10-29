import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { StateView } from '@/components/state-view';
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
  return <View style={{ gap: 12 }}>
    <AppText variant="heading">Privacidade do perfil</AppText><AppText>{account?.isPrivate ? 'Perfil privado' : 'Perfil público'}</AppText>
    <PillButton label={account?.isPrivate ? 'Tornar perfil público' : 'Tornar perfil privado'} disabled={busy} onPress={change} variant="outline" />
    <AppText variant="caption">Comunas privadas continuam privadas. Cada PDF mantém o acesso que você escolheu.</AppText>
    {requests.status === 'loading' ? <StateView kind="loading" message="Carregando solicitações" /> : null}
    {requests.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar as solicitações." onRetry={requests.refresh} /> : null}
    {requests.items.map((request) => <View key={request.id} style={{ gap: 8 }}><AppText>{request.name} · @{request.handle}</AppText><PillButton label={`Aprovar ${request.name}`} disabled={busy} onPress={() => decide(request.id, true)} /><PillButton label={`Recusar ${request.name}`} disabled={busy} onPress={() => decide(request.id, false)} variant="outline" /></View>)}
    {requests.hasMore ? <PillButton label="Mais solicitações" disabled={requests.loadingMore} onPress={requests.loadMore} /> : null}
    {requests.loadMoreError ? <StateView kind="error" message="Não conseguimos carregar mais solicitações." onRetry={requests.loadMore} /> : null}
    {error ? <AppText>{error}</AppText> : null}
  </View>;
}
