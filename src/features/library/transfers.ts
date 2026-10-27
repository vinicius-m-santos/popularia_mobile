import { ApiError } from '@/lib/errors';
import { AppState, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { downloadPdf } from './api';
import type { PickedPdf } from './types';

/** Os módulos são carregados só ao iniciar a ação; o build nativo precisa das dependências Expo declaradas. */
export async function pickPdf(): Promise<PickedPdf | null> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const picker = require('expo-document-picker') as { getDocumentAsync: (options: { type: string; copyToCacheDirectory: boolean; multiple: boolean }) => Promise<{ canceled: boolean; assets: PickedPdf[] | null }> };
  const result = await picker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
  if (result.canceled || !result.assets?.[0]) return null;
  const file = result.assets[0];
  if (!file.name.toLowerCase().endsWith('.pdf') || (file.size !== undefined && (file.size < 1 || file.size > 25 * 1024 * 1024))) {
    throw new ApiError(422, '/errors/pdf-selection', 'Escolha um PDF com conteúdo e até 25 MB.');
  }
  return file;
}

export async function openPdf(id: string, signal: AbortSignal): Promise<void> {
  if (Platform.OS === 'web') {
    const response = await downloadPdf(id, { signal });
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'documento.pdf';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return;
  }
  const uri = `${FileSystem.cacheDirectory}popularia-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`;
  try {
    await downloadPdf(id, { signal, transfer: async (url, headers, abortSignal) => {
      const task = FileSystem.createDownloadResumable(url, uri, { headers });
      const abort = () => { task.pauseAsync().catch(() => {}); };
      abortSignal.addEventListener('abort', abort);
      try {
        if (abortSignal.aborted) throw new Error('Download interrompido.');
        const result = await task.downloadAsync();
        if (!result || abortSignal.aborted) throw new Error('Download interrompido.');
        return new Response(null, { status: result.status, headers: result.headers });
      } finally { abortSignal.removeEventListener('abort', abort); }
    } });
    if (signal.aborted) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const sharing = require('expo-sharing') as { isAvailableAsync: () => Promise<boolean>; shareAsync: (uri: string, options: { mimeType: string; UTI: string; dialogTitle: string }) => Promise<void> };
    if (!(await sharing.isAvailableAsync())) throw new ApiError(400, '/errors/pdf-open', 'Não há um aplicativo disponível para abrir ou compartilhar este PDF.');
    await sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Abrir ou compartilhar PDF' });
    // Android pode resolver o chooser antes de o leitor consumir o URI. Aguarda o retorno.
    if (AppState.currentState !== 'active') await new Promise<void>((resolve) => {
      const timer = setTimeout(() => { subscription.remove(); resolve(); }, 60000);
      const subscription = AppState.addEventListener('change', (state) => { if (state === 'active') { clearTimeout(timer); subscription.remove(); resolve(); } });
    });
  } finally {
    await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }
}
