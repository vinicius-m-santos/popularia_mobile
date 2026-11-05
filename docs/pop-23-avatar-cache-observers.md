# POP-23: cache de avatares e crescimento de observers

Data: 05/11/2026. Escopo: `Avatar`, overlay de foto compartilhado e política de
GC no cache de queries. Sem mudança de layout, rota, API ou dependência.

## Causa raiz

`useAvatarUrl` chamava `useQuery` para **todo** avatar, com `enabled: false` e
`gcTime: Infinity`. Mesmo sem foto publicada, cada `userId` distinto criava uma
query e um observer do TanStack Query. Ao rolar uma lista longa, as queries de
quem saía da árvore continuavam no cache para sempre; o observer em si era
desmontado com a célula, mas o custo de montar/assinar e o acúmulo de entradas
por pessoa permaneciam.

O overlay de foto existe para a troca feita nesta sessão (`publishAvatar`), não
para substituir a foto que já veio no perfil/feed. O caminho anterior não usava
essa distinção: todo avatar consultava a query, inclusive quando o dado já
estava no próprio componente.

## Política implementada

- **Store por pessoa em `src/lib/avatar-cache.ts`.** A URL publicada fica em um
  `Map` com limite de 200 entradas e assinatura por `userId` via
  `useSyncExternalStore`. Trocar a foto de uma pessoa re-renderiza apenas os
  avatares dela; nenhum observer do TanStack Query é criado.
- **Sem assinatura desnecessária.** Foto local (`file:`, `content:`, `blob:`,
  `ph:`, `assets-library:`) tem prioridade e não assina nada. Avatar sem
  `userId` também não assina. O `imageUrl` recebido continua sendo a fonte
  quando não há troca publicada nesta sessão.
- **Atualização após upload preservada.** `publishAvatar` publica no store e
  mantém `queryClient.setQueryData(['user-avatar', userId], url)` para
  compatibilidade e inspeção, depois patcheia as queries já carregadas. O store
  avisa os avatares montados mesmo quando o `imageUrl` recebido ainda é o
  antigo.
- **GC finito.** `src/lib/query/client.ts` define a raiz `user-avatar` com
  `staleTime: Infinity` e `gcTime: 5 min` (antes era `Infinity`). A entrada
  publicada não é mais retida para sempre depois que ninguém a observa.
- **Troca de conta.** `clearAvatarCache()` limpa o store e as queries
  `user-avatar` em `startSession`, `clearSession` e `resetToSignedOut`; foto da
  conta anterior não vaza para a próxima.
- **LRU de 200 no overlay.** O caso real é uma foto por sessão; o teto evita
  crescimento artificial em uma sequência de publicações. A URL antiga
  permanece nos dados de perfil/feed, então a evicção não apaga a imagem da
  tela.

## Medições (Jest/host, sem device)

Cenário do teste `src/components/__tests__/avatar-cache.test.tsx`: 250 avatares
com `userId` distintos, metade com foto e metade sem foto. O teste lê o
`QueryCache` do TanStack Query, não uma estimativa.

| Medida | Antes (implementação anterior) | Depois |
| --- | --- | --- |
| Queries `user-avatar` após montar 250 avatares | 250 (uma por `userId`) | 0 |
| Observers de query somados | 250 | 0 |
| Queries após uma troca de foto | 1 por pessoa | 1 (a publicação explícita) |
| Observers da query publicada | 1 | 0 |
| `gcTime` da raiz `user-avatar` | `Infinity` | `300000 ms` |

Os valores "antes" são o comportamento direto da implementação removida
(`useQuery` com `enabled: false` para cada `userId`), não uma medição de build
antiga. **Não são FPS, memória, TTI nem latência de rede.** O teste também
confirma que a foto local continua vencendo, que os dois avatares da mesma
pessoa recebem a URL nova e que o avatar de outra pessoa não muda.

## Testes

```bash
NODE_OPTIONS=--max-old-space-size=512 \
  npx jest src/components/__tests__/avatar-cache.test.tsx \
             src/features/media/__tests__/image-cache.test.ts \
             src/features/media/__tests__/profile-images.test.tsx \
             src/features/account/__tests__/account-context.test.tsx \
             src/lib/api/__tests__/client.test.ts \
             --runInBand --ci
```

Resultado: **5 suítes / 36 testes passando**. Cobrem:

- 250 avatares com e sem foto: nenhuma query ou observer criado;
- publicação de foto atualiza os avatares montados da pessoa, sem observer de
  query;
- quem grava direto em `['user-avatar', id]` continua atualizando o avatar montado;
- a query publicada é recolhida após 5 min sem observers;
- foto local tem prioridade sobre o overlay;
- `clearAvatarCache` devolve os avatares ao dado de origem e remove as queries;
- upload de perfil continua publicando em `['user-avatar', id]`;
- logout/limpeza de sessão continua limpando o cache.

Também foram executados `npx tsc --noEmit` e ESLint nos arquivos alterados,
sem erros. O gate completo `npm run check` passou com **120 suítes / 702 testes**
(havia avisos de `act(...)` e de worker do Jest já presentes na suíte, sem
falha).

## Validação em device (pendente)

Não houve aparelho/emulador neste ambiente. Para validar de verdade:

1. Build de desenvolvimento/staging com
   `EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1`, abrir feed/comuna com 200+
   autores distintos e rolar por várias telas.
2. Inspecionar o `QueryCache` no app (ou a tela de diagnóstico, se receber uma
   leitura de queries/observers): a raiz `user-avatar` deve ficar vazia durante
   a rolagem, sem uma entrada por autor.
3. Abrir perfis distintos, voltar ao feed e rolar de novo; repetir a inspeção.
4. Trocar a foto em Perfil, voltar ao feed/comentários e confirmar que os
   avatares da mesma pessoa mostram a URL nova sem request em cascata.
5. Sair e entrar em outra conta; confirmar que nenhuma foto da conta anterior
   aparece.
6. Medir memória nativa e frames no Android Studio/Perfetto e no Instruments.
   Os contadores do Jest e a inspeção do cache não são métricas de memória.

## Limitações

- O store em memória é limitado por entradas, não por bytes; uma URL de avatar é
  pequena, mas o custo real de imagens continua sendo do `expo-image`.
- O overlay publicado por `publishAvatar` é do processo atual. Se o servidor
  devolver uma URL mais nova em um refetch, o dado da query de perfil/feed
  continua sendo a fonte para quem não tem overlay; a foto publicada nesta
  sessão tem prioridade, como antes.
- A suíte não prova FPS, memória, TTI nem comportamento de listas nativas com
  200+ avatares. Isso exige o roteiro de device acima.
- Não houve mudança de rota, navegação, autenticação, onboarding ou formulário;
  a validação Playwright de fluxo não se aplica a este card.
