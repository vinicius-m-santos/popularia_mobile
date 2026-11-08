# POP-60: decisão condicional FlashList 2 × Legend List

Data: 08/11/2026. Base: `1360c6f` (main). Escopo: decisão de biblioteca de
listas; sem mudança de rota, API, contrato ou dependência.

Referência do ticket: auditoria de fluidez (inspeção estática) no commit
`12c0369`, Seção 7 / decisão de biblioteca. O texto dessa auditoria não está
versionado neste clone — a mesma limitação já registrada em POP-33, POP-34 e
POP-47 —, então a avaliação abaixo parte do código atual, da instrumentação
POP-5 e de medições de host, não de conclusões atribuídas ao documento ausente.

## Decisão

**Manter a FlashList 2.3.2 como lista virtualizada padrão. Não instalar a Legend
List e não abrir a comparação A/B nesta fase.**

O gatilho do ticket não foi atendido: não há bug reproduzível reportado ou
observado na evidência disponível (código, testes host e instrumentação) de
células em branco, rolagem ou posição na comuna virtualizada. A comuna usa a mesma `PopulariaList` reciclável desde o
POP-28. Os cenários host disponíveis cobrem reciclagem, paginação, revalidação
e posição de perfil. Eles não incluem detector de blank cells nem física
nativa; portanto, não confirmam nem descartam esse sintoma. `scrollToIndex`
existe no caminho de memória de rolagem (`useListScrollMemory`), mas não é
exercitado com um alvo distante nesses testes — por isso ele continua
explicitamente no protocolo de benchmark.

A decisão é condicional, não definitiva: se o gatilho for reproduzido em
aparelho, o protocolo da seção “Quando abrir a comparação” define o benchmark
com dataset idêntico e as métricas exigidas. Sem esse gatilho, trocar de
biblioteca seria uma migração especulativa.

| Pergunta | Resposta nesta entrega |
| --- | --- |
| Existe bug reproduzível de blank cells/scroll/posição? | Não na evidência disponível; não reproduzido em aparelho porque não houve aparelho |
| A comparação A/B está justificada agora? | Não |
| A Legend List foi instalada? | Não; `package.json` e `package-lock.json` não a contêm |
| Qual lista continua sendo o padrão? | FlashList 2.3.2, através de `PopulariaList` |
| Quando revisitar? | Quando um dos gatilhos objetivos da seção seguinte for reproduzido |

## Dependências e contexto

- **POP-5 (instrumentação)** está implementado em `src/lib/performance/`.
  Mede requests, commits de `PostCard`/`CommentRow` via React Profiler,
  `FlashList.onLoad`, viewport de vídeo e eventos de player. **Não mede FPS,
  frame time, memória total nem jank nativo** — essas métricas exigem
  Perfetto/Android Studio ou Instruments, como já registrado em
  `docs/mobile-performance-baseline.md` e `docs/pop-72-performance-metrics-automation.md`.
- **POP-28 (comuna virtualizada)** está implementado: a lista de publicações da
  comuna é uma `PopulariaList` (FlashList 2), com células recicláveis,
  `getItemType`, `stickyHeaderIndices` na barra de abas e viewability de mídia.
  O fixture de QA tem 240 publicações (160 fotos, 80 vídeos) em 3 páginas de 80.
- **POP-34 (chat invertido)** já decidiu manter a `FlatList` nativa da Praça.
  `square-screen.tsx` não usa FlashList e não é candidato a esta migração.
- A comuna virtualizada é o marco de partida do ticket. Ela existe; o segundo
  marco — bug reproduzível — não existe na evidência atual.

## Mapa do que seria migrado

`PopulariaList` é o adaptador central, mas a API da FlashList vaza para as telas.
Uma troca de biblioteca não é um diff de uma linha:

