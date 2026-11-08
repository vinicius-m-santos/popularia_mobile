import { describe, expect, it } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { createElement, Profiler, type ReactElement, type ReactNode } from 'react';
import { View } from 'react-native';

const { compileSource, hasCompilerRuntime } = require('../scripts/react-compiler/compile') as {
  compileSource: (source: string, options?: { filename?: string; compiler?: boolean }) => string;
  hasCompilerRuntime: (code: string) => boolean;
};

/**
 * Benchmark A/B do POP-66. Compila o mesmo fixture com e sem React Compiler e
 * mede, no renderer de teste, o que o Compiler memoiza:
 *
 * - valor derivado no corpo do componente: o memo cache por instância evita o
 *   recálculo em um update com as mesmas props;
 * - cache de módulo compartilhado: duas instâncias ainda chamam a função, mas o
 *   corpo caro roda uma vez — o Compiler não substitui esse cache;
 * - contexto: uma mudança em outro campo do value notifica o consumidor e ele
 *   volta a renderizar; o Compiler não impede a notificação;
 * - useMemo com dependências divergentes: o Compiler faz bailout do componente.
 *
 * Não é FPS, frame time nem memória de aparelho. O roteiro de release com React
 * Profiler está em docs/pop-66-react-compiler-effect.md.
 *
 * npx jest --runTestsByPath benchmarks/pop-66-react-compiler.bench.ts \
 *   --testMatch '**\/*.bench.ts' --runInBand --silent=false
 */

const FIXTURE = `
import { createContext, useContext, useMemo } from 'react';
import { Text } from 'react-native';

export const stats = { derived: 0, shared: 0, consumerRenders: 0 };
const sharedCache = new Map();

function compute(value) { stats.derived += 1; return String(value).toUpperCase(); }
function computeShared(value) { stats.shared += 1; return String(value).toUpperCase(); }
function cachedShared(value) {
  if (!sharedCache.has(value)) sharedCache.set(value, computeShared(value));
  return sharedCache.get(value);
}

export const LabelContext = createContext({ label: 'a', tick: 0 });

export function Derived({ value }) {
  const upper = compute(value);
  return <Text>{upper}</Text>;
}

export function SharedA({ value }) {
  return <Text>{cachedShared(value)}</Text>;
}

export function SharedB({ value }) {
  return <Text>{cachedShared(value)}</Text>;
}

export function UncachedA({ value }) {
  return <Text>{computeShared(value)}</Text>;
}

export function UncachedB({ value }) {
  return <Text>{computeShared(value)}</Text>;
}

export function Consumer() {
  stats.consumerRenders += 1;
  const { label } = useContext(LabelContext);
  return <Text>{compute(label)}</Text>;
}

export function Provider({ label, tick, children }) {
  return <LabelContext.Provider value={{ label, tick }}>{children}</LabelContext.Provider>;
}
`;

const MISMATCH_FIXTURE = `
import { useMemo } from 'react';
import { Text } from 'react-native';

export const stats = { calls: 0 };
function compute(value) { stats.calls += 1; return String(value); }
export function Mismatch({ values }) {
  const key = values.join(',');
  // Mesmo padrão do POP-19 que fez o Compiler abandonar DiscoveryScreen.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stable = useMemo(() => values.slice(), [key]);
  return <Text>{compute(stable.join(''))}</Text>;
}
`;

type Commit = { phase: string; actualDuration: number; baseDuration: number };
type Fixture = {
  Derived: (props: { value: string }) => ReactElement;
  SharedA: (props: { value: string }) => ReactElement;
  SharedB: (props: { value: string }) => ReactElement;
  UncachedA: (props: { value: string }) => ReactElement;
  UncachedB: (props: { value: string }) => ReactElement;
  Consumer: () => ReactElement;
  Provider: (props: { label: string; tick: number; children?: ReactNode }) => ReactElement;
  stats: { derived: number; shared: number; consumerRenders: number };
};

function instantiate(compiler: boolean): { module: Fixture; code: string } {
  const code = compileSource(FIXTURE, { filename: 'pop66-fixture.jsx', compiler });
  const module = { exports: {} as Fixture };
  const requireShim = (id: string) => {
    if (id === 'react') return require('react');
    if (id === 'react/jsx-runtime') return require('react/jsx-runtime');
    if (id === 'react-native') return require('react-native');
    if (id === 'react/compiler-runtime') return require('react/compiler-runtime');
    return require(id);
  };
  new Function('require', 'module', 'exports', code)(requireShim, module, module.exports);
  return { module: module.exports, code };
}

function profiled(element: ReactElement, commits: Commit[]): ReactElement {
  return createElement(
    Profiler,
    {
      id: 'pop66',
      onRender: (_id: string, phase: string, actualDuration: number, baseDuration: number) => {
        commits.push({ phase, actualDuration, baseDuration });
      },
    },
    element,
  );
}

