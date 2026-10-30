import { useQuery } from '@tanstack/react-query';

import { DEMO_MODE } from '@/constants/config';
import { useAccount, useMe } from '@/features/account/account-context';
import { queryClient } from '@/lib/query/client';

import { getGamification } from './api';
import { gamificationQueryKey } from './types';

/** Uma consulta por conta. Cartões de publicação não usam esta chave. */
export function useGamification() {
  const { account } = useAccount();
  const me = useMe();
  const accountId = account?.id ?? (DEMO_MODE ? me.id : null);

  return useQuery({
    queryKey: gamificationQueryKey(accountId ?? 'anon'),
    queryFn: ({ signal }) => getGamification(signal),
    enabled: null !== accountId,
    staleTime: 60_000,
    retry: false,
  }, queryClient);
}
