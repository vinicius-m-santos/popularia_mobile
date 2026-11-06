# POP-21: viewport e autoplay de vídeo nas publicações da comuna

Data: 05/11/2026. Escopo: lista de publicações da comuna (FlashList de POP-28),
o contrato `mediaVisible` do `PostCard`, o `PostAttachment` e o coordenador
global `activePlayer`.

## Problema

A comuna herdava o cartão do feed, mas a lista e a viewability chegaram em
entregas separadas. Faltava confirmar, na lista virtualizada, que só os vídeos
realmente visíveis inicializam player, que o scroll rápido não deixa player
órfão e que troca de aba/navegação/desmontagem coordenam com o player global.

## Auditoria: o que já existia

- **POP-28** (`f88067b`): lista de publicações da comuna em `FlashList`, com
  `useListVisibility`, `mediaViewabilityConfig`, `extraData` e
  `mediaVisible={visibility.visibleIds.has(item.id)}` por `postId`.
- **POP-20** (`db338a2`, merged na `main`):
  - `PostCard.mediaVisible` passou a ter default **`false`**;
  - tópicos e salvos receberam o mesmo contrato;
  - `PostAttachment` desmonta o player e volta ao pôster quando `visible` é
    falso, sem sequer chamar `useVideoPlayer`;
  - `activePlayer` pausa o player anterior ao iniciar outro, mantendo no máximo
    uma reprodução;
  - o autoplay é bloqueado com o app em `background`, `inactive` ou `extension`,
    e qualquer player é pausado ao sair de `active`;
  - a prévia do composer e o harness de QA passam `mediaVisible` explícito.

Ou seja: os critérios de "só visível monta player", "um vídeo por vez",
"desmonta ao sair da viewport" e "não toca em background" já estavam
implementados e testados no cartão. O que faltava era **evidência no nível da
comuna** (200+ publicações e 3+ vídeos) e um caso de borda na troca de aba.

## Lacuna encontrada

`useListVisibility` mantinha o conjunto de IDs visíveis depois de a lista ser
desmontada pela troca de aba. Ao voltar para "Publicações", os IDs da janela
anterior ainda marcavam cartões como visíveis antes de a nova
`onViewableItemsChanged` chegar. Em uma lista reciclada, um vídeo podia montar
player e tocar antes de o cartão estar visível de novo. Na prática a janela é
curta, mas quebra o contrato "só inicializa o que está efetivamente visível".

## Mudanças

- `src/hooks/use-list-visibility.ts`: novo `clear()`, que zera o conjunto sem
  alterar o callback. O default dos demais consumidores continua igual.
- `src/features/comunas/comuna-screen.tsx`: ao sair da aba "Publicações", a
  viewport da lista desmontada é esquecida. Na volta, os cartões começam como
  pôster até a nova viewability confirmar quem está na tela.
- `src/features/comunas/__tests__/comuna-media-visibility.test.tsx`: testes de
  integração da comuna com o `PostCard`/`PostAttachment` reais e player
  simulado.

Não houve mudança de design, de rotas ou de componentes compartilhados. A
implementação de POP-20 e POP-28 foi preservada; o único comportamento novo é
não reaproveitar uma viewport que não existe mais.

## Como o fluxo funciona

1. A `FlashList` da comuna monta a janela de células com
   `mediaVisible={false}` por padrão.
2. `viewabilityConfig` = 20% do item visível por 100 ms; o callback entrega as
   chaves (`postId`) da viewport atual.
3. O `PostCard` repassa `mediaVisible` ao `PostAttachment`. Falso ⇒
   `VideoPoster` (pôster/duração) e **nenhum** `useVideoPlayer`.
4. Verdadeiro ⇒ player monta, toca mudo e vira o `activePlayer`; o anterior é
   pausado.
5. Sair da viewport, trocar de aba, sair da rota (desmontagem) ou ir para
   segundo plano desmonta ou pausa o player.

## Testes e contadores

O teste novo usa o fixture determinístico de QA (POP-5/POP-28): **200
publicações, 66 vídeos** (uma a cada três), com pôster/duração e player
simulado. A lista é um duplo que monta 40 cartões e permite disparar a viewport
pelo teste; a virtualização em si já é coberta em POP-28. Os contadores vêm de
`src/lib/performance` (`video.mountedNow`, `video.playingNow`,
`counters.videoMounts` e eventos `mount`/`unmount`/`play`/`pause`).

