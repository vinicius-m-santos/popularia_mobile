# POP-44 — auditoria de panning e dismiss das sheets roláveis

## Método

Inspeção estática dos consumidores de `BottomSheet` no commit de partida da
`ai/pop-44`, complementada pelos testes focados de componente. Não houve
execução em aparelho Android/iOS nesta sessão; a matriz de dispositivo abaixo
continua pendente e não deve ser tratada como medida.

## Inventário (16 arquivos, 26 instâncias)

| Consumidor | Folha(s) | Conteúdo / rolagem | Input | Busy |
| --- | --- | --- | --- | --- |
| `src/components/select-field.tsx` | seleção de opções | lista dinâmica | não | não |
| `src/components/tab-bar.tsx` | menu de criação | menu + ilustração | não | não |
| `src/features/compose/create-post-screen.tsx` | biblioteca | `FlatList` virtualizada | não | publicação tem spinner e barra bloqueada |
| | vincular evento | lista dinâmica | não | não |
| | onde publicar | lista longa + busca | `PopulariaBottomSheetTextInput` | não |
| | escolher assuntos | taxonomia longa | não | não |
| `src/features/comunas/components/comuna-hero.tsx` | opções da comuna | menu curto (`scrollable={false}`) | não | não |
| `src/features/comunas/manage-comuna-screen.tsx` | ações do membro | menu dinâmico curto | não | fecha antes da chamada |
| `src/features/explore/explore-screen.tsx` | todos os assuntos | taxonomia longa | não | não |
| `src/features/gamification/help-sheet.tsx` | como funciona | blocos de texto | não | não |
| `src/features/library/collection-editor.tsx` | nova/editar coleção | formulário curto | `TextField` | `dismissible={!busy}` e “Salvando…” |
| `src/features/library/document-screen.tsx` | opções do documento | menu curto | não | não |
| | denunciar documento | motivos + campo | `PillButton` | `dismissible={!busy}` e “Enviando…” |
| `src/features/library/library-screen.tsx` | assunto, ordenação, ações | menus curtos | não | não |
| `src/features/media/image-change-sheet.tsx` | foto/capa | preview curto (`scrollable={false}`) | não | `dismissible={!busy}` |
| `src/features/moderation/actions-sheet.tsx` | menu, motivo, detalhes, sucesso | formulário e lista | `PopulariaBottomSheetTextInput` | “Enviando…” e dismiss bloqueado (ajustado) |
| `src/features/moderation/moderation-screen.tsx` | restringir | formulário de opções | não | decisão local |
| `src/features/onboarding/components/single-topic-field.tsx` | escolher assunto | taxonomia longa | não | não |
| `src/features/onboarding/setup-screen.tsx` | foto de perfil | menu curto (`scrollable={false}`) | não | ações desabilitadas durante a troca |
| | país | `FlatList` virtualizada + busca | `PopulariaBottomSheetTextInput` | não |
| `src/features/squares/square-screen.tsx` | presença, figurinhas, praça | listas/menus dinâmicos | não | não |
| | mensagem (denunciar/remover) | motivos + campo | `TextField` | “Enviando…” e ações desabilitadas |

## Problema identificado na inspeção

O default anterior era `contentPanningGesture = dismissible`. Com isso, toda
folha rolável nascia com o pan de conteúdo do Gorhom ligado: um arrasto para
baixo no topo da lista podia ser interpretado como dismiss da folha em vez de
rolagem. O mesmo valia para as folhas virtualizadas (`FlatList`).

## Decisão aplicada

- O default de `contentPanningGesture` passou a depender do conteúdo, não de
  `dismissible`: fica **desligado** em `scrollable`/`virtualized` e **ligado**
  em conteúdo curto (`BottomSheetView`). Uma folha pode reativar o pan de
  conteúdo explicitamente com `contentPanningGesture`.
- `dismissible` continua sendo o portão final: folha não dismissível não tem
  pan de conteúdo, pan da alça, backdrop de fechamento nem back do Android.
- O arrasto pela alça de 44 px e o backdrop continuam fechando as folhas
  roláveis; o gesto vertical dentro da lista fica com a lista.
- A folha agora monta com `index={-1}` e `animateOnMount={false}` e só chama
  `snapToIndex(0)` depois que o conteúdo reporta layout. Isso evita a primeira
  abertura parcial seguida de salto quando o conteúdo dinâmico termina de medir.
- `actions-sheet` mantém o estado de envio no provedor: enquanto a denúncia está
  em voo, a folha fica `dismissible={false}` e o botão mostra “Enviando…”.
- `EditorialAction` ganhou `busy` opcional para anunciar o estado a tecnologias
  assistivas sem depender só da opacidade de desabilitado. Ele é usado nos envios
  de denúncia, coleção e mensagem da praça.

O `Modal` nativo por folha foi mantido. Ele garante que a folha cubra a navegação
inteira, inclusive as ações abertas no provedor raiz; trocar por um host/portal
global seria uma mudança estrutural sem evidência medida de ganho. O que foi
corrigido é a estabilidade da abertura: a folha nasce fechada e só abre depois da
medição, em vez de iniciar a animação e depois saltar para a altura final.

## O que ainda precisa de aparelho

A matriz Android/iOS (fonte ampliada, teclado externo e reaberturas) não foi
executada. Em aparelho, confirmar:

1. Arrastar a lista no topo para baixo rola o conteúdo e não fecha a folha.
2. A alça e o backdrop continuam fechando a folha; o back do Android também.
3. Teclado aberto não perde a posição da lista nem esconde o campo ativo.
4. Primeira abertura e reaberturas não mostram salto de altura.
5. Estado de envio bloqueado é visível e não permite dispensar por gesto/back.

Sem essas medições, não há números de tempo de primeira abertura nem de fluidez.

## Validação executada nesta sessão

- `npm run lint` e `npm run typecheck` verdes. O typecheck precisou de
  `--max-old-space-size=1024`; com 512 o processo estourou o heap.
- Jest focado com `--runInBand`: 7 suítes e 60 testes verdes, cobrindo
  `bottom-sheet`, `create-post`, moderação, praças/posts fixados, comentários e
  troca de imagens. Os 5 casos novos de `bottom-sheet` e `actions-sheet` também
  passaram isolados.
- Playwright: `e2e/specs/report-success.spec.ts` (3 testes) e
  `e2e/specs/mobile-ux-smoke.spec.ts` (6 testes) passaram no Chromium. O smoke
  abriu a folha de destino, manteve foco e valor no campo e confirmou o retorno
  ao rascunho. O log do Gorhom no web registrou um erro de `currentlyFocusedInput`
  no blur do `BottomSheetTextInput`; o fluxo continuou e o teste passou, mas o
  aviso é do adaptador web da biblioteca e não foi alterado aqui.
