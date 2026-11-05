import type { VideoThumbnail } from 'expo-video';

import { registerPosterCacheStatsProvider } from '@/lib/performance';

/**
 * Cache de pôsteres de vídeo (POP-22).
 *
 * O primeiro quadro de um vídeo é uma imagem nativa (`VideoThumbnail`). O feed
 * mantém vários cartões montados e o usuário pode percorrer dezenas de vídeos;
 * um `Map` sem limite retinha todas as miniaturas até o processo terminar.
 *
 * Política:
 * - LRU por número de entradas. O limite de 16 cobre a janela curta do feed
 *   (`FlashList`) e o retorno de alguns cartões sem regerar o quadro. Não é uma
 *   medição de memória: cada decodificação depende da resolução do vídeo.
 * - Entradas em uso são reservadas (`retain`) e não podem ser despejadas. Se
 *   todas as entradas estiverem em uso, o cache pode exceder o limite por um
 *   instante; a próxima liberação volta a aplicar a política.
 * - `load` deduplica gerações concorrentes da mesma mídia e devolve o pôster
 *   canônico. Falha de geração não é cacheada e devolve `null` para o fallback.
 * - `clear` incrementa a época: uma geração que terminar depois da limpeza é
 *   descartada em vez de repovoar o cache com conteúdo antigo.
 *
 * O cache solta a referência do `Map` na evicção, mas não chama `release()` no
 * `VideoThumbnail`: um componente pode estar exibindo a mesma referência entre
 * o render e o efeito que a reserva. O objeto nativo é liberado pelo ciclo de
 * vida do `expo-image`/GC quando não houver mais referência JS.
 */

export const POSTER_CACHE_CAPACITY = 16;

export type PosterCacheEventType =
  | 'hit'
  | 'miss'
  | 'dedupe'
  | 'store'
  | 'evict'
  | 'discard'
  | 'generation-failure'
  | 'clear';

export type PosterCacheEvent = {
  type: PosterCacheEventType;
  mediaId: string | null;
  size: number;
  retained: number;
  capacity: number;
};

export type PosterCacheStats = {
  capacity: number;
  size: number;
  retained: number;
  hits: number;
  misses: number;
  stores: number;
  evictions: number;
  generationRequests: number;
  generationFailures: number;
  dedupedGenerations: number;
  discardedGenerations: number;
  clears: number;
};

type Entry = { poster: VideoThumbnail; retained: number };
type Listener = (poster: VideoThumbnail | null) => void;

export type PosterCacheOptions = {
  capacity?: number;
  onEvent?: (event: PosterCacheEvent) => void;
};

export class PosterCache {
  private readonly capacity: number;
  private readonly onEvent?: (event: PosterCacheEvent) => void;
  private readonly entries = new Map<string, Entry>();
  /** Reservas existem mesmo antes do pôster: quem exibe se protege da evicção. */
  private readonly reservations = new Map<string, number>();
  private readonly inFlight = new Map<string, Promise<VideoThumbnail | null>>();
  private readonly inFlightEpoch = new Map<string, number>();
  private readonly listeners = new Map<string, Set<Listener>>();
  private generationEpoch = 0;
  private readonly counters = {
    hits: 0,
    misses: 0,
    stores: 0,
    evictions: 0,
    generationRequests: 0,
    generationFailures: 0,
    dedupedGenerations: 0,
    discardedGenerations: 0,
    clears: 0,
  };

  constructor({ capacity = POSTER_CACHE_CAPACITY, onEvent }: PosterCacheOptions = {}) {
    this.capacity = Math.max(1, Math.floor(capacity));
    this.onEvent = onEvent;
  }

  /** Leitura pura para render: não altera a ordem de recência nem conta hit. */
  peek(mediaId: string): VideoThumbnail | null {
    return this.entries.get(mediaId)?.poster ?? null;
  }

  /**
   * Reserva a mídia enquanto um componente a exibe. A reserva vale mesmo antes
   * de o pôster existir, para que uma geração concorrente já nasça protegida.
   */
  retain(mediaId: string): () => void {
    const count = (this.reservations.get(mediaId) ?? 0) + 1;
    this.reservations.set(mediaId, count);
    const entry = this.entries.get(mediaId);
    if (entry) {
      entry.retained = count;
      this.touch(mediaId);
    }
    return () => this.release(mediaId);
  }

