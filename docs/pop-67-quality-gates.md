# POP-67 — políticas de qualidade e marcos de entrega da auditoria

Data: 08/11/2026. Base: `f1ab341` (`origin/main`, branch `ai/pop-67`).
Dependências: POP-5 (baseline/instrumentação), POP-63 (regressões), POP-64
(matriz de smoke/E2E) e POP-72 (métricas por cenário). Referência externa:
auditoria estática de UI/UX/fluidez no commit `12c0369`, Seção 10 / gates de
qualidade.

Este documento define **o que conta como pronto** em cada ticket da auditoria e
**o que precisa existir para aprovar cada etapa 0–5**. Ele não executa os tickets
do backlog: orquestra a evidência, registra o que foi realmente rodado e separa
claramente o que é automação local, o que é E2E web e o que exige aparelho.

> O objeto `12c0369` deste clone é o commit do gate de AI review, não o relatório
> da auditoria. O texto original da Seção 10 não está versionado aqui; o mapa de
> etapas abaixo foi reconstruído a partir dos tickets, dos documentos de POP-63/
> POP-64/POP-72 e do código atual. A ausência do relatório original é registrada
> como blocker de rastreabilidade (B-03), não como aprovação.

## 1. Resultado desta validação

| Gate | Etapa | Status | Evidência principal |
| --- | --- | --- | --- |
| 0 | Baseline e ambiente | **Aprovado com ressalva** | Commit, versões, comandos e contagens desta sessão; perfil de aparelho ainda `N/E` |
| 1 | Estática e contratos | **Aprovado** | `check:fast` com heap de 1024; lint e TypeScript verdes |
| 2 | Testes focados por invariante | **Aprovado** | Amostra de estado, dados, mídia e gestos com `--runInBand`; política Sentry coberta |
| 3 | Regressão completa | **Aprovado com falha conhecida** | 170 suítes / 1.036 testes; processo só encerra com `--forceExit` |
| 4 | E2E de navegação | **Aprovado no Chromium** | Suíte Playwright completa; física nativa não é coberta |
| 5 | Aparelho, build e observabilidade | **BLOQUEADO** | Sem iPhone/Android real; tracing do Sentry avaliado e mantido desligado |

**Decisão:** os gates 0–4 liberam a continuação do trabalho local e o merge de
mudanças que não dependam de física nativa. O gate 5 **não** está aprovado: não
há evidência de aparelho, build EAS instalada nem decisão de produto para ligar
tracing. Nenhum item `N/E` é tratado como aprovado.

Esta entrega não altera o comportamento do app: adiciona os documentos de
processo e um teste que trava a política de privacidade do Sentry. O baseline de
código continua sendo `f1ab341`; qualquer mudança posterior precisa repetir os
gates afetados.

Política canônica de observabilidade:
[`docs/observability.md`](observability.md).

## 2. Como ler os status

| Status | Significado |
| --- | --- |
| **Aprovado** | Checklist completo, comando reproduzível e saída/artefato registrados nesta entrega. |
| **Aprovado com ressalva** | O gate passou no escopo declarado, mas há uma limitação conhecida que não foi escondida. |
| **Parcial** | Existe evidência local, mas falta aparelho, backend real, build distribuível ou uma decisão de produto. |
| **BLOQUEADO** | Falta a evidência mínima; o gate não pode ser declarado aprovado. |
| **N/E** | Não executado. Sempre acompanhado do motivo. Nunca usar como sinônimo de “passou”. |

Toda métrica neste documento segue o formato:

```text
valor · método · ambiente · commit · data · n
```

Exemplo: `170 suítes / 1.036 testes · Jest 30.5.2, --runInBand --ci --forceExit ·
WSL2, Node 24.22.1 · f1ab341 · 08/11/2026 · 1 execução`.

Números sem método — print sem build, “FPS” sem instrumentação, “mais rápido” sem
antes/depois no mesmo ambiente — não entram na tabela de aprovação.

## 3. Baseline reproduzível

### 3.1 Ambiente registrado

| Campo | Valor desta execução |
| --- | --- |
| Commit de partida | `f1ab3412e3da527669c22f9410c9bf41310dbfb2` |
| Branch/worktree | `ai/pop-67` neste worktree |
| Sistema | Linux/WSL2, 08/11/2026, fuso `America/Sao_Paulo` |
| Node / npm | `v24.22.1` / `11.19.1` |
| Expo / React Native | Expo SDK 58 (`~58.0.22`) / React Native `0.88.1` |
| Jest / Playwright | `30.5.2` / `1.64.1` |
| Heap usado | `NODE_OPTIONS=--max-old-space-size=1024` para lint, TypeScript, Jest e E2E |
| Backend | Nenhum; Jest usa doubles e o E2E intercepta a API no navegador |
| Dataset E2E | 240 posts em 3 páginas, 60 documentos em 3 páginas e um PNG em data URI (`e2e/support/qa-dataset.ts`) |
| Dataset de aparelho | Não disponível nesta sessão (`N/E`) |
| Rede | Local, sem throttling; perfis 4G/3G/offline não executados |
| Build instalada | Nenhuma build EAS; web via Metro isolado do Playwright na porta 8099 |
| CI remoto | Quality e Playwright estão em `.github/disabled-workflows/`; só o AI review roda no GitHub |

