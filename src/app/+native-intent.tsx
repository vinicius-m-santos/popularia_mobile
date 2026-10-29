import { receivePopulariaUrl } from '@/features/links/incoming';

/** Expo Router calls this for both initial launch and links received while running. */
export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  if (receivePopulariaUrl(path)) return '/abrir-link';
  // Preserve internal routes and OAuth callbacks. Malformed public links get safe feedback.
  if (/^(https?:|populariamobile:\/\/(p|u|c|d)\/)/i.test(path)) return '/link-indisponivel';
  return path;
}
