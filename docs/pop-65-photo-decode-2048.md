# POP-65 — decodificação de fotos de 2048 px em listas grandes

Data: 08/11/2026. Dependências: POP-5 (instrumentação) e POP-24 (foto em tela
cheia). Referências de auditoria: `12c0369`, S7 / seção 4.8; `post-media.ts`
(normalização do upload), `post-attachment.tsx` (foto do feed) e
`photo-viewer.tsx` (tela cheia).

## Resultado em uma página

**Nenhuma mudança de renderização do produto foi adotada nesta entrega.** A
recomendação é **não criar o pipeline de variantes agora** e medir em aparelho
com o harness novo antes de decidir. O motivo é que o número que decide a
variante não é o tamanho do arquivo, e sim o bitmap que o render pede:

- o feed usa `contentFit="cover"` e o `expo-image` instala com
  `allowDownscaling` ligado por padrão (a prop não é sobrescrita no cartão);
- em um telefone 1080p a 3×, um cartão de 360 DIP pede ~1080 px de largura; o
  bitmap necessário para cobrir um retrato 2:3 chega a **1080 × 1620** (~6,7 MB
  ARGB), não aos ~400 px do mockup;
- nesse mesmo aparelho, a fonte 2048² tem **16,0 MB** e a razão fonte/render
  medida pelo modelo fica entre **0,83× e 1,90×** nos oito presets do harness;
- uma variante de **512 px não cobre nem o quadro** (fica abaixo de 1× em 2× e
  em 3×) e introduziria perda visível no feed e no zoom.

Portanto: **a fonte de 2048 px não é um desperdício de 5× no feed de um aparelho
3×**. Ela é necessária para nitidez em retratos altos e no zoom. O ganho real de
uma variante dependeria de o aparelho decodificar a fonte inteira (em vez de
downsamplear no decode) ou de o cache de memória retê-la. Isso exige leitura
nativa, não estimativa.

O que foi entregue para obter essa evidência:

- harness determinístico de **120 fotos** de até 2048 px, com oito proporções,
  em `FlashList` virtualizada;
- modo de comparação com uma **variante simulada de 512 px** (mesmo host/seed),
  em sessão separada;
- instrumentação de cada foto do feed: fonte, pixels físicos do layout, bitmap
  necessário para o cover, razão fonte/render, cache e tempo até `onLoad`;
- cenário ADB `photo-feed` para coletar PSS, frames e snapshot JS;
- benchmark de modelo de memória reproduzível no host.

**O pico de memória e a contagem nativa de decodes continuam NÃO MEDIDOS em
aparelho.** O ambiente desta entrega não tinha Android/iOS acessível por ADB
(o `adb.exe` do Windows é bloqueado no sandbox). A tabela de aparelho abaixo
está deliberadamente vazia; preenchê-la é o critério de saída do ticket.

## O que o código faz hoje

| Ponto | Comportamento | Consequência para a medição |
| --- | --- | --- |
| `src/features/posts/post-media.ts` | `ImageManipulator` limita a imagem a `maxWidth: 2048`, `maxHeight: 2048` e salva JPEG a 0,82 | o teto de 2048 é do upload; arquivos legados podem ser maiores |
| `post-attachment.tsx` | `Image` com `contentFit="cover"`, `cachePolicy="memory-disk"`, `transition={180}` e `recyclingKey` | o cartão pede a URL original; o downsample nativo é permitido pelo default de `allowDownscaling` |
| `photo-viewer.tsx` | `allowDownscaling={false}` para fotos dentro de 2048² | o zoom usa a original; qualquer variante de feed não deve substituir essa fonte |
| `src/lib/performance` | eventos de foto em tela cheia já existiam (POP-24) | faltava medir a foto do feed e o tamanho efetivo do render |

O `expo-image ~58.0.18` documenta nos tipos instalados:

- `allowDownscaling` default `true`: “downscaled to match the size of the view
  container”; desligar “could negatively impact performance”;
