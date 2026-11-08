import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { EditorialHeader } from '@/components/editorial-header';
import { PillButton } from '@/components/pill-button';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getPerformanceSnapshot, performanceDiagnosticsAvailable, performanceInstrumentationEnabled } from '@/lib/performance';
import { goBack } from '@/lib/routes';

import {
  resetPerformanceMeasurement,
  startPerformanceMeasurement,
} from './diagnostics';
import { PhotoQaHarness } from './photo-harness';
import { QA_PHOTO_FEED_COUNT, type QaPhotoVariant } from './photo-harness-fixture';

/**
 * Entrada de diagnóstico do feed de 120 fotos (POP-65).
 *
 * A rota só é registrada em desenvolvimento/staging. Em produção a tela recusa
 * renderizar, a mesma segunda barreira usada pelo harness de 20 cartões.
 */
export function PhotoHarnessScreen() {
  if (!performanceDiagnosticsAvailable()) return <UnavailableScreen />;
  return <PhotoHarnessContent />;
}

function UnavailableScreen() {
  return (
    <Screen>
      <EditorialHeader title="Fotos 2048px" onBack={goBack} />
      <StateView
        kind="empty"
        title="Harness indisponível"
        message="Esta tela existe apenas em desenvolvimento e staging."
      />
    </Screen>
  );
}

function PhotoHarnessContent() {
  // Só monta o feed com uma sessão de verdade: a flag ligada sem sessão
  // renderizaria as fotos sem registrar o tamanho efetivo do render.
  const [enabled, setEnabled] = useState(() => performanceInstrumentationEnabled() && getPerformanceSnapshot().sessionId !== null);
  const [variant, setVariant] = useState<QaPhotoVariant>('original');
  const active = enabled && performanceInstrumentationEnabled();

  const start = () => {
    setEnabled(startPerformanceMeasurement());
  };

  const selectVariant = (next: QaPhotoVariant) => {
    if (next === variant) return;
    // Cada modo é uma sessão limpa: misturar original e variante no mesmo
    // agregado esconderia justamente a diferença que o harness quer medir.
    resetPerformanceMeasurement();
    setVariant(next);
  };

  return (
    <Screen>
      <EditorialHeader
        title="Fotos 2048px"
        subtitle={`Feed de QA · ${QA_PHOTO_FEED_COUNT} fotos`}
        onBack={goBack}
      />
      {active ? (
        <View style={styles.body}>
          <View style={styles.note}>
            <AppText variant="label" color={Colors.red}>Cenário de decodificação</AppText>
            <AppText variant="caption">
              Role o feed, abra algumas fotos em tela cheia e dê zoom até 4×. Ao voltar ao diagnóstico, leia carregamentos, cache, bitmap estimado, pixels necessários no render e a razão fonte/render.
            </AppText>
            <View style={styles.variantRow}>
              <AppText variant="label" color={Colors.muted}>Asset</AppText>
              <PillButton
                label="Original 2048"
                size="sm"
                variant={variant === 'original' ? 'dark' : 'outline'}
                selected={variant === 'original'}
                accessibilityLabel="Usar fotos originais de até 2048 pixels"
                onPress={() => selectVariant('original')}
                style={styles.variantAction}
              />
              <PillButton
                label="Variante 512"
                size="sm"
                variant={variant === 'small' ? 'dark' : 'outline'}
                selected={variant === 'small'}
                accessibilityLabel="Usar variante simulada de até 512 pixels"
                onPress={() => selectVariant('small')}
                style={styles.variantAction}
              />
            </View>
            <AppText variant="caption">
              A variante simulada usa 1/4 da fonte, servida pelo mesmo host de QA. Ela não existe no contrato de mídia: serve só para comparar nitidez e memória antes de propor um pipeline.
            </AppText>
          </View>
          <View style={styles.harness}>
            <PhotoQaHarness variant={variant} />
          </View>
        </View>
      ) : (
        <View style={styles.offState}>
          <StateView
            kind="empty"
            title="Medição parada"
            message="Inicie a medição para montar o feed de 120 fotos com o tamanho efetivo do render instrumentado."
          />
          <EditorialAction
            label="Iniciar medição"
            icon="play"
            tone="red"
            labelVariant="button"
            onPress={start}
            style={styles.action}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.five,
    gap: Spacing.two,
  },
  note: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderWidth: 1,
    borderColor: Colors.inkSoft,
    borderRadius: Radius.sm,
    backgroundColor: Colors.strawLight,
  },
  variantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingTop: Spacing.one,
  },
  variantAction: {
    borderRadius: Radius.sm,
  },
  harness: {
    flex: 1,
  },
  offState: {
    flex: 1,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: Spacing.five,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  action: {
    borderRadius: Radius.sm,
  },
});
