import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { View } from 'react-native';
import { AppText } from '@/components/app-text';
import { PillButton } from '@/components/pill-button';
import { StateView } from '@/components/state-view';
import { usePaginatedData } from '@/hooks/use-paginated-data';
import { apiRequest } from '@/lib/api/client';
import { describeError } from '@/lib/errors';
import type { Page } from '@/lib/pagination';

type Report = { id: string; documentId: string; reason: string; createdAt: string };
/** Seção da fila de moderação existente; nenhum dashboard paralelo. */
export function LibraryReportQueue({ comuna }: { comuna: string }) {
  const load = useCallback((cursor: string | null) => apiRequest<Page<Report>>(`/library/reports?comuna=${encodeURIComponent(comuna)}&limit=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`, { auth: true }), [comuna]);
  const data = usePaginatedData(load);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const decide = async (id: string, status: 'dismissed' | 'removed') => {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try { await apiRequest(`/library/reports/${encodeURIComponent(id)}`, { auth: true, method: 'PATCH', body: { status } }); data.refresh(); }
    catch (e) { setError(describeError(e)); } finally { pending.current = false; setBusy(false); }
  };
  return <View style={{ gap: 12 }}><AppText variant="heading">Documentos · Denúncias</AppText>
    {data.status === 'loading' ? <StateView kind="loading" message="Carregando denúncias de PDFs" /> : null}
    {data.status === 'error' ? <StateView kind="error" message="Não conseguimos carregar as denúncias de PDFs." onRetry={data.refresh} /> : null}
    {data.status === 'success' && !data.items.length ? <AppText variant="caption">Nenhuma denúncia de PDF aguardando análise.</AppText> : null}
    {data.items.map((report) => <View key={report.id} style={{ gap: 8 }}><AppText>{report.reason}</AppText>
      <PillButton label="Ver documento denunciado" variant="outline" onPress={() => router.push({ pathname: '/biblioteca/documento/[id]', params: { id: report.documentId, comuna } })} />
      <PillButton label="Manter documento" variant="outline" disabled={busy} onPress={() => decide(report.id, 'dismissed')} />
      <PillButton label="Remover conteúdo denunciado" disabled={busy} onPress={() => decide(report.id, 'removed')} />
    </View>)}
    {data.hasMore ? <PillButton label="Mais denúncias de PDFs" disabled={data.loadingMore} onPress={data.loadMore} /> : null}
    {data.loadMoreError ? <StateView kind="error" message="Não conseguimos carregar mais denúncias." onRetry={data.loadMore} /> : null}
    {error ? <AppText>{error}</AppText> : null}
  </View>;
}
