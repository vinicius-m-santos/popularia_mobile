import { useCallback, useEffect, useState } from 'react';

/**
 * Mantém o RefreshControl nativo visível apenas para pull-to-refresh iniciado
 * pela pessoa. Revalidações automáticas em foco não devem alterar o offset da lista.
 */
export function useManualRefresh(loading: boolean, reload: () => void) {
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    reload();
  }, [reload]);

  useEffect(() => {
    // O término vem do estado assíncrono externo ao hook; encerra exclusivamente
    // a animação iniciada em onRefresh, sem alterar conteúdo ou offset da lista.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (refreshing && !loading) setRefreshing(false);
  }, [loading, refreshing]);

  return { refreshing, onRefresh };
}