| Arquivo | Uso atual | Impacto de uma troca |
| --- | --- | --- |
| `src/components/list/popularia-list.tsx` | `FlashList`, `FlashListProps`, `FlashListRef`; defaults de teclado, refresh, paginação, empty/error e `onLoad` | Precisa de adaptador ou reescrita do contrato público |
| `src/features/comunas/comuna-screen.tsx` | `PopulariaList<ComunaRow>`, `FlashListRef`, `getItemType`, `stickyHeaderIndices`, `stickyHeaderConfig`, viewability | Sticky header e tipos de célula são específicos da FlashList 2 |
| `src/features/profiles/profile-screen.tsx` | `PopulariaList<ProfileRow>`, `FlashListRef`, `scrollToOffset`, viewability | `scrollToOffset` e posição de abas precisam de equivalente |
| `src/app/(tabs)/(inicio)/index.tsx` | `PopulariaList`, `FlashListRef` | Scroll ao topo e viewport de mídia |
| `src/features/notifications/notifications-screen.tsx` | `PopulariaList`, `FlashListRef` | Scroll ao topo e leitura de avisos |
| `src/hooks/use-list-visibility.ts` | Tipo `ViewToken` importado de `@shopify/flash-list` | O formato do token de viewability precisa de adaptador |
| Demais consumidores (`events`, `attendees`, `topic`, `saved-posts`, `relations`) | `PopulariaList` e props genéricas | Regressão funcional em listas curtas e paginadas |

Hoje há **1 adaptador e 9 arquivos consumidores** de `PopulariaList`, além do
próprio adaptador e de **4 telas de produção** que importam `FlashListRef`
diretamente (`(inicio)/index.tsx`, `comuna-screen.tsx`, `profile-screen.tsx` e
`notifications-screen.tsx`), e **1 hook** que depende de `ViewToken`. Uma
migração precisa preservar, no mínimo:

- reciclagem e altura dinâmica;
- `stickyHeaderIndices` e `stickyHeaderConfig` da comuna;
- `maintainVisibleContentPosition`/retenção de posição no retorno de detalhe;
- `onViewableItemsChanged` e `viewabilityConfig` para mídia;
- `scrollToOffset`/`scrollToIndex`, inclusive o fallback de índice não medido;
- `getItemType`, `keyExtractor`, header/footer, refresh control e `onLoad`;
- o comportamento de estados vazio/erro/paginação do adaptador.

## O que foi verificado agora

1. **Inspeção estática** dos quatro arquivos citados no ticket e de todos os
   consumidores de `PopulariaList`.
2. **Testes host focados** da comuna, do perfil e da Praça. A comuna mantém 240
   publicações no fixture e verifica reciclagem (menos de 40 cartões montados,
   nunca 240), paginação, revalidação e viewability. O perfil cobre troca de
   abas, posição e retorno. A Praça cobre a `FlatList` invertida, que não é
   objeto desta migração.
3. **Nenhuma instalação da Legend List**, nenhuma alteração de dependência e
   nenhuma tela de benchmark adicionada ao app.

O que isso **não** prova: os testes Jest usam o renderer de host, com medidas de
layout simuladas. Eles não reproduzem a física de rolagem nativa, a
reciclagem sob fling, a pressão de memória nem as células em branco de iOS e
Android. A ausência de bug no host é evidência de contrato, não validação em
aparelho.

### Resultado da validação executada

```bash
NODE_OPTIONS=--max-old-space-size=1024 npm run check:fast
# ESLint e TypeScript passaram

NODE_OPTIONS=--max-old-space-size=512 npx jest \
  src/features/comunas/__tests__/comuna-posts-list.test.tsx \
  src/features/profiles/__tests__/profile-screen.test.tsx \
  src/features/squares/__tests__/squares-ui.test.tsx \
  --runInBand --ci
# 3 suítes / 39 testes passaram
```

Detalhe por suíte: `comuna-posts-list` 12 testes, `profile-screen` 11,
`squares-ui` 16. Nenhum teste novo foi necessário porque nenhum comportamento
de produto mudou; a decisão é documental e o contrato da lista continua coberto
pelos testes existentes.