O baseline **não** é uma promessa de release. Ele serve para comparar a mesma
máquina, o mesmo commit e os mesmos comandos. Um número de development não é
número de produção.

### 3.2 Comandos e resultados

```bash
# Gate 1 — estática (heap menor falha; ver falhas conhecidas)
NODE_OPTIONS=--max-old-space-size=1024 npm run check:fast

# Gate 3 — suíte completa, serial e sem watch
NODE_OPTIONS=--max-old-space-size=1024 npx jest --runInBand --ci --forceExit

# Gate 4 — navegação no Chromium; sobe e derruba o próprio Metro
NODE_OPTIONS=--max-old-space-size=1024 npm run test:e2e

# Gate 2/5 — política de privacidade do Sentry
NODE_OPTIONS=--max-old-space-size=1024 npx jest src/lib/__tests__/monitoring.test.ts --runInBand --ci
```

| Comando | Resultado observado | Saída/observação |
| --- | --- | --- |
| `check:fast` com heap 1024 | **Passou** | ESLint + TypeScript, sem erro |
| `check:fast` com heap 512 | **Falhou** | `tsc --noEmit` estourou o heap; o lint passou. Repetir com 1024 |
| Jest completo com `--forceExit` | **170 suítes / 1.036 testes passaram** em 44,33 s | Exit 0; aviso de handles abertos é anterior a esta entrega |
| Jest completo sem `--forceExit` | **Testes passaram, processo não encerrou** | Operações assíncronas remanescentes mantêm o processo vivo; usar `--forceExit` no gate |
| Playwright completo | **52 passaram, 1 `fixme` (53 no total), 0 falhas** em 5,3 min | Chromium 390×844; ver seção 5.4 |
| `monitoring.test.ts` | **7 testes passaram** | Trava tracing/PII/replay e higiene de eventos |
| Amostra do gate 2 | **8 suítes / 99 testes passaram** em 2,41 s | Estado, dados, mídia, gesto e política Sentry em `--runInBand --ci` |

### 3.3 Falhas conhecidas no baseline

| ID | Falha | Impacto | Tratamento |
| --- | --- | --- | --- |
| K-01 | TypeScript estoura heap com `--max-old-space-size=512` | `check:fast` falha sem indicar erro de código | Rodar lint e typecheck com 1024 no WSL; registrar o heap junto da evidência |
| K-02 | Jest não encerra sozinho após os testes | Comando fica pendurado e devolve exit não zero | Usar `--forceExit` no gate e manter o aviso visível; não mascarar como falha de teste |
| K-03 | Logs do Metro/Expo com `expo-router` “invalid package.json”, require cycle, `useNativeDriver`, aviso de renders da FlashList e `RNTextInput.State.currentlyFocusedInput` no blur da folha | Ruído de console; não derruba os testes | Registrar como aviso do adaptador web/Gorhom; não confundir com falha funcional. O fluxo de foco/valor passa |
| K-04 | E2E web não prova física nativa, teclado do sistema, leitor de tela, Reduce Motion, FPS ou memória | Gate 5 continua sem evidência | Executar a matriz de POP-64 em iPhone/Android real |
| K-05 | Quality e Playwright estão desativados no GitHub Actions | CI remoto não produz a evidência dos gates 1–4 | Rodar localmente no orchestrator e anexar a saída; B-02 acompanha a decisão de reativar |
| K-06 | Sessão no web vive só em memória | Recarregar depois do login não é coberto como restauração | Tratar no aparelho/build; não declarar cobertura de sessão persistente no web |

## 4. Definition of Done por ticket

### 4.1 Template obrigatório

Copie no ticket e preencha; item sem evidência não é marcado.

```markdown
## DoD — POP-xx

- [ ] Problema reproduzido antes da correção (passos, commit e resultado).
- [ ] Invariante declarado em uma frase verificável.
- [ ] Teste de regressão falha no código anterior e passa no atual.
- [ ] Testes focados executados com `--runInBand`; contagem e nomes registrados.
- [ ] `npm run check:fast` verde (heap e commit registrados).
- [ ] Suíte completa verde em `--runInBand --ci`, ou falha conhecida com link.
- [ ] E2E de navegação executado se o ticket toca rota, formulário, sessão ou voltar.
- [ ] Evidência de aparelho anexada quando o ticket toca gesto, mídia, teclado ou acessibilidade.
- [ ] Métricas acompanhadas de método, ambiente, commit, data e n.
- [ ] Blockers e tickets relacionados linkados; nenhum blocker escondido.
```

### 4.2 DoD especializado

