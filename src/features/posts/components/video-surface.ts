/**
 * Tempo máximo que o pôster cobre uma surface de vídeo recém-montada.
 *
 * O primeiro quadro costuma chegar em poucos frames; o limite existe para a
 * plataforma que não emita `onFirstFrameRender` na remontagem (web, por
 * exemplo) não deixar o pôster preso sobre o vídeo.
 */
export const VIDEO_SURFACE_COVER_TIMEOUT_MS = 500;
