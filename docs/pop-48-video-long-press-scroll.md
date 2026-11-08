# POP-48 — long press de 2× em conflito com o scroll

Data: 08/11/2026. Escopo: vídeo do feed, do tópico/perfil e da tela cheia
(`post-attachment.tsx` e `video-viewer.tsx`). Sem mudança de rota, API, design
fora do indicador de 2× ou dependência.

## Problema e o que foi confirmado

A auditoria estática no commit `12c0369` (S5 / Seção 4.8) apontou o long press
de **220 ms** do vídeo como possível gatilho acidental de 2× quando a pessoa
começa a rolar devagar. O `Pressable` já cancela o próprio long press acima de
10 de deslocamento, mas o timer pode disparar antes de a lista capturar o
responder — especialmente nos primeiros quadros de um arrasto lento.

O que foi confirmado nesta entrega, por inspeção estática e testes:

- os dois vídeos (célula e tela cheia) usavam `onLongPress` + `delayLongPress`
  de 220 ms, sem threshold explícito de arrasto;
- ao perder o responder para o scroll, o `onPressOut` já devolvia a velocidade
  para 1×; o problema era o intervalo até esse cancelamento;
- a tela cheia aplicava 2×, mas não mostrava o estado.

**Não houve reprodução em iPhone/Android real.** O gesto lento em aparelho, a
disputa com o `ScrollView`/`FlashList` e a sensação do threshold continuam
pendentes de validação física. Nenhuma métrica de fluidez foi medida.

## Mudança aplicada

- Novo `src/features/posts/components/video-hold.ts` centraliza o long press do
  vídeo com **220 ms** e tolerância explícita de **6** de deslocamento.
- Os movimentos do toque (`onPressMove` e `onTouchMove`) alimentam essa guarda:
  - se o dedo andar mais de 6 antes do tempo, o 2× **não ativa**;
  - se o arrasto começar depois de o 2× ativar, ele é **encerrado na hora**;
  - `onPressOut`/`onTouchCancel` também encerram, cobrindo o momento em que o
    scroll assume o responder.
- O long press só é aceito depois de um `pressIn` real. Um callback atrasado
  não reativa o 2× depois de um `pressOut`.
- O 2× voluntário continua em 220 ms, com o mesmo impacto leve e o mesmo
  `playbackRate` 2 → 1.
- A tela cheia passou a exibir o chip **2×** no topo enquanto a velocidade está
  ativa, com rótulo acessível; o feed ganhou o mesmo rótulo no chip existente.
- Fechar a tela cheia devolve o player a 1×.

O toque simples, a pausa/retomada, o som, o “Ver de novo” e o arrasto para
fechar a tela cheia continuam nos mesmos handlers.

A otimização de viewport não foi alterada: a guarda vive dentro do
`LoadedPostVideo`, que só é montado quando `visible` é verdadeiro, e o player
continua sendo liberado ao sair da viewport. Fora da tela, o pôster não paga
nenhum timer ou gesto novo.

## Testes automatizados

```bash
NODE_OPTIONS=--max-old-space-size=512 \
  npx jest src/features/posts/components/__tests__/post-attachment.test.tsx \
             src/features/posts/components/__tests__/video-viewer.test.tsx \
             src/features/posts/components/__tests__/post-attachment-fullscreen.test.tsx \
             --runInBand --ci
```

Cobrem:

- long press voluntário ativa 2× (`playbackRate` 2), dispara o impacto leve e
  desativa ao soltar;
- arrasto lento antes do tempo não ativa 2× nem dispara o impacto;
- arrasto depois do long press encerra o 2×;
- tap simples continua reproduzindo/pausando;
- na tela cheia, o chip de 2× aparece/some junto do gesto e som/fechar
  continuam acionáveis.

Resultado local: **3 suítes / 26 testes focados passaram**; a suíte completa
rodou com **160 suítes / 963 testes passando**. `eslint` passou; `tsc --noEmit`
passou com heap maior que o padrão do ambiente (o typecheck estourou 512 MB
nesta worktree).

## O que não foi validado

- **Aparelho iOS/Android:** gesto lento real no feed, tópico e tela cheia;
  convivência com o swipe horizontal de abas e com o scroll da lista.
- **Threshold de 6 em uso real:** pode ser apertado demais para mãos trêmulas
  ou telas com muito ruído; se o teste em aparelho mostrar perda de 2×
  voluntário, ajustar apenas a constante.
- **E2E:** não executado porque a mudança não altera rota, navegação,
  autenticação, onboarding ou formulário. A validação de fluxo com Playwright
  não substitui o gesto em aparelho.
