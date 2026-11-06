# POP-31: swipe de abas x trilhos horizontais

Data: 06/11/2026. Escopo: arbitrar o pan de troca de abas do perfil/comuna com
os trilhos horizontais de biblioteca (barra de seções, faixa de coleções, chips
de assunto e chips de origem). Sem mudança de rota, API ou contrato de
navegação.

## Problema

`ProfileTabSwipe` envolve todo o conteúdo das abas em um `usePanGesture` com
`activeOffsetX: [-36, 36]`. As faixas horizontais da Biblioteca usam
`ScrollView`/`FlatList` horizontal e, quando renderizadas sob esse detector, não
tinham relação com o pan externo. Um arrasto horizontal no trilho podia ativar
os dois gestos: o trilho rolava e a aba trocava.

A análise é estática (mesmo caminho do achado S6/Seção 4.5 no commit 12c0369).
Não houve reprodução em aparelho neste ambiente; a correção aplica o padrão que
já protege a barra de abas. Na composição atual, a Biblioteca do perfil/comuna
usa `profileContext` e não monta a faixa de coleções nem os chips de assunto; a
barra de seções Documentos/Salvos (`LibrarySectionTabs`) é o trilho horizontal
real desse painel sob o swipe. O guard cobre esses casos sem mudar o
comportamento fora do swipe.

## Implementação

- `ProfileSwipeGuard` em `src/features/profiles/profile-tab-swipe.tsx` lê o pan
  do `ProfileTabSwipe` e cria `useNativeGesture(pan ? { block: pan } : {})`.
- O guard envolve somente as áreas de scroll horizontal:
  - barra de seções Documentos/Salvos (`LibrarySectionTabs`);
  - faixa de coleções da Biblioteca (`library-screen.tsx`);
  - chips de assunto (`TopicChips`);
  - chips de origem (`ChipRow`).
- Fora de `ProfileTabSwipe` não existe pan para bloquear: o guard entrega o
  conteúdo sem `GestureDetector`. A Biblioteca pública e o seletor de anexo do
  composer continuam funcionando como antes.
- Áreas livres das abas (conteúdo em si, partes sem trilho) mantêm o swipe.

## Casos sem problema (documentados, sem mudança)

- **Barra de abas (`UnderlineTabs`/`ProfileTabs`)**: já usa o mesmo
  `useNativeGesture({ block: pan })`; rolar os rótulos nunca trocou de aba.
- **Explorar e feed**: não usam `ProfileTabSwipe`. O carrossel de comunas do
  Explorar tem seu próprio `FlatList` horizontal e o feed usa um pan separado,
  restrito à área da lista.
- **Lista vertical e arrasto diagonal**: `activeOffsetX` + `failOffsetY` já
  deixam a rolagem vertical e o gesto diagonal com a lista.
- **Barra de status / chrome**: fica fora do detector do swipe.

## Validação executada

- `NODE_OPTIONS=--max-old-space-size=1024 npm run check:fast`: ESLint e
  TypeScript passaram. Com 512 o `tsc` estourou o heap nesta worktree.
- Testes focados de `profile-tab-swipe`, `profile-screen`, `comuna` e
  `library/screens`, com `--runInBand`, incluindo a barra de seções da
  biblioteca pessoal e os trilhos da biblioteca pública.
- Suíte Jest completa: **131 suítes / 793 testes passaram**.

## Limitações e o que não foi validado

- **Não houve execução em aparelho Android/iOS.** O handoff real entre o scroll
  nativo do trilho e o pan da aba, as trocas rápidas e o drag diagonal não foram
  medidos. Os testes de componente não substituem essa validação.
- Nenhum ganho de fluidez é afirmado: a mudança é de arbitragem de gesto.
- `npm run test:e2e` não foi executado: a mudança não altera rotas, navegação de
  pilha, autenticação ou formulário. A troca de aba é estado local da tela.