E2E não foi executado nesta entrega: não há mudança de navegação, rota,
autenticação ou formulário. O spec `e2e/specs/profile-scroll.spec.ts` já cobre a
retenção de posição no perfil e permanece como regressão para uma futura
migração.

## Quando abrir a comparação

A comparação só deve ser aberta quando **um** destes cenários for reproduzido
em aparelho, com gravação e offsets, na build atual com FlashList:

| Gatilho | Assinatura mínima |
| --- | --- |
| Blank cells | Após a rolagem assentir, uma área visível fica sem célula renderizada; ou um buraco maior que 2 px persiste por mais de um frame em pelo menos 3 de 5 repetições |
| Salto de rolagem | Ao paginar, revalidar, voltar de detalhe ou trocar de aba, o offset ou a âncora visível muda sem gesto do usuário |
| Prepend | Inserir itens acima da viewport move a âncora; o conteúdo em leitura sai do lugar |
| `scrollToIndex`/`scrollToOffset` | O alvo não fica visível, cai em índice errado, dispara falha não tratada ou deixa buraco no caminho |
| Sticky header | A barra fixa da comuna some, pula ou cobre conteúdo de forma reproduzível |

O gatilho precisa ser **funcional e reproduzível**, não uma impressão de
fluidez. “Parece mais rápido” não abre a comparação. Também não abre se o
problema for de layout, mídia, cache ou dados: nesse caso, a correção é no
causador, como já aconteceu em POP-33 (scroll pendente) e POP-34 (atalho que
encolhia a viewport).

Se o problema for reproduzido mas puder ser corrigido na FlashList com custo
menor que a migração, a correção vem primeiro. A troca de biblioteca não é
tratamento para um bug que o adaptador atual consegue resolver.

## Protocolo de benchmark (somente se o gatilho for confirmado)

### 1. Congelar a reprodução

- Gravar a tela do aparelho com o bug, anotando build, commit, aparelho, SO,
  dataset, rede, cache e o gesto/offset exato.
- Repetir 5 vezes no mesmo aparelho e build. Se não repetir, o gatilho não está
  confirmado.
- Reproduzir em Android e iOS. Se o bug for exclusivo de uma plataforma, a
  comparação ainda precisa cobrir as duas para não trocar um problema por
  outro.

### 2. Dataset idêntico

Usar o mesmo array, a mesma ordem, os mesmos `keyExtractor`, `getItemType`
(equivalente), `renderItem`, estilos e viewport nas duas variantes. Não trocar
o cartão, a foto, o texto ou o número de páginas entre A e B.

Datasets mínimos:

| Dataset | Conteúdo | Para exercitar |
| --- | --- | --- |
| Misto | `buildQaFeedItems(240)` / `qaFeedPage`: 160 fotos, 80 vídeos, 3 páginas de 80 | Reciclagem, mídia, viewability, altura variável |
| Texto variável | 240 posts, 1–6 linhas, títulos ocasionais, sem mídia | Altura dinâmica e fling sem custo de imagem |
| Mídia alta | Retratos 4:5 e paisagens 16:9, com proporções diferentes | Células altas, blank cells e memória |
| Prepend | Primeira página + 80 itens inseridos acima da viewport | Âncora e `maintainVisibleContentPosition` |

O dataset misto já existe em `src/features/performance/qa-fixture.ts` e é o
mesmo usado no POP-28. Os demais podem ser derivados dele, sem inventar
conteúdo ou métricas.

### 3. Variantes A/B

- **A:** build atual, FlashList 2.3.2, sem alterações.
- **B:** branch descartável com a Legend List instalada apenas ali, via
  `npx expo install` (nunca `npm install` direto), e um adaptador mínimo que
  reproduza o contrato de `PopulariaList`.
- A instalação e a build nativa da variante B **não entram na main** nesta fase.
- As duas variantes usam a mesma build de diagnóstico, com React Profiler
  habilitado quando a métrica for commits. Não comparar development com
  release.

