import { MOCK_LATENCY_MS } from '@/constants/config';

/** Simula a latência de rede para que as telas tratem carregamento desde já. */
export function mockDelay<T>(value: T, ms = MOCK_LATENCY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}
