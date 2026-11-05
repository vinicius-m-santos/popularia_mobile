# POP-30: `mediaVisible` por item, sem `extraData` global no feed

Data: 05/11/2026. Escopo: viewport de mídia das listas de publicações (feed,
perfil, comuna, tópico e salvos) e o contrato `mediaVisible` do `PostCard`.

## Problema

`useListVisibility` guardava o conjunto de IDs visíveis em `useState`. A cada
mudança de viewport, a tela inteira re-renderizava e a lista recebia
`extraData={visibleIds}`; o `renderItem` inline também trocava de identidade.
Com isso, a FlashList reconsiderava todas as células a cada rolagem, mesmo que
só um ou dois cartões tivessem entrado ou saído da viewport.

## Implementação

- `src/hooks/use-list-visibility.ts` passou a expor uma viewport observável:
  - `onViewableItemsChanged` atualiza um `Set` fora do estado do React;
  - `subscribe(postId, listener)` registra cada cartão pelo próprio ID;
  - a notificação compara a janela anterior com a nova e avisa **somente** os
    IDs que entraram ou saíram;
  - `clear()` esquece a janela e notifica os IDs que estavam visíveis;
  - `useListVisibility(resetKey)` cria uma viewport vazia quando a chave muda
    (aba do feed/comuna, aba do perfil ou tópico), em vez de deixar IDs da
    janela anterior montarem players antes da nova viewability.
- `MediaVisibilityProvider` leva a viewport da lista até os cartões.
- `PostCard` usa `useMediaVisible(item.id)`; um `mediaVisible` explícito
  continua vencendo a assinatura e é o caminho da prévia do composer, do
  harness de QA e dos testes de cartão isolado. Sem provider, o default segue
  seguro: mídia oculta.
- Feed, perfil, comuna, tópico e salvos deixaram de passar
  `extraData={visibleIds}` e `mediaVisible={ids.has(...)}` no `renderItem`.
  O feed também estabilizou `renderItem`/`getItemType` com `useCallback`.
- O comportamento de autoplay não mudou: apenas o cartão confirmado na viewport
  monta player, fora dela fica o pôster, e o player global continua mantendo no
  máximo uma reprodução.

## Critérios de aceite

- [x] Mudança de viewport atualiza só os cartões que entraram/saíram: teste do
      hook mede os renders e confirma que um cartão fora da mudança não
      re-renderiza.
- [x] A lista não recebe `extraData` de viewport nem `renderItem` re-criado a
      cada rolagem: teste do feed conserva a mesma referência de props durante
      a mudança de janela.
- [x] Vídeos continuam obedecendo à viewport: testes de cartão/comuna com
      player simulado mantêm players apenas para os IDs visíveis, com no máximo
      um tocando.
- [x] Troca de aba/desmontagem começa com a viewport vazia:
      `useListVisibility(resetKey)` e o teste de troca de aba da comuna.

## Validação executada

- `npm run check:fast`: ESLint e TypeScript passaram.
- Jest focado (hook, feed, tópico, salvos, comuna, cartão, perfil e
  performance): passou.
- Suíte completa: **119 suítes / 697 testes** passaram.
- Não houve mudança de rota, navegação, autenticação ou formulário; por isso
  `npm run test:e2e` não foi executado.

## Limitações

- **Não é medição de ganho.** Os testes provam a política de notificação e a
  estabilidade das props no host Jest; não medem FPS, frames perdidos, memória,
  TTI nem o tempo do React Profiler.
- **Não validado em aparelho.** A física da viewability (20% visível por
  100 ms), o autoplay/pausa reais do `expo-video`, a reciclagem da FlashList e a
  troca de aba precisam de inspeção em device iOS/Android.
- O Profiler em aparelho continua pendente: comparar commits de `PostCard`
  antes/depois durante rolagem rápida, com a instrumentação de POP-5 ligada.