- `enforceEarlyResizing` (iOS) default `false`: força o redimensionamento antes
  da decodificação;
- `decodeFormat` default `argb` no Android; `rgb` usa 16 bits sem alpha e reduz
  memória, mas altera a qualidade.

Nenhuma dessas props foi mudada nesta entrega. `allowDownscaling` já está no
default seguro; `enforceEarlyResizing` e `decodeFormat` são candidatos de
intervenção **somente depois** de o Profiler mostrar o custo.

## Modelo de memória (medido no host, não no aparelho)

O benchmark usa a mesma largura de cartão do feed (360 DIP) e a proporção
derivada do arquivo, com o mesmo clamp de 4:5 a 16:9 do `mediaRatio`. Ele
calcula bitmap ARGB (`largura × altura × 4`) e o bitmap para cobrir o quadro em
pixels físicos preservando a proporção da fonte (um decoder que já recorta no
decode pode usar menos). **Não é leitura de PSS nem tempo de decode.**

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest \
  --runTestsByPath benchmarks/pop-65-photo-decode-model.bench.ts \
  --testMatch '**/*.bench.ts' --runInBand --silent=false
```

#### Feed a 3× (1080p, caso comum)

| Preset | Fonte | Bitmap fonte | Necessário no cover | Bitmap necessário | Razão |
| --- | --- | --- | --- | --- | --- |
| Quadrada 2048 | 2048×2048 | 16,0 MB | 1080×1080 | 4,4 MB | 1,90× |
| Paisagem 3:2 | 2048×1365 | 10,7 MB | 1080×720 | 3,0 MB | 1,90× |
| Retrato 2:3 | 1365×2048 | 10,7 MB | 1080×1620 | 6,7 MB | 1,26× |
| Paisagem 16:9 | 2048×1152 | 9,0 MB | 1081×608 | 2,5 MB | 1,89× |
| Retrato 9:16 | 1152×2048 | 9,0 MB | 1080×1920 | 7,9 MB | 1,07× |
| Paisagem 4:3 | 1600×1200 | 7,3 MB | 1080×810 | 3,3 MB | 1,48× |
| Retrato 3:4 | 1200×1600 | 7,3 MB | 1080×1440 | 5,9 MB | 1,11× |
| Legada 900 | 900×1200 | 4,1 MB | 1080×1440 | 5,9 MB | 0,83× (amplia) |

#### Feed a 2× (720p)

| Preset | Bitmap fonte | Necessário | Bitmap necessário | Razão |
| --- | --- | --- | --- | --- |
| Quadrada 2048 | 16,0 MB | 720×720 | 2,0 MB | 2,84× |
| Paisagem 3:2 | 10,7 MB | 720×480 | 1,3 MB | 2,84× |
| Retrato 2:3 | 10,7 MB | 720×1080 | 3,0 MB | 1,90× |
| Paisagem 16:9 | 9,0 MB | 720×405 | 1,1 MB | 2,84× |
| Retrato 9:16 | 9,0 MB | 720×1280 | 3,5 MB | 1,60× |
| Paisagem 4:3 | 7,3 MB | 720×540 | 1,5 MB | 2,22× |
| Retrato 3:4 | 7,3 MB | 720×960 | 2,6 MB | 1,67× |
| Legada 900 | 4,1 MB | 720×960 | 2,6 MB | 1,25× |

Leituras:

1. O caso que mais se aproxima de “sobra” é o 2×: ainda assim, a maior razão é
   2,84×, não 5×. Uma variante de 512 px seria 2,1× menor que o necessário em 2×.
2. Em 3×, metade dos presets tem razão abaixo de 1,5×. O retrato 9:16 precisa de
   1080×1920: a fonte de 1152×2048 está no limite.
3. A foto legada de 900×1200 **já amplia** em 3×; reduzir a fonte pioraria a
   nitidez. O teto de 2048 não é o gargalo desse caso.
4. Se as 120 fotos fossem decodificadas juntas no tamanho da fonte, o modelo
   daria ~1,1 GB; no tamanho necessário, ~596 MB. A `FlashList` mantém poucas
   células montadas, então esse total é hipotético e serve apenas para mostrar
   por que a memória não pode ser estimada multiplicando 120 pelo bitmap. O
   pico real depende do cache do `expo-image` e do momento da coleta.
5. Com ~5 células montadas e o decoder entregando no tamanho necessário, a
   ordem de grandeza dos bitmaps do feed é **33–40 MB** (5 × 6,7–7,9 MB no pior
   caso 3×); um visualizador aberto soma até **16,8 MB** (2048²). Isso é modelo de bitmap, não PSS: JS, views, cache
   de disco, buffers de GPU e bibliotecas nativas ficam fora. O pico medido
   continua sendo o critério de aceite.

## Instrumentação adicionada

`src/lib/performance` ganhou um agregado separado para a foto do feed, sem
alterar os eventos da foto em tela cheia:

| Campo | Origem | Limite |
| --- | --- | --- |
| `loadCount`, `errorCount` | `onLoad`/`onError` do cartão | uma carga por mídia montada; reciclagem não herda o registro anterior |
| `cacheType` | evento do `expo-image` | `memory`, `disk` ou `none` (rede) |
| `sourceWidth/Height` | `event.source` | dimensões que o evento de carga reportou |
| `uploadWidth/Height` | metadados da API | dimensões do upload antes do downsample |
| `renderedWidthPx/HeightPx` | `onLayout` × `PixelRatio` | DIP convertido para pixels físicos |
| `neededWidthPx/HeightPx` | proporção da fonte + cover | bitmap para cobrir o quadro preservando a proporção |
| `decodedBytes` / `uploadBytes` / `neededBytes` | `w × h × 4` | estimativas ARGB, não PSS; `neededBytes` é um limite conservador |
| `sourceCoverRatio` | bitmap reportado / necessário | > 1 sobra; < 1 amplia |
| `uploadCoverRatio` | upload / necessário | potencial de economia da variante |
| `decodeEstimate` | `loads − hits de memória` | supõe disco/rede decodificando; não é contador nativo |

A tela `/diagnostico-performance` mostra **Fotos no feed**: carregamentos,
média/máximo até `onLoad`, cache, decodes estimados, maior bitmap do upload,
maior bitmap reportado pelo evento, maior bitmap necessário, razão upload/render,
razão decodificado/render e quantas fotos passam de 2×. Se a razão decodificado
for ~1 enquanto a de upload for maior, o downsample nativo aconteceu; se as duas
forem altas, o decoder manteve a fonte inteira e há candidato a intervenção. O
JSON exportado leva os eventos brutos para cruzar com o Profiler.

O harness fica em `/diagnostico-performance-fotos`, é registrado apenas em
desenvolvimento/staging e só monta com uma sessão ativa. Ele oferece:

- **Original 2048**: oito presets de 2048 px, 120 itens, lista virtualizada;
- **Variante 512**: o mesmo seed servido com 1/4 das dimensões, em sessão limpa.
  É uma simulação de host, não um contrato novo da API.

## Protocolo de aparelho (obrigatório para fechar o ticket)

### Preparação

1. Build de development/staging com
   `EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1` e `EXPO_PUBLIC_APP_ENV` diferente
   de `production`. Para o coletor ADB, também
   `EXPO_PUBLIC_PERFORMANCE_DEVICE_EXPORT=1`.
2. Android médio (60/90/120 Hz) e iPhone com recorte. Registrar modelo, RAM, SO,
   DPR, brilho e se a build tem profiling.
3. Wi-Fi estável. Para o cenário de rede, registrar se o cache está frio
   (reinstalação/limpeza) ou quente.
4. Abrir **Perfil → Conta e sessões → Diagnóstico de performance** e iniciar a
   medição; ou deep link `populariamobile://diagnostico-performance-fotos`.

