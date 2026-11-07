# POP-33: sticky header do Explorar e retenção de scroll no perfil

Data: 07/11/2026. Escopo: header fixo de busca/filtros do Explorar, posição de
leitura do perfil e registro das hipóteses da auditoria estática (S9/S10, Seções
4.3 e 6) sobre `stickyHeaderIndices` e `maintainVisibleContentPosition`.
Sem migração de listas, sem mudança de rota, API ou layout.

Arquivos: `src/features/explore/explore-screen.tsx`,
`src/features/profiles/profile-screen.tsx`, `src/hooks/use-sticky-controls-scroll.ts`,
`e2e/specs/explore-sticky.spec.ts`, `e2e/specs/profile-scroll.spec.ts`.

## Problema auditado

A análise estática do commit `12c0369` levantou duas hipóteses, ambas não
confirmadas:

1. `stickyHeaderIndices` no Explorar poderia falhar no Android ao trocar filtro
   ou digitar, fazendo o header pular.
2. O `maintainVisibleContentPosition` (MVCP) da FlashList, ligado por padrão na
   v2, poderia conflitar com o `scrollToOffset` que o perfil usa ao trocar de
   aba.

A investigação separou o que foi reproduzido do que foi descartado. O bug
confirmado não estava no índice fixo em si: era o scroll para o header perdido
quando o resultado anterior era curto demais para alcançar o offset.

## Matriz de reprodução

Ambiente: Chromium 390×844, `expo start --web` isolado na porta 8098, API
mockada. "top" é o `scrollTop` do maior scroller vertical da lista; "y" é a
posição do campo de busca no viewport. O header do Explorar mede 84 de altura
nesse cenário. Nada aqui foi executado em Android/iOS.

| # | Tela | Cenário | Antes | Depois | Resultado |
| --- | --- | --- | --- | --- | --- |
| 1 | Explorar | Busca longa (24 posts), rolar até 600 | busca em `y=37`; header fixo | igual | fixo, sem sobreposição |
| 2 | Explorar | Resultado curto (Comunas vazio) e depois Publicações (24) | volta ao topo (`top=0`, `y=121`) | `top=84`, `y=37` | **bug confirmado e corrigido** |
| 3 | Explorar | Repetir Comunas ↔ Publicações duas vezes | topo na categoria longa | `top=84` em todas | determinístico |
| 4 | Explorar | Dataset curto (2 posts) | controles visíveis | igual | filtros utilizáveis, sem scroll artificial |
| 5 | Explorar | Teclado nativo | — | — | **não executado**: sem aparelho; no web o campo mantém instância e termo |
| 6 | Perfil | Rolar até 620, abrir publicação e voltar | 620 | 620 | posição preservada |
| 7 | Perfil | Posts → Mídia → Posts, duas vezes | Mídia `291` (fim do conteúdo curto), Posts `583` (topo das abas) | igual | determinístico |
| 8 | Perfil | Sair para Início e voltar ao Perfil | 900 | 900 | posição preservada |
| 9 | Perfil | Repetir o cenário 7 com MVCP desligado | mesmos `291`/`583` | — | **hipótese de conflito descartada** |

Medidas do cenário 2 (o bug): com "Discussão" digitado, a busca lista 24 posts.
Ao escolher **Comunas**, o resultado fica vazio e a lista deixa de ter overflow.
Ao escolher **Publicações**, o código antigo chamava `scrollToOffset(84)` antes
de o novo conteúdo existir; o sistema limitava o scroll a 0 e não havia nova
tentativa quando os 24 posts chegavam. O header ficava no topo, com o título
grande ainda visível.

Medidas do cenário 7: a aba Mídia tem 1.007 de conteúdo para 716 de viewport,
então o alvo de 583 é maior que o máximo (291). A lista limita ao fim do
conteúdo de forma determinística; ao voltar para Posts, o alvo de 583 é
alcançável e é aplicado. Repetir a troca devolve exatamente os mesmos valores.

## Hipótese do MVCP no perfil: descartada

