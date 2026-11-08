# POP-66 — efeito real do React Compiler nas otimizações propostas

Data: 08/11/2026. Dependências: POP-5 (instrumentação/baseline) e POP-19
(cálculos recorrentes). Referências: auditoria estática de UI/UX/fluidez
(commit `12c0369`), S11 / Seções 4.8 e 6, e `app.json:108`.

## 1. Resultado

- **Produção continua com o React Compiler ligado.** A base segue com
  `experiments.reactCompiler: true`; o A/B só pode desligar o Compiler em build
  de desenvolvimento. `app.config.js` recusa a variável em produção, staging e
  TestFlight.
- **O Compiler cobre os hotspots centrais de POP-19** (`AppText`, `PostCard`,
  `ProfileMediaGrid` e `ProfileScreen`) e, após a correção abaixo, também
  `DiscoveryScreen`, todos com memo cache. O `useMemo`/`useCallback` explícito
  que o Compiler consegue provar é removido do output; nesses componentes ele
  não é o mecanismo que evita o recálculo.
- **Os ganhos que continuam reais são os caches de módulo**: `tokenizePostText`,
  `callSchedule`, `mediaGridData`, `stableInterestsFor` e os estilos de variante de
  `AppText` compartilham trabalho entre instâncias/remontagens, algo que o memo cache é
  por componente e por instância e não cobre.
- **Descobrimos um ponto cego em `explore-screen.tsx`.** O `useMemo` de
  `stableInterests` usava `[interestKey]` mas lia `interests`; essa dependência
  divergente fazia o Compiler abandonar `DiscoveryScreen` inteira. A
  estabilização foi substituída por `stableInterestsFor`, um cache de módulo
  por conteúdo, e o Compiler passou a compilar a tela. O `useMemo` com deps
  divergentes continua documentado como armadilha: ele desliga o Compiler em
  produção silenciosamente (`panicThreshold: NONE`).
- **Contexto global não é resolvido pelo Compiler.** Uma mudança em qualquer
  campo do value de um provider continua notificando e renderizando os
  consumidores. O Compiler pode memoizar cálculos e JSX, mas não impede a
  notificação. Selectors, contextos separados ou stores com assinatura seletiva
  continuam sendo trabalho de arquitetura.

Este documento **não declara ganho de FPS, frame time ou memória em aparelho**.
Não houve build de release em device nesta entrega. A seção 7 deixa o roteiro
para quem tiver aparelho e build de profiling.

## 2. O que foi medido e o que não foi

| Camada | O que prova | O que não prova |
| --- | --- | --- |
| Auditoria estática (`npm run audit:react-compiler`) | Quais componentes recebem `react/compiler-runtime` e memo cache; quais `useMemo`/`useCallback` desaparecem do output | Tempo de render, frames, memória |
| Benchmark A/B (`benchmarks/pop-66-react-compiler.bench.ts`) | Em React Profiler de host: memoização por instância, necessidade de cache compartilhado, notificação de contexto e bailout por deps divergentes | FPS, frame time, memória, custo de Hermes/JS thread |
| Testes de componente e fluxo | Ausência de regressão funcional em `explore`, `AppText`, `PostCard`, grade de mídia, perfil e config de build | Física de gesto, teclado, aparelho |
| Snapshot POP-5 / coletor POP-72 | `actualDuration`, commits, `onLoad`, requests e frames quando houver build de profiling em device | Nada é medido sem aparelho/dataset |

`jest-expo` **não liga** o React Compiler por padrão: o `caller` do Babel em
`node_modules/jest-expo/src/resolveBabelOptions.js` não passa
`supportsReactCompiler`. Portanto, os testes Jest normais exercitam o código sem
o Compiler. O benchmark A/B compila o fixture explicitamente com e sem o plugin
para comparar os dois caminhos no mesmo processo.

## 3. A/B de builds

O único braço desligado permitido é o de desenvolvimento. Para reproduzir:

```bash
# Compiler ON (produção e desenvolvimento)
EXPO_PUBLIC_REACT_COMPILER=1 npx expo start --dev-client --clear

# Compiler OFF (comparação controlada, somente desenvolvimento)
EXPO_PUBLIC_REACT_COMPILER=0 npx expo start --dev-client --clear
```

