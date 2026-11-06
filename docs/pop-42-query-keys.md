# POP-42: query keys e invalidação por entidade

Data: 06/11/2026. Escopo: cache de leitura de feed, perfil, publicação,
comuna e descoberta; nenhuma rota, layout, endpoint ou regra de negócio foi
alterada.

## Problema

A mesma entidade era lida por caminhos diferentes:

- o detalhe da comuna vinha de `useAsyncData` em quatro telas e de
  `['comuna-brief', slug]` na lista de eventos;
- a descoberta do Explorar usava `useAsyncData`, sem cache entre montagens;
- posts de comuna usavam `usePaginatedData`, fora do cache de queries, então
  apoio/salvamento/enquete não conseguiam atualizá-los;
- mutações de publicação/moderador usavam invalidações amplas ou listas de
  raízes duplicadas em `save.ts`, `reactions.ts` e `poll.ts`;
- seguir atualizava perfil/relações/feed, mas não a pessoa em descoberta/busca.

## Factory de chaves

`src/lib/query/keys.ts` é a única definição das chaves. Prefixos estáveis
permitem invalidar uma superfície inteira sem varrer o cache do aplicativo.

| Domínio | Chave | Conteúdo |
| --- | --- | --- |
| Feed | `['feed', aba, ...escopo]` | lista infinita por aba |
| Publicação | `['post', id]` / `['post-preview', id]` | detalhe completo / cartão de toque |
| Perfil | `['profile', id]` | detalhe |
| Posts do perfil | `['profile-posts', handle]` | lista infinita |
| Relações | `['relations', kind, id]` | seguidores/seguindo |
| Comuna | `['comuna', slug]` | detalhe completo |
| Comuna | `['comuna', slug, 'posts']` | publicações |
| Comuna | `['comuna', slug, 'pins']` | fixados |
| Comuna | `['comuna', slug, 'square']` | Praça |
| Comuna | `['comuna', slug, 'events', when]` | eventos por aba/preview |
| Descoberta | `['discovery', 'home', userId, topic, escopo]` | agregado do Explorar/assunto |
| Descoberta | `['discovery', 'topic-documents', userId, topic]` | documentos do assunto |
| Busca | `['search', termo, filtro, topic]` | resultados paginados |
| Tópico | `['topic', slug]` / `['topic-posts', slug]` | metadados / publicações |
| Salvos | `['saved-posts']` | lista infinita |

`queryKeys.comuna.posts`, `.pins`, `.square` e `.events` ficam abaixo do
detalhe da mesma comuna. `queryKeys.comuna.isPostsKey` e `.isEventsKey`
permitem predicates sem transformar um slug em chave especial.

### Por que `comuna` e não `comuna-brief`

O detalhe completo (`getComuna`) passou a ser a única leitura da entidade em
`['comuna', slug]`. Gestão, moderação, eventos, documento e upload usam
`useComuna`, portanto abrir uma tela depois da outra dentro da janela de
frescor não repete o `GET`. O resumo vindo de listas não é gravado nessa chave.

## Freshness por tipo

`contentPolicy` em `src/lib/query/client.ts` documenta a política:

| Tipo | `staleTime` | `gcTime` | Motivo |
| --- | --- | --- | --- |
| Feed | 30 s | 10 min | curtir/responder/publicar com retorno rápido |
| Perfil | 60 s | 10 min | bio, contadores e posts |
| Publicação | 15 s | 5 min | permissões e conteúdo aberto |
| Comuna | 60 s | 10 min | detalhe, posts, fixados, Praça e eventos |
| Descoberta | 60 s | 10 min | agregado do Explorar/assunto |
| Busca | 0 | 5 min | resultado precisa refletir termo/filtro ao voltar |
| Tópico | 60 s | 10 min | metadados e posts do assunto |
| Eventos | 30 s | 5 min | presença e cancelamento |

`revalidateIfStale` só invalida no foco quando a consulta passou da janela e
não está em voo. Isso evita o antigo refetch incondicional ao voltar do
detalhe e mantém o refresh manual (`reload`/pull-to-refresh) explícito.

## Mutações e invalidação

