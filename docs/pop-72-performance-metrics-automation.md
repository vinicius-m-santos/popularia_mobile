# POP-72 — captura e comparação automática de métricas reais por cenário E2E

Data: 08/11/2026. Dependências: POP-5 (instrumentação/baseline) e POP-64
(cenários e matriz de smoke). Execução local no WSL + Windows Emulator via ADB.
**Não depende de runner em nuvem nem de POP-71.**

## 1. Resultado desta entrega

Esta entrega automatiza a coleta e o relatório, mas **não inventa números**. O
ambiente de desenvolvimento usado para implementar não tinha um emulador
Android acessível pelo ADB (o `adb.exe` do Windows não executa dentro do
sandbox), então a tabela de valores permanece vazia até a primeira execução real.
O coletor imprime `—`/`NÃO MEDIDO` e registra a limitação no relatório em vez de
preencher zero.

O que está implementado e coberto por Jest:

- auditoria POP-5 × métricas ausentes na matriz da seção 3;
- cenários `cold-start`, `warm-start`, `feed`, `swipe`, `composer`, `pagination`
  e `video`;
- coleta ADB de frames/jank, latência de input, PSS, CPU, rede, startup e
  primeiro frame de vídeo (quando há snapshot JS e `--video-post`);
- snapshot JS do POP-5 exportado pelo app em development build;
- JSON, CSV, relatório Markdown por cenário e comparação antes/depois por commit;
- calibração de thresholds em múltiplas execuções, com gate **advisory** (não
  bloqueia merge);
- limitações explícitas do emulador e a pendência de aparelho físico Android/iOS.

### Evidência por cenário

Cada execução grava, em `artifacts/performance/<timestamp>-<commit>/runs/<cenário>/<iteração>/`:

| Evidência | Arquivo | O que prova |
| --- | --- | --- |
| Print final | `screen.png` | tela do cenário no emulador |
| Hierarquia de UI | `window.xml` | textos/labels/bounds do momento da captura |
| Snapshot JS | `js-snapshot.json` | requests, commits, onLoad, paginação e TTFF do POP-5 |
| Launch | `launch.txt` / `launch` em `run.json` | `am start -W` e deep link usado |
| Métricas da execução | `run.json` | frame stats, PSS, CPU, rede, notas e erros |
| Snapshot consolidado | `report.json` / `runs.csv` / `report.md` | relatório do commit |

O relatório liga cada linha de cenário aos arquivos de evidência. Prints, XML,
snapshots e relatórios são evidência local e estão no `.gitignore`
(`/artifacts/performance/`); anexe-os ao ticket, não ao repositório.

## 2. Arquitetura

```text
WSL
  scripts/performance/android-perf.mjs
    ├─ lib/adb.mjs          resolve adb.exe do Windows, devices, execFile
    ├─ lib/device.mjs       tap/swipe/texto/deep link, gfxinfo, meminfo, /proc, netstats
    ├─ lib/scenarios.mjs    cenários reproduzíveis e passos
    ├─ lib/collector.mjs    preparação, amostras, evidências, snapshot JS
    ├─ lib/parsers.mjs      parsing determinístico das saídas do ADB
    └─ lib/report.mjs       JSON/CSV/Markdown, thresholds e comparação
Windows Emulator
  com.popularia.mobile (development build com profiling)
    └─ /diagnostico-performance?collector=snapshot
         grava cache/popularia-performance-diagnostico.json
ADB
  run-as <pkg> cat cache/popularia-performance-diagnostico.json
```

O app só grava o snapshot quando **as duas condições** valem:

1. `performanceDiagnosticsAvailable()` (development/staging, nunca produção);
2. `EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT=1` no bundle.

A ponte da tela de diagnóstico (`src/features/performance/collector-bridge.ts`)
é acionada por `?collector=reset` (zera a sessão; com `&next=/` devolve o feed) e
`?collector=snapshot` (grava sem zerar). O arquivo fica no cache privado do app e é lido por `run-as`
em development build; em staging sem root o snapshot JS fica indisponível e o
relatório registra isso.

## 3. Matriz POP-5 × POP-72

A mesma matriz é embutida no relatório (`metricMatrix`).

