import { useCallback } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { StateView } from '@/components/state-view';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Spacing } from '@/constants/theme';
import { useAsyncData } from '@/hooks/use-async-data';

import { getComunaSquare } from './api';
import { openSquare } from './squares-screen';

export function SquareEntry({ slug }: { slug: string }) {
  if (DEMO_MODE) return null;
  return <ConnectedEntry slug={slug} />;
}
function ConnectedEntry({ slug }: { slug: string }) {
  const data = useAsyncData(useCallback(() => getComunaSquare(slug), [slug]));
  const square = data.data;
  return <View style={styles.root}>
    <AppText variant="label" color={Colors.muted}>Praça</AppText>
    {!square ? data.status === 'loading' ? <AppText variant="caption">Carregando Praça…</AppText> : <StateView kind="error" message="Não conseguimos carregar a Praça." onRetry={data.reload} /> : <>
      <AppText variant="bodyStrong">{square.status === 'closed' ? 'O histórico da conversa continua aqui.' : 'A conversa da sua comuna.'}</AppText>
      <AppText variant="caption">{!square.viewer.canRead ? 'Comuna privada' : square.status === 'closed' ? 'Praça encerrada · somente leitura' : `● ${square.presence ?? 0} pessoas na praça`}</AppText>
      <PillButton label={square.status === 'closed' ? 'Consultar histórico' : 'Entrar na Praça'} variant="dark" onPress={() => openSquare(square.id)} />
    </>}
  </View>;
}
const styles = StyleSheet.create({ root: { padding: Spacing.five, borderBottomWidth: 1, borderColor: Colors.rule, gap: 10 } });
