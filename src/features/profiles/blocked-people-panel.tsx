import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { Avatar } from '@/components/avatar';
import { EditorialAction } from '@/components/editorial-action';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { useAsyncData } from '@/hooks/use-async-data';
import { apiRequest } from '@/lib/api/client';
import { describeError } from '@/lib/errors';
import { initialsOf } from '@/lib/format';

export function BlockedPeoplePanel() {
  const load = useCallback(() => apiRequest<{ handle: string; displayName: string }[]>('/me/blocks', { auth: true }), []);
  const data = useAsyncData(load);
  const [error, setError] = useState('');
  const [busyHandle, setBusyHandle] = useState('');
  const toast = useToast();

  return <View style={styles.root}>
    <AppText variant="caption">Pessoas bloqueadas não aparecem no seu feed, no Explorar nem nas conversas.</AppText>
    {data.status === 'loading' ? <StateView kind="loading" message="Carregando pessoas bloqueadas" /> : null}
    {data.data?.map((person) => (
      <View key={person.handle} style={styles.row}>
        <Avatar initials={initialsOf(person.displayName)} tone="cream" size={36} />
        <View style={styles.copy}>
          <AppText style={styles.name}>{person.displayName}</AppText>
          <AppText variant="caption">@{person.handle}</AppText>
        </View>
        <EditorialAction
          label={busyHandle === person.handle ? 'Desbloqueando…' : 'Desbloquear'}
          icon="check"
          labelVariant="button"
          disabled={!!busyHandle}
          accessibilityLabel={busyHandle === person.handle ? `Desbloqueando @${person.handle}` : `Desbloquear @${person.handle}`}
          onPress={async () => {
            try {
              setError(''); setBusyHandle(person.handle);
              await apiRequest(`/me/blocks/${encodeURIComponent(person.handle)}`, { auth: true, method: 'DELETE' });
              toast.show(`@${person.handle} desbloqueado.`);
              data.reload();
            } catch (e) { setError(describeError(e)); }
            finally { setBusyHandle(''); }
          }}
          style={styles.action}
        />
      </View>
    ))}
    {data.status === 'success' && data.data?.length === 0 ? <StateView kind="empty" title="Ninguém bloqueado" message="As pessoas que você bloquear aparecerão aqui." /> : null}
    {data.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar as pessoas bloqueadas." onRetry={data.reload} /> : null}
    {error ? <AppText accessibilityLiveRegion="polite" color={Colors.red}>{error}</AppText> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: {
    gap: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.rule,
    backgroundColor: Colors.paper,
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    fontFamily: Fonts.bold,
    fontSize: 15.5,
    lineHeight: 20,
  },
  action: {
    borderRadius: Radius.sm,
    borderWidth: 1,
    minWidth: 132,
  },
});