### Execução manual (Android Studio / Instruments)

Para cada aparelho, cache e repetição (mínimo 3; ideal 5):

1. Zerar a medição no diagnóstico.
2. Abrir o feed de 120 fotos no modo **Original 2048**.
3. Iniciar a gravação de memória no Android Studio Profiler (Java/Kotlin +
   Native) ou no Instruments (Allocations + VM Tracker).
4. Rolar do topo ao fim em passos constantes; parar em pelo menos três pontos
   para ler PSS/RSS. Anotar o pico, não só o valor final.
5. Abrir 5 fotos em tela cheia; em cada uma, dar zoom até 4× e voltar. Conferir
   nitidez e ausência de OOM/frame preto.
6. Voltar ao diagnóstico, ler **Fotos no feed** e exportar o JSON.
7. Repetir com **Variante 512**. Comparar a mesma foto, o mesmo ponto de rolagem
   e o mesmo tempo de permanência.
8. Repetir com cache quente (sem limpar o app).
9. Rodar o cenário ADB para ter PSS/frames de forma reproduzível:

   ```bash
   npm run perf:android -- run \
     --scenarios photo-feed \
     --iterations 3 \
     --app-package com.popularia.mobile \
     --dataset "POP-65: 120 fotos / 8 presets / até 2048px" \
     --network "Wi-Fi local" \
     --cache warm
   ```

   O relatório fica em `artifacts/performance/<timestamp>/report.md`; anexe o
   `js-snapshot.json`, o print e a gravação ao ticket.

