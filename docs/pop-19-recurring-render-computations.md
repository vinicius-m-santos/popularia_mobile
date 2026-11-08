# POP-19 — cálculos recorrentes no render e listeners

Data: 2026-11-09. Escopo: mobile, sem endpoint novo e sem trocar bibliotecas.

> Este documento separa **medição de computação** (reprodutível em Jest/Node) de
> **medição de dispositivo**. Nenhum ganho de FPS, frame time ou memória é
> declarado aqui: essas métricas exigem build de profiling e aparelho real, como
> descrito em `docs/mobile-performance-baseline.md`.
>
> **Atualização POP-66 (08/11/2026).** A auditoria do React Compiler confirmou
> que os caches de módulo continuam sendo o ganho real e que o Compiler absorve
> os `useMemo`/`useCallback` de `PostCard`, `ProfileScreen` e `explore-screen`.
> Também encontrou um bailout em `DiscoveryScreen` causado por um `useMemo` com
> dependências divergentes; a correção e as decisões estão em
> `docs/pop-66-react-compiler-effect.md`.

## Ponto de partida

O app já usa o React Compiler (`app.json` → `experiments.reactCompiler: true`).
Por isso a entrega evita adicionar `useMemo` apenas para repetir o que o
compilador já faz por componente. As mudanças atacam o que ele não cobre:

- funções puras chamadas por várias instâncias/telas (tokenização, calendário,
  separação de mídia);
- resolução de estilo que acontece em toda instância de `AppText`;
- estado de rolagem do perfil que re-renderizava a lista inteira;
- identidade da lista do Explorar enquanto a pessoa ainda digita;
- linhas de posts/mídia do perfil recalculadas em renders que não mudaram os
  dados.

## O que mudou

| Arquivo/hotspot | Antes | Depois |
| --- | --- | --- |
| `features/hashtags/text.ts` | `tokenizePostText` compilava regex de URL e varria o texto a cada chamada | cache limitado por texto + assinatura das menções; regex de URL hoisted |
| `components/app-text.tsx` | `StyleSheet.flatten` + cálculo de line-height em toda instância/render | estilo de variante resolvido uma vez no módulo; caminho rápido sem `style`/`color`; cache por identidade para estilos customizados |
| `features/events/format.ts` | `callSchedule` refazia parsing/`Date` por cartão | cache limitado por `(iso, fuso)` |
| `profiles/components/profile-media-grid.tsx` | filtro de mídia e três `filter` para contagens | uma passada + cache por identidade da lista de posts |
| `profiles/profile-screen.tsx` | linhas de posts/mídia e dias recalculados no corpo; estado do overlay no pai | linhas memoizadas por `postItems`/aba; overlay com estado próprio |
| `profiles/components/profile-tabs-overlay.tsx` | novo componente | `onScroll` chama um método imperativo; só o overlay re-renderiza, a lista não |
| `features/explore/explore-screen.tsx` | `rows` reconstruída a cada tecla; filtros/`slice` inline | `rows` memoizada por entradas estáveis; `items`, tópicos, opções e sugestões estáveis |

### O que **não** foi feito

- Não foi adicionado `useMemo` cego no `ChamadoCard`: os valores que dependem de
  `data` estável já são candidatos naturais do React Compiler; o ganho real de
  chamados veio do cache compartilhado de `callSchedule`.
- Não foi trocado o `onScroll` do perfil por um worklet de UI thread. O listener
  continua em JS a 16 ms (mesma semântica de limiar/delta), mas não atualiza mais
  estado do corpo do perfil. A animação da barra já roda na UI thread via
  Reanimated. Migrar o listener exigiria confirmar a integração da FlashList com
  o handler de scroll na UI thread; ficou fora para não arriscar a semântica de
  rolagem/abas.
- Nenhuma dependência foi adicionada.

## Medição de computação

Benchmark reproduzível (não é um teste de orçamento de tempo):

```bash
NODE_OPTIONS=--max-old-space-size=768 npx jest \
  --runTestsByPath benchmarks/pop-19-recurring-computations.bench.ts \
  --testMatch '**/*.bench.ts' --runInBand --silent=false
```

