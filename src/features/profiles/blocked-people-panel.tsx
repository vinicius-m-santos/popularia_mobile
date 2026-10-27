import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { useAsyncData } from '@/hooks/use-async-data';
import { apiRequest } from '@/lib/api/client';
import { describeError } from '@/lib/errors';

export function BlockedPeoplePanel() {
  const load = useCallback(() => apiRequest<{ handle: string; displayName: string }[]>('/me/blocks', { auth: true }), []);
  const data = useAsyncData(load);
  const [error, setError] = useState('');
  return <View style={{ gap: 12 }}><AppText variant="heading">Pessoas bloqueadas</AppText>
    {data.data?.map((person) => <PillButton key={person.handle} label={`Desbloquear @${person.handle}`} variant="outline" onPress={async () => {
      try { await apiRequest(`/me/blocks/${encodeURIComponent(person.handle)}`, { auth: true, method: 'DELETE' }); data.reload(); }
      catch (e) { setError(describeError(e)); }
    }} />)}
    {data.status === 'error' ? <PillButton label="Tentar carregar bloqueios novamente" onPress={data.reload} /> : null}
    {error ? <AppText>{error}</AppText> : null}
  </View>;
}
