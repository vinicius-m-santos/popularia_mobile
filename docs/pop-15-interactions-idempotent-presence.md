# POP-15: reducer de interações e presença de chamado idempotentes

Data: 05/11/2026. Escopo: `interactions-context` e `useChamadoAttendance`.
Sem dependências novas e sem mudança visual.

## Causa raiz

1. O reducer `set` sempre clonava o conjunto e o estado, mesmo quando todos os
   IDs já tinham o valor pedido. O `setOn` do `ChamadoCard` disparava duas
   ações ao montar (`goingEvents` e `maybeEvents`), então cada mount podia
   trocar a referência do contexto e acordar todos os consumidores.
2. O efeito de presença chamava `setOn` sem olhar o estado local. Em remontagens
   durante a rolagem (a lista recicla instâncias), a presença já correta era
   reafirmada e virava trabalho global.
3. A resposta assíncrona de presença ainda podia chamar `setBusy` depois de o
   cartão sair da tela.

## Alterações

- `src/features/interactions/interactions-context.tsx`:
  - `reducer` e `initialState` exportados para teste.
  - `set` compara o valor exato de cada ID (`current[id] === action.value`) e
    devolve o mesmo estado quando nada muda. A comparação é exata porque
    `undefined` ("ainda não conhecido") e `false` explícito têm significados
    diferentes em `membershipOf`: é o `false` que sobrepõe o `viewerIsMember`
    do servidor ao sair de uma comuna.
- `src/features/events/chamado-card.tsx`:
  - o efeito só despacha o campo que diverge do estado local;
  - os valores atuais são lidos por ref para o efeito não reexecutar a cada
    toque (cancelar a presença não pode ser desfeito pelo `viewerAttendance`
    antigo do servidor);
  - um ref de montagem evita `setBusy` depois do unmount;
  - `setAttendance` só despacha os campos que realmente mudam.
- Consumers avaliados: `PostCard`/`usePostActions` já isolam reação e
  salvamento por publicação (POP-13). Para presença, o bail-out elimina o
  dispatch de mount quando o estado já está correto; uma mudança real de
  presença continua atualizando o contexto. Não foi necessária uma store
  paralela nem troca de biblioteca.

## Evidência (Jest/host, Profiler de POP-5)

`src/features/performance/__tests__/chamado-presence-fanout.test.tsx` monta 6
cartões com presença já semeada, zera a sessão de medição e acrescenta mais 6
chamados (entrada de itens, como na rolagem). Resultado: 6 mounts novos e
**0 updates** nos cartões já montados.

`src/features/events/__tests__/chamado-attendance-effect.test.tsx` cobre mount
com `viewerAttendance` já refletido no estado local sem chamar `setOn`, alinha
quando o servidor diverge e não reafirma presença depois de um toque.

`src/features/interactions/__tests__/interactions-reducer.test.ts` cobre a
mesma referência para `set` repetido (true e false), ID novo, múltiplos IDs e
`set` vazio.

## Testes

```bash
NODE_OPTIONS=--max-old-space-size=512 \
  npx jest src/features/interactions/__tests__/interactions-reducer.test.ts \
             src/features/events/__tests__/chamado-attendance-effect.test.tsx \
             src/features/events/__tests__/chamado-card.test.tsx \
             src/features/performance/__tests__/chamado-presence-fanout.test.tsx \
             --runInBand
```

## Limitações

- A medição é Jest/host com o Profiler; não houve aparelho Android/iOS nesta
  entrega. Não foram medidos FPS, frames perdidos, memória, TTI nem
  `actualDuration` de build de release; nenhum ganho desses é declarado.
- O teste de rolagem acrescenta itens a um `ScrollView`, em vez de exercitar a
  reciclagem nativa da FlashList no aparelho.
- Não houve mudança de rota, navegação, autenticação, onboarding ou formulário;
  por isso não foi necessária navegação Playwright nova.
