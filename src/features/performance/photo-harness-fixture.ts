import type { PostMediaDto } from '@/features/posts/post-media';
import type { FeedItem } from '@/types/models';

/**
 * Dataset determinístico do harness de fotos 2048 px (POP-65).
 *
 * A maior dimensão de cada preset é 2048, o teto aplicado no upload em
 * `post-media.ts`. O harness não substitui o feed real: ele existe para medir
 * decodificação, cache e memória com fotos de tamanhos e proporções variados.
 * Sem rede para o host configurado, o cenário não é válido e deve ser
 * registrado como NÃO MEDIDO.
 */

export const QA_PHOTO_FEED_COUNT = 120;

export type QaPhotoSize = {
  label: string;
  width: number;
  height: number;
};

/** Presets com a mesma proporção dos formatos comuns de upload. */
export const QA_PHOTO_SIZES: QaPhotoSize[] = [
  { label: 'quadrada 2048', width: 2048, height: 2048 },
  { label: 'paisagem 3:2', width: 2048, height: 1365 },
  { label: 'retrato 2:3', width: 1365, height: 2048 },
  { label: 'paisagem 16:9', width: 2048, height: 1152 },
  { label: 'retrato 9:16', width: 1152, height: 2048 },
  { label: 'paisagem 4:3', width: 1600, height: 1200 },
  { label: 'retrato 3:4', width: 1200, height: 1600 },
  { label: 'legada 900', width: 900, height: 1200 },
];

export type QaPhotoVariant = 'original' | 'small';

const PHOTO_BASE = (process.env.EXPO_PUBLIC_PERF_QA_PHOTO_BASE ?? 'https://picsum.photos/seed/popularia').replace(/\/+$/, '');

const AUTHORS = [
  { id: 'qa-photo-author-1', name: 'Ana Ribeiro', handle: 'anaribeiro', initials: 'AR', tone: 'red' as const },
  { id: 'qa-photo-author-2', name: 'Bruno Lima', handle: 'brunolima', initials: 'BL', tone: 'black' as const },
  { id: 'qa-photo-author-3', name: 'Carla Nunes', handle: 'carlanunes', initials: 'CN', tone: 'cream' as const },
];

const COMUNAS = [
  { id: 'qa-photo-comuna-1', name: 'Vila Operária' },
  { id: 'qa-photo-comuna-2', name: 'Feira do Bairro' },
];

/** A variante simulada usa 1/4 da fonte, como um preview de ~512 px. */
export function qaPhotoVariantSize(size: QaPhotoSize, variant: QaPhotoVariant): QaPhotoSize {
  if (variant === 'original') return size;
  return {
    ...size,
    width: Math.max(1, Math.round(size.width / 4)),
    height: Math.max(1, Math.round(size.height / 4)),
  };
}

function photoFor(index: number, variant: QaPhotoVariant): PostMediaDto {
  const preset = QA_PHOTO_SIZES[index % QA_PHOTO_SIZES.length];
  const size = qaPhotoVariantSize(preset, variant);
  return {
    id: `qa-photo-${variant}-${index}`,
    type: 'image',
    mimeType: 'image/jpeg',
    // Metadado sintético: o harness não usa byteSize para decidir nada.
    byteSize: Math.round(size.width * size.height * 0.18),
    width: size.width,
    height: size.height,
    durationMs: null,
    url: `${PHOTO_BASE}-photo-${index}/${size.width}/${size.height}`,
  };
}

/** 120 publicações somente com foto, em ordem estável. */
export function buildQaPhotoFeedItems(count = QA_PHOTO_FEED_COUNT, variant: QaPhotoVariant = 'original'): FeedItem[] {
  return Array.from({ length: count }, (_, index) => {
    const author = AUTHORS[index % AUTHORS.length];
    const comuna = COMUNAS[index % COMUNAS.length];
    const createdAt = new Date(Date.UTC(2026, 10, 1, 12, 0, 0) - index * 60_000).toISOString();
    return {
      id: `qa-photo-post-${index + 1}`,
      authorId: author.id,
      comunaId: comuna.id,
      createdAt,
      text: `Foto de QA ${index + 1} · ${QA_PHOTO_SIZES[index % QA_PHOTO_SIZES.length].label}.`,
      title: null,
      attachment: photoFor(index, variant),
      supportCount: index,
      commentCount: index % 7,
      echoCount: index % 4,
      viewer: { isAuthor: false, canComment: true, canDelete: false },
      author: { ...author },
      comuna: { id: comuna.id, name: comuna.name, status: 'active' as const },
      event: null,
      topCommentAuthor: null,
      topComment: undefined,
    };
  });
}