| Ação | Atualiza | Não toca |
| --- | --- | --- |
| Seguir/deixar de seguir | contadores em `profile`, linha em `relations`, `feed` Seguindo, pessoa em `discovery`/`search`; rollback restaura os mesmos snapshots | posts, comunas, notificações |
| Publicar | `feed`, `profile-posts` de quem publicou, `comuna.posts` dos destinos, `discovery` e `search` | perfis/comunas de terceiros |
| Excluir publicação | remove `post`/`post-preview`; invalida feed, perfil, posts/fixados da comuna, tópicos, descoberta e busca | filas de moderação não relacionadas |
| Moderar | fila da comuna/plataforma, `feed`, `post`, `profile-posts`, `comuna.posts`, `comuna.pins`, tópicos, busca e descoberta | dados de outra comuna |
| Entrar/sair da comuna | campos de membership no detalhe; em comuna privada invalida posts/Praça e remove/ invalida fixados | detalhe de outras comunas |
| Fixar/desafixar | `comuna.pins` + `post`/`post-preview` | feed e perfil |
| Salvar/apoiar/ecoar/votar | somente queries que contêm a publicação (`feed`, `profile-posts`, `post`, `post-preview`, `saved-posts`, `comuna.posts`, `topic-posts`) | demais entidades |

As raízes de publicação foram centralizadas em
`src/features/posts/cache-payload.ts`. Os helpers `containsPost`,
`isPostPagePayload` e `isPostInfinitePayload` confirmam que a query realmente
tem a publicação antes de qualquer escrita. A exclusão deixou de chamar
`invalidateQueries()` global e usa `invalidateAfterPostDeleted`.

## Equivalência de payloads e cache poisoning

- **Detalhe ≠ resumo.** Listas (Explorar, perfil, compositor) não gravam
  `Comuna` resumida em `['comuna', slug]`. O detalhe só recebe o payload
  completo de `getComuna`.
- **Validação antes do cache.** `useComuna` exige `id`, `name`, `handle` e
  `viewerIsMember`; `useDiscovery` exige todas as coleções e `next`. Um payload
  truncado vira erro de leitura e o cache anterior permanece.
- **Páginas validadas.** `useCachedPages` passa cada página por
  `assertPagePayload` antes de alimentar o cache; `items` ausente ou
  `nextCursor` inválido não substitui o histórico.
- **Escrita por campo.** Membership grava `viewerIsMember`, `viewerRole` e
  `memberCount`, removendo permissões ao sair, sem substituir o objeto inteiro.
  Follow grava somente `viewerFollowing`/`viewerRequested` na pessoa certa.
- **Overlays separados.** Capa/marca/avatar continuam em chaves próprias
  (`comuna-cover`, `comuna-mark`, `user-avatar`), fora do detalhe da entidade.

## Testes

- `src/lib/query/__tests__/keys.test.ts`: formato das chaves, subchaves da
  comuna, normalização de assunto e predicates.
- `src/hooks/__tests__/use-cached-data.test.ts`: uma request para duas telas
  com a mesma chave, remontagem fresca sem request, isolamento entre entidades,
  acesso revogado limpando o conteúdo e revalidação apenas quando stale.
- `src/features/comunas/__tests__/queries.test.tsx`: detalhe compartilhado,
  payload parcial rejeitado, membership por campo e escopo das invalidações.
- `src/features/explore/__tests__/queries.test.tsx`: deduplicação da descoberta
  e preservação do cache diante de payload parcial.
- `src/features/posts/__tests__/invalidation.test.ts`: superfícies de publicar
  e excluir, incluindo feed/perfil/comuna/descoberta.
- `src/features/profiles/__tests__/follow-cache.test.ts`: patch/rollback em
  perfil, relações, feed Seguindo, descoberta e busca.
- `src/features/moderation/__tests__/content-reports.test.ts`: fila e listas
  atingidas pela moderação, sem invalidação global.
- `src/hooks/__tests__/use-cached-pages.test.ts`: página parcial não substitui
  o histórico.

As contagens acima são chamadas de loader em Jest, não medições de rede, FPS,
memória ou tempo de tela. Não houve validação em aparelho real nesta entrega e
não se declara ganho de performance medido. `npm run test:e2e` não foi
executado porque a entrega não altera navegação, rotas, autenticação,
onboarding ou formulário.