### Tabela a preencher (hoje NÃO MEDIDO)

| Aparelho | DPR | Cache | Rep. | PSS pico original | PSS pico variante 512 | `onLoad` p95 original | `onLoad` p95 variante | Decodes est. | Nitidez no feed | Zoom 4× | OOM/frame preto |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NÃO MEDIDO | — | frio | 3 | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO |
| NÃO MEDIDO | — | quente | 3 | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO |

### Como interpretar

- **PSS** é o processo inteiro, não só a foto. Compare o mesmo aparelho, build,
  rede e ponto de rolagem; não compare development com release.
- **`onLoad`** inclui rede, disco, cache e decode. Para separar decode, use o
  Profiler/Perfetto e o tempo de `onLoad` em cache quente.
- **`decodeEstimate`** é uma dedução a partir do cache, não uma contagem nativa.
  O número oficial de decodes vem do Profiler (Android) / Instruments (iOS).
- **`sourceCoverRatio`** abaixo de 1 significa que a fonte já é menor que o
  quadro; uma variante pioraria a nitidez.

## Recomendação e critérios para intervir

**Não construir o pipeline de variantes nesta entrega.** A evidência disponível
mostra que 2048 px é uma fonte próxima do necessário em 3× e que 512 px é
insuficiente. O próximo passo é medir o custo nativo; só depois escolher entre
as intervenções abaixo, nesta ordem:

1. **Garantir o downsample nativo** (já é o default): confirmar no Profiler que
   o cartão não mantém um bitmap 2048² por foto visível. Se mantiver, tornar
   `allowDownscaling` explícito no cartão (sem mudança visual esperada).
2. **`enforceEarlyResizing` no iOS**: reduz a memória da image view; exige
   comparar nitidez no feed e no zoom antes de adotar.
3. **`decodeFormat="rgb"` no Android**: só se a memória for o gargalo e a perda
   de 16 bits for aceitável; não adotar por padrão.
4. **Variante de servidor**: apenas se o Profiler mostrar que o decode da fonte
   inteira é o custo dominante ou se o cache de memória retiver bitmaps demais.
   A variante do feed deve ter **pelo menos o necessário em 3×** (referência:
   1080 px de largura; 1080×1620 para retrato 2:3) e **nunca substituir a
   original do visualizador**. Uma variante de 512 px não atende à nitidez.

Critérios objetivos para reabrir a decisão (todos com a mesma build, aparelho,
rede e dataset):

- PSS de pico do feed original exceder o baseline em **≥ 150 MB** ou ocorrer
  **OOM**/reciclagem visível durante a rolagem de 120 fotos;
