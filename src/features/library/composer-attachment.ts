import type { LibraryDocument } from './types';

// Callback ligado à instância atual do composer; desmontar remove a referência e o rascunho.
const listeners = new Map<string, (document: LibraryDocument) => void>();
export function subscribeAttachment(key: string, listener: (document: LibraryDocument) => void) {
  listeners.set(key, listener);
  return () => { listeners.delete(key); };
}
export function returnAttachment(key: string, document: LibraryDocument) { listeners.get(key)?.(document); }
