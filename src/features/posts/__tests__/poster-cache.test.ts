import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { VideoThumbnail } from 'expo-video';

import { getPerformanceSnapshot } from '@/lib/performance';

import { POSTER_CACHE_CAPACITY, PosterCache, posterCache } from '../poster-cache';

/** O cache só usa a identidade da miniatura; o objeto nativo não é exercitado no Jest. */
function thumbnail(id: string): VideoThumbnail {
  return { id, width: 320, height: 568, requestedTime: 0, actualTime: 0 } as unknown as VideoThumbnail;
}

/** Deixa a promise de geração iniciar e permite controlar quando ela resolve. */
async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

beforeEach(() => {
  posterCache.clear();
});

describe('política do cache de pôsteres', () => {
  it('limita o número de entradas ao percorrer muitos vídeos', async () => {
    const cache = new PosterCache();
    for (let index = 0; index < 120; index += 1) {
      await cache.load(`video-${index}`, async () => thumbnail(`poster-${index}`));
    }
    expect(cache.stats().size).toBe(POSTER_CACHE_CAPACITY);
    expect(cache.stats().stores).toBe(120);
    expect(cache.stats().evictions).toBe(120 - POSTER_CACHE_CAPACITY);
    expect(cache.peek('video-0')).toBeNull();
    expect(cache.peek('video-119')).not.toBeNull();
  });

  it('despeja a entrada menos usada recentemente, não a mais antiga por acaso', async () => {
    const cache = new PosterCache({ capacity: 2 });
    const a = thumbnail('a');
    const b = thumbnail('b');
    const c = thumbnail('c');
    cache.set('a', a);
    cache.set('b', b);

    await cache.load('a', async () => thumbnail('nunca'));
    cache.set('c', c);

    expect(cache.peek('a')).toBe(a);
    expect(cache.peek('c')).toBe(c);
    expect(cache.peek('b')).toBeNull();
    expect(cache.stats()).toMatchObject({ size: 2, hits: 1, evictions: 1, stores: 3 });
  });

  it('serve o pôster do cache sem gerar de novo', async () => {
    const cache = new PosterCache();
    const a = thumbnail('a');
    cache.set('a', a);
    const generate = jest.fn(async () => thumbnail('novo'));

    await expect(cache.load('a', generate)).resolves.toBe(a);
    expect(generate).not.toHaveBeenCalled();
    expect(cache.stats()).toMatchObject({ hits: 1, misses: 0, generationRequests: 0, size: 1 });
  });

  it('protege pôster em uso e aplica o limite assim que ele é liberado', () => {
    const cache = new PosterCache({ capacity: 1 });
    const releaseA = cache.retain('a');
    const releaseB = cache.retain('b');
    const a = thumbnail('a');
    const b = thumbnail('b');

    cache.set('a', a);
    cache.set('b', b);
    // Duas mídias em uso podem exceder o limite temporariamente.
    expect(cache.stats()).toMatchObject({ capacity: 1, size: 2, retained: 2 });

    // 'a' é a menos recente e a primeira a ser despejada quando deixa de estar em uso.
    releaseA();
    expect(cache.peek('a')).toBeNull();
    expect(cache.peek('b')).toBe(b);
    expect(cache.stats()).toMatchObject({ size: 1, retained: 1, evictions: 1 });

    releaseB();
    expect(cache.stats().retained).toBe(0);
  });

  it('não despeja o pôster reservado para dar lugar a um pôster sem uso', () => {
    const cache = new PosterCache({ capacity: 1 });
    const releaseA = cache.retain('a');
    cache.set('a', thumbnail('a'));
    cache.set('b', thumbnail('b'));

    expect(cache.peek('a')).not.toBeNull();
    expect(cache.peek('b')).toBeNull();
    expect(cache.stats()).toMatchObject({ size: 1, retained: 1, evictions: 1 });
    releaseA();
  });
});