Antes de medir, conferir na variante B: peer dependencies, suporte a Expo SDK 58,
React Native 0.88.1, React 19.3.0, nova arquitetura, web usado pelos testes,
sticky header, viewability, `scrollToIndex`, refresh control e `getItemType`.
Se algum item do contrato não tiver equivalente, a migração já está reprovada
por custo/risco, independentemente de frame time.

### 4. Cenários piores

Executar em Android e iOS, com o mesmo aparelho/classe de hardware e a mesma
rede:

1. Abrir a comuna com 240 posts e rolar do topo ao fim, carregando as 3 páginas.
2. Fling rápido de ida e volta (no mínimo 10 gestos), amostrando a viewport
   durante e depois da rolagem.
3. Repetir com o dataset de texto variável e com o de mídia alta.
4. Inserir 80 itens acima da viewport enquanto a pessoa lê o meio da lista;
   comparar âncora e offset antes/depois.
5. `scrollToIndex` para um índice distante (por exemplo 220), voltar ao topo e
   repetir; medir sucesso, tempo e buracos.
6. Trocar Posts ↔ Mídia no perfil e Posts ↔ Regras ↔ Membros na comuna,
   voltando à aba anterior.
7. Abrir uma publicação e voltar; puxar para atualizar no meio da lista; mandar
   o app para segundo plano e retornar.
8. Repetir com cache frio e quente, registrando qual foi usado.

### 5. Métricas e como medir

| Métrica | Como medir | Limite / cuidado |
| --- | --- | --- |
| Commits | React Profiler: `recordProfileCommit` para `PostCard`; na variante de benchmark, envolvendo as linhas com um Profiler temporário | `actualDuration` inclui overhead do Profiler; comparar builds equivalentes |
| Mounts | Commits de fase `mount` por instância + contador temporário de montagem de linha; `counters.videoMounts` para players | Não confundir itens carregados com células montadas |
| Frame time | Android: `gfxinfo framestats` / Perfetto; iOS: Instruments (Core Animation/Time Profiler) | p50, p95, p99, máximo, jank % e frames lentos; emulador não substitui aparelho |
| Memória | Android: `dumpsys meminfo` (PSS); iOS: Allocations/VM Tracker | PSS é do processo, não heap JS; estimativa de bitmap não é memória |
| Prepend | Offset e `top` de uma âncora antes/depois; nº de amostras com buraco | Registrar delta em px e tempo até assentar |
| `scrollToIndex` | Índice pedido, índice/offset final, visibilidade do alvo, callback de falha e tempo | Incluir alvo fora da janela e índice inexistente |
| Blank cells | Amostragem da viewport durante o fling + inspeção de vídeo quadro a quadro; buraco > 2 px | Sem aparelho, não declarar ausência |
| `onLoad` | `lists` do snapshot POP-5 | É tempo da FlashList até desenhar itens; não é TTI e pode não ter equivalente na Legend List |

Coletar 5 execuções por cenário e usar mediana/p95, não o melhor caso. O mesmo
operador, aparelho, build e dataset devem valer para A e B. A ordem A/B pode
alternar entre execuções para reduzir viés térmico.

### 6. Critério de troca

A troca só é aprovada se **todas** as condições abaixo forem verdadeiras:

- [ ] O gatilho foi reproduzido na variante A, em aparelho, com gravação.
- [ ] A variante B elimina o gatilho nas 5 execuções e não introduz crash,
      perda de conteúdo, salto de posição ou falha de acessibilidade.
- [ ] Há ganho relevante em pelo menos uma métrica primária, pré-registrada
      antes da coleta. Proposta para este ticket: **≥ 20% de melhora em p95 de
      frame time ou em jank %, ou eliminação completa do blank cell
      reproduzido**, sem regressão > 5% nas demais métricas primárias.
- [ ] Memória e mounts não pioram de forma consistente; se piorarem, o ganho
      funcional precisa compensar e ser registrado.