| Métrica | POP-5 | Coleta POP-72 | Status | Limite |
| --- | --- | --- | --- | --- |
| Requests lógicas, tentativas HTTP, retries, duração | implementado | snapshot JS | medido | caminhos sem query string |
| Commits e `actualDuration` do React Profiler | implementado | snapshot JS | medido | só compara build com profiling |
| FlashList `onLoad` | implementado | snapshot JS | medido | não é TTI |
| Vídeo: players, TTFF e primeiro quadro de surface | implementado | snapshot JS + cenário `video` | condicional | exige `--video-post` e ponte |
| Foto em tela cheia | implementado | snapshot JS | medido | estimativa de bitmap, não memória |
| Frame timing/jank (p50/p90/p95/p99, janky) | ausente | `dumpsys gfxinfo framestats` | medido | emulador; budget do refresh rate |
| JS stalls | ausente | proxy de frames longos + commits | parcial | Hermes não expõe long task via ADB |
| Latência de interação | ausente | `HandleInputStart → FrameCompleted` | medido | só frames com input |
| Inicialização fria/quente | ausente | `am start -W` + `logcat Displayed` | medido | não é baseline de release |
| Memória/PSS | ausente | `dumpsys meminfo` | medido | PSS do processo, não heap JS |
| CPU do processo | ausente | `/proc/<pid>/stat` | medido | influência do host/emulador |
| Rede (bytes/pacotes do UID) | ausente | `dumpsys netstats` | parcial | formato varia; indisponível vira `null` |
| Paginação | parcial (`onLoad`/requests) | snapshot JS + frames | medido | conta requests/onLoad, não valida conteúdo |
| Primeiro frame de vídeo | implementado no player | snapshot JS no cenário | condicional | exige vídeo real no dataset |
| FPS/GPU/thermals/bateria | ausente | Perfetto/Android Studio/Instruments | ausente | exige trace nativo/aparelho |
| Jank em aparelho físico Android/iOS | ausente | manual | ausente | emulador não substitui aparelho |

### O que “JS stall” significa aqui

O ADB entrega frames do processo, não a separação UI thread × JS thread. O
coletor calcula:

- `frames.jankPct`: frames acima de `1,5 ×` o frame budget do refresh rate;
- `frames.slowFrames`: frames acima de `2 ×` o budget;
- `jsStalls`: frames ≥ 100 ms (proxy) e o `maxActualMs` dos commits do Profiler
  no snapshot. É explicitamente rotulado como proxy: não é uma long task do
  Hermes e não deve ser lido como “tempo de JS” exato.

Se no futuro houver um trace Perfetto/atrace com slices de JS, ele pode ser
correlacionado pelo timestamp sem mudar o relatório.

## 4. Pré-requisitos

### Emulador e ADB

- Windows Emulator já iniciado (Android 14+ recomendado, imagem sem Google Play
  se for preciso `adb root`).
- `adb.exe` do SDK acessível pelo WSL. O coletor procura, nesta ordem:
  `--adb`, `ADB_PATH`, `ANDROID_HOME`/`ANDROID_SDK_ROOT`, a instalação padrão
  em `/mnt/c/Users/*/AppData/Local/Android/Sdk/platform-tools/adb.exe` e o
  `adb` do PATH.
- Conferir: `node scripts/performance/android-perf.mjs devices`.

### App e dataset

- Development build instalado (`com.popularia.mobile/.MainActivity`), com
  profiling se for comparar `actualDuration`.
- Build/bundle com:

  ```bash
  EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1 \
  EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT=1 \
  EXPO_PUBLIC_APP_ENV=development \
  npx expo start --dev-client
  ```

  A flag de exportação é lida no bundle; mudá-la exige reiniciar o Metro/build.
- Conta de QA e dataset com pelo menos 3 páginas no feed e um post com vídeo.
  O fixture `qa-fixture.ts` do POP-5 não alimenta o feed real; sem dataset
  mínimo, registre **NÃO EXECUTADO — dataset insuficiente**.
- Para o cenário de vídeo, informe o ID real:

  ```bash
  --video-post <id-da-publicacao-com-video>
  ```

- Não é necessário publicar durante o cenário do composer; o coletor apenas
  abre, foca o texto, digita `TestePOP72` e fecha.

## 5. Como rodar

```bash
# lista dispositivos
npm run perf:android -- devices

# executa a matriz (3 repetições por cenário, mínimo de calibração)
EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT=1 npm run perf:android -- run \
  --app-package com.popularia.mobile \
  --iterations 3 \
  --dataset "QA: 240 posts / 3 páginas / 3 vídeos" \
  --network "Wi-Fi local; RTT < 30 ms" \
  --cache warm \
  --video-post <id>

# sem --video-post, o cenário video é marcado skipped; o resto roda
npm run perf:android -- run --iterations 3

# compara dois commits/relatórios
npm run perf:android -- compare \
  --before artifacts/performance/<antes>/report.json \
  --after artifacts/performance/<depois>/report.json

# ou já roda e compara no mesmo comando
npm run perf:android -- run --baseline artifacts/performance/<antes>/report.json

# re-renderiza um relatório existente
npm run perf:android -- report --input artifacts/performance/<run>/report.json

# imprime a matriz e os cenários
npm run perf:android -- plan
```

