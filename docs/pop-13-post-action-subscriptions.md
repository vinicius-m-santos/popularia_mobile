# POP-13: assinaturas de reação e salvamento por publicação

Data: 05/11/2026. Escopo: stores de reação/salvamento e `PostCard`.
Branch: `feature/post-action-subscriptions`, a partir de `17bbfe9`.

## Causa raiz

`usePostActions` assinava as versões globais das stores com
`useSyncExternalStore(subscribeSavedStore, savedStoreVersion, ...)` e
`useSyncExternalStore(subscribeReactions, reactionsVersion, ...)`. Qualquer
`emit()` incrementava a versão global e notificava **todos** os cartões
montados. Como o `useSyncExternalStore` força a renderização do componente que
hospeda o hook, o `memo` do `PostCard` não conseguia evitar o trabalho: apoiar,
ecoar ou salvar uma publicação redesenhava as outras. As travas (`lock`/`unlock`)
também emitiam globalmente, mesmo sem mudar nenhum estado visível.

## Alterações

- `src/features/posts/post-subscriptions.ts`: mapa `postId -> listeners` com
  `notify(postId)`, `notifyAll()` (reset de sessão) e unsubscribe idempotente.
  O conjunto vazio sai do mapa, então troca de `postId` e desmontagem não deixam
  listeners acumulados.
- `src/features/posts/save.ts`: `subscribeSavedPost(postId, listener)` e
  `readSavedSnapshot(postId)` (`boolean | undefined`, primitivo estável).
  `apply`, rollback e travas notificam só o ID alterado.
- `src/features/posts/reactions.ts`: `subscribePostReactions(postId, listener)` e
  `readReactionSnapshot(postId)`. O objeto de snapshot só é recriado quando
  `count` ou `mine` mudam; a confirmação do servidor que repete o valor otimista
  não notifica de novo.
- `src/features/interactions/use-post-actions.ts`: assina o `postId` atual com
  `subscribe`/`getSnapshot` memoizados; troca de ID refaz a assinatura e os
  valores exibidos continuam vindo de `readSaved`/`readReaction`, sem depender
  do snapshot do render anterior.
- `src/features/moderation/actions-sheet.tsx`: o menu acompanha só o alvo aberto,
  em vez da store global. O valor exibido continua vindo de `readSaved`, então
  trocar de alvo não mostra um snapshot antigo.
- As APIs globais `subscribeSavedStore`/`savedStoreVersion` e
  `subscribeReactions`/`reactionsVersion` foram removidas; os dois consumidores
  do app foram migrados. `usePostActions` mantém o mesmo contrato público
  (`supported`, `echoed`, `saved`, contadores e ações).

## Medição de commits (React Profiler, 20 cartões)

Cenário: `src/features/performance/__tests__/post-action-fanout.test.tsx` monta
20 `PostCard`s reais, zera a sessão de medição depois do mount e pressiona
**Apoiar** no primeiro cartão. A API é mockada; o Profiler de POP-5
(`src/lib/performance/profiler.tsx`) agrega os commits por instância.

| Versão | Cartões montados | Instâncias com update | Update commits por instância | Update commits totais |
| --- | --- | --- | --- | --- |
| Antes (`17bbfe9`, store global) | 20 | 20 | 2 | 40 |
| Depois (esta branch) | 20 | 1 | 1 | 1 |

A confirmação do servidor devolve o mesmo valor otimista, então o cartão
alterado commita uma vez; os outros 19 não recebem a notificação. O teste
automatizado trava o resultado "depois" (`updated` com 1 instância e 1 commit).

**Isto é Jest/host, não aparelho.** A medição usa o React Profiler em ambiente de
teste, com API mockada. Não foram medidos FPS, frames perdidos, memória, TTI nem
`actualDuration` comparável a release. A validação em iPhone/Android real segue
pendente e não deve ser declarada a partir desta tabela.

Reprodução:

```bash
NODE_OPTIONS=--max-old-space-size=512 \
  npx jest src/features/performance/__tests__/post-action-fanout.test.tsx --runInBand
```

## Testes

```bash
NODE_OPTIONS=--max-old-space-size=512 \
  npx jest src/features/posts/__tests__/post-action-subscriptions.test.tsx \
             src/features/posts/__tests__/save.test.tsx \
             src/features/performance/__tests__/post-action-fanout.test.tsx \
             --runInBand
```

Cobrem isolamento entre dois posts, estabilidade referencial do snapshot de
reações, unsubscribe idempotente, troca de `postId`, desmontagem, apoio otimista
com rollback e o cenário de 20 cartões.

## Limitações

- Nenhum aparelho Android/iOS foi usado nesta entrega; não há ganho de FPS ou
  memória medido.
- A comparação é de commits no Jest, não de duração de render em build de
  release.
- O fluxo visual de apoiar/ecoar/salvar não mudou de contrato; não foi necessária
  navegação Playwright nova. Os testes de componente das stores e do
  `actions-sheet` foram executados.
