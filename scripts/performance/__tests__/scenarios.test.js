import { describe, expect, it } from '@jest/globals';

import { DEFAULT_SCENARIO_IDS, SCENARIOS, collectorDeepLink, resolveScenarios } from '../lib/scenarios.mjs';

describe('cenários do POP-72', () => {
  it('cobre feed, swipe, composer, paginação e vídeo por padrão', () => {
    expect(DEFAULT_SCENARIO_IDS).toEqual(expect.arrayContaining(['feed', 'swipe', 'composer', 'pagination', 'video']));
    for (const id of DEFAULT_SCENARIO_IDS) {
      expect(SCENARIOS[id]).toMatchObject({ id, title: expect.any(String), description: expect.any(String) });
    }
  });

  it('exige vídeo real apenas no cenário video', () => {
    const scenarios = resolveScenarios(DEFAULT_SCENARIO_IDS, {});
    const video = scenarios.find((scenario) => scenario.id === 'video');
    expect(video).toMatchObject({ skipped: true, skipReason: 'faltam opções: --video-post' });
    expect(scenarios.filter((scenario) => scenario.id !== 'video').every((scenario) => !scenario.skipped)).toBe(true);
    expect(resolveScenarios(['video'], { videoPostId: 'abc' })[0].skipped).toBe(false);
  });

  it('mantém o feed de fotos fora da matriz padrão e aponta para a rota dedicada', () => {
    expect(DEFAULT_SCENARIO_IDS).not.toContain('photo-feed');
    expect(SCENARIOS['photo-feed']).toMatchObject({
      id: 'photo-feed',
      measure: 'interaction',
      deepLink: 'populariamobile://diagnostico-performance-fotos',
      waitForLabel: 'Fotos 2048px',
      sampleMemoryEveryStep: true,
      captureSnapshot: true,
    });
    expect(SCENARIOS['photo-feed'].steps.filter((step) => step.type === 'swipe')).toHaveLength(2);
    expect(resolveScenarios(['photo-feed'], {})[0].skipped).toBe(false);
  });

  it('registra o próximo destino no deep link do coletor', () => {
    expect(collectorDeepLink('reset', 'n1', { next: '/' })).toContain('collector=reset&nonce=n1&next=%2F');
    expect(collectorDeepLink('snapshot', 'n2')).not.toContain('next=');
  });

  it('documenta o composer sem publicar e com print antes de fechar', () => {
    const types = SCENARIOS.composer.steps.map((step) => step.type);
    expect(types).toContain('screenshot');
    expect(types.indexOf('screenshot')).toBeLessThan(types.lastIndexOf('keyevent'));
    expect(SCENARIOS.composer.steps.some((step) => step.type === 'inputText')).toBe(true);
  });
});
