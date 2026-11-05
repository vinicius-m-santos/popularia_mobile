# Baseline de performance mobile (POP-5)

Data de criação: 05/11/2026. Escopo: instrumentação e roteiro de medição.
**Nenhum valor deste documento foi medido ainda.** A tabela de baseline abaixo
está deliberadamente vazia e marcada como `NÃO MEDIDO`; preenchê-la exige
aparelho real e os procedimentos descritos aqui. Não copie números de outra
build, de outra máquina ou de desenvolvimento como se fossem baseline de release.

## O que a instrumentação mede (e o que não mede)

O módulo `src/lib/performance/` coleta, em memória e apenas quando ligado:

| Métrica | Origem | Limite |
| --- | --- | --- |
| Requests lógicas por tela/ação, tentativas HTTP, duração, status e erro/abort | `apiResponse`/`send` em `src/lib/api/client.ts` | 400 registros em anel |
| Commits e duração de render de `PostCard` e `CommentRow` | React `Profiler` em `src/lib/performance/profiler.tsx` | 400 instâncias agregadas |
| `FlashList.onLoad` (`elapsedTimeInMs`) por lista | `PopulariaList` | 100 registros |
| Players montados/tocando, play/pause, erro e tempo até o primeiro quadro | `post-attachment.tsx` | 300 eventos |

O caminho da API é gravado **sem query string**; tokens, corpos, conteúdo de
posts, comentários e URLs assinadas não entram na coleta. Nada é enviado ao
Sentry nem à rede. A coleta é opt-in e fechada em produção.

O que a instrumentação **não** mede: FPS, frames perdidos de UI/JS, uso total de
memória, latência nativa de decodificação, temperatura ou consumo de bateria.
Para isso use Perfetto/Android Studio e Instruments, como descrito abaixo.
`elapsedTimeInMs` do `onLoad` não é TTI; `actualDuration` do Profiler inclui o
overhead do próprio Profiler e varia por build.

## Como ligar (build de diagnóstico)

```bash
EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1 \
EXPO_PUBLIC_APP_ENV=staging \
npx expo start --dev-client
```

Regras do gate em `performanceInstrumentationEnabled()`:

- default: **desligado**;
- `EXPO_PUBLIC_APP_ENV=production`: **sempre desligado**, mesmo com a flag ligada;
- build de diagnóstico não-dev (`staging`) pode ligar a flag explicitamente;
- `development` também pode ligar, mas serve só para diagnóstico.

Leitura da sessão (console de desenvolvimento ou entrada de diagnóstico):

```ts
import { getPerformanceSnapshot, exportPerformanceSnapshot, resetPerformanceSession } from '@/lib/performance';

resetPerformanceSession();       // começa uma repetição limpa
const snapshot = getPerformanceSnapshot();
const json = exportPerformanceSnapshot(); // texto local, sem upload
```

Contadores disponíveis no snapshot:

- `requestsByScreen`: requests por tela, incluindo `refreshCount` (pull-to-refresh);
- `commits`: commits por instância de `PostCard`/`CommentRow`;
- `lists`: `onLoad` por lista;
- `video`: players montados/tocando, primeiro quadro e eventos;
- `counters`: requests lógicas, tentativas HTTP, commits, `onLoad` e montagens;
- `dropped`: registros descartados pelo limite de memória.

Escopos de request são atribuídos no início de cada chamada. As listas paginadas
passam `performanceScope` (`feed`, `profile`, `topic`, `saved-posts`,
`moderation`, `relations`); requisições sem escopo aparecem como `unknown`.

### Profiler e builds

React `Profiler` só produz medições confiáveis com profiling habilitado na build
(Development Build ou build nativa com profiling). Uma build de release comum não
é equivalente: não compare `actualDuration` de development com um número de
release. O tempo de primeiro quadro do vídeo vem de `onFirstFrameRender` do
`VideoView` do `expo-video`; ele é registrado uma vez por instância de player, e
a remontagem da view na tela cheia não reinicia a contagem.