Para instalar um dev client local com o braço desligado:

```bash
EXPO_PUBLIC_REACT_COMPILER=0 \
EXPO_PUBLIC_APP_ENV=development \
npx expo run:android
```

Regras do `app.config.js`:

- `EXPO_PUBLIC_REACT_COMPILER` ausente ou `1`: Compiler ligado;
- `0`: desligado, aceito apenas quando `EXPO_PUBLIC_APP_ENV=development` e
  `EAS_BUILD_PROFILE` está ausente ou é `development`;
- `production`, `staging` e `testflight-staging`: recusa `0` com erro de build;
- qualquer outro valor (`false`, `off`, `no`): erro, para não desligar por
  acidente.

O valor resolvido também fica em `extra.reactCompiler`, útil para registrar qual
braço foi instalado. Use `--clear` ao alternar o braço para o Metro não reutilizar
o cache de transformação do build anterior.

## 4. Evidência estática

Comando:

```bash
npm run audit:react-compiler
```

Saída desta entrega (Node 24.22.1, Jest 30.5.2, Linux/WSL):

```text
POP-66 — React Compiler nos hotspots da auditoria
app.json experiments.reactCompiler: true

arquivo                                                    função             compilou  caches      useMemo/useCallback no output
src/components/app-text.tsx                                AppText            sim       1           0 (fonte: 0)
src/features/posts/components/post-card.tsx                PostCardView       sim       1           0 (fonte: 1)
src/features/profiles/components/profile-media-grid.tsx    ProfileMediaGrid   sim       2           0 (fonte: 0)
src/features/profiles/profile-screen.tsx                   ProfileScreen      sim       9           0 (fonte: 12)
src/features/explore/explore-screen.tsx                    DiscoveryScreen    sim       8           0 (fonte: 9)
```

Leitura:

- `PostCard`: o `useMemo(() => chamadoCardFor(item), [item])` não aparece no
  output; o Compiler já guarda `chamadoCardFor(item)` no memo cache por instância.
  O `useMemo` da fonte é redundante em runtime com o Compiler ligado.
- `ProfileScreen`: 12 `useMemo`/`useCallback` na fonte viram 9 memo caches no
  output; o Compiler absorve as dependências e remove as chamadas de hook.
- `ProfileMediaGrid`: o Compiler compila a grade e `MediaTile`, mas o
  `mediaGridData` continua sendo cache de módulo — o Compiler não o substitui.
- `AppText`: o Compiler guarda `textStyle` por instância. O ganho extra de
  `VARIANT_STYLES` é não refazer `StyleSheet.flatten` na primeira renderização de
  cada instância e reaproveitar estilos entre montagens.
- `explore-screen`: antes da correção, `DiscoveryScreen` não tinha memo cache
  algum (só os componentes auxiliares tinham). O `useMemo` com
  `[interestKey]` lendo `interests` fazia bailout da função inteira. Depois da
  correção, `DiscoveryScreen` aparece com memo cache.

O teste `scripts/react-compiler/__tests__/compiler-audit.test.js` trava esse
contrato: os cinco hotspots precisam compilar, e um probe confirma que
`useMemo` com deps divergentes **não** recebe memo cache.

## 5. Evidência de runtime (React Profiler de host)

Comando:

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest \
  --runTestsByPath benchmarks/pop-66-react-compiler.bench.ts \
  --testMatch '**/*.bench.ts' --runInBand --silent=false
