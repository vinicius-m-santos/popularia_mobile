# POP-59: inventário e refatoração incremental de telas extensas

Data: 06/11/2026. Referência: auditoria de fluidez (inspeção estática) no
commit `12c0369`, Seção 2.4. Escopo: os seis arquivos citados no ticket —
`create-post-screen.tsx`, `profile-screen.tsx`, `chamado-card.tsx`,
`square-screen.tsx`, `comuna-hero.tsx` e `manage-comuna-screen.tsx`.

## Objetivo e limites

Esta mudança extrai domínios estáveis que já estavam bem delimitados dentro das
telas, sem reescrever fluxos nem alterar contratos públicos. Não houve
migração automática por contagem de linhas: cada extração tem uma fronteira de
responsabilidade clara e os consumidores continuam usando os mesmos
componentes, rotas, textos, estilos e estados.

Não foram feitas medições novas de render, FPS, memória ou latência de teclado.
Os hotspots de render medidos continuam tratados nos tickets de performance
(POP-18, POP-19, POP-23 etc.); esta tarefa não declara ganho de desempenho.

## Inventário por arquivo

| Arquivo | Responsabilidades encontradas | Domínio estável extraído | Contrato preservado |
| --- | --- | --- | --- |
| `src/features/compose/create-post-screen.tsx` | destinos, tipos de post, editor, enquete, chamado, anexos, folhas e barra de publicar | `PollComposerCard` (formulário da enquete) e `PublishBar` (barra fixa de publicar) | `POLL_*`, `PollDraft`, `publish`, validações e rótulos acessíveis inalterados |
| `src/features/profiles/profile-screen.tsx` | abas, lista, identidade, atalhos, masthead e ações de perfil | `ProfileBar`, `ProfileShortcut`, `ProfileEditButton`, `Masthead`, `CollectiveSupport` e `RoleTag` | mesmos textos, ícones, navegação e `EditorialBar` |
| `src/features/events/chamado-card.tsx` | cartão do feed, presença, pilha de rostos e link de agenda | `chamado-attendance.ts` (hook de presença) e `chamado-card-model.ts` (funções puras) | `useChamadoAttendance` continua exportado por `chamado-card.tsx`; testes existentes seguem importando do mesmo caminho |
| `src/features/squares/square-screen.tsx` | cabeçalho do chat, lista invertida, reações, ações de mensagem e folhas | `SquareHeader`, `ChatDayRule`, `SheetAction` e `ReactionPicker` | mesma lista invertida, mesma janela de renderização e mesmos rótulos |
| `src/features/comunas/components/comuna-hero.tsx` | capa, marca, identidade, estatísticas, entrada, menu e oferta de transferência | `comuna-hero-state.ts` (estado de entrada), `use-comuna-mark.ts` (marca) e `comuna-hero-parts.tsx` (peças visuais) | mesmas regras de arquivada, pedido pendente, saída e envio da marca |
| `src/features/comunas/manage-comuna-screen.tsx` | chrome da gestão, abas de membros, pedidos e configurações | `manage-comuna-people-tabs.tsx` e `manage-comuna-settings-tab.tsx` | mesmas permissões, confirmações, paginação e chamadas de API |

## O que ficou de fora

- `create-post-screen.tsx` ainda concentra o formulário do chamado, a folha de
  destinos e os blocos de anexos. Esses domínios dependem de muito estado da
  tela e serão extraídos quando houver uma mudança funcional neles; fazer isso
  agora aumentaria o diff sem reduzir risco.
- O corpo de `ProfileContent` continua na tela porque abas, lista virtualizada
  e viewport de mídia compartilham o mesmo ciclo de layout.
- `chamado-card.tsx` mantém a composição visual do cartão no arquivo; apenas a
  lógica de presença e os cálculos puros saíram.
- Não houve mudança de rota, API, cache, autenticação ou onboarding. A
  validação em aparelho (teclado, foco, gestos e leitor de tela) não foi feita
  nesta máquina.

## Testes e validação

Cobertura adicionada para os recursos extraídos:

- `src/features/events/__tests__/chamado-card-model.test.ts`: pilha de rostos,
  nomes, frase de presença e link do Google Agenda.
- `src/features/comunas/__tests__/comuna-hero-state.test.ts`: entrada em comuna
  pública, participação, pedido pendente, arquivada e saída.
- `src/features/comunas/__tests__/use-comuna-mark.test.tsx`: envio da marca,
  erro e lock por comuna.

Regressão focada executada com Jest (`--runInBand`):

- edição/composer: `create-post-screen.test.tsx`;
- moderação: `comuna-screens.test.tsx` e `squares-ui.test.tsx`;
- RSVP/chamado: `chamado-card`, `chamado-attendance-effect` e
  `chamado-verification`;
- praça: `squares-ui.test.tsx`;
- perfil: `profile-screen.test.tsx`.

`npm run check:fast` (ESLint + TypeScript) passou. A suíte completa do Jest
passou com **172 suítes / 1043 testes** (`--runInBand`). E2E não foi executado
nesta mudança porque não há alteração de navegação, rota, autenticação,
onboarding ou formulário visível; o comportamento coberto continua o mesmo dos
testes existentes.
