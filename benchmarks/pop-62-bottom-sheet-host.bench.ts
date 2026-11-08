import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render } from '@testing-library/react-native';
import GorhomBottomSheet from '@gorhom/bottom-sheet';
import { createElement } from 'react';
import { Modal, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

/**
 * Benchmark A/B do POP-62. Compara o custo de montagem no host (Node/Jest) de
 * duas apresentações para a mesma folha curta:
 *
 * - atual: um `Modal` + `GestureHandlerRootView` + Gorhom por abertura;
 * - host único: o `Modal`/`GestureHandlerRootView`/Gorhom sobrevivem ao
 *   fechamento e cada reabertura monta apenas o conteúdo.
 *
 * A primeira abertura paga a árvore inteira nas duas arquiteturas; a diferença
 * aparece da segunda abertura em diante, quando o host único reaproveita a
 * apresentação. O benchmark mede o trabalho síncrono de render/montagem até o
 * conteúdo reportar layout. Não mede criação de janela nativa, frame time, FPS
 * nem memória do aparelho: o `Modal` do Jest é um mock de componente.
 *
 * npx jest --runTestsByPath benchmarks/pop-62-bottom-sheet-host.bench.ts \
 *   --testMatch '**\/*.bench.ts' --runInBand --silent=false
 */

const ROWS = Array.from({ length: 14 }, (_, index) => `Opção ${index + 1}`);
const ROUNDS = 8;
const REOPENS = 6;

function Options() {
  return createElement(
    View,
    null,
    createElement(AppText, null, 'Escolher opção'),
    ...ROWS.map((label) => createElement(
      View,
      { key: label, style: { minHeight: 48, justifyContent: 'center' } },
      createElement(AppText, null, label),
    )),
  );
}

function elapsedSince(startedAt: bigint): number {
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function report(label: string, values: number[]): void {
  console.info(
    `POP-62 ${label}: mediana ${median(values).toFixed(2)}ms; ` +
    `mín ${Math.min(...values).toFixed(2)}ms; máx ${Math.max(...values).toFixed(2)}ms ` +
    `(${ROUNDS} rodadas)`,
  );
}

/** A apresentação atual: a árvore nativa inteira nasce e morre a cada abertura. */
function CurrentSheet({ visible }: { visible: boolean }) {
  return createElement(BottomSheet, {
    visible,
    onClose: () => {},
    title: 'Opções',
    children: createElement(Options),
  });
}

type HostProps = {
  mounted: boolean;
  open: boolean;
  onLayout?: () => void;
};

/**
 * Modelo do host único: depois da primeira abertura, `Modal`,
 * `GestureHandlerRootView` e Gorhom permanecem montados; fechar desmonta só o
 * conteúdo e reabrir remonta só o conteúdo. Não modela a ocultação visual, o
 * bloqueio de toque/back nem o teclado — justamente os contratos que teriam de
 * ser reimplementados no host real.
 */
function HostSheet({ mounted, open, onLayout }: HostProps) {
  if (!mounted) return null;
  return createElement(
    Modal,
    { visible: true, transparent: true, animationType: 'none', testID: 'host-modal' },
    createElement(
      GestureHandlerRootView,
      { style: { flex: 1 }, accessibilityViewIsModal: true },
      createElement(
        GorhomBottomSheet,
        {
          index: -1,
          animateOnMount: false,
          enableDynamicSizing: true,
          enablePanDownToClose: true,
          enableHandlePanningGesture: true,
          onClose: () => {},
          children: open
            ? createElement(
              View,
              { testID: 'host-content', onLayout, style: { paddingHorizontal: 18 } },
              createElement(Options),
            )
            : null,
        },
      ),
    ),
  );
}

type CurrentView = Awaited<ReturnType<typeof render>>;

async function openCurrent(view: CurrentView): Promise<number> {
  const startedAt = process.hrtime.bigint();
  await view.rerender(createElement(CurrentSheet, { visible: true }));
  await fireEvent(view.getByTestId('bottom-sheet-scroll'), 'contentSizeChange', 390, 560);
  return elapsedSince(startedAt);
}

async function coldCurrent(): Promise<number> {
  const view = await render(createElement(CurrentSheet, { visible: false }));
  const elapsed = await openCurrent(view);
  await view.unmount();
  return elapsed;
}

async function warmCurrent(): Promise<number> {
  const view = await render(createElement(CurrentSheet, { visible: true }));
  await fireEvent(view.getByTestId('bottom-sheet-scroll'), 'contentSizeChange', 390, 560);
  const values: number[] = [];
  for (let reopen = 0; reopen < REOPENS; reopen += 1) {
    await view.rerender(createElement(CurrentSheet, { visible: false }));
    values.push(await openCurrent(view));
  }
  await view.unmount();
  return median(values);
}

async function openHost(view: CurrentView): Promise<number> {
  const startedAt = process.hrtime.bigint();
  await view.rerender(createElement(HostSheet, { mounted: true, open: true }));
  await fireEvent(view.getByTestId('host-content'), 'layout', {
    nativeEvent: { layout: { width: 390, height: 560 } },
  });
  return elapsedSince(startedAt);
}

async function coldHost(): Promise<number> {
  const view = await render(createElement(HostSheet, { mounted: false, open: false }));
  const elapsed = await openHost(view);
  await view.unmount();
  return elapsed;
}

async function warmHost(): Promise<number> {
  const view = await render(createElement(HostSheet, { mounted: true, open: true }));
  const values: number[] = [];
  for (let reopen = 0; reopen < REOPENS; reopen += 1) {
    await view.rerender(createElement(HostSheet, { mounted: true, open: false }));
    values.push(await openHost(view));
  }
  await view.unmount();
  return median(values);
}

async function sample(run: () => Promise<number>): Promise<number[]> {
  const values: number[] = [];
  for (let round = 0; round < ROUNDS; round += 1) {
    values.push(await run());
  }
  return values;
}

describe('POP-62 bottom sheet host', () => {
  it('compara a abertura por Modal com um host único persistente', async () => {
    expect(REOPENS).toBeGreaterThan(1);

    // Aquece módulos, estilos e o caminho de montagem antes de medir.
    await coldCurrent();
    await warmCurrent();
    await coldHost();
    await warmHost();

    const cold = {
      current: await sample(coldCurrent),
      host: await sample(coldHost),
    };
    const warm = {
      current: await sample(warmCurrent),
      host: await sample(warmHost),
    };

    report('primeira abertura, Modal por folha', cold.current);
    report('primeira abertura, host único', cold.host);
    report(`reabertura, Modal por folha (mediana de ${REOPENS})`, warm.current);
    report(`reabertura, host único (mediana de ${REOPENS})`, warm.host);
    console.info(
      `POP-62 diferença de reabertura: ` +
      `${(median(warm.current) - median(warm.host)).toFixed(2)}ms por abertura ` +
      `(trabalho síncrono de montagem no host Jest; não é abertura nativa)`,
    );

    // A primeira abertura paga a mesma árvore nas duas arquiteturas. O host do
    // benchmark é simplificado (não recria os contratos de safe area, teclado,
    // acessibilidade e fechamento), então a comparação de primeira abertura é
    // uma referência, não uma promessa de ganho.
    expect(median(cold.host)).toBeLessThan(median(cold.current) * 2);
    // O host único só pode economizar quando reaproveita a apresentação.
    expect(median(warm.host)).toBeLessThanOrEqual(median(warm.current));
  });

  it('fecha o Modal da folha atual e mantém o do host montado', async () => {
    const current = await render(createElement(CurrentSheet, { visible: true }));
    expect(current.getByTestId('bottom-sheet-modal')).toBeTruthy();
    await current.rerender(createElement(CurrentSheet, { visible: false }));
    expect(current.queryByTestId('bottom-sheet-modal')).toBeNull();
    await current.unmount();

    const host = await render(createElement(HostSheet, { mounted: true, open: true }));
    expect(host.getByTestId('host-modal')).toBeTruthy();
    await host.rerender(createElement(HostSheet, { mounted: true, open: false }));
    expect(host.getByTestId('host-modal')).toBeTruthy();
    await host.unmount();
  });
});