- o Profiler mostrar **bitmaps 2048² retidos por cartões visíveis** (não apenas
  um decode transitório), com o cache de memória acima do orçamento definido
  para o aparelho;
- `onLoad` p95 em cache quente ficar **≥ 300 ms** por foto atribuível a decode,
  não a rede;
- a variante de 512 px **não** for visivelmente inferior no feed e no zoom 4×
  (critério de nitidez; se falhar, não é candidata).

Se o gargalo for rede/disco e não decode, uma variante de 1080–1440 px pode ser
avaliada, mas o ganho de memória só existirá se o decode nativo não estiver
reduzindo para o tamanho da view. Sem essa separação, o pipeline adiciona custo
de armazenamento, invalidação e CDN sem resolver o problema medido.

## Validação automatizada desta entrega

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest \
  src/features/posts/components/__tests__/photo-render-metrics.test.ts \
  src/features/posts/components/__tests__/post-attachment-photo.test.tsx \
  src/features/performance/__tests__/photo-harness-fixture.test.ts \
  src/features/performance/__tests__/photo-harness-screen.test.tsx \
  src/features/performance/__tests__/diagnostics.test.ts \
  src/features/performance/__tests__/performance-diagnostics-screen.test.tsx \
  src/lib/performance/__tests__/performance.test.ts \
  --runInBand --ci
```

Cobrem: conversão DIP→pixel, cover com proporção, fonte menor que o quadro,
agregado de cache/decodes/razão, registro no `onLoad`, dataset de 120 fotos,
troca de modo com sessão limpa, leitura na tela de diagnóstico e navegação para
a rota nova. Nenhum desses testes mede memória, decode nativo ou FPS.

Resultado desta entrega: **9 suítes / 60 testes focados** verdes; suíte completa
**179 suítes / 1.078 testes** verdes (`--ci --maxWorkers=2 --forceExit`, pelo
handle assíncrono já conhecido do baseline); `npm run check:fast` verde;
benchmark POP-65 verde; Playwright focado em `performance-diagnostics.spec.ts`
**1 teste** verde no Chromium, abrindo o feed de fotos e voltando ao
diagnóstico. O Playwright cobre navegação/semântica web, não memória nem decode.

## Limitações

- **Não houve aparelho Android nem iPhone.** PSS, decodes nativos, frames,
  nitidez no zoom e OOM não foram observados; a tabela de aparelho continua
  `NÃO MEDIDO`.
- O benchmark é um modelo de bitmap, não uma medição de alocação. Ele assume
  ARGB de 32 bits e não considera o formato real do decoder, cache, GPU ou
  compressão.
- O `onLoad` do `expo-image` é um evento JS; ele não separa rede, disco e decode.
- A variante de 512 é uma simulação de host (picsum com 1/4 das dimensões), não
  um contrato de API. O backend não oferece variantes hoje.
- O cenário ADB usa um emulador/aparelho com a rota de diagnóstico; sem conta
  onboarded e sem rede para o host de QA, o cenário deve ser registrado como
  não executado.
- A `FlashList` do harness mantém poucas células; o número de fotos “montadas”
  não é 120. O teste de 100+ fotos é de rolagem/reciclagem, não de 120 bitmaps
  simultâneos.

## Referências

- `src/features/posts/post-media.ts` — normalização 2048 e limite de 10 MB.
- `src/features/posts/components/post-attachment.tsx` — foto do feed, cache e
  instrumentação.
- `src/features/posts/components/photo-render-metrics.ts` — DIP→pixel, cover e
  bitmap necessário.
- `src/features/posts/components/photo-viewer.tsx` — original e zoom.
- `src/lib/performance/index.ts` — eventos e agregados.
- `src/features/performance/photo-harness-screen.tsx` — rota do harness.
- `benchmarks/pop-65-photo-decode-model.bench.ts` — modelo reproduzível.
- `docs/pop-24-photo-viewer-loading.md`, `docs/pop-72-performance-metrics-automation.md`
  e `docs/mobile-performance-baseline.md`.
