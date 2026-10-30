import { DEMO_MODE } from '@/constants/config';
import { apiRequest } from '@/lib/api/client';

import { DEMO_GAMIFICATION } from './demo';
import type { GamificationState } from './types';

export function getGamification(signal?: AbortSignal): Promise<GamificationState> {
  if (DEMO_MODE) return Promise.resolve(DEMO_GAMIFICATION);
  return apiRequest<GamificationState>('/me/gamification', { auth: true, signal });
}
