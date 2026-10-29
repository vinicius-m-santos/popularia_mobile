import { API_BASE_URL } from '@/constants/config';

/** Caminhos relativos da API (`/api/v1/media/...`) viram URL absoluta. URLs já absolutas permanecem. */
export function absoluteMediaUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith('/')) return `${API_BASE_URL.replace(/\/api\/v1$/, '')}${url}`;
  return url;
}