Execução local em 2026-11-09, Node 24.22.1, Jest 30, Linux/WSL, 1.000 iterações
por caminho:

| Função | 1.000 acertos de cache | 1.000 recálculos | Leitura |
| --- | --- | --- | --- |
| `tokenizePostText` | 1,00 ms (1,00 µs/op) | 33,00 ms (33,00 µs/op) | ~33× menos CPU no caminho repetido |
| `callSchedule` | 1,00 ms (1,00 µs/op) | 12,00 ms (12,00 µs/op) | ~12× menos CPU no caminho repetido |
| `mediaGridData` | 0,00 ms (abaixo da resolução do timer) | 11,00 ms (11,00 µs/op) | lista de 240 posts não é refiltrada por render |

Observações:

- os números variam entre execuções; a resolução de `performance.now()` no
  ambiente de teste pode arredondar o caminho de acerto para 0,00 ms;
- o caminho de “recálculo” já inclui o custo de inserção no cache, então a
  comparação é conservadora;
- isso mede CPU de funções puras no processo Node, **não** tempo de render,
  frames perdidos, FPS ou memória do aparelho.

## Evidência de comportamento

Testes adicionados/atualizados:

- `features/hashtags/__tests__/text.test.ts`: mesma entrada devolve o mesmo
  array; menção renomeada e offsets diferentes geram variantes corretas;
  `hashtagsEnabled` não compartilha resultado.
- `components/__tests__/app-text.test.tsx`: estilo de variante é reutilizado
  entre renders; line-height já adequado não aloca; ajuste é memorizado.
- `features/events/__tests__/format.test.ts`: `callSchedule` reaproveita o mesmo
  objeto para o mesmo chamado e separa fusos.
- `profiles/components/__tests__/profile-media-grid.test.tsx`: contagem em uma
  passada, cache por identidade e lista vazia sem contagem inventada.
- `profiles/components/__tests__/profile-tabs-overlay.test.tsx`: montagem
  preguiçosa, `setVisible` idempotente, `pointerEvents`/acessibilidade ao
  recolher e troca de aba preservada.
- `explore/__tests__/explore-screen.test.tsx`: enquanto o termo aguarda o
  debounce, a lista mantém a mesma identidade de `data` em vez de recriar as
  células a cada tecla.

Resultado da suíte completa:

```text
Test Suites: 149 passed, 149 total
Tests:       897 passed, 897 total
```

`npx expo lint` e `npx tsc --noEmit` passaram antes da suíte.

Fluxos web exercitados (Metro isolado da suíte E2E, Chromium único):

```text
npx playwright test e2e/specs/profile-scroll.spec.ts   → 2 passed
npx playwright test e2e/specs/explore-sticky.spec.ts   → 2 passed
```

O primeiro confirma retenção de rolagem ao voltar de publicação, troca de aba
inferior e alternância entre Publicações/Mídia com a barra de abas visível. O
segundo confirma que o campo de busca continua montado, que os controles fixos
não se perdem ao trocar resultado curto/longo e que o termo/filtro permanecem.

## Limites e validação pendente em aparelho

- Não houve validação em device nesta entrega. FPS, frame time de JS/UI, memória
  e comportamento de scroll com aparelho real continuam **não medidos**.
- O roteiro de release de `docs/mobile-performance-baseline.md` continua sendo o
  caminho para React Profiler de produção, Perfetto/Android Studio e Instruments.
  Comparar antes/depois no mesmo aparelho, rede, dataset e build.
- O benchmark cobre funções puras e não substitui o Profiler: ele mostra que o
  trabalho repetido deixou de ser executado, não que o frame ficou mais rápido.
- Caches são limitados: 200 textos × 4 variantes de menção e 200 calendários.
  As listas de mídia usam `WeakMap` por identidade, então acompanham o ciclo de
  vida dos arrays. O app trata posts como imutáveis; mutação in-place da mesma
  lista não invalida o cache.
