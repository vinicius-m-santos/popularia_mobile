import { useCallback } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { Icon } from '@/components/icon';
import { StateView } from '@/components/state-view';
import { useToast } from '@/components/toast';
import { DEMO_MODE } from '@/constants/config';
import { Colors, Fonts, Spacing } from '@/constants/theme';
import { useAsyncData } from '@/hooks/use-async-data';

import { getComunaSquare } from './api';
import { openSquare } from './squares-screen';

export function SquareEntry({ slug }: { slug: string }) {
  if (DEMO_MODE) return <DemoEntry />;
  return <ConnectedEntry slug={slug} />;
}

function DemoEntry() {
  const toast = useToast();
  return <SquareBanner presence={0} onPress={() => toast.show('As Praças ao vivo ficam disponíveis quando o servidor estiver conectado.')} />;
}

function ConnectedEntry({ slug }: { slug: string }) {
  const data = useAsyncData(useCallback(() => getComunaSquare(slug), [slug]));
  const square = data.data;
  if (!square) return <View style={styles.root}>{data.status === 'loading' ? <AppText variant="caption">Carregando Praça…</AppText> : <StateView kind="error" message="Não conseguimos carregar a Praça." onRetry={data.reload} />}</View>;
  return <SquareBanner
    presence={square.presence ?? 0}
    status={square.status ?? undefined}
    canRead={square.viewer.canRead}
    onPress={() => openSquare(square.id)}
  />;
}

function SquareBanner({ presence, status = 'active', canRead = true, onPress }: { presence: number; status?: 'active' | 'closed'; canRead?: boolean; onPress: () => void }) {
  const closed = status === 'closed';
  const presenceLabel = !canRead ? 'Comuna privada' : closed ? 'Praça encerrada · somente leitura' : null;
  return <View style={styles.root}>
    <View style={styles.banner}>
      <Image fadeDuration={0} source={require('@/assets/squares/square-entry-banner.png')} resizeMode="cover" style={styles.bannerImage} accessible={false} />
      <View style={styles.copy}>
        <View style={styles.kicker}><View style={styles.kickerMark} /><AppText variant="label" style={styles.kickerLabel}>Praça</AppText></View>
        <AppText accessibilityRole="header" style={styles.title}>A CONVERSA DA{'\n'}SUA COMUNA.</AppText>
        <View style={styles.presence}>
          <Icon name="user" size={18} color={Colors.ink} />
          {presenceLabel ? (
            <AppText style={styles.presenceLabel}>{presenceLabel}</AppText>
          ) : (
            <AppText style={styles.presenceLabel}>
              <AppText style={styles.presenceNumber} color={Colors.red}>{presence}</AppText>
              {` ${presence === 1 ? 'PESSOA' : 'PESSOAS'} NA PRAÇA`}
            </AppText>
          )}
        </View>
        <EditorialAction
          label={closed ? 'Consultar histórico' : 'Entrar na Praça'}
          icon="arrowRight"
          iconPosition="trailing"
          tone="red"
          onPress={onPress}
          style={styles.action}
        />
      </View>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { padding: Spacing.four, borderBottomWidth: 1.5, borderColor: Colors.ink },
  banner: { aspectRatio: 1.88, borderWidth: 1.5, borderColor: Colors.ink, overflow: 'hidden' },
  bannerImage: { ...StyleSheet.absoluteFill, width: '100%', height: '100%' },
  copy: { flex: 1, width: '62%', justifyContent: 'center', padding: Spacing.three },
  kicker: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  kickerMark: { width: 10, height: 10, backgroundColor: Colors.red },
  kickerLabel: { fontSize: 12 },
  title: { fontFamily: Fonts.anton, fontWeight: '400', fontSize: 30, lineHeight: 41, letterSpacing: -0.7, color: Colors.ink, marginTop: Spacing.one },
  presence: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  presenceLabel: { fontFamily: Fonts.mono, fontSize: 11, lineHeight: 18, letterSpacing: 0.4, color: Colors.ink },
  presenceNumber: { fontFamily: Fonts.mono, fontSize: 11, lineHeight: 18, letterSpacing: 0.4 },
  action: { alignSelf: 'stretch', marginTop: Spacing.two, minHeight: 46 },
});
