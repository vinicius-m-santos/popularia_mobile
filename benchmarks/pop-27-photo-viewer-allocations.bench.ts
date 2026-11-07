import { describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { ImageRef } from 'expo-image';
import { createElement, Fragment, type ReactElement } from 'react';

import { PostAttachment } from '@/features/posts/components/post-attachment';
import { PhotoViewer } from '@/features/posts/components/photo-viewer';
import type { PostMediaDto } from '@/features/posts/post-media';

/**
 * Benchmark local de POP-27. Mede o custo de montagem no host (Node/Jest),
 * comparando o caminho antigo — um `PhotoViewer` fechado por cartão — com o
 * caminho atual — `PostAttachment` fechado, sem viewer — e o custo do único
 * viewer montado no toque. Não é FPS, frame time nem memória do aparelho.
 *
 * npx jest --runTestsByPath benchmarks/pop-27-photo-viewer-allocations.bench.ts \
 *   --testMatch '**\/*.bench.ts' --runInBand --silent=false
 */

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Image = (props: Record<string, unknown>) => React.createElement(View, props);
  Image.loadAsync = async (): Promise<ImageRef | null> => null;
  return { Image };
});

jest.mock('react-native-gesture-handler', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    GestureDetector: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
    GestureHandlerRootView: View,
    usePinchGesture: () => ({ type: 'pinch' }),
    usePanGesture: () => ({ type: 'pan' }),
    useTapGesture: () => ({ type: 'tap' }),
    useSimultaneousGestures: (...gestures: unknown[]) => gestures,
  };
});

jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

const CARDS = 100;
const ROUNDS = 8;

const photo: PostMediaDto = {
  id: 'photo-bench',
  type: 'image',
  url: 'https://example.test/foto.jpg',
  width: 1080,
  height: 1350,
  durationMs: null,
  mimeType: 'image/jpeg',
  byteSize: 1_000_000,
};

function currentCards(): ReactElement {
  return createElement(
    Fragment,
    null,
    ...Array.from({ length: CARDS }, (_, index) => createElement(PostAttachment, {
      key: index,
      media: { ...photo, id: `photo-${index}`, url: `https://example.test/foto-${index}.jpg` },
    })),
  );
}

/** O caminho antigo: o mesmo cartão mais um `PhotoViewer` fechado por célula. */
function legacyCards(): ReactElement {
  return createElement(
    Fragment,
    null,
    currentCards(),
    ...Array.from({ length: CARDS }, (_, index) => createElement(PhotoViewer, {
      key: `viewer-${index}`,
      uri: `https://example.test/foto-${index}.jpg`,
      visible: false,
      onClose: () => {},
      width: photo.width,
      height: photo.height,
    })),
  );
}

async function elapsed(node: ReactElement): Promise<number> {
  const startedAt = process.hrtime.bigint();
  const view = await render(node);
  await view.unmount();
  return Number(process.hrtime.bigint() - startedAt) / 1_000_000;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function report(label: string, values: number[]): void {
  console.info(
    `POP-27 ${label}: mediana ${median(values).toFixed(2)}ms; ` +
    `mín ${Math.min(...values).toFixed(2)}ms; máx ${Math.max(...values).toFixed(2)}ms ` +
    `(${ROUNDS} rodadas, ${CARDS} cartões)`,
  );
}

function viewer(props: { visible: boolean }): ReactElement {
  return createElement(PhotoViewer, {
    uri: photo.url,
    visible: props.visible,
    onClose: () => {},
    width: photo.width,
    height: photo.height,
  });
}

describe('POP-27 photo viewer allocations', () => {
  it('compara o viewer fechado por cartão com a montagem sob demanda', async () => {
    expect(CARDS).toBeGreaterThanOrEqual(100);
    // Aquece módulos, estilos e o primeiro render antes de medir.
    await elapsed(legacyCards());
    await elapsed(currentCards());
    await elapsed(viewer({ visible: true }));

    const legacy: number[] = [];
    const current: number[] = [];
    for (let round = 0; round < ROUNDS; round += 1) {
      legacy.push(await elapsed(legacyCards()));
      current.push(await elapsed(currentCards()));
    }
    report('100 cartões + viewer fechado (antes)', legacy);
    report('100 cartões sem viewer (depois)', current);
    console.info(
      `POP-27 custo removido por cartão fechado: ` +
      `${((median(legacy) - median(current)) / CARDS).toFixed(3)}ms (mediana no host, não é device)`,
    );

    const open: number[] = [];
    for (let round = 0; round < ROUNDS; round += 1) {
      open.push(await elapsed(viewer({ visible: true })));
    }
    console.info(
      `POP-27 1 PhotoViewer montado no toque: mediana ${median(open).toFixed(2)}ms; ` +
      `mín ${Math.min(...open).toFixed(2)}ms; máx ${Math.max(...open).toFixed(2)}ms`,
    );

    // O benchmark é comparativo; não define orçamento de tempo.
    expect(median(current)).toBeLessThan(median(legacy));
  });
});