O perfil usa uma única FlashList cujas linhas são substituídas por inteiro ao
trocar de aba. O MVCP ancora o primeiro item visível pela `key`; as chaves de
publicação (`post:<id>`) e de mídia (`media:<id>`) não existem no outro conjunto,
então não há correção de offset a aplicar. As três primeiras linhas (`identity`,
`tabs`, `content`) mantêm índice e posição. A documentação da FlashList registra
que o MVCP pode mover itens quando há [reordenação de dados](https://shopify.github.io/flash-list/docs/known-issues/);
aqui não há reordenação, há troca de conjunto. Além disso, o teste com
`maintainVisibleContentPosition={{ disabled: true }}` produziu exatamente os
mesmos `291`/`583`, o que afasta a hipótese de conflito.

Por isso **nenhuma mudança foi feita no perfil**: desligar o MVCP poderia
prejudicar a revalidação ao voltar de um detalhe, quando uma publicação nova é
inserida acima da janela visível. A posição atual foi coberta por E2E para não
regredir.

## Correção aplicada

### Explorar

- Novo `useStickyControlsScroll` (`src/hooks/use-sticky-controls-scroll.ts`)
  guarda o offset do cabeçalho e só o aplica quando
  `contentHeight - viewportHeight` alcança o alvo. `onContentSizeChange` é o
  gatilho para o resultado longo que chega depois da troca de categoria.
- Arrastar a lista (`onScrollBeginDrag`) ou pedir o topo cancela a pendência,
  para um crescimento posterior de conteúdo não puxar a leitura sem intenção.
- `stickyHeaderIndices` virou a constante `STICKY_HEADER_INDICES`: a referência
  não muda a cada tecla nem a cada filtro. O índice continua `[1]` porque o
  `ListHeaderComponent` (título) é a célula 0 e os controles são o primeiro item.
- O campo e os filtros continuam na mesma célula montada; a busca preserva termo
  e categoria.

### Perfil

Sem alteração de código. A posição de retorno e a troca de abas já estavam
estáveis; o comportamento passou a ter cobertura E2E dedicada.

## Testes

- `src/hooks/__tests__/use-sticky-controls-scroll.test.tsx`: **5 testes** —
  espera do conteúdo longo, aplicação imediata quando o alvo já é alcançável,
  topo cancela a pendência, arrasto cancela e cabeçalho não medido mantém o topo.
- `e2e/specs/explore-sticky.spec.ts`: **2 testes** — curto → longo sem perder os
  controles fixos; dataset curto com filtros visíveis e utilizáveis.
- `e2e/specs/profile-scroll.spec.ts`: **2 testes** — volta de publicação e troca
  de aba inferior preservam a posição; abas internas são determinísticas e
  mantêm a barra de abas visível.
- `e2e/specs/explore-sections.spec.ts`: **3 testes** existentes continuam
  passando, cobrindo a ordem das seções e os "Ver todas".
- Suíte Jest completa: **145 suítes / 863 testes** passaram (`--runInBand --ci`).
- `npm run check:fast`: ESLint e TypeScript passaram. O `tsc` precisou de
  `NODE_OPTIONS=--max-old-space-size=1024`; com 512 ele estourou o heap do Node.

Comandos:

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest \
  src/features/explore src/features/profiles \
  src/hooks/__tests__/use-sticky-controls-scroll.test.tsx --runInBand --ci
NODE_OPTIONS=--max-old-space-size=1024 npm run check:fast
E2E_PORT=8098 NODE_OPTIONS=--max-old-space-size=512 \
  npx playwright test e2e/specs/explore-sticky.spec.ts
E2E_PORT=8098 NODE_OPTIONS=--max-old-space-size=512 \
  npx playwright test e2e/specs/profile-scroll.spec.ts
E2E_PORT=8098 NODE_OPTIONS=--max-old-space-size=512 \
  npx playwright test e2e/specs/explore-sections.spec.ts
```

## O que não foi validado

- **Nada foi executado em aparelho ou emulador Android/iOS.** O sticky header
  nativo, o teclado do sistema, a física de rolagem e gestos continuam no
  roteiro manual. O Chromium implementa o header fixo via CSS, não via
  `ScrollViewStickyHeader` nativo; o resultado web não prova o Android.
- Não houve medição de FPS, jank, memória ou latência. Não há afirmação de ganho
  de fluidez.
- A suíte Playwright completa não foi repetida nesta entrega; foram executados
  os dois specs novos e o spec existente do Explorar. A mudança não toca
  navegação, autenticação, onboarding ou formulário.
- A hipótese de `stickyHeaderIndices` "falhar no Android" não foi reproduzida
  sem aparelho. O que se corrigiu foi o caso confirmado no web e o risco
  mecânico da referência instável; o comportamento nativo segue pendente.

## Critérios de aceite

- [x] Header fixo não pula no fluxo testado (curto → longo) e os filtros
      continuam utilizáveis no web.
- [x] Perfil volta de publicação e troca aba com posição estável no web.
- [x] Evidência de reprodução do bug do Explorar e descarte documentado da
      hipótese de conflito do MVCP no perfil.
- [ ] Validação em Android/iOS com datasets curto/longo e teclado — pendente de
      aparelho; não declarada como aprovada.
