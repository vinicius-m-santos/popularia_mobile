# POP-68: Eventos no Explorar e HTTP 500 em `/search`

Data: 06/11/2026. Escopo: filtro **Eventos** do Explorar, contrato de
`GET /search` e estados de erro/vazio da busca. Sem mudança de navegação,
layout ou refatoração do módulo.

## Sintoma

Ao selecionar **Eventos** em Explorar, a busca podia terminar sem resultados.
Na mesma sessão de diagnóstico no iPhone houve três respostas HTTP 500 em
`GET /search`.

## Causa raiz

O app já enviava o filtro corretamente:

```http
GET /search?q=&type=events&limit=20
```

A falha estava no backend. `DiscoveryQuery::find()` não tinha um ramo para
`type=events`; a categoria sem termo caía no ramo de publicações. O provider
entregava entidades `Post` para `EventViews::many()`, o que gerava `TypeError`
e o HTTP 500. Quando não havia publicações no banco, o mesmo caminho devolvia
uma lista vazia — por isso a falha também podia parecer ausência legítima de
resultados.

O conserto foi feito no backend (`popularia_backend`), commit
`6c5c7d8` (`fix(explore-events-search): list events when the category has no
term`):

- ramo `events` em `DiscoveryQuery::find()`, com a mesma visibilidade de
  comuna usada na busca textual;
- hidratação de `ComunaEvent` com `comuna` e `organizer`;
- paginação por UUID e filtro por assunto;
- teste `DiscoveryTest::testEventsCategoryWithoutTermListsVisibleEventsAndPages`.

O app não precisou mudar de comportamento: o erro HTTP já chegava ao React
Query, era renderizado pelo `StateView` com **Tentar de novo** e não era
confundido com lista vazia. A cobertura mobile foi registrada no commit
`17bbfe9` e ampliada nesta entrega no nível do contrato da API.

## Comportamento validado na busca

| Situação | Resultado na tela |
| --- | --- |
| `type=events` com eventos | lista de eventos, cursor próprio da categoria |
| `type=events` com resposta 200 e nenhum evento | estado vazio legítimo ("Nada nesta categoria por enquanto.") |
| `type=events` com erro da API | estado de erro com mensagem e **Tentar de novo**, sem estado vazio |
| retry depois do erro | nova chamada com os mesmos parâmetros e recuperação da lista |
| troca de categoria depois de erro | nenhum resultado de outra categoria aparece como se fosse Eventos |
| página de assunto | `topic` é preservado na busca de Eventos |

## Testes

- `src/features/explore/__tests__/api.test.ts`
  - `type=events` sem termo monta `q=&type=events&limit=20` e devolve
    `kind: 'events'` com o cursor `next.events`;
  - o assunto (`topic`) da página de origem é preservado;
  - erros do servidor continuam sendo propagados (sem cair em mocks).
- `src/features/explore/__tests__/explore-screen.test.tsx`
  - selecionar **Eventos** lista a categoria;
  - resposta vazia mostra estado vazio e não mostra retry;
  - HTTP 500 mostra erro com retry e não mostra estado vazio;
  - retry recupera o evento;
  - erro ao trocar de categoria não exibe resultados da categoria anterior.

Comandos executados:

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest \
  src/features/explore --runInBand --ci
NODE_OPTIONS=--max-old-space-size=512 npx jest --runInBand --ci
npm run typecheck
npm run lint
```

Resultado: 4 suítes / 30 testes focados verdes; suíte completa com 125
suítes / 747 testes verdes; lint e TypeScript sem erros.

## Limitações da validação

- A validação foi feita em Jest (host), não em iPhone. Este ambiente não tem
  aparelho nem simulador iOS; o fluxo móvel e o teclado ainda precisam ser
  conferidos manualmente em um iPhone.
- O backend não foi executado neste workspace (sem `vendor/`); a causa raiz e
  o teste de regressão foram verificados no código e no histórico do repositório
  `popularia_backend`.
