import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialAction } from '@/components/editorial-action';
import { EditorialHeader } from '@/components/editorial-header';
import { Screen } from '@/components/screen';
import { StateView } from '@/components/state-view';
import { Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { getPerformanceSnapshot, performanceDiagnosticsAvailable, performanceInstrumentationEnabled } from '@/lib/performance';
import { goBack } from '@/lib/routes';

import { startPerformanceMeasurement } from './diagnostics';
import { PerformanceQaHarness } from './qa-harness';

/**
 * Entrada de diagnóstico para o harness de 20 cartões (POP-5).
 *
 * Existia só como componente solto; agora tem uma rota protegida por ambiente.
 * Em produção a rota não é registrada e a tela também recusa renderizar.
 */
export function PerformanceHarnessScreen() {
  if (!performanceDiagnosticsAvailable()) return <UnavailableScreen />;
  return <HarnessContent />;
}

function UnavailableScreen() {
  return (
    <Screen>
      <EditorialHeader title="Harness de 20 posts" onBack={goBack} />
      <StateView
        kind="empty"
        title="Harness indisponível"
        message="Esta tela existe apenas em desenvolvimento e staging."
      />
    </Screen>
  );
}

function HarnessContent() {
  // Só monta o harness com uma sessão de verdade: a flag ligada sem sessão
  // renderizaria os 20 cartões sem registrar commits.
  const [enabled, setEnabled] = useState(() => performanceInstrumentationEnabled() && getPerformanceSnapshot().sessionId !== null);
  const active = enabled && performanceInstrumentationEnabled();

  const start = () => {
    setEnabled(startPerformanceMeasurement());
  };

  return (
    <Screen>
      <EditorialHeader
        title="Harness de 20 posts"
        subtitle="Dataset de QA · vídeos desligados"
        onBack={goBack}
      />
      {active ? (
        <View style={styles.body}>
          <View style={styles.note}>
            <AppText variant="label" color={Colors.red}>Cenário de renderização</AppText>
            <AppText variant="caption">
              Os 20 cartões usam o dataset determinístico de QA. Role, apoie e volte ao diagnóstico para ler os commits.
            </AppText>
          </View>
          <View style={styles.harness}>
            <PerformanceQaHarness />
          </View>
        </View>
      ) : (
        <View style={styles.offState}>
          <StateView
            kind="empty"
            title="Medição parada"
            message="Inicie a medição para montar os 20 cartões com o React Profiler ativo."
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
