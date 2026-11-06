# POP-63: regressões de store, paginação, viewport e rollback

Data: 06/11/2026. Escopo: testes determinísticos para as correções arquiteturais
de POP-13, POP-15, POP-20/POP-30 e POP-36, com uma correção de revalidação
encontrada ao automatizar o cenário de três páginas.

## Problema

As correções de store por publicação, reducer idempotente, viewport de vídeo e
refresh incremental são invisíveis na maior parte dos fluxos. Uma regressão pode
voltar como:

- um cartão redesenhar quando outro post muda;
- um rollback desfazer uma ação concorrente;
- um vídeo fora da tela montar player;
- um `revalidate` reduzir a lista carregada à primeira página;
- uma mudança de ordenação duplicar ou pular o item de fronteira;
- dois `loadMore` concorrentes pedirem o mesmo cursor.

## Correção encontrada pela suíte

`usePaginatedData.revalidate` recarregava apenas a primeira página e substituía
o estado inteiro. Com três páginas já carregadas (por exemplo, na Biblioteca ao
voltar de um documento), a lista perdia as páginas 2 e 3 e o cursor de
continuação.

O hook passou a guardar as páginas carregadas, não só a lista achatada:

- `revalidate` busca o prefixo novo e o reconcilia com as páginas em cache com
  `reconcileRefreshedPages`, o mesmo algoritmo do refresh de `useCachedPages`;
- inserções, deleções e mudanças de ordem acima do item-âncora são absorvidas
  sem repetir o item de fronteira;
- se o prefixo não reencontra o histórico, busca a página de ligação, limitado
  ao número de páginas já em cache; sem reencontro, substitui pelo prefixo
  contíguo;
- `append`, `remove` e `update` mantêm as páginas alinhadas, e um mutation local
  durante a revalidação tem prioridade sobre o resultado antigo;
- `loadMore` espera a revalidação terminar e continua do cursor preservado;
- acesso revogado (401/403/404 ou recurso inexistente) limpa as páginas carregadas
  e volta ao estado de erro, para conteúdo privado não ressuscitar;
- falha na revalidação mantém as três páginas e não expõe erro nem loader.

## Matriz de regressão

| Cenário | Suíte | O que trava |
| --- | --- | --- |
| Reducer idempotente | `src/features/interactions/__tests__/interactions-reducer.test.ts` | `set` repetido (true/false), ID novo, múltiplos IDs, `set` vazio e contagem de comentários que não aumenta mantêm a referência |
| Isolamento por ID | `src/features/posts/__tests__/post-action-subscriptions.test.tsx` | snapshot e listener de `p1` não acordam `p2`; unsubscribe idempotente; reset da sessão |
| Updates entre feeds | `src/features/posts/__tests__/post-action-consistency.test.tsx` | o post muda em todas as páginas/feeds que o contêm, vizinhos preservam referência e cursores |
| Rollback e concorrência | `src/features/posts/__tests__/post-action-consistency.test.tsx` e `save.test.tsx` | falha de apoio não desfaz eco/salvamento paralelo; falha de salvamento não desfaz outro post; rollback com `onlyIf` não sobrescreve refetch mais novo; dois toques geram uma request |
| Vídeos invisíveis sem player | `src/features/posts/components/__tests__/post-attachment.test.tsx` e `post-card-media-visibility.test.tsx` | `visible=false` e `mediaVisible=false` não chamam `useVideoPlayer`; três vídeos invisíveis ficam só com pôster; no máximo um player tocando |
| Revalidate com 3 páginas | `src/hooks/__tests__/use-paginated-data.test.ts` | três páginas preservadas, uma request, cursor mantido, falha silenciosa e retry |
| Mudanças de ordenação | `src/lib/__tests__/pagination.test.ts`, `use-cached-pages.test.ts` e `use-paginated-data.test.ts` | inserção, deleção e item fixado no topo não duplicam nem perdem a continuação |
| `loadMore` concorrente | `use-paginated-data.test.ts` e `use-cached-pages.test.ts` | dois disparos geram uma página; durante revalidação o loadMore espera; resposta de outra aba é descartada |

Todas as suítes usam loaders e APIs mockados. Nenhum teste depende de rede,
Metro, dispositivo, relógio externo ou backend real.

## Validação

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest \
  src/features/interactions/__tests__/interactions-reducer.test.ts \
  src/features/posts/__tests__/post-action-subscriptions.test.tsx \
  src/features/posts/__tests__/post-action-consistency.test.tsx \
  src/features/posts/__tests__/save.test.tsx \
  src/features/posts/components/__tests__/post-attachment.test.tsx \
  src/features/posts/components/__tests__/post-card-media-visibility.test.tsx \
  src/hooks/__tests__/use-paginated-data.test.ts \
  src/hooks/__tests__/use-cached-pages.test.ts \
  src/lib/__tests__/pagination.test.ts \
  --runInBand
npm run check:fast
```

Resultado observado nesta entrega: **9 suítes focadas / 94 testes** e **123
suítes / 739 testes** na suíte completa, com `npm run check:fast` passando.

## Limitações

- Jest/host não mede FPS, memória, TTI nem o comportamento real do
  `expo-video`; a viewport é simulada por props e pelo hook de visibilidade.
- A reconciliação de revalidação só atualiza o prefixo necessário para
  reencontrar o histórico. Edições ou deleções abaixo do item-âncora continuam
  cobertas pelo próximo refresh completo (POP-36/POP-35).
- Não houve mudança de rota, navegação, autenticação, onboarding ou formulário;
  por isso o Playwright não foi executado nesta entrega.