function summary(commits: Commit[]): string {
  const total = commits.reduce((sum, commit) => sum + commit.actualDuration, 0);
  const max = commits.reduce((value, commit) => Math.max(value, commit.actualDuration), 0);
  return `${commits.length} commits, actual ${total.toFixed(2)}ms, máx ${max.toFixed(2)}ms`;
}

describe('POP-66 React Compiler A/B', () => {
  it('memoiza valor derivado por instância, mas não substitui cache de módulo', async () => {
    const off = instantiate(false).module;
    const offRender = await render(profiled(createElement(off.Derived, { value: 'a' }), []));
    expect(off.stats.derived).toBe(1);
    await offRender.rerender(profiled(createElement(off.Derived, { value: 'a' }), []));
    expect(off.stats.derived).toBe(2);
    await offRender.unmount();

    const on = instantiate(true).module;
    const onCommits: Commit[] = [];
    const onRender = await render(profiled(createElement(on.Derived, { value: 'a' }), onCommits));
    expect(on.stats.derived).toBe(1);
    await onRender.rerender(profiled(createElement(on.Derived, { value: 'a' }), onCommits));
    expect(on.stats.derived).toBe(1);
    await onRender.unmount();

    console.info(
      `POP-66 derivado: sem Compiler ${off.stats.derived} cálculos; com Compiler ${on.stats.derived}; ` +
      `Profiler ${summary(onCommits)}`,
    );
  });

  it('mostra que o cache compartilhado continua necessário entre instâncias', async () => {
    for (const compiler of [false, true]) {
      const cached = instantiate(compiler).module;
      const cachedView = await render(createElement(
        View,
        null,
        createElement(cached.SharedA, { value: 'compartilhado' }),
        createElement(cached.SharedB, { value: 'compartilhado' }),
      ));
      expect(cached.stats.shared).toBe(1);
      await cachedView.unmount();

      const uncached = instantiate(compiler).module;
      const uncachedView = await render(createElement(
        View,
        null,
        createElement(uncached.UncachedA, { value: 'compartilhado' }),
        createElement(uncached.UncachedB, { value: 'compartilhado' }),
      ));
      // O Compiler memoiza cada instância; duas instâncias ainda executam duas vezes.
      expect(uncached.stats.shared).toBe(2);
      await uncachedView.unmount();
      console.info(
        `POP-66 cache compartilhado (Compiler ${compiler ? 'on' : 'off'}): ` +
        `com cache ${cached.stats.shared} corpo caro; sem cache ${uncached.stats.shared}`,
      );
    }
  });

  it('não impede o consumidor de contexto de renderizar quando outro campo muda', async () => {
    for (const compiler of [false, true]) {
      const fixture = instantiate(compiler).module;
      const commits: Commit[] = [];
      const first = createElement(
        fixture.Provider,
        { label: 'a', tick: 0 },
        createElement(fixture.Consumer),
      );
      const view = await render(profiled(first, commits));
      expect(fixture.stats.consumerRenders).toBe(1);

      const second = createElement(
        fixture.Provider,
        { label: 'a', tick: 1 },
        createElement(fixture.Consumer),
      );
      await view.rerender(profiled(second, commits));
      // O label não mudou, mas o value do contexto mudou: o consumidor roda de novo.
      expect(fixture.stats.consumerRenders).toBe(2);
      await view.unmount();
      console.info(`POP-66 contexto (Compiler ${compiler ? 'on' : 'off'}): ${summary(commits)}`);
    }
  });

  it('documenta o bailout de useMemo com dependências divergentes', async () => {
    const code = compileSource(MISMATCH_FIXTURE, { filename: 'pop66-mismatch.jsx', compiler: true });
    expect(hasCompilerRuntime(code)).toBe(false);

    const module = { exports: {} as { Mismatch: (props: { values: string[] }) => ReactElement; stats: { calls: number } } };
    const requireShim = (id: string) => {
      if (id === 'react') return require('react');
      if (id === 'react/jsx-runtime') return require('react/jsx-runtime');
      if (id === 'react-native') return require('react-native');
      if (id === 'react/compiler-runtime') return require('react/compiler-runtime');
      return require(id);
    };
    new Function('require', 'module', 'exports', code)(requireShim, module, module.exports);

    const values = ['a'];
    const view = await render(createElement(module.exports.Mismatch, { values }));
    await view.rerender(createElement(module.exports.Mismatch, { values }));
    expect(module.exports.stats.calls).toBe(2);
    await view.unmount();
    console.info(`POP-66 bailout: useMemo com deps divergentes não recebe memo cache e recalculou ${module.exports.stats.calls} vezes`);
  });
});
