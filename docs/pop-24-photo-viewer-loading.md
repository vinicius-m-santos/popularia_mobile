# POP-24 — placeholder e carregamento da foto em tela cheia

Data: 08/11/2026. Escopo: `src/features/posts/components/photo-viewer.tsx`,
`post-attachment.tsx` e instrumentação de `src/lib/performance`. Sem mudança de
rota, contrato de mídia, API ou dependência.

## Problema

O `PhotoViewer` abria o `Modal` transparente com um backdrop de tinta e só
montava a `Image` depois do primeiro `onLayout`. Em cache frio, o quadro ficava
preto até a viewport medir, a imagem montar, baixar e decodificar; a transição de
120 ms ainda fazia o fade a partir do transparente. O feed já tinha o mesmo
bitmap decodificado, mas o visualizador pedia a URL original de novo sem usar
essa camada intermediária.

O contrato `PostMediaDto` oferece apenas `url`, `width` e `height` — não há
variante, thumbnail de servidor ou parâmetro de resize documentado. Inventar
`?w=`/`?q=` na URL não é aceitável: o backend não garante esse contrato. A
transição usa, então, o bitmap que o feed já decodificou e manteve no cache do
`expo-image`.

## Implementação

- **Camada imediata:** antes do primeiro layout, a viewport já mostra a listra
  escura da casa em tela cheia. Depois do layout, a listra (ou o bitmap do feed)
  fica sob a original, dentro do mesmo quadro de proporção original.
- **Variante de transição a partir do feed:** `PostPhoto` chama
  `Image.loadAsync({ uri }, { maxWidth, maxHeight })` na abertura e
  passa o `ImageRef` ao `PhotoViewer`. O limite é o quadro em pixels físicos:
  quando o feed já decodificou a foto, essa chamada aproveita o cache e devolve
  uma variante reduzida; não inventa parâmetro de resize na URL nem baixa uma
  thumbnail de servidor. A variante só é pedida depois que o feed terminou de
  carregar, para não disputar rede com a original em cache frio; antes disso, a
  listra permanece até a foto final chegar. A leitura só acontece no toque e o
  preview é liberado ao fechar — cartões fora de uso não retêm uma foto extra.
- **Sem flash preto:** a original entra com
  `transition={{ duration: 160, skipOnCacheHit: 'all' }}`. Em cache hit, aparece
  direto; em cache frio, faz cross-dissolve sobre a listra/preview. A listra
  permanece montada embaixo e vira o fallback visual de erro
  (“Não foi possível carregar a imagem.”), com fundo legível.
- **Resolução final:** `allowDownscaling={false}` para fotos dentro do teto de
  `2048 × 2048` (o mesmo limite aplicado no upload), para o zoom de 4× não usar
  o bitmap reduzido do feed. Acima desse teto, a propriedade volta a `true` para
  não arriscar um bitmap grande demais em arquivos legados; o teto é documentado
  e medido pela instrumentação.
- **Gestos preservados:** o quadro medido, a pinça, o arrasto, o duplo toque, o
  descarte e o chrome inferior continuam nos mesmos valores e handlers. A camada
  nova é `pointerEvents="none"` e não intercepta toque.

## Instrumentação: tamanho, cache e decode

`src/lib/performance` ganhou eventos de foto em tela cheia:

| Evento | Campos | Uso |
| --- | --- | --- |
| `open` | `mediaId`, `atMs` | Marca cada abertura |
| `load` | `mediaId`, `elapsedMs`, `width`, `height`, `cacheType`, `estimatedBytes` | Tempo até `onLoad` (busca + decodificação) e tamanho do bitmap |
| `display` | `mediaId`, `elapsedMs` | Tempo até a view renderizar o bitmap |
| `error` | `mediaId` | Falha de carregamento |

- `elapsedMs` vai da abertura até o evento; não é um timer nativo de decode.
- `estimatedBytes` é `width × height × 4` (ARGB de 32 bits). É uma referência
  para comparar fotos, **não** leitura de memória do aparelho.
- `cacheType` separa hit de memória, hit de disco e rede.
- A URL não entra no snapshot; só `mediaId`, dimensões e números.

A tela `/diagnostico-performance` mostra **Fotos em tela cheia**: aberturas,
média/máximo até `onLoad`, média/máximo até `onDisplay`, hits de memória/disco,
cargas de rede, erros e o maior bitmap estimado. O JSON exportado leva os
eventos brutos para alinhar com uma gravação de tela.

## Avaliação de memória

| Cenário | Bitmap estimado (ARGB) | Observação |
| --- | --- | --- |
| Foto 1080 × 1350 | ≈ 5,8 MB | tamanho comum de feed |
| Foto 1440 × 1800 | ≈ 10,4 MB | retrato grande |
| Teto do contrato 2048 × 2048 | ≈ 16,8 MB | decodificação inteira para o zoom |
| Preview de transição | até o quadro em pixels físicos | `loadAsync` com `maxWidth`/`maxHeight`; não é a original e é liberado ao fechar |
| Foto legada acima de 4,19 MP | reduzida ao tamanho da view | proteção contra OOM; zoom pode ficar mais macio |