```

Execução local em 08/11/2026:

| Cenário | Sem Compiler | Com Compiler | Leitura |
| --- | --- | --- | --- |
| Valor derivado no corpo, mesmo props | 2 cálculos no mount + update | 1 cálculo; update não recalcula | O memo cache por instância cobre o caso que um `useMemo` por componente cobriria |
| Duas instâncias com o mesmo valor, com cache de módulo | 1 corpo caro | 1 corpo caro | O cache compartilhado continua necessário |
| Duas instâncias com o mesmo valor, sem cache de módulo | 2 corpos caros | 2 corpos caros | O Compiler memoiza cada instância, não compartilha resultado entre elas |
| Contexto com `label` igual e `tick` diferente | 2 renders do consumidor | 2 renders do consumidor | A notificação do provider não é bloqueada pelo Compiler |
| `useMemo` com deps divergentes | 2 cálculos | 2 cálculos e **sem** memo cache | O bailout desliga a otimização do componente inteiro |

Os tempos de `actualDuration` do host ficam em torno de 0–1 ms e são apenas
indicativos; a resolução do relógio no Jest pode arredondar para `0,00 ms`. O
teste não usa esses tempos como orçamento: ele valida a **contagem de trabalho
executado**, que é determinística.

## 6. Decisões de memoização

| Hotspot / mudança | O Compiler cobre? | Ganho real com Compiler? | Decisão |
| --- | --- | --- | --- |
| `tokenizePostText` (cache + regex hoisted) | Não entre instâncias/chamadas fora do render | Sim: mesmo texto/menções reaproveita tokenização em vários cartões e telas | Manter |
| `callSchedule` (cache por `iso`/fuso) | Não entre cartões/remontagens | Sim: chamados repetidos e várias instâncias compartilham o mesmo calendário | Manter |
| `mediaGridData` (WeakMap por lista) | Por instância; não entre `ProfileScreen` e `ProfileMediaGrid` nem após remontar | Sim: a lista de 240 posts não é refiltrada por render/aba/remontagem | Manter |
| `VARIANT_STYLES` + `withMinimumLineHeight` (WeakMap) | Por instância | Sim: evita `StyleSheet.flatten` na primeira renderização de cada `AppText` e compartilha o ajuste de line-height entre instâncias | Manter |
| `useMemo` de `chamadoCardFor` em `PostCard` | Sim | Não adicional: o Compiler remove o hook e faz o mesmo cache | Manter na fonte como fallback barato; não contar como ganho do POP-66 |
| `useMemo`/`useCallback` de linhas em `ProfileScreen` | Sim | Não adicional em runtime; o Compiler os remove e recria o cache equivalente | Manter como contrato explícito de identidade/fallback; não contar como ganho |
| `stableInterests` em `explore-screen` | Não: deps divergentes causavam bailout | O ganho era real (identidade por conteúdo), mas o `useMemo` com deps divergentes desligava o Compiler da tela | Substituído por `stableInterestsFor`, cache de módulo por conteúdo; `DiscoveryScreen` voltou a compilar sem perder a identidade |
| `useMemo` restantes de `explore-screen` | Sim (o output não tem mais hooks) | Não adicional; o Compiler assume | Manter a fonte como documentação/fallback até uma revisão de simplificação |
| Contextos `Account`/`Interactions` | Não | Não: o provider continua notificando todos os consumidores | Fora do escopo; registrar como constraint e priorizar selector/split em tarefa própria |

## 7. React Profiler em build de release (roteiro pendente)

Sem aparelho e build de profiling, não há número de release a declarar. O roteiro
mínimo, reutilizando POP-5/POP-72:

1. Instale o mesmo commit e o mesmo dev client com `--clear` nos dois braços:
   `EXPO_PUBLIC_REACT_COMPILER=1` e `EXPO_PUBLIC_REACT_COMPILER=0`.
2. Ligue a instrumentação (`EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1`,
   `EXPO_PUBLIC_APP_ENV=development`) e exporte o snapshot pelo coletor POP-72.
3. Execute o mesmo cenário nos dois braços, no mesmo aparelho, rede, cache e
   dataset: feed com 240 posts/3 páginas, rolagem, like no harness de 20 cartões,
   abertura de post e de foto.
4. Repita 5 vezes por cenário. Compare, no mínimo:
   - commits e `actualDuration` de `PostCard`/`CommentRow` (snapshot POP-5);
   - `onLoad` da FlashList e requests (POP-5);
   - frame p95/p99, jank e PSS via `dumpsys gfxinfo`/`meminfo` no POP-72.
5. Registre o braço do Compiler junto de commit, device, SO, dataset e cache. Um
   relatório sem essa marca não é comparável.

Regras de leitura:

- **Não compare development sem profiling com release.** `actualDuration` de
  development inclui overhead e não é número de release.
- **Não desligue o Compiler em produção/staging para “fechar” a comparação.**
  O guard do `app.config.js` bloqueia; um braço de release desligado exigiria uma
  justificativa independente e uma branch separada, não uma variável de ambiente.
- O benchmark de host mostra *o que* o Compiler memoiza, não *quanto* o frame
  ganhou. A conclusão de fluidez só existe com o passo 3 em diante.

## 8. Constraints da nova arquitetura

1. **O Compiler é por componente e por instância.** Caches de módulo continuam
   necessários para trabalho compartilhado entre cartões, telas e remontagens.
2. **Dependências de hooks precisam ser reais.** Um `useMemo` com deps
   divergentes derruba o Compiler do componente inteiro em produção, sem erro de
   lint/build. O auditor precisa olhar função por função, não só arquivo.
3. **Jest não prova o código compilado.** Testes de componente rodam sem o
   Compiler; o A/B explícito ou uma build web/device são necessários para cobrir
   o output real.
4. **Contexto/store continua sendo broadcast.** Memoizar o value do provider
   evita recriar o objeto, mas qualquer mudança de dependência notifica todos os
   consumidores. O Compiler não implementa seleção por campo.
5. **A build de comparação é um artefato de QA.** Ela não pode ir para produção
   nem ser promovida por engano; o `app.config.js` e os testes cobrem essa regra.

## 9. Validação desta entrega

```bash
npm run audit:react-compiler
npx jest scripts/react-compiler/__tests__ scripts/__tests__/app-config.test.js --runInBand
NODE_OPTIONS=--max-old-space-size=512 npx jest \
  --runTestsByPath benchmarks/pop-66-react-compiler.bench.ts \
  --testMatch '**/*.bench.ts' --runInBand --silent=false
