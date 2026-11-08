import { Platform } from 'react-native';

import { exportPerformanceSnapshot, performanceDiagnosticsAvailable } from '@/lib/performance';

/**
 * Ponte local entre o app e o coletor ADB do POP-72.
 *
 * O coletor abre a tela de diagnóstico com `?collector=snapshot` (ou
 * `?collector=reset`) e depois lê o JSON pelo `run-as`. A ponte só existe em
 * desenvolvimento/staging, exige a flag `EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT=1`
 * e grava no cache privado do app. Nada é enviado à rede.
 */
export const PERFORMANCE_COLLECTOR_FILE_NAME = 'popularia-performance-diagnostico.json';

export type PerformanceCollectorAction = 'reset' | 'snapshot';

export function performanceCollectorExportEnabled(): boolean {
  return performanceDiagnosticsAvailable() && process.env.EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT === '1';
}

/** Lê a ação do deep link sem aceitar valores arbitrários. */
export function collectorActionFromParams(params: {
  collector?: string | string[];
}): PerformanceCollectorAction | null {
  const raw = Array.isArray(params.collector) ? params.collector[0] : params.collector;
  if (raw === 'reset' || raw === 'snapshot') return raw;
  return null;
}

/**
 * Destino opcional depois do reset. O coletor usa `/` para devolver o feed
 * antes de medir a interação; só aceitamos a raiz para não criar um navegador
 * arbitrário a partir de um deep link.
 */
export function collectorNextPath(params: {
  next?: string | string[];
}): '/' | null {
  const raw = Array.isArray(params.next) ? params.next[0] : params.next;
  return raw === '/' ? '/' : null;
}

/**
 * Grava o snapshot atual no cache do app para o coletor ADB. Devolve `null`
 * quando a ponte está desligada ou quando a plataforma é web (não há arquivo
 * privado que o `run-as` consiga ler).
 */
export async function writePerformanceSnapshotForCollector(): Promise<string | null> {
  if (!performanceCollectorExportEnabled() || Platform.OS === 'web') return null;

  // Módulo carregado só na ação, como no compartilhamento do diagnóstico.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fileSystem = require('expo-file-system/legacy') as {
    cacheDirectory: string | null;
    writeAsStringAsync: (uri: string, contents: string) => Promise<void>;
  };
  if (!fileSystem.cacheDirectory) return null;

  const uri = `${fileSystem.cacheDirectory}${PERFORMANCE_COLLECTOR_FILE_NAME}`;
  await fileSystem.writeAsStringAsync(uri, exportPerformanceSnapshot());
  return uri;
}
