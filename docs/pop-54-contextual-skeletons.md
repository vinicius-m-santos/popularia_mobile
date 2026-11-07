# POP-54: skeletons contextuais no lugar de spinners integrais

Escopo: comuna, discussão, avisos e perfil. Sem mudança de rota, contrato de API
ou biblioteca nova. Os estados de carregamento passam a reservar o formato real
do conteúdo, sem shimmer, timers ou animação.

## O que mudou

- `components/list/popularia-list-skeleton.tsx` ganhou variantes estáticas para
  publicação, linha compacta, aviso, comentário e grade de mídia. Também expõe
  silhuetas de tela inteira para comuna, perfil e discussão.
- O contêiner acessível anuncia `progressbar` com `busy: true` e um único rótulo
  (`Carregando comuna`, `Carregando perfil`, `Carregando discussão`,
  `Carregando avisos`, `Carregando publicações`). Os blocos decorativos ficam
  ocultos das tecnologias assistivas.
- `comuna-screen.tsx`: o primeiro frame sem detalhe em cache mostra capa, marca,
  título, descrição, estatísticas, abas e publicações no formato final. A lista
  de publicações em carregamento usa o skeleton de post.
- `discussion-screen.tsx`: o detalhe da publicação e os primeiros comentários
  usam a mesma silhueta; o cabeçalho real continua no topo.
- `notifications-screen.tsx`: os avisos em carregamento usam linhas com avatar
  quadrado, selo e linhas de texto no lugar do spinner.
- `profiles/profile-screen.tsx`: perfil sem cache usa a silhueta de identidade,
  abas e publicações; a mídia usa a grade de quadrados.

## Perfil de terceiros

`profileKeys.summary` guarda um resumo mínimo da identidade já visível na lista
ou no cartão. `prepareProfileFromUser` grava esse resumo e `profileOptions` o usa
como `placeholderData`, então nome, @ e foto aparecem no primeiro quadro
enquanto o detalhe chega. O resumo não inclui bio, contagens, comunas ou relação:
esses dados só aparecem quando o servidor confirma. Se o detalhe falhar enquanto
só há resumo, a tela mostra erro com retry — o placeholder não esconde a falha.

## Revalidação

Os dados anteriores continuam na tela durante revalidações. O skeleton só entra
quando a consulta ainda não tem dado; falha de atualização mantém o conteúdo e
expõe o aviso com retry. O comportamento segue as políticas de frescor de
POP-37/38 (`contentPolicy.profile` e `contentPolicy.comuna`).

## Validação executada

- `npx tsc --noEmit`: passou.
- `npm run lint -- --no-cache`: passou.
- Jest focado, `--runInBand`: 49 testes em
  `popularia-list-skeleton.test.tsx`, `profile-screen.test.tsx`,
  `comuna-posts-list.test.tsx`, `discussion-screen.test.tsx`,
  `notifications-screen.test.tsx`, `follow-cache.test.ts` e
  `src/lib/query/__tests__/keys.test.ts`: passaram.
- `npx playwright test e2e/specs/explore-sections.spec.ts`: 3 testes passaram,
  incluindo o card que abre a comuna e o retorno com o cabeçalho real.
- `npx playwright test e2e/specs/post-stack.spec.ts`: 1 teste passou, cobrindo
  push/back da discussão, compositor e barra inferior.
- Os testes cobrem o primeiro frame de comuna/discussão/perfil, o placeholder de
  terceiros, o erro sem detalhe confirmado e os estados de aviso/comentário/mídia.

## Limitações

- Não houve medição de FPS, memória, tempo de rede ou jank em aparelho real.
  Não há números de ganho de fluidez nesta entrega.
- A validação em aparelho (fonte ampliada, leitor de tela, rede lenta e gesto de
  voltar) continua pendente; o Jest apenas prova estrutura, rótulos e fluxo de
  dados no host. O Chromium prova navegação, não a física nativa.
- Não há spec E2E específico de carregamento lento: os skeletons foram
  verificados em Jest e os fluxos de navegação no Playwright.