npm run check:fast
```

Testes de função afetados: `explore/__tests__/explore-screen.test.tsx` (21
testes) e a suíte completa. O E2E de Explorar foi executado com Metro e o log
`React Compiler enabled`: 5 testes de `explore-sections`/`explore-sticky`
passaram. Isso valida a tela compilada no web, não o aparelho.

Também foi conferido o config resolvido pelo Expo CLI:

```text
EXPO_PUBLIC_REACT_COMPILER=1 → experiments.reactCompiler: true, extra.reactCompiler: true
EXPO_PUBLIC_REACT_COMPILER=0 (development) → false, false
EXPO_PUBLIC_REACT_COMPILER=0 (production) → erro de build
```

Resultado desta execução: `check:fast` passou; auditoria e benchmark A/B
passaram; suíte completa com **171 suítes / 1.036 testes**; E2E de Explorar com
**5 testes**. O aviso de worker do Jest (“failed to exit gracefully”) é anterior a
esta entrega e não impediu os testes de passarem.

## 10. Limitações

- Nenhum aparelho Android/iOS foi usado; FPS, frame time, memória e TTFF de
  release continuam **NÃO MEDIDOS**.
- O benchmark A/B é de host e não mede Hermes, bridge, UI thread, GPU ou
  alocação nativa.
- A auditoria usa o preset do Expo com um `caller` de Metro; ela prova a decisão
  do plugin, não o bundle final assinado.
- O `actualDuration` do React Profiler de host tem resolução de milissegundo e
  pode aparecer como `0,00 ms`; por isso o teste valida contagens.
- A comparação de release exige build de profiling e o mesmo dataset; sem isso,
  o máximo que esta entrega afirma é “o Compiler cobre estes componentes e estes
  caches continuam necessários”.

## 11. Referências

- `app.json` — `experiments.reactCompiler: true`.
- `app.config.js` — guarda do A/B e `extra.reactCompiler`.
- `scripts/react-compiler/audit.js` — auditoria dos hotspots.
- `scripts/react-compiler/compile.js` — compilação A/B com o preset do Expo.
- `benchmarks/pop-66-react-compiler.bench.ts` — React Profiler de host.
- `docs/pop-19-recurring-render-computations.md` — mudanças avaliadas.
- `docs/mobile-performance-baseline.md` — instrumentação POP-5 e roteiro de
  release.
- `docs/pop-72-performance-metrics-automation.md` — coletor ADB e comparação
  antes/depois.
