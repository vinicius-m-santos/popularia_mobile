import { afterAll, beforeAll } from '@jest/globals';
import { notifyManager } from '@tanstack/react-query';

import { queryClient } from '@/lib/query/client';

/** A notificação padrão usa setTimeout e cruza o act() do teste seguinte. */
export function settleQueryClient(): void {
  notifyManager.setScheduler((callback) => { callback(); });
}

const defaults = queryClient.getDefaultOptions();

/** Sem o timer de coleta, o processo do Jest não fica preso depois dos testes. */
beforeAll(() => {
  queryClient.setDefaultOptions({
    ...defaults,
    queries: { ...defaults.queries, gcTime: Number.POSITIVE_INFINITY },
  });
});

afterAll(() => {
  notifyManager.setScheduler((callback) => { setTimeout(callback, 0); });
  queryClient.setDefaultOptions(defaults);
});