  /**
   * Devolve o pôster existente ou gera um novo. Gerações concorrentes da mesma
   * mídia compartilham a mesma promise; falha resolve `null` para o fallback.
   */
  load(mediaId: string, generate: () => Promise<VideoThumbnail | null>): Promise<VideoThumbnail | null> {
    const cached = this.entries.get(mediaId);
    if (cached) {
      this.counters.hits += 1;
      this.touch(mediaId);
      this.emit('hit', mediaId);
      return Promise.resolve(cached.poster);
    }

    this.counters.misses += 1;
    const pending = this.inFlight.get(mediaId);
    if (pending) {
      this.counters.dedupedGenerations += 1;
      this.emit('dedupe', mediaId);
      return pending;
    }

    this.counters.generationRequests += 1;
    this.emit('miss', mediaId);
    const epoch = this.generationEpoch;
    const promise = Promise.resolve()
      .then(generate)
      .then(
        (poster) => {
          this.settleGeneration(mediaId, epoch);
          if (!poster) {
            this.counters.generationFailures += 1;
            this.emit('generation-failure', mediaId);
            return null;
          }
          if (epoch !== this.generationEpoch) {
            this.counters.discardedGenerations += 1;
            this.emit('discard', mediaId);
            return null;
          }
          const canonical = this.set(mediaId, poster);
          if (canonical !== poster) {
            this.counters.discardedGenerations += 1;
            this.emit('discard', mediaId);
          }
          return canonical;
        },
        () => {
          this.settleGeneration(mediaId, epoch);
          this.counters.generationFailures += 1;
          this.emit('generation-failure', mediaId);
          return null;
        },
      );
    this.inFlight.set(mediaId, promise);
    this.inFlightEpoch.set(mediaId, epoch);
    return promise;
  }

  /**
   * Insere um pôster. Se a mídia já tiver um pôster, o existente ganha: uma
   * geração concorrente atrasada não troca o quadro que já está na tela.
   */
  set(mediaId: string, poster: VideoThumbnail): VideoThumbnail {
    const existing = this.entries.get(mediaId);
    if (existing) {
      this.touch(mediaId);
      return existing.poster;
    }
    const entry: Entry = { poster, retained: this.reservations.get(mediaId) ?? 0 };
    this.entries.set(mediaId, entry);
    this.counters.stores += 1;
    this.emit('store', mediaId);
    this.notify(mediaId, poster);
    this.trim();
    return poster;
  }

  subscribe(mediaId: string, listener: Listener): () => void {
    let listeners = this.listeners.get(mediaId);
    if (!listeners) {
      listeners = new Set();
      this.listeners.set(mediaId, listeners);
    }
    listeners.add(listener);
    return () => {
      const current = this.listeners.get(mediaId);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) this.listeners.delete(mediaId);
    };
  }

  /**
   * Limpa o cache e invalida gerações em voo. Usado em testes e, se necessário,
   * quando o conteúdo deixa de pertencer à sessão. As reservas de componentes
   * ainda montados continuam válidas até o unmount: elas não são miniaturas.
   */
  clear(): void {
    this.generationEpoch += 1;
    this.entries.clear();
    this.inFlight.clear();
    this.inFlightEpoch.clear();
    this.counters.clears += 1;
    for (const mediaId of [...this.listeners.keys()]) this.notify(mediaId, null);
    this.emit('clear', null);
  }

  stats(): PosterCacheStats {
    let retained = 0;
    for (const entry of this.entries.values()) {
      if (entry.retained > 0) retained += 1;
    }
    return {
      capacity: this.capacity,
      size: this.entries.size,
      retained,
      ...this.counters,
    };
  }

  /**
   * Remove a geração em voo apenas se ela ainda for a dona da entrada. Depois
   * de `clear`, uma geração antiga não pode apagar a promise de uma nova.
   */
  private settleGeneration(mediaId: string, epoch: number): void {
    if (this.inFlightEpoch.get(mediaId) !== epoch) return;
    this.inFlight.delete(mediaId);
    this.inFlightEpoch.delete(mediaId);
  }

  private release(mediaId: string): void {
    const count = (this.reservations.get(mediaId) ?? 0) - 1;
    if (count > 0) {
      this.reservations.set(mediaId, count);
      const entry = this.entries.get(mediaId);
      if (entry) entry.retained = count;
      return;
    }
    this.reservations.delete(mediaId);
    const entry = this.entries.get(mediaId);
    if (entry) entry.retained = 0;
    this.trim();
  }

  private touch(mediaId: string): void {
    const entry = this.entries.get(mediaId);
    if (!entry) return;
    this.entries.delete(mediaId);
    this.entries.set(mediaId, entry);
  }

  private trim(): void {
    while (this.entries.size > this.capacity) {
      let victim: string | null = null;
      for (const [mediaId, entry] of this.entries) {
        if (entry.retained === 0) {
          victim = mediaId;
          break;
        }
      }
      // Todas em uso: mantém o excesso temporário e tenta de novo na liberação.
      if (victim === null) return;
      this.entries.delete(victim);
      this.counters.evictions += 1;
      this.emit('evict', victim);
      // Não notifica: um pôster já renderizado não deve sumir no meio da transição.
    }
  }

  private notify(mediaId: string, poster: VideoThumbnail | null): void {
    const listeners = this.listeners.get(mediaId);
    if (!listeners) return;
    for (const listener of [...listeners]) listener(poster);
  }

  private emit(type: PosterCacheEventType, mediaId: string | null): void {
    if (!this.onEvent) return;
    let retained = 0;
    for (const entry of this.entries.values()) {
      if (entry.retained > 0) retained += 1;
    }
    this.onEvent({
      type,
      mediaId,
      size: this.entries.size,
      retained,
      capacity: this.capacity,
    });
  }
}

export const posterCache = new PosterCache({ capacity: POSTER_CACHE_CAPACITY });

registerPosterCacheStatsProvider(() => posterCache.stats());
