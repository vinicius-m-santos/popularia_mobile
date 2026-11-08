/**
 * Matriz de auditoria POP-5 → POP-72.
 *
 * `medido` significa que o coletor produz um número real na execução local;
 * `parcial` significa proxy ou dependência de formato/flag; `ausente` é uma
 * métrica que continua exigindo aparelho, Instruments/Perfetto ou trabalho
 * futuro. Esta lista é usada no relatório e deve espelhar
 * `docs/pop-72-performance-metrics-automation.md`.
 */

export const METRIC_MATRIX = [
  {
    metric: 'Requests lógicas, tentativas HTTP, retries e duração',
    pop5: 'implementado',
    collector: 'snapshot JS',
    status: 'medido',
    notes: 'Caminhos sem query string; inclui requests por tela e paginação.',
  },
  {
    metric: 'Commits e actualDuration do React Profiler',
    pop5: 'implementado',
    collector: 'snapshot JS',
    status: 'medido',
    notes: 'Só comparável entre builds com profiling; inclui overhead do Profiler.',
  },
  {
    metric: 'FlashList onLoad',
    pop5: 'implementado',
    collector: 'snapshot JS',
    status: 'medido',
    notes: 'Não é TTI; mede o tempo informado pela lista até desenhar.',
  },
  {
    metric: 'Vídeo: players, TTFF e primeiro quadro da surface',
    pop5: 'implementado',
    collector: 'snapshot JS + cenário de vídeo',
    status: 'condicional',
    notes: 'Exige build de diagnóstico com a ponte e um post de vídeo informado.',
  },
  {
    metric: 'Foto em tela cheia: onLoad, onDisplay e cache',
    pop5: 'implementado',
    collector: 'snapshot JS',
    status: 'medido',
    notes: 'Estimativa de bitmap não é leitura de memória nativa.',
  },
  {
    metric: 'Frame timing e jank (p50/p90/p95/p99, frames janky)',
    pop5: 'ausente',
    collector: 'ADB dumpsys gfxinfo framestats',
    status: 'medido',
    notes: 'Frame budget do refresh rate; limiar de 1,5× e frames lentos de 2×.',
  },
  {
    metric: 'JS stalls',
    pop5: 'ausente',
    collector: 'proxy: frames longos + commits do snapshot',
    status: 'parcial',
    notes: 'Hermes não expõe long tasks por ADB; o proxy inclui tempo de UI.',
  },
  {
    metric: 'Latência de interação',
    pop5: 'ausente',
    collector: 'ADB gfxinfo: HandleInputStart → FrameCompleted',
    status: 'medido',
    notes: 'Só frames que tiveram input; não mede teclado nativo nem gesto físico.',
  },
  {
    metric: 'Inicialização fria e quente',
    pop5: 'ausente',
    collector: 'ADB am start -W + logcat Displayed',
    status: 'medido',
    notes: 'Emulador; não é baseline de release nem de aparelho físico.',
  },
  {
    metric: 'Memória/PSS',
    pop5: 'ausente',
    collector: 'ADB dumpsys meminfo',
    status: 'medido',
    notes: 'PSS do processo; não é heap JS nem memória total do sistema.',
  },
  {
    metric: 'CPU do processo',
    pop5: 'ausente',
    collector: 'ADB /proc/<pid>/stat',
    status: 'medido',
    notes: 'Delta de utime+stime; sofre influência do host/emulador.',
  },
  {
    metric: 'Rede (bytes/pacotes do UID)',
    pop5: 'ausente',
    collector: 'ADB dumpsys netstats',
    status: 'parcial',
    notes: 'Formato varia por versão; indisponível vira null, nunca zero.',
  },
  {
    metric: 'Paginação',
    pop5: 'parcial (onLoad/requests)',
    collector: 'snapshot JS + frames do cenário',
    status: 'medido',
    notes: 'Conta páginas por requests de paginação e onLoad; não prova conteúdo.',
  },
  {
    metric: 'Primeiro frame de vídeo',
    pop5: 'implementado no player',
    collector: 'snapshot JS no cenário de vídeo',
    status: 'condicional',
    notes: 'O coletor só mede se houver --video-post e a ponte estiver ligada.',
  },
  {
    metric: 'FPS/GPU/thermals e bateria',
    pop5: 'ausente',
    collector: 'Perfetto/Android Studio/Instruments',
    status: 'ausente',
    notes: 'Fora do escopo do ADB collector; exige trace nativo e aparelho.',
  },
  {
    metric: 'Jank de aparelho físico Android/iOS',
    pop5: 'ausente',
    collector: 'execução manual',
    status: 'ausente',
    notes: 'Emulador não substitui aparelho; iOS não é coberto por ADB.',
  },
];

export function metricMatrixForReport() {
  return METRIC_MATRIX.map((row) => ({ ...row }));
}