Opções relevantes:

| Opção | Default | Uso |
| --- | --- | --- |
| `--serial` | primeiro `device` | obrigatório com mais de um emulador |
| `--adb` | resolução automática | caminho do `adb.exe` |
| `--iterations` | 3 | repetições por cenário |
| `--scenarios` | todos | lista separada por vírgula |
| `--min-runs` | 3 | mínimo para calibrar threshold |
| `--bridge-wait` | 1200 ms | espera do deep link de snapshot |
| `--ui-timeout` | 10000 ms | espera por labels via uiautomator |
| `--fail-on-regression` | desligado | só use depois de estabilizar a baseline |
| `--fail-on-error` | desligado | falha de passo vira exit 1 |

### Fluxo interno de uma execução

1. `?collector=reset&next=/` zera a sessão JS, grava o snapshot vazio e devolve o
   app ao feed; em feed/swipe/composer/paginação o launch não é repetido. No
   vídeo, o reset devolve o feed e o deep link da publicação é aberto em seguida.
2. `am force-stop`/Home, quando o cenário pede.
3. `am start -W` com deep link/launcher; `launch.txt` registra `TotalTime` e
   `WaitTime`. O parser também tenta a linha `Displayed ... +Nms` do logcat e
   grava `startup.displayedTimeMs` quando ela existe.
4. Espera a tela assentar e confere um label via `uiautomator dump`.
5. `dumpsys gfxinfo <pkg> reset` (para cenários de interação).
6. Amostra inicial de PSS/CPU; `dumpsys netstats` inicial.
7. Passos (`input swipe`, `input tap`, `input text`, labels).
8. Amostra final, `gfxinfo framestats`, `meminfo`, `/proc`, `netstats`.
9. `?collector=snapshot`; `run-as` lê o JSON do POP-5.
10. Salva print, XML, snapshot e `run.json`; segue para a próxima repetição.

Abertura fria/quente usa `measure: launch`: o cronômetro começa antes do
`am start -W`. Nos demais cenários o launch é preparação e não entra no tempo do
cenário.

## 6. Formato dos artefatos

### JSON (`report.json`)

Campos de topo: `schemaVersion`, `generatedAt`, `environment` (commit, branch,
device, build, pacote, dataset, rede, cache, orquestrador), `summary.scenarios`,
`thresholds`, `coverage`, `metricMatrix`, `limitations`, `comparison`, `runs`.

Cada `run` contém:

```json
{
  "scenario": "feed",
  "iteration": 1,
  "status": "ok | partial | error | skipped",
  "startedAt": "2026-11-08T12:00:00.000Z",
  "durationMs": 5000,
  "metrics": {
    "frames": { "jankPct": 4, "p95Ms": 24, "p99Ms": 40, "maxMs": 80, "interaction": {}, "jsStalls": {} },
    "memory": { "pssStartKb": 200000, "pssEndKb": 220000, "pssPeakKb": 225000 },
    "cpu": { "processPct": 25 },
    "network": { "rxBytes": 1000, "txBytes": 500 },
    "pagination": { "pagesLoaded": 3, "p95RequestMs": 400 },
    "video": { "maxFirstFrameMs": 700 },
    "app": { "requests": {}, "commits": {} }
  },
  "jsSnapshot": { "available": true, "sessionId": "perf-..." },
  "steps": [], "notes": [], "errors": [], "evidence": {}
}
```

Ausência de dado é `null`/`available: false`; nunca zero inventado.

### CSV (`runs.csv`)

Uma linha por execução, com cabeçalho estável:
`scenario,iteration,status,startedAt,durationMs,commit,device,android,buildType,
framesMeasured,jankyFrames,jankPct,frameP50Ms,frameP95Ms,frameP99Ms,frameMaxMs,
skippedFrames,interactionSamples,interactionP95Ms,jsStallProxyCount,
jsStallProxyMaxMs,startupTotalMs,startupWaitMs,pssStartKb,pssEndKb,pssPeakKb,
javaHeapKb,nativeHeapKb,cpuProcessPct,networkRxBytes,networkTxBytes,
paginationPages,paginationP95Ms,videoFirstFrameMaxMs,videoMountedNow,
videoPlayingNow,logicalRequests,paginationRequests,profilerCommits,listLoads,
snapshotAvailable,notes,screenshot`.

