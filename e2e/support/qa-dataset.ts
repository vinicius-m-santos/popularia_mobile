import type { LibraryDocument } from '../../src/features/library/types';
import type { PostDto } from '../../src/lib/api/dto';

/**
 * Dataset determinístico do smoke de UX mobile (POP-64).
 *
 * O feed tem 240 publicações em 3 páginas de 80 — acima dos 200 posts do
 * roteiro. Os textos são curtos para manter a rolagem previsível sem depender
 * de imagens ou rede. O cenário de mídia/3+ vídeos é manual no aparelho: o
 * player web do `expo-video` não representa a física, o autoplay mudo e o
 * ciclo de vida nativos.
 */

export const QA_FEED_POST_COUNT = 240;
export const QA_FEED_PAGE_SIZE = 80;
export const QA_LIBRARY_DOCUMENT_COUNT = 60;
export const QA_LIBRARY_PAGE_SIZE = 20;
export const QA_IMAGE_POST_ID = 'qa-image-post';
export const QA_IMAGE_POST_TEXT = 'Foto de QA para abrir em tela cheia.';

/**
 * PNG 1×1 transparente. Mantém o cenário de foto sem rede: o gesto e o chrome
 * são o que importa, não a decodificação da imagem.
 */
export const TINY_PNG_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lY3nWQAAAABJRU5ErkJggg==';

const AUTHORS = [
  { id: 'qa-author-1', handle: 'ana.qa', displayName: 'Ana QA' },
  { id: 'qa-author-2', handle: 'bruno.qa', displayName: 'Bruno QA' },
  { id: 'qa-author-3', handle: 'carla.qa', displayName: 'Carla QA' },
];

function authorFor(index: number) {
  return AUTHORS[index % AUTHORS.length];
}

function createdAtFor(index: number) {
  return new Date(Date.UTC(2026, 10, 2, 12, 0, 0) - index * 60_000).toISOString();
}

/** Publicação textual estável; o número no texto é o marcador de posição na lista. */
export function buildQaFeedPosts(count = QA_FEED_POST_COUNT): PostDto[] {
  return Array.from({ length: count }, (_, index) => {
    const position = index + 1;
    const author = authorFor(index);
    return {
      id: `qa-feed-post-${position}`,
      body: `Publicação de QA ${String(position).padStart(3, '0')}. Rolagem longa do smoke mobile.`,
      createdAt: createdAtFor(index),
      author: { ...author, avatarUrl: null },
      comuna: null,
      commentCount: position % 4,
      supportCount: position % 17,
      echoCount: position % 9,
      viewer: { isAuthor: false, canComment: true, canDelete: false, canRemove: false },
    };
  });
}

/** Primeira publicação com foto real para o teste de abertura/fechamento do visualizador. */
export function buildQaImagePost(): PostDto {
  return {
    id: QA_IMAGE_POST_ID,
    body: QA_IMAGE_POST_TEXT,
    createdAt: createdAtFor(0),
    author: { ...authorFor(0), avatarUrl: null },
    comuna: null,
    commentCount: 0,
    supportCount: 0,
    echoCount: 0,
    viewer: { isAuthor: false, canComment: true, canDelete: false, canRemove: false },
    media: {
      id: 'qa-image-media',
      type: 'image',
      mimeType: 'image/png',
      byteSize: 68,
      width: 1200,
      height: 800,
      durationMs: null,
      url: TINY_PNG_DATA_URI,
    },
  };
}

/** Documentos públicos suficientes para três páginas de 20 na Biblioteca. */
export function buildQaLibraryDocuments(count = QA_LIBRARY_DOCUMENT_COUNT): LibraryDocument[] {
  return Array.from({ length: count }, (_, index) => {
    const position = index + 1;
    const number = String(position).padStart(3, '0');
    return {
      id: `qa-library-document-${number}`,
      state: 'available',
      title: `Documento de QA ${number}`,
      description: `Descrição do documento ${number} para a rolagem da Biblioteca.`,
      origin: { kind: 'personal', id: 'qa-library-origin', name: 'Coletivo QA' },
      collection: null,
      responsible: { id: 'qa-author-1', name: 'Ana QA', handle: 'ana.qa' },
      author: 'Coletivo QA',
      createdAt: createdAtFor(index),
      byteSize: 240_000 + index,
      pageCount: 8 + (index % 12),
      topic: 'edu',
      access: 'visitors',
      isPublic: true,
      saved: false,
      viewer: { canEdit: false, canDelete: false },
      distributions: [],
      message: null,
    };
  });
}
