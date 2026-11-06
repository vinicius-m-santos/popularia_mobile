# POP-18: estado de digitação isolado no composer de publicação

Data: 05/11/2026. Escopo: `src/features/compose/create-post-screen.tsx` e o
rascunho de "Escrever" (texto, título e menções). Sem mudança de rota, API,
biblioteca ou contrato de publicação.

## Problema

Texto e título usavam `useState`/`useMentionDraft` na mesma função que guarda
destinos, enquete, chamado, capacidade, mídia, eventos, PDF, folhas e prévia.
Cada tecla atualizava o estado da tela inteira e reconciliava todos os painéis
já montados (destino, tipos, editor, painel de anexos e barra de publicar).

## Medição antes da alteração (host, não device)

Foi instrumentado um contador de renders da função `CreatePostScreen` e
executado um teste de componente no Jest com cinco `changeText` consecutivos:

| Cenário | Renders do composer |
| --- | --- |
| 5 teclas no corpo | **5** (1 por tecla) |

Esse número mede apenas a função da tela no host. Não é FPS, memória nem
latência de teclado em aparelho. O Profiler em device continua pendente.

## Implementação

- `src/features/compose/write-draft.ts` criou uma store externa com
  `subscribe`/`getSnapshot`:
  - o editor assina o snapshot completo (texto, título, menções, cursor,
    seleção e query de menção);
  - a tela assina só `subscribeContent`, que notifica quando `hasContent`
    muda de vazio para preenchido ou vice-versa.
- `create-post-screen.tsx` deixou de manter texto/título em `useState` e passou
  a ler a store no clique de publicar e ao montar a prévia. Validação,
  `dirty`, `usePreventRemove`, upload, PDF, enquete e chamado continuam usando
  os mesmos fluxos; o snapshot é lido na hora da publicação.
- O editor virou `WriteEditor`, com identidade estável e assinatura própria da
  store. Foto, painel de destino e grade de tipos foram extraídos para
  componentes nomeados e instrumentados com `withPerformanceProfiler`.
- O rascunho sobrevive à troca de modo (enquete/chamado/escrita), porque a
  store pertence à tela e não ao editor desmontado.

## Critérios de aceite

- [x] Digitar no corpo não reconcilia destino, grade de tipos nem moldura de
      foto: teste de Profiler confirma zero commits de atualização nesses
      componentes enquanto o editor continua atualizando.
- [x] Prévia e campos dependentes continuam sincronizados: teste alterna
      prévia, título e corpo e compara o item entregue ao `PostCard`.
- [x] Rascunho, validações, publicação, PDF, enquete, mídia e
      `usePreventRemove` seguem cobertos pelos testes existentes do composer.
- [x] Alternar para enquete e voltar preserva o texto digitado.

## Testes

- `src/features/compose/__tests__/write-draft.test.ts`: snapshot, notificação
  só na mudança de presença, título vazio, menções e reset.
- `src/features/compose/__tests__/create-post-screen.test.tsx`: isolamento por
  Profiler, prévia sincronizada, preservação ao trocar de modo e todos os
  cenários anteriores (perfil/comunas, imagem, PDF, enquete, falha/retry).
- `e2e/specs/composer-typing.spec.ts`: smoke no app web real (Expo Router +
  Metro) que abre o composer pela entrada do feed, digita, alterna prévia,
  enquete e chamado e confirma que o rascunho e o título voltam ao modo
  "Escrever".
- Suítes de compose executadas: 4 suítes / 25 testes.
- Suíte completa: 123 suítes / 728 testes.
- E2E: 34 testes passaram e 1 `fixme` já existente ficou pulado, incluindo o
  novo smoke do composer.
- `npm run check:fast`: ESLint e TypeScript passaram.

## Limitações

- **Não é medição de ganho em device.** O contador e o Profiler rodam em Jest;
  não medem FPS, frames perdidos, memória, latência do teclado nativo nem o
  custo real de layout no iPhone/Android.
- Não houve smoke test manual em aparelho. Teclado, foco, menções e folhas
  nativas precisam de inspeção em device.
- Enquete e chamado ainda mantêm seus campos no estado da tela. O escopo desta
  tarefa é a digitação do corpo (modo "Escrever"); isolar esses formulários
  fica para uma mudança própria.
