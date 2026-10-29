const locks = new Set<string>();

/** Impede um segundo envio da mesma imagem enquanto o primeiro não terminou. */
export function tryLockImageUpload(key: string): boolean {
  if (locks.has(key)) return false;
  locks.add(key);
  return true;
}

export function unlockImageUpload(key: string): void {
  locks.delete(key);
}

export function resetImageUploadLocks(): void {
  locks.clear();
}
