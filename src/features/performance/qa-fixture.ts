import type { FeedItem } from '@/types/models';
import type { PostMediaDto } from '@/features/posts/post-media';

/**
 * Dataset determinístico e isolado do QA de performance (POP-5).
 *
 * Não substitui os mocks públicos nem entra em produção: é usado apenas pelo
 * harness de diagnóstico e pelos testes. Os assets são remotos e configuráveis;
 * sem rede acessível o cenário de mídia não é válido e deve ser registrado como
 * não medido. Nenhum número de performance é gerado aqui.
 */

export const QA_POST_COUNT = 240;
export const QA_PAGE_SIZE = 80;
export const QA_MOUNTED_CARD_COUNT = 20;
export const QA_PHOTO_COUNT = 160;
export const QA_VIDEO_COUNT = QA_POST_COUNT - QA_PHOTO_COUNT;

const DEFAULT_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4';
const IMAGE_BASE = (process.env.EXPO_PUBLIC_PERF_QA_IMAGE_BASE ?? 'https://picsum.photos/seed/popularia').replace(/\/+$/, '');
const VIDEO_URL = process.env.EXPO_PUBLIC_PERF_QA_VIDEO_URL ?? DEFAULT_VIDEO_URL;

const AUTHORS = [
  { id: 'qa-author-1', name: 'Ana Ribeiro', handle: 'anaribeiro', initials: 'AR', tone: 'red' as const },
  { id: 'qa-author-2', name: 'Bruno Lima', handle: 'brunolima', initials: 'BL', tone: 'black' as const },
  { id: 'qa-author-3', name: 'Carla Nunes', handle: 'carlanunes', initials: 'CN', tone: 'cream' as const },
  { id: 'qa-author-4', name: 'Diego Alves', handle: 'diegoalves', initials: 'DA', tone: 'red' as const },
  { id: 'qa-author-5', name: 'Elisa Prado', handle: 'elisaprado', initials: 'EP', tone: 'black' as const },
  { id: 'qa-author-6', name: 'Fábio Costa', handle: 'fabiocosta', initials: 'FC', tone: 'cream' as const },
];

const COMUNAS = [
  { id: 'qa-comuna-1', name: 'Vila Operária' },
  { id: 'qa-comuna-2', name: 'Feira do Bairro' },
  { id: 'qa-comuna-3', name: 'Rádio Comunitária' },
  { id: 'qa-comuna-4', name: 'Horta Coletiva' },
];

function mediaFor(index: number): PostMediaDto {
  const isVideo = index % 3 === 2;
  return isVideo
    ? {
        id: `qa-media-${index}`,
        type: 'video',
        mimeType: 'video/mp4',
        byteSize: 2_400_000,
        width: 1280,
        height: 720,
        durationMs: 15_000,
        url: VIDEO_URL,
      }
    : {
        id: `qa-media-${index}`,
        type: 'image',
        mimeType: 'image/jpeg',
        byteSize: 320_000,
        width: index % 2 === 0 ? 1200 : 900,
        height: index % 2 === 0 ? 800 : 1200,
        durationMs: null,
        url: `${IMAGE_BASE}/popularia-${index}/1200/800`,
      };
}

/** 240 publicações com mídia: 160 fotos e 80 vídeos, em ordem estável. */
export function buildQaFeedItems(count = QA_POST_COUNT): FeedItem[] {
  return Array.from({ length: count }, (_, index) => {
    const author = AUTHORS[index % AUTHORS.length];
    const comuna = COMUNAS[index % COMUNAS.length];
    const createdAt = new Date(Date.UTC(2026, 9, 1, 12, 0, 0) - index * 60_000).toISOString();
    const attachment = mediaFor(index);
    return {
      id: `qa-post-${index + 1}`,
      authorId: author.id,
      comunaId: comuna.id,
      createdAt,
      text: `Publicação de QA ${index + 1}. Texto de comprimento variável para exercitar o cartão e a rolagem, sem conteúdo real de pessoas.`,
      title: index % 7 === 0 ? `Manchete de QA ${index + 1}` : null,
      attachment,
      supportCount: index * 3,
      commentCount: index % 11,
      echoCount: index % 5,
      viewer: { isAuthor: false, canComment: true, canDelete: false },
      author: { ...author },
      comuna: { id: comuna.id, name: comuna.name, status: 'active' as const },
      event: null,
      topCommentAuthor: index % 4 === 0 ? { ...AUTHORS[(index + 1) % AUTHORS.length] } : null,
      topComment: index % 4 === 0 ? { authorId: AUTHORS[(index + 1) % AUTHORS.length].id, text: 'Comentário de QA.' } : undefined,
    };
  });
}

export type QaFeedPage = { items: FeedItem[]; nextCursor: string | null };

/** Paginação por cursor com pelo menos três páginas no dataset padrão. */
export function qaFeedPage(cursor: string | null, pageSize = QA_PAGE_SIZE, items = buildQaFeedItems()): QaFeedPage {
  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const start = Number.isFinite(offset) && offset >= 0 ? offset : 0;
  const page = items.slice(start, start + pageSize);
  const next = start + pageSize < items.length ? String(start + pageSize) : null;
  return { items: page, nextCursor: next };
}

/** Primeiros cartões para o cenário de 20 cartões montados simultaneamente. */
export function qaMountedCards(items = buildQaFeedItems()): FeedItem[] {
  return items.slice(0, QA_MOUNTED_CARD_COUNT);
}
