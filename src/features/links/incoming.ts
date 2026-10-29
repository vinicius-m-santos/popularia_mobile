import type { NotificationTarget } from '@/types/models';
import { parsePopulariaUrl, type ShareDestination } from './destinations';

// One pending external intent, kept in memory across the auth/legal/onboarding screens.
// Latest explicit link wins. Nothing sensitive or account-specific is persisted.
type IncomingIntent = { source: 'link'; target: ShareDestination } | { source: 'push'; target: NotificationTarget; accountId: string };
let pending: IncomingIntent | null = null;
let revision = 0;
const listeners = new Set<() => void>();
export function receivePopulariaUrl(url: string): boolean {
  const target = parsePopulariaUrl(url);
  if (!target) return false;
  pending = { source: 'link', target };
  revision += 1;
  listeners.forEach((listener) => listener());
  return true;
}
export function beginIncomingPush() { pending = null; revision += 1; return revision; }
export function incomingRevision() { return revision; }
export function peekIncomingDestination() { return pending; }
export function receivePushDestination(target: NotificationTarget, accountId: string) {
  pending = { source: 'push', target, accountId };
  revision += 1;
  listeners.forEach((listener) => listener());
}
export function takeIncomingDestination() { const target = pending; pending = null; return target; }
export function subscribeIncoming(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
