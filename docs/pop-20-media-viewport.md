# POP-20: mídia fora da viewport em tópicos e salvos

Data: 05/11/2026. Escopo: listas de tópico e de publicações salvas, com o
contrato de `mediaVisible` do `PostCard`.

## Problema

`TopicScreen` e `SavedPostsPane` renderizavam `PostCard` sem `mediaVisible`. O
default do cartão era `true`, então cada vídeo dessas listas montava um player
mesmo fora da viewport. O feed, o perfil e a comuna já passavam viewability; as
duas listas ficaram de fora.

## Dependências verificadas

- **POP-13** (`f7b4635`) e **POP-14** (`641b913`): presentes na branch; não
  foram reimplementados.
- **POP-28** (`ebae546`): é o HEAD da branch atual; a lista de publicações da
  comuna já usa `useListVisibility` + `mediaViewabilityConfig`.
- **POP-35** (revalidação preservando páginas): não implementado, conforme o
  próprio `docs/pop-28-comuna-flashlist.md`. Esta entrega não depende dele e
  não o antecipa.

## Implementação

- `PostCard.mediaVisible` passou a ter default **`false`**. Todos os
  consumidores foram conferidos:
  - feed, perfil e comuna já passavam o conjunto de IDs visíveis;
  - tópico e salvos agora passam `visibility.visibleIds.has(item.id)`;
  - a prévia do composer passa `mediaVisible` explicitamente: é um cartão único,
    não uma lista reciclada, e mantém o comportamento anterior;
  - o harness de QA e os testes passam `false` de propósito.
- `TopicScreen` e `SavedPostsPane` receberam `extraData`,
  `onViewableItemsChanged` e `viewabilityConfig` (20% visível por 100 ms), com a
  visibilidade controlada por `postId`.
- O `PostAttachment` continua desmontando o player e mostrando `VideoPoster`
  quando `visible` é falso. Com `mediaVisible` falso, nem `useVideoPlayer` é
  chamado.
- O player global (`activePlayer`) continua pausando o vídeo anterior ao iniciar
  outro, mantendo no máximo uma reprodução.
- O início da reprodução agora também é bloqueado nos estados `background`,
  `inactive` e `extension` do `AppState`; o listener já pausava qualquer player
  ao sair de `active`. `null`/`unknown` continuam permitindo o autoplay inicial,
  como antes.

## Testes e evidências

Testes adicionados/atualizados (Jest, host — não são métricas de device):

- `src/features/posts/components/__tests__/post-card-media-visibility.test.tsx`
  - `mediaVisible={false}`: 0 players, pôster com duração visível.
  - default sem prop: 0 players.
  - 3 vídeos na viewport: `mountedNow = 3`, `playingNow = 1`; os dois primeiros
    players recebem `pause`.
  - rolagem simulada de `v1` para `v2`: `mountedNow` continua 1, `v1` desmonta e
    `v2` monta.
  - `background`/`inactive` no mount: nenhum `play()`.
- `src/features/hashtags/__tests__/topic-screen.test.tsx`: lista de 30 posts,
  viewability entrega `mediaVisible` só ao `postId` visível e desliga o anterior
  ao rolar.
- `src/features/library/__tests__/saved-posts-visibility.test.tsx`: mesma
  validação para salvos.
- Suítes relacionadas (tópico, salvos, `PostCard`, `PostAttachment`, feed,
  perfil, comuna/POP-28, harness de QA e composer): **50 testes passaram**.
- Suíte completa: **109 suítes / 613 testes passaram**.
- `npm run check:fast`: ESLint e TypeScript passaram.

Os contadores vêm de `src/lib/performance` (`video.mountedNow`,
`video.playingNow`, `video.mounts`) e são do Jest host; não medem FPS, memória
nem TTI.

## Limitações

- **Não validado em aparelho.** A física da viewability (20% por 100 ms), o
  momento exato do autoplay/pausa, a geração do pôster e o comportamento real do
  `expo-video` em iOS/Android continuam pendentes de inspeção em device.
- **Sem Playwright nesta entrega**: não houve mudança de rota, navegação,
  autenticação, onboarding ou formulário. A validação de fluxo não substitui a
  inspeção visual no aparelho.
- A viewability é local a cada lista. O POP-21 (viewport compartilhada entre
  listas) continua fora do escopo; a garantia de um player global é feita pelo
  `activePlayer`, não por um coordenador central de listas.
- Até o primeiro quadro virar pôster, o vídeo fora da viewport usa a listra
  escura da casa. Em produção a miniatura depende do `generateThumbnailsAsync`
  do player; na web ela não é gerada.
- O teste de "no máximo um" usa players simulados. A confirmação final depende
  de device com pelo menos três vídeos reais na mesma lista.
