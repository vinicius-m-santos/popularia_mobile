import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { Icon } from '@/components/icon';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, Radius, Spacing } from '@/constants/theme';
import { comunaKeys, readComunaSummary } from '@/features/comunas/keys';
import { contentPolicy, queryClient } from '@/lib/query/client';

import { getComunaSquare, type Square } from './api';
import { openSquare } from './squares-screen';

export function SquareEntry({ slug }: { slug: string }) {
  if (DEMO_MODE) return <DemoEntry />;
  return <ConnectedEntry slug={slug} />;
}

function DemoEntry() {
  const toast = useToast();
  return <SquareBanner presence={0} onPress={() => toast.show('As Praças ao vivo ficam disponíveis quando o servidor estiver conectado.')} />;
}

/** A capa já conhece nome, tom e acesso: a faixa não pisca enquanto a Praça chega. */
function squarePlaceholder(slug: string): Square | undefined {
  const comuna = readComunaSummary(slug);
  if (!comuna) return undefined;
  const member = !!comuna.viewerIsMember;
  return {
    id: comuna.serverId ?? comuna.id,
    title: comuna.name,
    comuna: {
      id: comuna.serverId ?? comuna.id,
      slug: comuna.id,
      name: comuna.name,
      tone: comuna.tone,
      visibility: comuna.visibility ?? 'public',
      topics: comuna.topics,
    },
    status: comuna.status === 'archived' ? 'closed' : 'active',
    closedAt: null,
    version: null,
    presence: null,
    unread: null,
    lastReadId: null,
    lastMessage: null,
    viewer: {
      canRead: comuna.visibility !== 'private' || member,
      isMember: member,
      canWrite: false,
      canManage: false,
      joinRequest: null,
    },
  };
}

function ConnectedEntry({ slug }: { slug: string }) {
  const entry = useQuery({
    queryKey: comunaKeys.square(slug),
    queryFn: () => getComunaSquare(slug),
    ...contentPolicy.comuna,
    placeholderData: () => squarePlaceholder(slug),
  }, queryClient);
  const square = entry.isError ? undefined : entry.data;
  if (!square) {
    return (
      <View style={styles.root}>
        {entry.isPending
          ? <AppText variant="caption">Carregando Praça…</AppText>
          : <StateView kind="error" message="Não conseguimos carregar a Praça." onRetry={() => { void entry.refetch(); }} />}
      </View>
    );
  }
  return <SquareBanner
    presence={square.presence ?? 0}
    status={square.status ?? undefined}
    canRead={square.viewer.canRead}
    onPress={() => openSquare(square.id)}
  />;
}

function SquareBanner({ presence, status = 'active', canRead = true, onPress }: { presence: number; status?: 'active' | 'closed'; canRead?: boolean; onPress: () => void }) {
  const closed = status === 'closed';
  const active = status === 'active';
  const presenceLabel = !canRead ? 'Comuna privada' : closed ? 'Praça encerrada · somente leitura' : presence > 0 ? `${presence} ${presence === 1 ? 'pessoa' : 'pessoas'} na praça` : 'Ninguém na praça agora';
  return <View style={styles.root}>
    <View style={styles.banner}>
      <View style={styles.topRow}>
        <View style={styles.kicker}>
          <View style={styles.kickerMark} />
          <AppText variant="label" color={Colors.onInkMuted}>Praça</AppText>
        </View>
        <View style={styles.presence}>
          {active && presence > 0 ? <View style={styles.liveDot} /> : null}
          <Icon name="user" size={15} color={Colors.onInkMuted} />
          <AppText style={styles.presenceLabel} color={Colors.onInkMuted} numberOfLines={1}>{presenceLabel}</AppText>
        </View>
      </View>
      <AppText accessibilityRole="header" style={styles.title}>A conversa da sua comuna.</AppText>
      <EditorialAction
        label={closed ? 'Consultar histórico' : 'Entrar na Praça'}
        icon="arrowRight"
        iconPosition="trailing"
        labelVariant="button"
        tone={closed ? 'paper' : 'red'}
        onPress={onPress}
        style={styles.action}
      />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.two,
  },
  banner: {
    gap: Spacing.two + 2,
    padding: Spacing.three,
    borderWidth: 1.5,
    borderColor: Colors.ink,
    backgroundColor: Colors.ink,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  kicker: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  kickerMark: {
    width: 8,
    height: 8,
    backgroundColor: Colors.red,
  },
  presence: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 5,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.red,
  },
  presenceLabel: {
    fontFamily: Fonts.mono,
    fontSize: 10.5,
    lineHeight: 15,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    fontFamily: Fonts.anton,
    fontSize: 30,
    lineHeight: 36,
    letterSpacing: -0.7,
    textTransform: 'uppercase',
    color: Colors.cream,
  },
  action: {
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: Radius.sm,
  },
});
