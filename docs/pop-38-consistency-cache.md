# POP-38: leitura e cache consistentes em Explorar, Biblioteca e Praças

Escopo: descoberta, acervo e listas de Praças. Sem mudança de rota, contrato de
API ou layout. As três stacks (`useAsyncData`, `usePaginatedData` e React Query)
passam a compartilhar as mesmas chaves e políticas de frescor nesses domínios.

## Chaves canônicas

`src/lib/query/keys.ts` concentra as chaves:

- `discoveryKeys.detail(meId, topicId, interesses)` — abertura e assunto;
- `discoveryKeys.topicDocuments(meId, topicId)` — preview de documentos do assunto;
- `discoveryKeys.search(meId, termo, filtro, topicId)` — busca paginada;
- `libraryKeys.documents(filtros)` / `libraryKeys.collections(filtros)` —
  listas do acervo, com filtros vazios normalizados e ordem estável;
- `libraryKeys.collection(id)` — detalhe da coleção;
- `squaresKeys.list(seção, termo)` — Suas Praças e descoberta.

As chaves incluem a conta (`meId`) para uma troca de sessão não reutilizar dados
da anterior.

## Políticas de frescor

`contentPolicy` ganhou `discovery`, `search`, `library`, `collection` e `squares`.
Nenhum domínio usa `staleTime: Infinity`: uma montagem com dados frescos não faz
request, enquanto um retorno depois da janela revalida em segundo plano sem
apagar o conteúdo.

## Explorar

- A descoberta deixou `useAsyncData` e usa `useCachedQuery` (React Query) com a
  chave canônica. Remontar a tela com cache fresco mostra o conteúdo direto,
  sem `TrendingNowSkeleton`; uma revalidação mantém os dados na tela.
- A busca paginada usa a mesma chave canônica e `keepPreviousData`. Trocar de
  categoria mantém o termo e mostra o resultado anterior enquanto a nova página
  chega; voltar de um detalhe não reinicia a paginação.
- O preview de documentos do assunto usa `placeholderData` da primeira página
  da busca de documentos já carregada, quando existir.
- O pull-to-refresh continua acionando `refetch`, mas o indicador nativo só
  aparece para o gesto da pessoa (`useManualRefresh`).

## Biblioteca

- Documentos e coleções usam `useCachedPages`, com paginação por cursor e
  refresh incremental (`reconcileRefreshedPages`) em vez de refazer o histórico.
- A chave inclui escopo, origem, dono, comuna, coleção, termo, assunto e ordem;
  mudar um filtro consulta uma chave própria, e voltar a um filtro já carregado
  reutiliza o cache.
- O detalhe da coleção usa `useCachedQuery` e aproveita a coleção já listada como
  `placeholderData`, evitando o loader de tela cheia ao abrir pelo card.
- Mutações do acervo (`createCollection`, `editCollection`, `deleteCollection`,
  upload/edição/exclusão de documento, salvar e compartilhar) marcam o domínio
  `library` como obsoleto com `refetchType: 'none'`; a tela em foco decide
  quando atualizar, e não há refetch de todas as páginas como efeito colateral.

## Praças

- As listas `mine` e `discover` usam `useCachedPages` com as mesmas políticas.
  Ao voltar ao foco, o refresh é incremental e mantém as páginas e a posição
  visível (`maintainVisibleContentPosition`).
- Trocar o termo de busca muda a chave sem descartar as listas anteriores.

## Testes

- `src/lib/query/__tests__/keys.test.ts`: normalização, separação por filtro e
  isolamento por conta.
- `explore-screen.test.tsx`: remontagem da descoberta sem request extra,
  remontagem da busca com as duas páginas em cache, paginação por categoria,
  retry e revalidação em foco.
- `library/__tests__/screens.test.tsx`: paginação por cursor, remontagem com as
  páginas preservadas e reaproveitamento da consulta sem filtro.
- `squares-screen.test.tsx`: retorno com páginas carregadas e refresh em foco sem
  perder o item visível.

## Validação executada

- `npm run check:fast` (ESLint + TypeScript): passou.
- Jest focado dos quatro arquivos acima: **42 testes** passaram.
- Suíte Jest completa com `--maxWorkers=2`: **766 testes** passaram.
- `npm run test:e2e`: **34 passaram**, 1 `fixme` já existente.
- A suíte E2E de navegação do Explorar passou; o cache com dados paginados foi
  verificado em Jest/host.

## Limitações

- Não houve medição em aparelho real de FPS, memória, gesto de voltar ou física
  do scroll. Os números desta entrega são contagens de requests em teste, não
  ganhos de fluidez medidos.
- O refresh da busca paginada ainda usa `refetch` da Infinite Query (todas as
  páginas já carregadas). Alinhar essa entrada ao refresh incremental do
  `useCachedPages` continua sendo o escopo do POP-35; o cache de remontagem e a
  paginação estável já estão cobertos.
- Não há validação visual nova; as telas foram preservadas.
