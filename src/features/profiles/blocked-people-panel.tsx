import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { useAsyncData } from '@/hooks/use-async-data';
import { apiRequest } from '@/lib/api/client';
import { describeError } from '@/lib/errors';

export function BlockedPeoplePanel() {
  const load = useCallback(() => apiRequest<{ handle: string; displayName: string }[]>('/me/blocks', { auth: true }), []);
  const data = useAsyncData(load);
  const [error, setError] = useState('');
  const [busyHandle, setBusyHandle] = useState('');
  const toast = useToast();
  return <View style={{ gap: 12 }}><AppText variant="heading">Pessoas bloqueadas</AppText>
    {data.status === 'loading' ? <StateView kind="loading" message="Carregando pessoas bloqueadas" /> : null}
    {data.data?.map((person) => <PillButton key={person.handle} label={busyHandle === person.handle ? 'Desbloqueando…' : `Desbloquear @${person.handle}`} variant="outline" disabled={!!busyHandle} onPress={async () => {
      try {
        setError(''); setBusyHandle(person.handle);
        await apiRequest(`/me/blocks/${encodeURIComponent(person.handle)}`, { auth: true, method: 'DELETE' });
        toast.show(`@${person.handle} desbloqueado.`);
        data.reload();
      } catch (e) { setError(describeError(e)); }
      finally { setBusyHandle(''); }
    }} />)}
    {data.status === 'success' && data.data?.length === 0 ? <StateView kind="empty" title="Ninguém bloqueado" message="As pessoas que você bloquear aparecerão aqui." /> : null}
    {data.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar as pessoas bloqueadas." onRetry={data.reload} /> : null}
    {error ? <AppText accessibilityLiveRegion="polite">{error}</AppText> : null}
  </View>;
}