## Dataset reproduzível

`src/features/performance/qa-fixture.ts` gera, de forma determinística:

- 240 publicações, todas com mídia;
- 160 fotos e 80 vídeos;
- 3 páginas de 80 itens via cursor;
- exatamente 20 cartões para o cenário de montagem simultânea.

O harness `PerformanceQaHarness` monta esses 20 cartões. Ele **não é uma rota do
app**: para medir, monte-o numa entrada de diagnóstico temporária em um
development build, dentro dos providers normais (conta, interações, moderação,
toast e query). Depois de medir, remova a entrada temporária. Em produção o
harness não renderiza nada.

Assets:

```bash
EXPO_PUBLIC_PERF_QA_IMAGE_BASE=https://seu-cdn-ou-ambiente/qa
EXPO_PUBLIC_PERF_QA_VIDEO_URL=https://seu-cdn-ou-ambiente/qa/video.mp4
```

Os defaults do fixture apontam para imagens determinísticas do picsum e um MP4
público de exemplo. Se a rede do laboratório não alcançar esses hosts, o cenário
de mídia **não é válido** e deve ser registrado como não medido. Para baseline
sério, sirva assets próprios com dimensões, duração e cache conhecidos.

O harness usa `mediaVisible={false}` de propósito: o cenário de 20 cartões mede o
fanout de like/render sem 20 players concorrentes. O cenário de vídeo é medido
separadamente, com um ou poucos vídeos visíveis.

## Matriz de build e aparelho

Registre cada linha com todos os campos; sem isso o número não é comparável.

| Campo | Exemplo |
| --- | --- |
| Commit | `12c0369` ou hash da build |
| Build | release / development com profiling / staging |
| App | versão + build number (`expo-application`) |
| Aparelho | modelo, ano, RAM, armazenamento livre |
| SO | versão exata (Android/iOS) |
| Rede | Wi-Fi/4G/5G, latência e banda medidas, ou throttling configurado |
| Cache | frio (reinstalação/limpeza) e quente, separados |
| Dataset | QA fixture com 240 posts / conta de teste |
| Tela | brilho, tamanho de fonte, movimento reduzido |
| Repetições | 5 por cenário, valores brutos, mediana e p95 |

Mínimo para baseline: um Android intermediário real e um iPhone real. Emulador
e web não substituem aparelho. Development build serve para diagnóstico e para
validar a instrumentação; o baseline de release precisa da build de release com
os mesmos dados e a mesma rede.

## Roteiro por cenário

Para cada cenário: limpar sessão (`resetPerformanceSession`), executar o fluxo,
exportar o snapshot e anotar device/build/dataset/rede/cache. Repetir 5 vezes;
apresentar os valores brutos e a mediana. Não descartar execuções ruins sem
registrar o motivo.

1. **Abertura fria e quente**: abrir `/` (feed) com 240 posts e 3 páginas. Medir
   `onLoad`, requests iniciais e commits de `PostCard`.
2. **Rolagem**: rolar o feed por 20 cartões; capturar frames perdidos e
   JS/UI frame time nativos. Registrar commits e `onLoad` do JS ao lado.
3. **Like**: apoiar/desapoiar em um cartão; no harness de 20 cartões, medir o
   fanout de commits. Não comparar com o feed virtualizado sem dizer qual foi usado.
4. **Chamado / RSVP**: abrir um cartão de chamado e confirmar presença. É evento
   e RSVP, não chamada de voz.
5. **Paginação**: carregar pelo menos 3 páginas; medir requests por página,
   `loadingMore`, tempo até a página aparecer e commits.
6. **Pull-to-refresh**: puxar para atualizar na primeira página e no meio da
   lista; confirmar `refreshCount`, requests e `onLoad`/commits.
7. **Sheet**: abrir/fechar o menu "⋯", o sheet de denúncia e voltar; medir
   frames nativos e requests disparados. Teclado fica para o roteiro de acessibilidade.
