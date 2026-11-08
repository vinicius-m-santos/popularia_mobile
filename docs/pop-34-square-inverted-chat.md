# POP-34: renderização e estado do chat invertido da Praça

Data: 11/11/2026. Base: `4aafa52` (main após POP-47). Escopo:
`src/features/squares/square-screen.tsx`, o fixture de Praça do E2E e testes
focados. Sem mudança de rota, API, contrato de mensagens ou dependência.

Referência do ticket: auditoria estática de fluidez no commit `12c0369`,
Seções 4.3 e 7, e `square-screen.tsx:195-223`. O texto da auditoria não está
versionado neste clone (o commit `12c0369` deste repositório é a correção do
gate de review), então a avaliação abaixo partiu do código atual e de medições
próprias, não de conclusões atribuídas ao documento ausente.

## Decisão

**Manter a `FlatList` invertida. Não houve migração para FlashList.**

A lista em si passou nos cenários medidos: prepend de página antiga preservou o
offset e a mensagem-âncora exatamente, mensagens novas não entraram no trecho
histórico e a rolagem programática não deixou células em branco. O único
problema real reproduzido não estava na lista: o atalho “novas mensagens” era
um irmão no fluxo do layout e, ao aparecer, encolhia a viewport em 52 px
(36 px do botão + 8 px de margem em cada lado), deslocando o trecho em leitura.
Isso foi corrigido sobre a `FlatList` existente, sem trocar a biblioteca.

A FlashList já é dependência do projeto, mas a migração não resolveria esse
deslocamento por si só e trocaria o mecanismo de inversão, janela e
`maintainVisibleContentPosition` sem ganho medido. Fica descartada como
migração especulativa.

## Implementação atual da lista

- `data` em ordem decrescente de ID (mais nova primeiro), `inverted`: o índice 0
  fica no fim visual e o histórico antigo é anexado ao fim do array, no topo
  visual.
- `initialNumToRender=20`, `maxToRenderPerBatch=12`, `windowSize=9`,
  `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`,
  `scrollEventThrottle=100` e `onEndReachedThreshold=0.25`.
- `onEndReached` carrega a página anterior; o rodapé também oferece
  “Mensagens anteriores”.
- Fora do fim, o polling não insere mensagens novas na janela: incrementa
  `newCount` e mostra o atalho. No fim, a mensagem nova é mesclada no índice 0.
- `mergeMessages` preserva referências de linhas inalteradas, reconcilia
  `clientId` e limita a janela (200/250). Ao passar de 200 ao ler histórico,
  `loadOlder` preserva o trecho antigo e sinaliza `hasRecentGap` para “Ir às
  recentes”.
- O separador de dia e o divisor “Novas mensagens” são renderizados depois da
  linha; na lista invertida isso os coloca acima dela, como pretendido.

## Correção aplicada

`src/features/squares/square-screen.tsx`:

- a lista e o atalho passaram a viver em um `View` `flex: 1` (`messagesArea`);
- o atalho virou uma sobreposição absoluta no rodapé dessa área
  (`newWrap`, `pointerEvents="box-none"`), mantendo o botão tocável e sem
  consumir altura da lista;
- `testID="square-messages"` identifica a lista nas medições, sem efeito visual.

O botão continua no mesmo ponto acima do composer; o que mudou é que ele deixa
de reservar altura e passa a flutuar sobre o rodapé da lista.

## Matriz de reprodução e métricas

Ambiente: Chromium 390×844, `expo start --web` isolado na porta 8099, API
mockada, 120 mensagens (4 páginas de 30), texto de duas linhas por mensagem.
`scrollTop=0` é o fim visual da lista invertida; valores maiores sobem para o
histórico. A altura útil da lista foi 711 px. Nada aqui foi executado em
Android/iOS.

| # | Cenário | Antes | Depois | Resultado |
| --- | --- | --- | --- | --- |
| 1 | Abrir com 120 mensagens, página inicial de 30 | `scrollTop=0`; sequência visível 116→120, sem buraco | igual | fim visual correto; 5 linhas visíveis |
| 2 | Rolar para 1500 e carregar anteriores sem auto-scroll | `scrollTop=1500`; âncora 106 em `top=-9`; gaps -1/0/-1/0 | `scrollTop=1500`; âncora 106 em `top=-9`; gaps -1/0/-1/0 | posição preservada; `scrollHeight` 4544→5247; nenhuma célula em branco |
| 3 | Nova mensagem enquanto lê o histórico | atalho entrava no fluxo: âncora 106 caía de `top=-9` para `top=-61` | atalho sobreposto: `clientHeight` 711→711; âncora 106 em `top=-9` | deslocamento de 52 px **reproduzido e corrigido**; mensagem nova não entrou na janela |
| 4 | Tocar no atalho “↓ 1 novas mensagens” | — | mensagem 121 visível; `scrollTop=0`; atalho some | volta às recentes correta |
| 5 | Nova mensagem já no fim | — | mensagem 122 entra no fim; `scrollTop=0` | lista continua ancorada no fim |
| 6 | Rolagem programática em 31 amostras (0→máximo) | — | 5–6 linhas visíveis por amostra; 0 amostras sem linha; maior gap 0 | nenhuma célula em branco observada no Chromium |
| 7 | Focar e digitar no composer durante a leitura | — | `scrollTop` e âncora 106 inalterados | foco/digitação não deslocam o histórico no web |

Os gaps negativos de -1 px no cenário 2 são arredondamento de `getBoundingClientRect`;
as linhas se tocam. “Célula em branco” foi medida como amostra de viewport sem
nenhuma linha renderizada ou como gap maior que 2 px entre linhas visíveis.

