import { describe, expect, it } from '@jest/globals';

import { callSchedule } from '@/features/events/format';
import { tokenizePostText } from '@/features/hashtags/text';
import { mediaGridData } from '@/features/profiles/components/profile-media-grid';
import { qaMountedCards } from '@/features/performance/qa-fixture';

const ITERATIONS = 1_000;

function elapsed(fn: (index: number) => void): number {
  const start = performance.now();
  for (let index = 0; index < ITERATIONS; index += 1) fn(index);
  return performance.now() - start;
}

function report(label: string, cachedMs: number, recomputedMs: number): void {
  const perOp = (ms: number) => `${(ms / ITERATIONS * 1_000).toFixed(2)}µs/op`;
  console.info(
    `POP-19 ${label}: ${ITERATIONS} hits ${cachedMs.toFixed(2)}ms (${perOp(cachedMs)}); ` +
    `${ITERATIONS} recomputações ${recomputedMs.toFixed(2)}ms (${perOp(recomputedMs)})`,
  );
}

/**
 * Benchmark local de POP-19. Não define orçamento de tempo: os números só
 * comparam o caminho memoizado com o recálculo no mesmo processo. Rodar com:
 *
 * npx jest --runTestsByPath benchmarks/pop-19-recurring-computations.bench.ts \
 *   --testMatch '**\/*.bench.ts' --runInBand --silent=false
 */
describe('POP-19 recurring computations', () => {
  it('compara tokenização memoizada com textos únicos', () => {
    const text = '@ana, passando para lembrar do ato #tarifazero na Praça Sete. https://popularia.com.br/agenda';
    const mentions = [{ userId: 'ana', handle: 'ana', displayName: 'Ana', avatarUrl: null, start: 0, end: 4 }];
    expect(tokenizePostText(text, mentions).length).toBeGreaterThan(1);

    // Aquece a entrada antes de medir o caminho de cache.
    tokenizePostText(text, mentions);
    const cached = elapsed(() => { tokenizePostText(text, mentions); });
    const recomputed = elapsed((index) => { tokenizePostText(`${text} #unico${index}`, mentions); });
    report('tokenizePostText', cached, recomputed);
  });

  it('compara calendário memoizado com chamados distintos', () => {
    const zone = 'America/Sao_Paulo';
    const iso = '2026-11-06T19:00:00-03:00';
    const dates = Array.from({ length: ITERATIONS }, (_, index) =>
      new Date(Date.UTC(2026, 0, 1 + (index % 27), 19, index % 60)).toISOString());
    expect(callSchedule(iso, zone).day).toBe('06');

    callSchedule(iso, zone);
    const cached = elapsed(() => { callSchedule(iso, zone); });
    const recomputed = elapsed((index) => { callSchedule(dates[index], zone); });
    report('callSchedule', cached, recomputed);
  });

  it('compara separação de mídia memoizada com listas novas', () => {
    const posts = qaMountedCards();
    expect(mediaGridData(posts).posts.length).toBeGreaterThan(0);

    mediaGridData(posts);
    const cached = elapsed(() => { mediaGridData(posts); });
    const recomputed = elapsed(() => { mediaGridData([...posts]); });
    report('mediaGridData', cached, recomputed);
  });
});