| Tipo de ticket | Prova adicional obrigatória |
| --- | --- |
| Correção de estado/cache | Teste que falha com o comportamento antigo, mais uma asserção de que o vizinho/consumidor não foi afetado. |
| Correção de mídia | Teste de montagem/visibilidade do player e evidência de aparelho para TTFF, frame preto, pinça e áudio. |
| Correção de dados/paginação | Teste de três páginas, revalidação, rollback e item de fronteira; sem depender de rede. |
| Correção de gesto | Teste de lógica/limiar e vídeo ou gravação no aparelho; web não substitui a física. |
| Auditoria | Inventário do que foi inspecionado, achados com decisão, o que ficou fora e matriz `N/E` explícita. |
| Performance | Mesmo device, SO, dataset, rede, cache e profiling; antes/depois ou `NÃO MEDIDO`. |
| QA/processo | Checklists por etapa, comandos reproduzíveis, links de evidência e blockers com dono. |

### 4.3 Ledger por ticket

`Local` = doc e testes/automação locais existem. `Parcial` = falta evidência de
aparelho, build ou métrica. `Pendente` = sem doc dedicado neste branch. A coluna
“Prova mínima” é o DoD específico que o ticket precisa manter.

#### Etapa 1 — Estado, reatividade e feedback

| Ticket | Prova mínima | Evidência | Status |
| --- | --- | --- | --- |
| POP-13 | Listener/snapshot de um post não acorda outro; rollback não desfaz ação concorrente | [doc](pop-13-post-action-subscriptions.md) · `post-action-subscriptions.test.tsx`, `save.test.tsx` | Local |
| POP-14 | Patch de cache não notifica todos; reação/salvamento mantêm consistência | [doc](pop-14-post-action-cache-writes.md) · `post-action-consistency.test.tsx` | Local |
| POP-15 | Reducer e presença de chamado idempotentes; dois toques não duplicam estado | [doc](pop-15-interactions-idempotent-presence.md) · `interactions-reducer.test.ts`, `chamado-attendance-effect.test.tsx` | Local |
| POP-18 | Digitação não remonta o composer nem perde rascunho; foco e valor preservados | [doc](pop-18-composer-typing-isolation.md) · `composer-typing.spec.ts`, `write-draft.test.ts` | Local |
| POP-19 | Cálculos recorrentes e listeners não repetem trabalho por render | [doc](pop-19-recurring-render-computations.md) · benchmark de host e testes de tela | Local |
| POP-23 | Cache de avatar e observers têm limite e GC previsível | [doc](pop-23-avatar-cache-observers.md) · `avatar-cache.test.tsx`, `image-cache.test.ts` | Local |
| POP-30 | `mediaVisible` é por item, sem `extraData` global no feed | [doc](pop-30-media-visible-subscription.md) · `post-card-media-visibility.test.tsx` | Local |
| POP-49 | Durações/easings/pressed vêm de tokens, não de números locais | [doc](pop-49-motion-tokens.md) · `contrast.test.ts`, `motion.test.ts` | Local |
| POP-50 | Apoio, eco e salvar animam localmente sem re-render global | [doc](pop-50-reaction-motion.md) · `social-action.test.tsx` e testes do cartão | Local |
| POP-51 | Seguir, publicar e comentar confirmam estado sem mover layout | [doc](pop-51-motion-feedback.md) · testes de `follow-button` e composer | Local |
| POP-54 | Skeletons reservam o formato do conteúdo, sem spinner integral | [doc](pop-54-contextual-skeletons.md) · testes de comuna, discussão, avisos e perfil | Local |
| POP-55 | Indicador de abas e expansão de respostas assentam sem salto | [doc](pop-55-motion-indicators.md) · `underline-tabs`, `reply-expansion-motion` | Local |
| POP-56 | Reduce Motion, pressed e contraste têm política e teste | [doc](pop-56-accessibility-motion-audit.md) · `contrast.test.ts`, 13 suítes focadas | Parcial: matriz VoiceOver/TalkBack pendente |
| POP-57 | Ação social com contador é um componente único e acessível | [doc](pop-57-social-action.md) · `social-action.test.tsx` | Local |
| POP-58 | Headers editoriais e chips de filtro seguem a mesma primitive | Commit [`51f397d`](https://github.com/vinicius-m-santos/popularia_mobile/commit/51f397d) (sem doc dedicado neste branch) | Pendente: registrar doc/evidência própria |
| POP-16 | Efeito de `rememberPost` fora do render não dispara em render | Commit [`1d95159`](https://github.com/vinicius-m-santos/popularia_mobile/commit/1d95159) (sem doc dedicado neste branch) | Pendente: registrar doc/evidência própria |
| POP-17 | `CommentRow` e handlers da discussão estáveis | Commit [`6cc0a9b`](https://github.com/vinicius-m-santos/popularia_mobile/commit/6cc0a9b) (sem doc dedicado neste branch) | Pendente: registrar doc/evidência própria |

#### Etapa 2 — Mídia e viewport

| Ticket | Prova mínima | Evidência | Status |
| --- | --- | --- | --- |
| POP-20 | Tópicos/salvos não montam player fora da viewport | [doc](pop-20-media-viewport.md) · `topic-screen.test.tsx`, `saved-posts-visibility.test.tsx` | Local |
| POP-21 | Comuna mantém no máximo um player e pausa ao sair | [doc](pop-21-comuna-media-viewport.md) · `comuna-media-visibility.test.tsx` | Local |
| POP-22 | Pôster tem cache limitado e não vaza player | [doc](pop-22-poster-cache.md) · `poster-cache.test.ts` | Local |
| POP-24 | Placeholder cobre o quadro e fullscreen não pisca | [doc](pop-24-photo-viewer-loading.md) · `photo-viewer.test.tsx`, `post-attachment-photo.test.tsx` | Local |
| POP-25 | TTFF e prefetch medidos com método, não por impressão | [doc](pop-25-video-viewport-first-frame.md) · `use-list-visibility`, `use-route-media-focus` | Parcial: TTFF em aparelho `N/E` |
| POP-26 | Transição para o vídeo não deixa frame preto | [doc](pop-26-video-fullscreen-transition.md) · `video-viewer.test.tsx` | Parcial: transição nativa `N/E` |
| POP-27 | Visualizador de foto é montado sob demanda e libera alocações | [doc](pop-27-photo-viewer-allocations.md) · `photo-viewer-geometry.test.ts`, `post-attachment.test.tsx` | Local |
| POP-69 | Mídia de lista pausa ao perder foco da rota | [doc](pop-69-route-media-focus.md) · `use-route-media-focus.test.tsx` | Local: web; aparelho `N/E` |

#### Etapa 3 — Dados, listas e navegação

| Ticket | Prova mínima | Evidência | Status |
| --- | --- | --- | --- |
| POP-28 | Publicações da comuna virtualizadas sem perder posição | [doc](pop-28-comuna-flashlist.md) · `comuna-posts-list.test.tsx` | Local |
| POP-32 | Pilha das abas e TabBar não pulam ao abrir/voltar de post | [doc](pop-32-tabbar-post-stack.md) · `post-stack.spec.ts`, `tab-bar.test.tsx` | Local |
| POP-33 | Header fixo do Explorar e scroll do perfil são retidos | [doc](pop-33-sticky-header-scroll-retention.md) · `explore-sticky.spec.ts`, `profile-scroll.spec.ts` | Local |
| POP-34 | Chat invertido não cria célula em branco nem desloca leitura | [doc](pop-34-square-inverted-chat.md) · `praca-chat.spec.ts` | Local |
| POP-36 | Refresh incremental preserva páginas carregadas | [doc](pop-36-incremental-refresh.md) · `use-cached-pages.test.ts` | Local |
| POP-37 | Cache da comuna invalida após participação/edição/moderação | [doc](pop-37-comuna-cache.md) · `queries.test.tsx`, `next-event.test.tsx` | Local |
| POP-38 | Explorar, Biblioteca e Praças usam chaves e frescor consistentes | [doc](pop-38-consistency-cache.md) · `keys.test.ts` e testes de revalidação | Local |
| POP-39 | AppState/foco/avisos não duplicam a mesma revalidação | [doc](pop-39-revalidation-single-flight.md) · `revalidation.test.ts`, `unread-revalidation.test.tsx` | Local |
| POP-40 | Prefetch aquece post/perfil/comuna antes da navegação | [doc](pop-40-prefetch.md) · `prefetch.test.ts`, `post-card-prefetch.test.tsx` | Local |
| POP-41 | Voltar preserva filtros, rascunho e posição | [doc](pop-41-return-flows.md) · testes de retorno em Biblioteca, Praças, Avisos e discussão | Local |
| POP-42 | Query keys e invalidação são por entidade | [doc](pop-42-query-keys.md) · `keys.test.ts`, `invalidation.test.ts` | Local |
| POP-63 | Regressões de store, paginação, viewport e rollback ficam travadas | [doc](pop-63-qa-regressions.md) · 9 suítes / 94 testes | Local |
| POP-68 | Filtro Eventos e `/search` têm contrato e estado de erro | [doc](pop-68-explore-events-search.md) · `api.test.ts`, `explore-screen.test.tsx` | Local |
| POP-70 | E-mail não verificado explica a recusa sem toast genérico | Commit [`5288747`](https://github.com/vinicius-m-santos/popularia_mobile/commit/5288747); `chamado-attendance.spec.ts` (2 testes) | Local |
| POP-73 | “Eu vou” em chamado não mostra toast genérico | Commit [`0675c66`](https://github.com/vinicius-m-santos/popularia_mobile/commit/0675c66); `chamado-attendance.spec.ts` | Local |

#### Etapa 4 — Gestos, movimento e acessibilidade

| Ticket | Prova mínima | Evidência | Status |
| --- | --- | --- | --- |
| POP-29 | Swipe do feed roda em RNGH/UI thread e não disputa com a lista | [doc](pop-29-feed-swipe-rngh.md) · `feed-swipe.test.ts` | Local |
| POP-31 | Swipe de abas não captura trilhos horizontais | [doc](pop-31-tab-swipe-rails.md) · testes de trilhos e abas do perfil | Local |
| POP-44 | Pan de conteúdo não fecha sheet rolável; dismiss só pela alça/backdrop/back | [doc](pop-44-sheets-audit.md) · `bottom-sheet.test.tsx` | Parcial: matriz de teclado/back em aparelho `N/E` |
| POP-46 | Drag-to-dismiss assenta e não dispara fechamento duplo | [doc](pop-46-photo-viewer-drag-dismiss.md) · `photo-viewer.test.tsx` | Parcial: física em aparelho `N/E` |
| POP-47 | Thumbnail → visualizador mantém geometria e não pisca | [doc](pop-47-photo-transition.md) · `photo-viewer-transition.test.ts` | Parcial: transição nativa `N/E` |
| POP-45 | Pinça respeita o ponto focal dos dedos | Commit [`f403ce4`](https://github.com/vinicius-m-santos/popularia_mobile/commit/f403ce4); testes de geometria do viewer | Local: web; física `N/E` |
| POP-52 | Feedback háptico é contextual e não dispara em ação bloqueada | Commit [`eeabb1c`](https://github.com/vinicius-m-santos/popularia_mobile/commit/eeabb1c); testes de háptica | Parcial: motor nativo `N/E` |
| POP-53 | Altura do progresso no header do feed é estável | Commit [`a663bc0`](https://github.com/vinicius-m-santos/popularia_mobile/commit/a663bc0); testes do feed | Local |

#### Etapa 5 — Baseline, QA e entrega

| Ticket | Prova mínima | Evidência | Status |
| --- | --- | --- | --- |
| POP-5 | Instrumentação local e matriz de captura documentadas | [doc](mobile-performance-baseline.md) | Parcial: nenhum valor de aparelho medido |
| POP-64 | Matriz S1–S12 e E2E de UX mobile reproduzíveis | [doc](pop-64-mobile-ux-smoke-matrix.md) · `mobile-ux-smoke.spec.ts` | Parcial: S2/S5/S7–S12 `N/E` |
| POP-72 | Coleta/comparação de métricas por cenário com método e limites | [doc](pop-72-performance-metrics-automation.md) · `scripts/performance/__tests__` | Parcial: sem emulador/execução real |
| POP-66 | Efeito real do React Compiler medido e documentado | Branch `ai/pop-66` @ `0ea0a24` (fora da `main` nesta base) | Pendente: integrar doc/bench à `main` |
| POP-59 | Hotspots de telas extensas refatorados de modo incremental | Branch `ai/pop-59` @ `d0b0521` (fora da `main` nesta base) | Pendente: integrar doc/evidência à `main` |

Os tickets acima sem doc dedicado continuam no backlog de evidência. A ausência
de documento não invalida o commit, mas impede declarar o gate 5 daquele ticket
como aprovado.

## 5. Gates 0–5

Cada gate tem entrada, checklist, evidência e critério de saída. Um gate só
fecha quando todos os itens obrigatórios têm artefato; `N/E` com motivo é
registrado, mas não fecha o gate correspondente.

### 5.1 Gate 0 — Baseline e ambiente

**Objetivo:** garantir que os números seguintes são comparáveis.

- [x] Commit, branch e worktree registrados.
- [x] Versões de Node, npm, Expo, React Native, Jest e Playwright registradas.
- [x] Heap usado em cada comando registrado.
- [x] Dataset do E2E e ausência de dataset de aparelho declaradas.
- [x] Falhas conhecidas do baseline listadas (seção 3.3).
- [x] Backend/mocks e tipo de build declarados.
- [ ] Perfil de rede (Wi-Fi/4G/3G/offline) medido em aparelho.
- [ ] Build EAS instalada com versão/build number.

**Evidência:** seção 3 e commit `f1ab341`. **Saída:** baseline reproduzível para
quem tem a mesma máquina. **Status:** aprovado com ressalva; os dois itens de
aparelho/build permanecem `N/E`.

### 5.2 Gate 1 — Estática e contratos

**Objetivo:** impedir que o gate de comportamento esconda erro de tipo, lint ou
contrato.

```bash
NODE_OPTIONS=--max-old-space-size=1024 npm run check:fast
```

- [x] ESLint verde.
- [x] TypeScript verde.
- [x] Contrato alterado mapeado quando o ticket toca API, rota, storage ou flag.
- [x] Documento do ticket atualizado com o método e a limitação.
- [ ] `npx expo-doctor` quando houver mudança de dependência/SDK.
- [ ] Build EAS quando a mudança exigir código nativo.

**Evidência:** saída de `check:fast` com heap 1024 em 08/11/2026. **Saída:**
merge local liberado para o gate 2. **Status:** aprovado.

### 5.3 Gate 2 — Testes focados por invariante

**Objetivo:** provar o comportamento do ticket antes da suíte completa, com um
teste que falha no código antigo.

```bash
NODE_OPTIONS=--max-old-space-size=1024 npx jest \
  src/features/interactions/__tests__/interactions-reducer.test.ts \
  src/features/posts/__tests__/post-action-subscriptions.test.tsx \
  src/hooks/__tests__/use-paginated-data.test.ts \
  src/features/posts/components/__tests__/post-attachment.test.tsx \
  src/features/posts/components/__tests__/photo-viewer.test.tsx \
  src/features/posts/components/__tests__/photo-viewer-transition.test.ts \
  src/features/squares/__tests__/squares-ui.test.tsx \
  src/lib/__tests__/monitoring.test.ts \
  --runInBand --ci
```

- [x] Um teste de regressão por invariante de estado, dados, mídia e gesto.
- [x] Testes sem rede, Metro, relógio externo ou banco real.
- [x] `--runInBand`, sem watch, com contagem e nomes registrados.
- [x] Falha esperada no código antigo descrita no doc do ticket, quando houver correção.
- [ ] Teste nativo de gesto/teclado/leitor de tela (não existe em Jest).

**Evidência:** amostra executada nesta sessão (contagem na seção 3.2 e no doc de
cada ticket). **Saída:** os invariantes de maior risco estão travados. **Status:**
aprovado no escopo local.

### 5.4 Gate 3 — Regressão completa

**Objetivo:** verificar que a correção não quebrou vizinhos.

```bash
NODE_OPTIONS=--max-old-space-size=1024 npx jest --runInBand --ci --forceExit
```

- [x] 170 suítes / 1.036 testes passaram, 0 falhas, 0 snapshots.
- [x] `--runInBand` e `--ci`; sem watch.
- [x] Nenhum teste comentado, pulado sem justificativa ou snapshot atualizado às cegas.
- [x] Falhas conhecidas separadas de falhas novas (K-02, K-03).
- [x] Saída completa anexada ao ticket/PR quando o gate for usado para merge.

**Evidência:** 44,33 s, exit 0 com `--forceExit`, Node 24.22.1, commit
`f1ab341`. **Saída:** regressão local liberada. **Status:** aprovado com a falha
conhecida de handles abertos.

### 5.5 Gate 4 — E2E de navegação

**Objetivo:** provar entrada, rota, volta, recarga e guarda de sessão no app web.

```bash
NODE_OPTIONS=--max-old-space-size=1024 npm run test:e2e
```

- [x] Suíte completa executada no Chromium 390×844.
- [x] Entrada real (`/`), login, onboarding, documentos legais e guardas cobertos pelos specs existentes.
- [x] Fluxos anexos repetidos quando rota/layout/sessão mudam.
- [x] URL final, conteúdo visível, voltar do app e do navegador assertados.
- [x] Relatório/trace/screenshot não versionados; `test-results/` e `playwright-report/` no `.gitignore`.
- [ ] Física de gesto, teclado nativo, leitor de tela e mídia nativa.
- [ ] Build web de produção; a suíte usa Metro de desenvolvimento.

**Evidência:** 53 testes previstos, 52 passaram, 1 `fixme` conhecido (guarda de
“cadastro em andamento”), 0 falhas em 5,3 min; ver `docs/e2e.md` e o relatório
local. **Saída:**
navegação web liberada. **Status:** aprovado no Chromium; o gate 5 continua
obrigatório para o que o navegador não prova.

### 5.6 Gate 5 — Aparelho, build e observabilidade

**Objetivo:** fechar o que só existe no dispositivo e revisar o que sai do app.

- [ ] iPhone real com build de staging/TestFlight e versão/build anotadas.
- [ ] Android real com build de staging/development e versão/build anotadas.
- [ ] Dataset mínimo de POP-64 (200+ posts/3 páginas, 3+ vídeos, 3+ comentários).
- [ ] S1–S12 executados; S2, S5 e S7–S12 com vídeo/print/trace.
- [ ] Pinça, duplo toque, arrasto e assentamento conferidos no aparelho.
- [ ] Teclado nativo, fonte ampliada, VoiceOver/TalkBack e Reduce Motion conferidos.
- [ ] Sentry: nenhum evento/trace com conteúdo, token, e-mail, nome ou URL sensível.
- [ ] Tracing revisado e decisão registrada (ligado/desligado, sample, ambiente).
- [ ] Artefatos nomeados e anexados; nada sensível no anexo.

**Evidência desta sessão:** revisão estática do Sentry e teste de privacidade;
**nenhum** aparelho ou build EAS. **Saída:** só fecha com a matriz de POP-64
preenchida e a decisão de observabilidade. **Status:** **BLOQUEADO** por B-01,
B-04 e B-05.

## 6. Checklist por plataforma e CI/build

| Verificação | iOS real | Android real | Web/Chromium | CI/build |
| --- | --- | --- | --- | --- |
| Commit e versão/build anotados | ☐ | ☐ | ☑ `f1ab341` | ☑ commit local; CI só AI review |
| API/ambiente correto (staging/local) | ☐ | ☐ | ☑ API mockada same-origin | ☐ sem build EAS |
| Sessão ausente/restaurando/autenticada/onboarding | ☐ | ☐ | ☑ specs de entrada e guardas | ☑ Jest + Playwright locais |
| Feed 200+ posts/3 páginas e volta | ☐ | ☐ | ☑ `mobile-ux-smoke.spec.ts` | ☑ 170 suítes locais |
| Biblioteca 60 docs/3 páginas | ☐ | ☐ | ☑ `mobile-ux-smoke.spec.ts` | ☑ local |
| Vídeo: um player, mudo, pausa ao sair | ☐ | ☐ | ☐ web não representa player nativo | ☐ sem aparelho |
| Foto: pinça, duplo toque, arrasto, descarte | ☐ | ☐ | ☑ abre/fecha por toque | ☐ física nativa |
| Teclado nativo na folha | ☐ | ☐ | ☑ foco/valor; física não | ☐ sem aparelho |
| Fonte ampliada sem corte | ☐ | ☐ | ☐ não é escala nativa | ☐ sem aparelho |
| VoiceOver/TalkBack | ☐ | ☐ | ☑ papéis/nomes; locução não | ☐ sem aparelho |
| Reduce Motion | ☐ | ☐ | ☐ não é preferência nativa | ☐ sem aparelho |
| Rede 4G/3G/offline | ☐ | ☐ | ☐ E2E sem throttling | ☐ sem aparelho |
| Sentry sem PII/conteúdo | ☐ | ☐ | ☑ teste de política | ☑ 7 testes locais |
| Tracing do Sentry | ☐ | ☐ | ☑ desligado; avaliado | ☐ sem decisão de produto |
| Artefato de evidência anexado | ☐ | ☐ | ☑ relatório local | ☐ CI Quality/Playwright desativados |

**Build disponível:** os perfis EAS `development`, `staging`, `production` e
`testflight-staging` existem em `eas.json`, mas nenhum build foi gerado nesta
sessão. **CI disponível:** o GitHub roda apenas o **AI review**
(`.github/workflows/claude-review.yml`); Quality e Playwright estão em
`.github/disabled-workflows/` e não executam. A evidência dos gates 1–4 é,
portanto, **local**, conforme a decisão registrada no README dos workflows
desativados.

## 7. Avaliação do tracing do Sentry

### 7.1 Configuração atual

| Controle | Valor | Efeito |
| --- | --- | --- |
| `tracesSampleRate` | `0` | Nenhum trace de performance é enviado |
| `profilesSampleRate` | `0` | Nenhum profile é enviado |
| `replaysSessionSampleRate` / `replaysOnErrorSampleRate` | `0` / `0` | Session Replay desligado |
| `sendDefaultPii` | `false` | SDK não anexa PII padrão |
| `enabled` | DSN presente e ambiente diferente de `development` | Sentry fica desligado no desenvolvimento local |
| `beforeSend` | remove `request`, `extra`, `breadcrumbs` e `contexts.react` | Formulários, respostas e conteúdo não vão no evento |
| `beforeSend` (usuário) | mantém só `id` e fixa `ip_address: '0.0.0.0'` | Sem e-mail, nome, telefone ou IP real |
| `beforeBreadcrumb` | descarta `http` e `console` | URLs, corpos e logs não viram breadcrumb |
| `beforeBreadcrumb` (navegação) | `sanitizePath` troca UUID/numérico por `:id` | Evita cardinalidade e IDs de conteúdo |
| `captureApiError` | tags `api_path`, `http_method`, `http_status`, `request_id` | Correlação com o backend sem corpo da requisição |

O tracing de performance **do app** (`src/lib/performance/`) é outro mecanismo:
fica em memória, é opt-in em development/staging, não é enviado ao Sentry e é
lido pelo coletor POP-72. Não confundir “tracing local” com “Sentry tracing”.

### 7.2 Achados

1. **O tracing do Sentry está desligado e não há APM.** A decisão é coerente com
   o beta: o app lida com conteúdo político e privado. Não há dado de latência
   distribuída no Sentry para declarar ganho ou regressão.
2. **As sanitizações de HTTP/console em `beforeBreadcrumb` são inalcançáveis.**
   O primeiro `if` devolve `null` para `http` e `console`; os blocos seguintes
   que chamam `stripSensitiveParams`/`delete breadcrumb.data` nunca executam. O
   efeito prático é seguro (o breadcrumb inteiro é descartado), mas o código não
   deve ser citado como prova de que uma URL foi sanitizada. Se um dia o
   breadcrumb HTTP for mantido, a ordem precisa ser corrigida e testada.
3. **`setSentryRoute` não tem chamador.** A navegação não gera breadcrumb por
   esse helper hoje; o `beforeBreadcrumb` de navegação só vale para breadcrumbs
   adicionados por outro caminho. Não é vazamento, mas é cobertura incompleta.
4. **`captureApiError` usa `method: 'HTTP'` no cliente.** A tag `http_method`
   não identifica GET/POST/PUT; a correlação fina depende de `request_id` e
   `api_path`. Não é dado sensível, mas enfraquece a investigação.
5. **`sanitizePath` remove IDs, não query strings.** O cliente passa
   `new URL(response.url).pathname`, então a query não entra; a defesa é do
   chamador, não da função. Manter a regra “nunca passar URL com query” no
   contrato de `captureApiError`.

### 7.3 Decisão e critério para ligar tracing

**Decisão para o beta: manter desligado.** O custo de privacidade e a
necessidade de revisar cada span não se justificam antes de existir uma pergunta
de performance que o coletor POP-72 não responda. Se o produto pedir APM:

- ligar primeiro em **staging**, com `tracesSampleRate` baixo (começar em 0,05) e
  `profilesSampleRate` separado;
- sanitizar `transaction`/`span.description` para **template de rota**, sem IDs,
  query, corpo, título de post, nome de arquivo ou conteúdo de PDF;
- manter `sendDefaultPii: false`, Replay desligado, sem screenshot e sem request
  body;
- revisar um evento real com conta canário, sem conteúdo sensível, antes de
  produção;
- documentar dono, sample, ambiente, rollback e o critério de remoção;
- cobrir a decisão com teste (como `monitoring.test.ts`) para que uma mudança de
  SDK não ligue PII/tracing por acidente.

**Validação desta entrega:**

```bash
NODE_OPTIONS=--max-old-space-size=1024 npx jest \
  src/lib/__tests__/monitoring.test.ts --runInBand --ci
```

Resultado: **7 testes passaram** cobrindo tracing/profiling/replay em zero,
`sendDefaultPii: false`, remoção de request/extras/breadcrumbs/contexto React,
descarte de erro de rede esperado, descarte de breadcrumb HTTP/console,
sanitização de navegação, usuário só por UUID e tag de caminho sanitizada.

## 8. Blockers e riscos

| ID | Blocker/risco | Etapas afetadas | Dono sugerido | Próxima ação | Evidência |
| --- | --- | --- | --- | --- | --- |
| B-01 | Sem iPhone/Android real e sem dataset mínimo de POP-64 | 5 | QA mobile | Executar S1–S12 e anexar vídeo/print/trace | [POP-64](pop-64-mobile-ux-smoke-matrix.md) |
| B-02 | Quality e Playwright desativados no GitHub Actions | 1–4 (CI) | Infra/QA | Rodar no orchestrator local e decidir reativação; o README dos workflows já registra a decisão | `.github/disabled-workflows/README.md` |
| B-03 | Texto original da auditoria (`12c0369`, Seção 10) não está neste clone | 0 | Produto/QA | Anexar o relatório ou link permanente ao ticket | Este documento, seção 1 |
| B-04 | Tracing do Sentry desligado; não há APM | 5 | Produto/observabilidade | Aceitar “sem APM no beta” ou abrir ticket com sample/privacidade | Seção 7 |
| B-05 | Nenhum build EAS instalado nesta sessão | 5 | Mobile/QA | Gerar build de staging/TestFlight e registrar versão/build | `eas.json` |
| B-06 | Jest não encerra sozinho (handles abertos) | 3 | Mobile | Investigar com `--detectOpenHandles`; até lá, `--forceExit` documentado | K-02 |
| B-07 | E2E web não prova física nativa, teclado, leitor de tela, FPS ou memória | 4–5 | QA mobile | Manter a distinção no relatório e executar a matriz manual | K-04 / [POP-64](pop-64-mobile-ux-smoke-matrix.md) |

Nenhum blocker é “resolvido” por um print de sucesso isolado. B-01, B-04 e B-05
impedem declarar o gate 5 aprovado; B-03 mantém a rastreabilidade do gate 0
parcial; B-02 impede declarar CI remoto verde; B-06 é uma falha conhecida do
comando, não dos testes; B-07 é uma limitação de método.

## 9. Procedimento para atualizar os gates

1. **Antes de codar:** registre commit, branch, ambiente e dataset no ticket.
2. **Ao fechar o ticket:** preencha o template 4.1, rode o gate 1 e o gate 2 e
   anexe a saída. Se o ticket toca rota/formulário/sessão, rode o gate 4.
3. **Antes do merge:** rode o gate 3. Se tocar mídia/gesto/teclado/
   acessibilidade, o gate 5 continua obrigatório e o ticket fica `Parcial` até a
   evidência de aparelho.
4. **Se um gate falhar:** abra um blocker com ID, etapa, dono e próxima ação.
   Não use `--no-verify`, não comente teste e não baixe o nível do gate.
5. **Se a `main` avançar/rebase:** repita 1–4; mudança de rota/lista/gesto exige
   novo E2E. Anexe a nova saída, não reutilize a antiga.
6. **Ao aprovar uma etapa:** registre data, pessoa, comando, ambiente e artefato.
   “Não falhou” não é aprovação; `N/E` não é aprovação.
7. **Ao anexar métrica:** use o formato da seção 2. Se não houver método
   comparável, escreva `NÃO MEDIDO` e o motivo.

## 10. Referências

- `docs/pop-63-qa-regressions.md` — regressões determinísticas de store,
  paginação, viewport e rollback.
- `docs/pop-64-mobile-ux-smoke-matrix.md` — matriz S1–S12, ambiente, rede,
  dataset e evidência manual.
- `docs/pop-72-performance-metrics-automation.md` — coleta/comparação de
  métricas, thresholds e limites de emulador.
- `docs/mobile-performance-baseline.md` — instrumentação, matriz de build e
  protocolo de captura nativa.
- `docs/e2e.md` — como a suíte Playwright sobe, o que ela mocka e o que não cobre.
- `docs/ai-review.md` — gate de review e checks do PR.
- `.github/disabled-workflows/README.md` — decisão de rodar Quality/E2E
  localmente.
- `src/lib/monitoring.ts` e `src/lib/__tests__/monitoring.test.ts` — política de
  privacidade do Sentry.
- `AGENTS.md` e `CLAUDE.md` — gate de commit, validação de fluxo e regras de
  evidência.
