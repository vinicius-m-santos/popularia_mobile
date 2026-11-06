# POP-37: cache por domínio nas leituras da comuna

Data: 06/11/2026. Escopo: leituras da página da comuna (`detalhe`, `posts`,
`fixados`, `próximo evento` e `Praça`), compartilhamento do detalhe entre telas
e invalidação depois de participação, edição e moderação. Sem mudança de API,
rota ou layout.

## Problema

A página montava cinco leituras independentes e cada uma tinha um dono
diferente: `useAsyncData` para detalhe e Praça, `usePaginatedData` para posts,
`useQuery` para fixados e evento. O detalhe era recarregado em todo foco, a
Praça não tinha cache entre montagens e gestão/moderação/eventos carregavam a
mesma comuna de novo com outras chaves. Não havia uma política única de
`staleTime`/`gcTime` para a comuna.

## Chaves compartilhadas

`src/features/comunas/keys.ts` concentra a árvore de cache. Toda leitura da
mesma comuna fica sob `['comuna', slug]`:

| Chave | Conteúdo |
| --- | --- |
| `['comuna', slug]` | detalhe (`ComunaDetails`) |
| `['comuna', slug, 'summary']` | resumo leve vindo de listas/detalhe, usado como placeholder |
| `['comuna', slug, 'posts']` | lista infinita de publicações |
| `['comuna', slug, 'pins']` | publicações fixadas |
| `['comuna', slug, 'square']` | Praça da comuna |
| `['comuna', slug, 'events', when]` | eventos da comuna por aba |

Invalidar `comunaKeys.group(slug)` (`['comuna', slug]`) alcança todas as
subchaves daquela comuna; outra comuna não é tocada. Fixados e eventos passaram
a usar essa raiz (`pinnedPostsKey` e `comunaEventsKey` delegam para ela).

## Implementação

- `src/features/comunas/queries.ts`: `comunaOptions`/`useComuna` com
  `contentPolicy.comuna` (**60 s** de `staleTime`, **10 min** de `gcTime`),
  `placeholderData` a partir do resumo e `invalidateComunaReads` para as
  leituras derivadas.
- `contentPolicy.comuna` em `src/lib/query/client.ts` é a política explícita
  usada por detalhe, posts, fixados, evento e Praça. Nenhuma dessas leituras
  depende do default global.
- A página da comuna usa `useCachedPages` para posts (mesma chave infinita),
  `useComuna` para detalhe, `useQuery` para fixados e evento, e `useQuery` para
  a Praça. `retry: false` preserva o erro visível com "Tentar de novo" das
  listas.
- `getComunas`/`getMyComunas` e `getComuna` alimentam o resumo leve. Abrir a
  comuna a partir de Explorar, perfil, compositor ou gestão mostra a capa na
  primeira renderização enquanto o detalhe confirma o acesso.
- Gestão, moderação e a lista de eventos usam a mesma chave de detalhe. Sair da
  página da comuna para qualquer uma delas, dentro do `staleTime`, não repete a
  leitura.
- O "Próximo evento" tem a própria consulta curta (`preview`, 5 itens), mas
  usa a primeira página da lista `upcoming` já carregada como
  `placeholderData`. A faixa aparece imediatamente e a consulta curta confirma
  presença/cancelamento sem esperar a tela de eventos.
- `useFocusEffect` só invalida o detalhe quando ele está mais velho que o
  `staleTime`. Voltar dentro da janela não dispara request.

## Invalidação e atualização

- **Participar/sair** (`useComunaMembership`): a resposta da API atualiza
  `viewerIsMember`, `viewerRole` e `memberCount` no detalhe e no resumo. Sair
  remove `viewerPermissions`. Em comuna privada, posts, Praça e fixados são
  invalidados/limpos porque o acesso muda; em comuna pública a leitura continua
  a mesma e não há request extra.
- **Edição/arquivamento** (`manage-comuna-screen.tsx`): a resposta de
  `updateComuna`/`archiveComuna` é gravada no detalhe compartilhado. Arquivar
  também invalida posts, fixados, Praça e eventos.
- **Moderação** (`invalidateAfterModeration`): além de feed, publicação e
  perfil, invalida publicações e fixados da comuna.
- **Acesso negado**: quando o detalhe recebe 401/403/404/410, o resumo é
  removido junto para que um placeholder não ressuscite conteúdo privado.
- Capa e marca continuam sendo propagadas para as queries já carregadas por
  `image-cache.ts`; a invalidação do domínio não desfaz esse patch.

## Requests por abertura (contagem de testes)

Números de chamadas dos loaders em Jest, não medição de rede, FPS ou tempo em
aparelho. A primeira abertura com o servidor conectado dispara no máximo:

| Leitura | Requests |
| --- | --- |
| Detalhe | 1 |
| Posts (primeira página) | 1 |
| Fixados | 1 |
| Próximo evento (consulta curta `preview`, 5 itens) | 1 |
| Praça | 1 |
| **Total** | **até 5** |

| Cenário | Requests adicionais |
| --- | --- |
| Voltar à comuna dentro de 60 s | **0** (detalhe, posts, fixados, preview e Praça frescos) |
| Trocar de aba e voltar em posts | **0** |
| Abrir a gestão em seguida | **0** para o detalhe (teste de componente) |
| Depois de 60 s | o detalhe é revalidado ao focar; demais leituras seguem a política da própria query |

Os testes focados confirmam cache de página em remontagem (`use-cached-pages`),
detalhe fresco sem segundo request (`queries.test.tsx`), gestão reaproveitando o
detalhe (`comuna-screens.test.tsx`), placeholder do evento a partir da lista
(`next-event.test.tsx`) e contagem de detalhe/posts/fixados na primeira abertura
(`comuna-posts-list.test.tsx`).

## Testes

- `src/features/comunas/__tests__/queries.test.tsx`: forma das chaves,
  invalidação limitada à comuna, cache do detalhe, placeholder do resumo,
  gravação de edição e atualização/limpeza de participação.
- `src/features/comunas/__tests__/comuna-posts-list.test.tsx`: primeira
  abertura, paginação, erro/retry, abas e contagens de requests.
- `src/features/events/__tests__/next-event.test.tsx`: placeholder com a lista
  de eventos já carregada e uma única consulta curta.
- `src/features/squares/__tests__/squares-ui.test.tsx`: Praça com cache
  isolado por teste.
- `src/features/moderation/__tests__/content-reports.test.ts`: invalidação de
  publicações/fixados da comuna depois de moderação.
- `src/hooks/__tests__/use-cached-pages.test.ts`: preservação do retry padrão
  quando a tela não define `retry`.

## Limitações

- A validação é de componente/host. Não houve medição de FPS, memória, tempo de
  rede ou gestos em aparelho real nesta entrega; a página não altera navegação,
  então o E2E de rotas não foi executado.
- Fixados, evento e Praça têm políticas de dados próprias por endpoint; a
  invalidação os alcança pela raiz, mas o refresh de posts depois de publicar
  continua usando `refresh()` (uma página, reconciliada) como no POP-36.
- Publicações ainda usam `usePaginatedData` em outras telas (membros, pedidos,
  denúncias). A migração incremental deste ticket cobre a leitura principal da
  comuna, não todas as listas do app.