- [ ] O contrato da seção “Mapa do que seria migrado” está coberto: sticky,
      viewability, `scrollToIndex`, prepend, refresh, altura dinâmica e estados.
- [ ] A variante B passa lint, TypeScript, testes focados e, se a migração
      tocar navegação ou fluxo, o E2E previsto no `AGENTS.md`.
- [ ] O custo de migração (adaptador, 9 consumidores, tipos, testes, build
      nativa, manutenção de mais uma dependência) é menor que o custo de manter
      e corrigir a FlashList.

Se B tiver apenas paridade, ou ganhar em uma métrica e perder em outra sem
resolver o gatilho, a decisão é **manter a FlashList**.

### 7. Matriz de decisão

| Resultado | Decisão |
| --- | --- |
| Gatilho não reproduzido | Encerrar a spike; manter FlashList |
| Gatilho reproduzido e corrigível na FlashList | Corrigir na FlashList; não migrar |
| Gatilho reproduzido, sem correção viável, B resolve e atende ao critério | Avaliar migração com o custo detalhado |
| B resolve, mas regride em outra plataforma/métrica primária | Manter FlashList |
| B só empata ou melhora de forma marginal | Manter FlashList |

## Riscos da migração

- **Sticky header:** a comuna depende de `stickyHeaderIndices` e
  `stickyHeaderConfig`; uma API diferente pode exigir overlay manual e mudar o
  comportamento do hero reciclável.
- **Viewability:** o hook `use-list-visibility` tipa `ViewToken` da FlashList;
  tokens com formato/cadência diferentes podem atrasar a montagem de players ou
  quebrar a medição de viewport.
- **Posição:** `scrollToOffset`, `maintainVisibleContentPosition` e revalidação
  de páginas precisam manter a âncora; é exatamente o tipo de regressão que o
  ticket manda evitar.
- **Reciclagem e mídia:** `expo-image`/`expo-video` dependem de `recyclingKey` e
  de desmontar a mídia fora da viewport; trocar o motor de reciclagem pode
  reintroduzir mídia presa na célula errada.
- **Plataforma:** mais uma dependência nativa, com impacto em development
  build, iOS, Android, web dos testes e futuras atualizações de Expo/RN.
- **Custo de teste:** 9 consumidores e testes de fumaça teriam que passar a
  cobrir duas implementações ou o adaptador precisa absorver toda a diferença.

## O que não foi validado

- **Nada foi executado em aparelho ou emulador Android/iOS nesta entrega.**
  Blank cells, física de rolagem, sticky nativo, `scrollToIndex` real, memória,
  FPS e frame time continuam **não medidos**. Não há afirmação de ganho de
  fluidez.
- **Não houve benchmark A/B.** A Legend List não foi instalada, conforme o
  ticket. Sem o gatilho, não há comparação legítima a fazer.
- **Não houve medição de memória, commits em release ou frame time nativo.**
  Os 39 testes verdes são de host e não substituem aparelho.
- **A auditoria `12c0369`, Seção 7, não está versionada neste clone.** A decisão
  se apoia no código atual e nas dependências POP-5/POP-28, não em números
  atribuídos ao documento ausente.
- **E2E não foi executado** porque a mudança é apenas documental e não altera
  navegação, rota, autenticação, onboarding ou formulário.

## Critérios de aceite

- [x] Documento de decisão registrado, com gatilho objetivo e protocolo de
      benchmark condicional.
- [x] FlashList preservada por padrão; Legend List não instalada.
- [x] Nenhuma troca sem regressão demonstrável e ganho relevante: a regra está
      explícita na seção “Critério de troca”.
- [x] `npm run check:fast` e testes focados (`--runInBand`) verdes.
- [ ] Comparação iOS/Android com cenários piores — **não executada**; só faz
      sentido depois de um gatilho reproduzido em aparelho.
- [ ] Validação em aparelho do comportamento atual da FlashList — **pendente de
      aparelho**; não declarada como aprovada.