| Cenário | Resultado observado (Jest host) |
| --- | --- |
| 200 publicações, nenhuma viewport confirmada | 0 players montados, 0 tocando; `useVideoPlayer` não chamado |
| 3 vídeos na viewport | 3 montados, **1 tocando** |
| Scroll rápido para outros 3 vídeos | 3 montados, 1 tocando, `videoMounts = 6`; os 3 primeiros receberam `unmount` |
| Viewport vazia | 0 montados, 0 tocando |
| Troca para "Regras" | 0 montados, 0 tocando |
| Volta para "Publicações" antes da nova viewability | 0 montados, 0 tocando (viewport antiga descartada) |
| Nova viewport com 1 vídeo | 1 montado, 1 tocando |
| Desmontagem da tela | 0 montados, 0 tocando |
| App em `background` com vídeo tocando | `pause` chamado; 0 tocando |
| Configuração da lista | a mesma `mediaViewabilityConfig` do feed |

Validação executada:

- `npm run check:fast`: ESLint e TypeScript passaram.
- Jest focado: **13 suítes / 79 testes** passaram (comunas, `PostCard`,
  `PostAttachment`, feed, tópico e salvos), incluindo os 6 testes novos.
- Suíte completa (`npm run check`): **110 suítes / 619 testes** passaram.

Esses números provam a política de montagem/desmontagem no host. **Não são
métricas de performance de device**: não medem FPS, memória, TTI nem o tempo
real de viewability.

## Critérios de aceite

- [x] Comuna com 200 publicações e 3+ vídeos mantém players apenas para os itens
      confirmados na viewport (teste de integração com 200 posts e 66 vídeos).
- [x] Scroll rápido troca a viewport e desmonta os players da janela anterior,
      sem órfãos (`unmount` por mídia + contadores).
- [x] Comportamento igual ao feed: mesmo hook, mesma configuração e
      `mediaVisible` por `postId`.
- [x] Troca de aba e desmontagem liberam os players.
- [x] No máximo um vídeo reproduzindo ao mesmo tempo e nenhum autoplay em
      background (coberto no cartão desde POP-20 e revalidado na comuna).

## Navegação e limites conhecidos

- **Voltar/sair da comuna** desmonta a rota (e o `popToTopOnBlur` das abas
  também a desmonta); os players são liberados no unmount, coberto pelo teste.
- **Abrir uma publicação por cima da comuna** mantém a lista montada na pilha
  nativa. O vídeo visível continua montado e mudo até a comuna ser desmontada ou
  outro player assumir. É o mesmo comportamento do feed e não foi alterado
  neste card: uma pausa por foco exigiria um contrato de navegação compartilhado
  entre todas as listas. Implementado no **POP-69**
  (`docs/pop-69-route-media-focus.md`): o foco da rota passou a fazer parte da
  visibilidade da mídia.
- O limiar de 20% por 100 ms é o contrato atual: um cartão 20% visível já pode
  manter player. Ajustar esse número muda a sensação de autoplay e pede
  validação em device.

## Validação em device (pendente)

Não houve aparelho/emulador neste ambiente, então **nada foi validado em
iOS/Android**. O fixture de 200 publicações é só de teste: a API/demo não
entrega essa massa pronta. Para medir no aparelho:

1. Build de desenvolvimento com `EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1` e
   `EXPO_PUBLIC_APP_ENV` diferente de `production`.
2. Abrir a comuna com 200+ publicações e pelo menos 3 vídeos (semear a API ou
   usar um fixture temporário de desenvolvimento; não versionar).
3. Em `/diagnostico-performance`, conferir "Players montados", "Tocando agora" e
   "Montagens de vídeo" antes/depois de: rolar devagar, rolar rápido, parar
   sobre 3 vídeos, trocar de aba, voltar, abrir uma publicação, voltar e mandar o
   app para segundo plano.
4. Esperado: montados = vídeos confirmados na viewport; "Tocando agora" ≤ 1;
   aba/rota/background sem players órfãos.

Também precisa de device: a física real da viewability, a geração do pôster
(`generateThumbnailsAsync`), o autoplay/pausa do `expo-video` no iOS e no
Android, a memória com vários vídeos já visitados e o comportamento da pilha ao
abrir uma publicação por cima da comuna.