8. **Fotos**: abrir uma foto no feed e em tela cheia; medir frames nativos,
   memória e tempo de carregamento. Repetir com cache quente.
9. **Vídeo**: com rede Wi-Fi e com throttling lento, medir TTFF (primeiro
   quadro), players montados/tocando, pausa ao sair da viewport/rota/background,
   erro de rede e retomada. Abrir a tela cheia e voltar sem duplicar player.
10. **Background/foreground**: com vídeo tocando, ir para segundo plano e voltar;
    confirmar pausa e retomada e o efeito na memória.
11. **Discussão**: abrir um post, rolar comentários, responder, apoiar e voltar
    duas vezes; medir commits de `CommentRow` e frames nativos.
12. **Busca/tópico**: abrir um tópico e paginar; medir `onLoad` e requests.

## Captura nativa

### Android

- Perfetto (`perfetto` / Android Studio Profiler): frames de UI e JS, `doFrame`,
  `Choreographer`, jank e memória do processo.
- Android Studio Memory Profiler: pico de heap Java/nativo, alocações durante
  rolagem e vídeo. Não chame heap JS de memória total do app.
- Grave o trace com o mesmo fluxo e duração de cada repetição.

### iOS

- Instruments: Time Profiler, Core Animation (FPS/frames) e Allocations/VM
  Tracker. Xcode Organizer/MetricKit para dados de builds distribuídas.
- Grave com o aparelho conectado e o mesmo dataset.

Correlacione os artefatos nativos com o snapshot JS pelo timestamp aproximado e
pelo cenário. Guarde trace, device, build, commit e rede junto da tabela.

## Baseline registrado

Preencha ao executar. Até lá, **todos os valores são NÃO MEDIDOS** — inclusive
quaisquer números antigos de documentos anteriores, que não foram reexecutados
neste ticket.

| Cenário | Device/build | Dataset/rede | Repetições | Frames perdidos | JS frame (ms) | UI frame (ms) | Memória de pico | Requests | Commits | onLoad (ms) | TTFF (ms) | Resultado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Abertura fria | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | — | NÃO MEDIDO |
| Rolagem 20 cartões | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | — | NÃO MEDIDO |
| Like (20 montados) | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | — | — | NÃO MEDIDO |
| Paginação 3 páginas | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | — | NÃO MEDIDO |
| Pull-to-refresh | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | — | NÃO MEDIDO |
| Sheet abrir/fechar | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | — | — | — | NÃO MEDIDO |
| Foto tela cheia | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | — | — | — | NÃO MEDIDO |
| Vídeo rede lenta | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | — | — | NÃO MEDIDO | NÃO MEDIDO |
| Vídeo background | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | — | — | — | NÃO MEDIDO |
| Discussão | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | — | NÃO MEDIDO |

## Comparação antes/depois

Só compare builds com o mesmo device, SO, dataset, rede, cache e flags. O baseline
"antes" exige o commit original (`12c0369` ou hash equivalente) disponível e
buildado; se esse commit não estiver acessível ou não puder ser buildado, registre
a ausência em vez de atribuir ganho. Para cada cenário, compare as 5 execuções e
reporte mediana, p95 e variância. Mudanças de instrumentação (por exemplo, mais
contadores) também precisam ser consideradas na leitura.

## Limitações desta entrega

- Nenhum aparelho Android/iOS foi usado; nenhum valor de FPS, memória ou TTFF
  foi medido.
- A instrumentação foi validada por testes unitários e de componente em Jest,
  não em device.
- O harness de 20 cartões não é uma rota; exige entrada temporária de diagnóstico.
- Os assets remotos do fixture podem não estar acessíveis no laboratório; nesse
  caso o cenário de mídia é inválido.
- React Profiler em development não é equivalente a release; a comparação de
  `actualDuration` entre builds precisa da mesma configuração de profiling.