### Markdown (`report.md`)

Traz ambiente, matriz de cobertura, resumo por cenário, detalhe com uma linha por
execução e links para print/UI/snapshot, thresholds, comparação e limitações.
`comparison.md` é gerado quando há baseline.

## 7. Thresholds e comparação

- O threshold é calculado **por cenário e métrica** sobre as execuções do
  relatório: `max(piso_absoluto, mediana + max(3 × 1,4826 × MAD, 15% da mediana))`.
- Com menos de `--min-runs` execuções, usa o piso default e marca
  `confident: false`; a fonte fica `default`.
- Com amostras suficientes, a fonte fica `calibrated`. Ainda assim o gate é
  `advisory` e `blocking: false`: **não bloqueia merge por ruído de emulador**.
- A comparação antes/depois usa o threshold da baseline “antes” (não o “depois”)
  para não esconder uma regressão atrás de um threshold recalibrado.
- `--fail-on-regression` é uma opção explícita para uma fase posterior, quando a
  variância do laboratório estiver conhecida.

Métricas com piso default: jank 8%, frame p95 32 ms, frame p99 50 ms, frame
máximo 120 ms, interação p95 100 ms, stall proxy 200 ms, startup 4 s, PSS de pico
450 MB, CPU 70%, paginação p95 1,8 s, TTFF máximo 1,5 s. Esses valores são
provisórios e calibrados pelo próprio relatório; não são promessa de release.

## 8. Limitações explícitas

1. **Emulador não substitui aparelho.** GPU, térmica, memória do host, escala de
   CPU e virtualização mudam o resultado. O relatório marca `isEmulator: true`.
2. **Android apenas.** iOS continua exigindo Instruments/MetricKit e aparelho
   físico; o coletor ADB não cobre iOS.
3. **Frames do processo.** `gfxinfo` não separa UI thread de JS thread; JS stall
   é proxy de frame longo + commits, não long task do Hermes.
4. **PSS não é heap JS.** A amostra é pontual; picos entre amostras podem
   escapar. Não há leitura de `dumpsys meminfo` contínua.
5. **CPU é do processo.** O host do emulador e o carregamento da máquina
   influenciam; compare apenas com a mesma configuração.
6. **Rede é `netstats` do UID.** Formato varia por ROM; quando indisponível, o
   campo fica `null` com nota, nunca zero.
7. **TTFF depende do snapshot JS.** Sem a ponte (development build + flag) ou
   sem `--video-post`, vídeo fica `skipped`/`partial`; o relatório diz por quê.
   Como o snapshot é lido depois de abrir a tela de diagnóstico, `mountedNow` e
   `playingNow` são do instante da leitura; `firstFrame`/TTFF continuam válidos.
8. **Física de gesto, teclado nativo, TalkBack/VoiceOver, Reduce Motion e
   bateria/térmica continuam manuais**, conforme POP-64.
9. **Um commit por relatório.** Antes/depois exige o mesmo device, SO, dataset,
   rede, cache e configuração de profiling; caso contrário, o relatório é
   inconclusivo, não “ganho”.
10. **Sem runner em nuvem.** A execução é local; anexe os artefatos ao ticket.

## 9. Validação automatizada

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest scripts/performance/__tests__ src/features/performance/__tests__/collector-bridge.test.ts --runInBand
npx eslint scripts/performance src/features/performance/collector-bridge.ts
npx tsc --noEmit
node scripts/performance/android-perf.mjs plan
```

Os testes usam fixtures de `gfxinfo`, `meminfo`, `netstats`, `/proc`, `am start`,
`uiautomator` e um controlador ADB fake; eles provam o parsing e o fluxo do
runner, **não** um número de emulador. A primeira execução real deve ser feita
por quem tiver o emulador aberto e a build instalada; até lá, os valores são
`NÃO MEDIDOS`.

## 10. Referências

- `docs/mobile-performance-baseline.md` — instrumentação e baseline do POP-5.
- `docs/pop-64-mobile-ux-smoke-matrix.md` — cenários S1–S12 e limitações manuais.
- `src/lib/performance/index.ts` — snapshot usado pelo coletor.
- `src/features/performance/collector-bridge.ts` — ponte de reset/snapshot.
- `scripts/performance/lib/metrics-matrix.mjs` — matriz embutida no relatório.
