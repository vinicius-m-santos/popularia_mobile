# POP-36: refresh incremental de listas infinitas

Data: 05/11/2026. Escopo: pull-to-refresh das listas paginadas por cursor do
`useCachedPages` (feed, perfil, tópico, salvos, relações e filas de moderação).
Sem mudança de rota, API ou contrato de navegação.

## Problema

O `refresh` chamava `refetch()` da Infinite Query. No TanStack Query, isso
recomeça a paginação do zero e busca **todas** as páginas já carregadas em
sequência. Depois de 8 páginas, um gesto de atualização disparava 8 requests,
mesmo quando a primeira página já bastava para atualizar o topo.

## Implementação

- `src/lib/pagination.ts` ganhou `reconcileRefreshedPages`. Ele recebe o cache
  atual e o prefixo recém-buscado e decide entre:
  - **reuse**: o último item do prefixo ainda está no cache; as páginas antigas
    a partir do item-âncora (exclusive) continuam sendo a sequência correta;
  - **fetch**: o prefixo terminou em um item novo; é preciso buscar a próxima
    página para reencontrar o histórico;
  - **replace**: o fim da lista foi alcançado antes do cache (ou não há cache),
    então o prefixo novo é a lista completa.
- `src/hooks/use-cached-pages.ts` passou a buscar a primeira página diretamente,
  com escopo de performance `refresh`, e a soldar o resultado no cache via
  `setQueryData`. O `refetch()` de todas as páginas não é mais usado no gesto.
- O prefixo novo absorve inserções, deleções e mudanças de ordem que tenham
  ocorrido acima do item-âncora. O item de fronteira não é repetido na lista:
  a exibição continua usando `mergeById`.
- O número de páginas de ligação é limitado ao número de páginas já em cache.
  Se o prefixo não reencontrar o histórico dentro desse limite, o cache antigo é
  descartado e o prefixo novo (já contíguo) permanece. Assim o refresh nunca
  gasta mais requests do que o refetch antigo.
- `pageParams` acompanha as páginas mantidas, então o próximo `loadMore` continua
  do cursor da última página antiga, não do cursor da primeira página nova.
- Falhas preservam o conteúdo já carregado e expõem `refreshError`. Respostas
  401/403/404/410 continuam limpando o cache, como no `QueryCache`.
- O abort do refresh acompanha a troca de aba/consulta e o unmount; o `finally`
  de uma operação antiga não libera a concorrência da consulta atual.

## Requests medidos em teste (host, não device)

Os números abaixo são contagens de chamadas do loader nos testes de Jest. Não
são medições de rede, FPS ou tempo em aparelho.

| Cenário | Requests do refresh |
| --- | --- |
| 8 páginas carregadas, primeira página inalterada | **1** |
| Inserção/deleção/reordenação que cabe na primeira página | **1** |
| Inserção grande o bastante para exigir a página seguinte | **2** |
| Prefixo não reencontra o histórico dentro do cache | no máximo o número de páginas antigas |

O teste de instrumentação confirma `requestsByScreen.feed = { count: 1,
refreshCount: 1 }` depois de um refresh com 8 páginas carregadas.

## Testes

- `src/lib/__tests__/pagination.test.ts`: inserção, deleção, mudança de ordem,
  pedido de página de ligação, substituição no fim da lista e âncora no último
  item.
- `src/hooks/__tests__/use-cached-pages.test.ts`:
  - 8 páginas → refresh faz 1 request e mantém os 16 itens;
  - contador de requests/refresh da instrumentação (POP-5);
  - inserção, deleção e reordenação no topo;
  - página de ligação e continuação do `loadMore` pelo cursor preservado;
  - substituição quando o refresh chega ao fim da lista;
  - os casos anteriores de cache, concorrência, erro e acesso revogado.
- Suítes de consumo executadas: feed, perfil, tópico, salvos e visibilidade de
  salvos.

## Limitações

- O refresh não descobre deleções ou edições que aconteçam **abaixo** do item
  âncora, porque só busca o prefixo necessário para reconectar o topo. O
  histórico mantido é o snapshot anterior; uma revalidação completa continua
  sendo outro caminho (POP-35).
- As revalidações automáticas por `invalidateQueries` (perfil, feed depois de
  ações e tópico) ainda usam o `refetch` de todas as páginas. Alinhar essas
  entradas com a mesma reconciliação é o escopo do POP-35.
- Não houve validação em aparelho real. Gesto, scroll, física do
  `RefreshControl` e consistência visual do feed/perfil não foram medidos nesta
  tarefa; os testes de feed/perfil são de componente, em host.
- `npm run test:e2e` não foi executado: a entrega não altera navegação, rotas,
  autenticação ou formulário.