Limites do `expo-image` que contextualizam o número: a memória é limpada com
pressão do sistema; no Android o Glide mantém até 250 MB de disco; no iOS o
SDWebImage remove entradas não lidas em uma semana e o disco não tem limite
padrão. O app mantém no máximo um visualizador aberto e solta o preview ao
fechar, então a soma transitória é a foto do feed (já existente) mais a
decodificação da original.

Esses valores são estimativas por pixels, não pico de memória medido. A medição
real (Android Studio Profiler/Perfetto e Instruments) continua pendente de
aparelho e deve usar as mesmas fotos do roteiro abaixo.

## Validação

### Automatizada

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest \
  src/features/posts/components/__tests__/photo-viewer.test.tsx \
  src/features/posts/components/__tests__/post-attachment-photo.test.tsx \
  src/lib/performance/__tests__/performance.test.ts \
  src/features/performance/__tests__/diagnostics.test.ts \
  src/features/performance/__tests__/performance-diagnostics-screen.test.tsx \
  --runInBand --ci
```

Cobrem listra antes do layout, preview do feed, resolução do zoom, eventos de
abertura/carga/exibição, estimativa de bitmap, fallback de erro e a leitura na
tela de diagnóstico.

### Aparelho (pendente)

1. Build de staging/development com
   `EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1`; uma foto já vista e uma foto
   nunca aberta (cache frio).
2. Rede lenta (ex.: perfil 3G) e modo offline: abrir a foto, fechar, reabrir.
3. Gravar a abertura a 60/120 fps e conferir que não há quadro preto entre o
   toque e a listra/preview.
4. Pinçar até 4× e conferir a nitidez da original; comparar com o preview do
   feed antes de a original carregar.
5. Medir pico de memória no Profiler/Instruments com a foto de 2048 × 2048 e
   preencher a tabela com os valores reais.
6. Conferir o snapshot: `onLoad`, `onDisplay`, `cacheType` e
   `largestDecodedBytes`; anexar o JSON e a gravação ao ticket.

**NÃO EXECUTADO em aparelho nesta entrega.** Não há iPhone/Android nem build
instalada neste ambiente; os testes de Jest comprovam comportamento, não
latência, memória ou ausência de frame preto. A análise estática também não é
métrica de performance.

## Resultado desta entrega

- `npx tsc --noEmit`: passou.
- `npx expo lint`: passou, sem avisos.
- Jest focado nas suítes de foto, performance e diagnóstico: **5 suítes,
  51 testes** verdes.
- Suíte completa: **149 suítes, 898 testes** verdes, executada com
  `--forceExit`; o processo não encerra sozinho após o resultado (handles
  assíncronos já observados em entregas anteriores).
- Playwright focado em `mobile-ux-smoke.spec.ts -g "abre a foto em tela cheia"`:
  **1 teste** verde no Chromium (web sem preview nativo, exercitando a listra e
  o fechamento acessível).

**NÃO EXECUTADO em aparelho.** Não há iPhone/Android nem build instalada neste
ambiente; não há número de memória real, latência de decode nem confirmação de
frame preto por gravação. A análise estática e o Jest não são métricas de
performance.

## Limitações

- `Image.loadAsync` é a via nativa Android/iOS; na web ela não é usada e a
  listra continua sendo o fallback. Se o feed ainda não carregou, a variante
  não é pedida: a abertura usa a listra e busca a original, sem concorrência.
- O preview é uma variante reduzida, não a original: até o crossfade ele pode
  parecer levemente mais macio que a foto final, principalmente no zoom.
- O teto de resolução é uma decisão de segurança de memória: fotos legadas
  acima de 4,19 MP ainda podem ser reduzidas pelo `expo-image`.
- `onLoad`/`onDisplay` são eventos de JS, não um perfil nativo de decode.

## Referências

- `src/features/posts/components/photo-viewer.tsx` — fallback, preview,
  resolução e eventos.
- `src/features/posts/components/post-attachment.tsx` — leitura do cache no
  toque e liberação ao fechar.
- `src/lib/performance/index.ts` — eventos e snapshot.
- `src/features/performance/diagnostics.ts` e
  `performance-diagnostics-screen.tsx` — agregação e leitura.
- `docs/pop-20-media-viewport.md` — contrato de mídia sem variante de imagem.
- `docs/pop-26-video-fullscreen-transition.md` — mesma abordagem de cobertura
  contra lacuna de surface em vídeo.
- `docs/mobile-performance-baseline.md` — instrumentação e captura nativa.