## Evidência do deslocamento do atalho

No cenário 3, antes da correção, o botão “↓ 1 novas mensagens” era renderizado
entre a `FlatList` e o composer. O botão tem 36 px de altura e
`marginVertical: Spacing.two` (8 px em cada lado), portanto somava 52 px ao
layout. Ao aparecer, a lista perdia 52 px de altura e a mensagem-âncora saía de
`top=-9` para `top=-61`: exatamente 52 px. A mensagem nova não estava na lista;
o deslocamento era só de layout. A correção remove essa dependência entre o
atalho e a altura da viewport.

## Testes

Jest focado (`src/features/squares`, `--runInBand`): **4 suítes / 36 testes**
passaram. Cobertura nova:

- `__tests__/squares-ui.test.tsx`: trava `inverted`, `initialNumToRender=20`,
  `maxToRenderPerBatch=12`, `windowSize=9`, persistência do teclado, ordem dos
  dados, `contentContainerStyle` e os limiares de `onScroll`/`onEndReached`.
- `__tests__/use-square.test.tsx`: paginação antiga anexa ao fim sem recriar as
  linhas recentes; mensagem nova no fim não recria a anterior; ao passar de 200
  preserva o trecho antigo e sinaliza o atalho de recentes.

E2E novo (`e2e/specs/praca-chat.spec.ts`): **4 testes** — prepend/posição,
nova mensagem/atalho, rolagem rápida/células e foco no composer. O fixture de
Praça foi adicionado em `e2e/support/api-mock.ts` (`squares`, `square`,
`squareMessages`, `squareMessagePageSize`) e o spec está listado em
`docs/e2e.md`.

Regressão:

- suíte Jest completa: **169 suítes / 1029 testes** passaram;
- suíte Playwright completa: **52 testes passaram, 1 skip** (o `fixme` já
  existente das etapas de onboarding sem cadastro).

Comandos executados:

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest src/features/squares --runInBand --ci
NODE_OPTIONS=--max-old-space-size=512 npx playwright test e2e/specs/praca-chat.spec.ts
NODE_OPTIONS=--max-old-space-size=512 npx jest --ci --maxWorkers=2
NODE_OPTIONS=--max-old-space-size=512 npm run test:e2e
```

`npm run lint` passou. O `tsc --noEmit` estourou o heap com 512 MB e passou com
`NODE_OPTIONS=--max-old-space-size=1024`, como já registrado na POP-33.

## Roteiro manual pendente (aparelho)

Para fechar a validação do ticket sem transformar a ausência de aparelho em
aprovação, repetir com uma Praça semeada com 200+ mensagens (textos longos,
respostas e figurinhas), registrando tela e frame timing:

1. Abrir no fim; rolar até o topo carregando pelo menos 3 páginas antigas.
   Anotar o offset e o `top` de uma mensagem-âncora antes/depois de cada
   prepend; contar células em branco durante o carregamento.
2. Receber uma mensagem com o histórico aberto; confirmar que o atalho não
   encolhe a lista, que a âncora não se move e que a mensagem nova não entra
   fora do fim; tocar no atalho e confirmar o retorno ao fim.
3. Receber uma mensagem já no fim; confirmar que ela entra e que a lista
   permanece ancorada no fim.
4. Abrir e fechar o teclado várias vezes enquanto digita, com fonte padrão e
   ampliada; confirmar que o composer sobe, que o histórico não salta e que
   nenhuma linha fica encoberta.
5. Fling rápido do fim ao topo e de volta; registrar frames perdidos/jank e
   células em branco persistentes. Comparar com o baseline de
   `docs/mobile-performance-baseline.md`; o coletor ADB está descrito em
   `docs/pop-72-performance-metrics-automation.md`.

Métricas a anexar: offset da lista, `top` da âncora, quantidade de células em
branco, altura da viewport com/sem teclado, frame timing e gravação. Sem esses
dados, não declarar ganho de fluidez nem aprovação em Android/iOS.

## O que não foi validado

- **Nada foi executado em aparelho ou emulador Android/iOS.** A preservação de
  posição, as células em branco e a rolagem medida são do Chromium, que usa o
  `VirtualizedList` do React Native Web, não a física nativa.
- **Teclado nativo não foi exercitado.** No web o `KeyboardAvoidingView` não
  abre teclado; o teste cobre foco/digitação e ausência de deslocamento, não o
  redimensionamento causado pelo teclado do sistema. A validação pedida no
  ticket (mensagens longas + alternância de teclado) segue pendente de aparelho.
- Não houve medição de FPS, jank, tempo de frame, memória ou latência. Não há
  afirmação de ganho de fluidez; a única mudança mensurável foi a remoção do
  salto de 52 px.
- A rolagem programática percorreu 31 pontos em passos de ~77 px, não um fling
  nativo. O resultado “0 células em branco” vale para essa amostragem no
  Chromium e para o repouso após o prepend.
- A suíte E2E completa passou, mas continua sem cobrir física de rolagem nativa,
  teclado do sistema ou FPS.

## Critérios de aceite

- [x] Chat invertido sem regressão nos cenários medidos (prepend, novas
      mensagens, atalho, rolagem programática e foco no composer).
- [x] Decisão registrada com métricas e reprodução; `FlatList` mantida e
      migração especulativa descartada.
- [x] Deslocamento real do atalho reproduzido (52 px) e corrigido sem trocar a
      lista.
- [ ] Validação em Android/iOS com mensagens longas e alternância de teclado —
      pendente de aparelho; não declarada como aprovada.