describe('geração concorrente, falha e ciclo de vida', () => {
  it('compartilha uma única geração entre duas instâncias da mesma mídia', async () => {
    const cache = new PosterCache();
    const result = thumbnail('a');
    let resolve!: (poster: VideoThumbnail | null) => void;
    const generate = jest.fn(() => new Promise<VideoThumbnail | null>((done) => { resolve = done; }));

    const first = cache.load('a', generate);
    const second = cache.load('a', generate);
    await flushMicrotasks();
    expect(generate).toHaveBeenCalledTimes(1);
    resolve(result);

    await expect(first).resolves.toBe(result);
    await expect(second).resolves.toBe(result);
    expect(cache.stats()).toMatchObject({
      size: 1,
      stores: 1,
      generationRequests: 1,
      dedupedGenerations: 1,
    });
  });

  it('trata falha e resultado vazio como ausência de pôster sem envenenar o cache', async () => {
    const cache = new PosterCache();
    const failing = jest.fn(async (): Promise<VideoThumbnail | null> => { throw new Error('codec'); });

    await expect(cache.load('a', failing)).resolves.toBeNull();
    expect(cache.peek('a')).toBeNull();
    expect(cache.stats()).toMatchObject({ size: 0, generationFailures: 1, evictions: 0 });

    const empty = jest.fn(async () => null);
    await expect(cache.load('a', empty)).resolves.toBeNull();
    expect(cache.stats().generationFailures).toBe(2);

    // A mídia continua elegível: a próxima montagem pode tentar de novo.
    const a = thumbnail('a');
    await expect(cache.load('a', async () => a)).resolves.toBe(a);
    expect(cache.stats()).toMatchObject({ size: 1, stores: 1, generationRequests: 3 });
  });

  it('descarta geração atrasada quando outra instância já publicou o pôster canônico', async () => {
    const cache = new PosterCache();
    const canonical = thumbnail('canonical');
    const late = thumbnail('late');
    let resolve!: (poster: VideoThumbnail | null) => void;
    const pending = cache.load('a', () => new Promise<VideoThumbnail | null>((done) => { resolve = done; }));
    await flushMicrotasks();

    cache.set('a', canonical);
    resolve(late);

    await expect(pending).resolves.toBe(canonical);
    expect(cache.peek('a')).toBe(canonical);
    expect(cache.stats()).toMatchObject({ size: 1, stores: 1, discardedGenerations: 1 });
  });

  it('limpa o cache e ignora uma geração que termina depois da limpeza', async () => {
    const cache = new PosterCache();
    const a = thumbnail('a');
    let resolve!: (poster: VideoThumbnail | null) => void;
    const pending = cache.load('a', () => new Promise<VideoThumbnail | null>((done) => { resolve = done; }));
    await flushMicrotasks();

    cache.clear();
    resolve(a);

    await expect(pending).resolves.toBeNull();
    expect(cache.peek('a')).toBeNull();
    expect(cache.stats()).toMatchObject({ size: 0, clears: 1, discardedGenerations: 1 });
  });

  it('preserva a reserva de quem continua montado depois de uma limpeza', () => {
    const cache = new PosterCache({ capacity: 1 });
    const releaseA = cache.retain('a');
    cache.clear();
    const releaseB = cache.retain('b');
    cache.set('a', thumbnail('a'));
    cache.set('b', thumbnail('b'));

    // A limpeza descarta miniaturas, não as reservas dos componentes montados.
    expect(cache.stats()).toMatchObject({ size: 2, retained: 2 });
    releaseA();
    expect(cache.stats().size).toBe(1);
    releaseB();
  });

  it('avisa quem exibe quando o pôster chega e quando o cache é limpo', () => {
    const cache = new PosterCache();
    const a = thumbnail('a');
    const listener = jest.fn();
    const unsubscribe = cache.subscribe('a', listener);

    cache.set('a', a);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenLastCalledWith(a);

    cache.clear();
    expect(listener).toHaveBeenLastCalledWith(null);

    unsubscribe();
    cache.set('a', thumbnail('outro'));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('emite miss, store, hit, evicção, falha e clear para a instrumentação', async () => {
    const events: string[] = [];
    const cache = new PosterCache({ capacity: 1, onEvent: (event) => events.push(event.type) });

    await cache.load('a', async () => thumbnail('a'));
    await cache.load('a', async () => thumbnail('outro'));
    cache.set('b', thumbnail('b'));
    await cache.load('c', async () => { throw new Error('sem quadro'); });
    cache.clear();

    expect(events).toEqual(expect.arrayContaining([
      'miss', 'store', 'hit', 'evict', 'generation-failure', 'clear',
    ]));
  });

  it('expõe contagem e ciclo de vida no snapshot de performance', () => {
    posterCache.set('snapshot', thumbnail('snapshot'));
    expect(getPerformanceSnapshot().posters).toMatchObject({
      capacity: POSTER_CACHE_CAPACITY,
      size: 1,
      stores: expect.any(Number),
      evictions: expect.any(Number),
      generationRequests: expect.any(Number),
      generationFailures: expect.any(Number),
    });
    posterCache.clear();
    expect(getPerformanceSnapshot().posters.size).toBe(0);
  });
});
