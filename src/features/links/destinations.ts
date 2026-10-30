import { router, type Href } from 'expo-router';
import { API_BASE_URL } from '@/constants/config';
import { hrefComuna, hrefHashtag, hrefPost, hrefProfile, type TabBase } from '@/lib/routes';

export type ShareDestination = { kind: 'post' | 'profile' | 'comuna' | 'document' | 'event' | 'hashtag'; id: string };
export type Destination = ShareDestination | { kind: 'square' | 'join_requests' | 'notice'; id: string };
export const PUBLIC_LINK_ORIGIN = (process.env.EXPO_PUBLIC_LINK_ORIGIN || API_BASE_URL?.replace(/\/api\/v1$/, '') || 'http://localhost:8080').replace(/\/+$/, '');
const prefixes = { post: 'p', profile: 'u', comuna: 'c', document: 'd', event: 'e', hashtag: 't' } as const;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validDestination(target: ShareDestination): boolean {
  if (target.kind === 'hashtag') return /^[\p{L}\p{M}\p{N}_]{1,50}$/u.test(target.id) && /[\p{L}\p{N}]/u.test(target.id) && target.id === target.id.normalize('NFD').replace(/\p{Mn}+/gu, '').normalize('NFC').toLowerCase();
  return target.kind === 'comuna' ? /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(target.id) && target.id.length <= 40 : uuid.test(target.id);
}

export function canonicalUrl(target: ShareDestination): string {
  if (!validDestination(target)) throw new Error('Este conteúdo ainda não possui um link público.');
  return `${PUBLIC_LINK_ORIGIN}/${prefixes[target.kind]}/${encodeURIComponent(target.id.toLowerCase())}`;
}

/** Only this environment's HTTPS host and the existing development scheme are accepted. */
export function parsePopulariaUrl(value: string): ShareDestination | null {
  try {
    const scheme = value.startsWith('populariamobile://');
    const url = new URL(scheme ? value.replace('populariamobile://', `${PUBLIC_LINK_ORIGIN}/`) : value);
    const origin = new URL(PUBLIC_LINK_ORIGIN);
    if (url.origin !== origin.origin || url.username || url.password || url.hash) return null;
    if ([...url.searchParams.keys()].some((key) => !/^utm_(source|medium|campaign|term|content)$/.test(key) && !['fbclid', 'gclid', 'igshid', 's'].includes(key))) return null;
    if (!scheme && url.protocol !== 'https:' && !(origin.protocol === 'http:' && __DEV__)) return null;
    const match = /^\/(p|u|c|d|e|t)\/([^/]+)$/.exec(url.pathname);
    if (!match) return null;
    const kind = (Object.keys(prefixes) as (keyof typeof prefixes)[]).find((key) => prefixes[key] === match[1])!;
    const target = { kind, id: decodeURIComponent(match[2]).toLowerCase() };
    return validDestination(target) ? target : null;
  } catch { return null; }
}

export function destinationHref(target: Destination, base: TabBase = ''): Href {
  switch (target.kind) {
    case 'notice': return '/avisos';
    case 'post': return hrefPost(base, target.id);
    case 'hashtag': return hrefHashtag(target.id);
    case 'profile': return hrefProfile(base, target.id);
    case 'comuna': return hrefComuna(base, target.id);
    case 'document': return { pathname: '/biblioteca/documento/[id]', params: { id: target.id } };
    case 'event': return { pathname: '/evento/[id]', params: { id: target.id } };
    case 'square': return { pathname: '/praca/[id]', params: { id: target.id } };
    case 'join_requests': return { pathname: '/gerir-comuna/[id]', params: { id: target.id, aba: 'pedidos' } };
  }
}

export function openDestination(target: Destination, base: TabBase = '') { router.push(destinationHref(target, base)); }
