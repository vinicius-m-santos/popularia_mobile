# POP-14: menos notificações e patches no caminho de reação/salvamento

Data: 05/11/2026. Escopo: stores de reação e salvamento, helpers de cache e
`usePostActions`. Base: `feature/post-action-subscriptions` (POP-13, `ad07ec9`).
Nenhuma dependência nova e nenhuma mudança visual.

## O que o POP-13 já havia resolvido

As assinaturas já eram por `postId` (`post-subscriptions.ts`), o snapshot de
reações já era referencialmente estável e a confirmação que repetia o valor
otimista já não notificava de novo. Este card **não refez** isso.

## Causa raiz restante

1. `lockReaction`/`unlockReaction` e `lock`/`unlock` de salvamento chamavam
   `emitReaction`/`emitSaved`. A trava não tem estado visível para o cartão, mas
   cada toque acordava o listener duas vezes além da mudança real.
2. `snapshotReactionCaches` + `restoreReactionCaches` e `snapshot` + `restore` de
   salvamento fotografavam a **query inteira** e restauravam tudo no erro. Com um
   eco, um salvamento ou outro post concluindo em paralelo na mesma query, o
   rollback de uma requisição falha desfazia a alteração bem-sucedida da outra.
3. `patchReactionCaches` usava `setQueriesData` sobre todas as raízes
   (`feed`, `profile-posts`, `post`, `post-preview`, `saved-posts`) e `replace`
   recriava `pages`/`items` mesmo quando o post não estava na query. Resultado:
   escrita e dispatch em query intocada, duas vezes por toque (otimista +
   confirmação).
4. `setQueryData` do TanStack Query sempre incrementa `dataUpdateCount` e
   notifica observers, mesmo quando o updater devolve o mesmo objeto. O
   `replaceSaved` já preservava a referência, mas o dispatch acontecia de todo
   jeito em toda query da raiz.
5. `toggleSavedPost` fazia duas varreduras (`POST_ROOTS` e `saved-posts`) e
   `prependSaved` recriava páginas seguintes da lista de salvos sem necessidade.
6. O `flip` calculava o próximo estado a partir do `current` capturado no render;
   depois de uma confirmação, um render atrasado podia alternar a partir de um
   valor antigo.

## Alterações

- `src/lib/query/client.ts`: `setQueryDataIfChanged(queryKey, current, next)` só
  chama `setQueryData` quando a referência muda. É o ponto único que evita
  dispatch vazio nos dois stores.
- `src/features/posts/reactions.ts`:
  - `lockReaction`/`unlockReaction` não emitem mais.
  - `writeReaction` devolve se o snapshot mudou; `revertReaction` só desfaz se a
    store ainda mostra o valor otimista deste toque.
  - `patchReactionCaches` faz uma varredura restrita às queries que contêm o
    `postId`, usa `replace` que preserva a referência quando nada muda e aceita
    `onlyIf` para o rollback não sobrescrever um valor mais novo.
  - `snapshotReactionCaches`/`restoreReactionCaches` foram removidos; o rollback
    agora é por post/campo, não por query inteira.
- `src/features/posts/save.ts`:
  - trava de salvamento não emite mais.
  - `apply` separa o feedback imediato (store + `emitSaved`) do trabalho de cache
    (`syncSavedCaches`), que faz **uma** varredura e ignora queries sem o post.
  - rollback (`rollbackSaved`) desfaz somente este post, com `onlyIf` nas listas e
    reinserção na lista de salvos sem tocar nas outras publicações; snapshots de
    query inteira foram removidos.
  - `prependSaved` preserva as páginas seguintes e a primeira página quando o
    item já está no topo; lista vazia agora recebe a primeira página.
- `src/features/interactions/use-post-actions.ts`:
  - o `flip` lê o valor atual da store antes de calcular o próximo;
  - o feedback otimista (store) vem antes da sincronização de queries;
  - a confirmação só escreve store/cache quando difere do otimista;
  - rollback usa `revertReaction` + patch com `onlyIf`, então apoio, eco e
    salvamento concorrentes não se desfazem entre si.

A sincronização entre feed, perfil, detalhe, preview, salvos e lista de salvos
foi preservada; só ficou restrita às queries que realmente contêm o post.

## Evidência medida (Jest/host, API mockada)

Os números abaixo saem dos testes novos contra a implementação POP-13 (stash
temporário das fontes) e contra esta branch. Cenário de cache: 5 queries
candidatas — feed com `p1`, feed com `p2`, perfil com `p1`, detalhe de `p1` e
lista de salvos com `p1`. Salvamento: 4 raízes de publicação + lista de salvos.

| Medida por toque | Antes (POP-13) | Depois | Teste |
| --- | --- | --- | --- |
| Notificações de store no apoio com sucesso | 3 | 1 | `notificações observáveis` |
| Notificações de store no salvamento com sucesso | 3 | 1 | `notificações observáveis` |
| Notificações no apoio com falha (ida + volta) | 4 | 2 | `notificações observáveis` |
| Escritas de cache no apoio (5 queries candidatas) | 10 | 4 | `escritas de cache` |
| Escritas de cache no salvamento (4 + salvos) | 5 | 4 | `escritas de cache` |
| Escritas num patch de reação sem mudança | 1 | 0 | `escritas de cache` |
| Rollback com eco concorrente | desfazia o eco | preserva o eco | `concorrência e rollback` |
| Rollback com salvamento de outro post | perdia o outro post | preserva o outro post | `concorrência e rollback` |

Isto é **Jest/host com API mockada**, não aparelho. Não foram medidos FPS,
frames perdidos, memória, TTI nem `actualDuration` de release; nenhum ganho
desses é declarado. A sincronização de cache continua síncrona logo após a
notificação da store; o que mudou é a quantidade de varreduras/escritas e o
escopo do rollback.

## Testes

```bash
NODE_OPTIONS=--max-old-space-size=512 \
  npx jest src/features/posts/__tests__/post-action-consistency.test.tsx \
             src/features/posts/__tests__/post-action-subscriptions.test.tsx \
             src/features/posts/__tests__/save.test.tsx \
             src/features/performance/__tests__/post-action-fanout.test.tsx \
             --runInBand
```

Cobrem: uma notificação por mudança real; rollback de ida e volta; escritas só
nas queries afetadas; patch sem mudança não escreve; confirmação com contagem
diferente; feed/perfil/detalhe/salvos consistentes no sucesso e no erro; eco
concluído preservado quando o apoio falha; salvamento de outro post preservado
quando um falha; dois toques rápidos com uma requisição e nova alternância
depois; páginas seguintes de salvos preservadas.

## Limitações

- Sem aparelho Android/iOS nesta entrega; nenhuma medição de FPS/memória.
- O feedback otimista continua síncrono; a sincronização de queries não foi
  movida para microtask/frame seguinte. Isso evita corrida de rollback, mas não
  elimina o custo da varredura do cache.
- O rollback adota o valor anterior do toque. Se um refetch trouxer um valor mais
  novo durante a requisição, o cache não é sobrescrito (`onlyIf`), mas a store
  continua autoritativa para o cartão até o próximo toque/reset.
- `poll.ts` usa um padrão parecido de snapshot/patch e ficou fora deste card.
- Não houve mudança de rota, navegação, autenticação, onboarding ou formulário;
  por isso não foi necessária navegação Playwright nova. O contrato visual de
  apoiar/ecoar/salvar não mudou.
