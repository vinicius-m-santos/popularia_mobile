# Automação E2E do app web

Data: 04/11/2026. Escopo: suíte Playwright de navegação, autenticação, onboarding,
documentos legais e guardas de sessão. Nenhuma alteração de produto.

A suíte roda o app real (Expo Router + Metro) no Chromium, com a API interceptada
no navegador. Ela não depende do backend local, de uma conta semeada nem de rede:
qualquer pessoa e o CI partem do mesmo estado.

## Comandos

```bash
npm run test:e2e           # suíte completa (sobe e derruba o Metro)
npm run test:e2e:ui        # modo interativo do Playwright
npx playwright test e2e/specs/legal.spec.ts          # um arquivo
npx playwright test -g "licenças"                    # um teste pelo nome
npx playwright test --headed                         # ver o navegador
```

Pré-requisitos: `node_modules` instalado e o Chromium do Playwright disponível.
Em WSL sem as bibliotecas do sistema, siga a seção 1 de
`docs/playwright-screenshots.md` para baixar `libnspr4`/`libnss3` em
`.cache-pw/libs`. O `playwright.config.ts` usa essa pasta como fallback em Linux;
um `LD_LIBRARY_PATH` já exportado tem prioridade:

```bash
export LD_LIBRARY_PATH="$PWD/.cache-pw/libs/usr/lib/x86_64-linux-gnu"
npm run test:e2e
```

## Como a suíte funciona

| Peça | Papel |
| --- | --- |
| `playwright.config.ts` | Sobe `expo start --web` em `127.0.0.1:8099`, com `EXPO_PUBLIC_API_URL` na mesma origem. Um worker, viewport 390×844. |
| `e2e/support/api-mock.ts` | Intercepta `**/api/v1/**` e responde com fixtures. Mantém o estado de `/me` por teste. |
| `e2e/support/flows.ts` | Helpers de boas-vindas, login, mensagem editorial e seletores visíveis. |
| `e2e/support/qa-dataset.ts` | Dataset determinístico do smoke de UX mobile: 240 posts em 3 páginas, 60 documentos em 3 páginas e uma foto em data URI, sem hosts externos. |
| `e2e/specs/*.spec.ts` | Fluxos, separados por área. |

A API aponta para `http://127.0.0.1:8099/api/v1`, a mesma origem do app. Isso evita
CORS e garante que a interceptação pegue todas as chamadas. Um teste em
`auth.spec.ts` confere que nenhuma chamada saiu para outra origem — se o `.env`
local vencer a variável do `webServer`, a suíte falha nessa asserção em vez de
depender de CORS.

O Metro da suíte é próprio e isolado na porta 8099; ele não reutiliza um servidor já
aberto e é encerrado ao fim da execução. Para outra porta, use
`E2E_PORT=8098 npm run test:e2e`.

### O que é mockado

- Sessão: `POST /auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`.
- Conta: `GET/PATCH /me`, gamificação, avisos não lidos.
- Feed e listas: `/feed`, `/comunas`, `/me/comunas`, `/users/*/posts`, `/topics`.
- Descoberta: `GET /explore` e `GET /search` usam os fixtures opcionais `explore` e `search`.
- Cadastro: sugestão de `@`, disponibilidade de `@`, países, estados e municípios.
- Provedores sociais: `POST /auth/social` existe no mock, mas **o fluxo nativo
  Google/Apple não é exercitado** — os módulos não rodam no navegador.

O fallback responde listas vazias para GETs desconhecidos. Se uma tela nova passar a
depender de um endpoint com outro formato, acrescente o fixture em `api-mock.ts` em
vez de deixar a tela cair no estado de erro.

## Cobertura atual

| Arquivo | Fluxo |
| --- | --- |
| `entry.spec.ts` | `/` → boas-vindas sem sessão; recarregar a rota pública; voltar do login pelo botão e pelo navegador. |
| `auth.spec.ts` | Login válido até o feed; credenciais inválidas; validação de campos vazios; sair pela Conta e voltar às boas-vindas. |
| `interests.spec.ts` | Conta → Interesses abre com os assuntos do perfil, atualiza o contador, salva com `PATCH /me` e volta. |
| `signup-onboarding.spec.ts` | Cadastro completo: credenciais + aceite → identidade/estado/cidade → confirmação de e-mail adiada → interesses → comunas → mensagem editorial → feed. Confere o card de boas-vindas (nome, etiqueta e fechamento) e o `PATCH /me` com `welcomeDismissed`. Também prova que o cadastro não avança sem o aceite. |
| `legal.spec.ts` | Termos, Política e Regras a partir das boas-vindas e de Sobre e legal; Sobre e legal ↔ Licenças; voltar em um nível por vez. |
| `explore-sections.spec.ts` | Ordem Em alta → Assuntos → Comunas → Pessoas; card das três publicações em alta; carrossel e participação otimista; card abre a comuna; os dois “Ver todas” trocam a lista. |
| `session-guards.spec.ts` | Rotas protegidas (`/biblioteca`, `/avisos`, `/conta`, `/perfil`, `/criar`, `/progresso`, `/post/[id]`) sem sessão; login e Sobre e legal públicos; documento legal por link direto com a âncora no voltar. |
| `report-success.spec.ts` | Denúncia de uma enquete no feed até a confirmação; cartão do conteúdo, link das Regras; contrato de `POST /reports`; bloquear, desfazer, bloquear de novo e confirmar que a publicação sai do feed ao fechar; linha oculta para quem já está bloqueado. Usa `installApiMock(page, {}, { feedItems, blockedHandles })` para semear feed e bloqueios. |
| `performance-diagnostics.spec.ts` | Conta → Diagnóstico de performance (rota de dev/staging), início da coleta, harness de 20 cartões, navegação pelas abas e retorno com requests registradas; download do JSON com o snapshot da sessão. |
| `mobile-ux-smoke.spec.ts` | Smoke da UX mobile crítica (POP-64): 240 posts em 3 páginas no feed até o fim, troca de abas, volta de publicação e de documento para listas com 3 páginas carregadas, publicação pelo composer até o post no feed, foco/valor no campo da folha e abertura/fechamento da foto em tela cheia. Usa `qa-dataset.ts` e só roda com a API mockada. |
| `post-stack.spec.ts` | POP-32: push/back da discussão a partir do feed, barra inferior oculta e inacessível na rota de post, retorno ao feed e amostragem de layout quadro a quadro (a barra e o compositor não pulam a altura de uma vez). O link direto de post sem sessão fica em `session-guards.spec.ts`. |

As asserções verificam URL, texto visível, estado do formulário e o contrato observado
na API (por exemplo, o corpo de `/auth/register` e o PATCH de interesses). Não são
apenas "a tela não quebrou".

## CI

`.github/workflows/e2e.yml` roda em pull requests e pushes para a `main`:

1. `npm ci`;
2. `npx playwright install --with-deps chromium`;
3. `npm run test:e2e`;
4. upload de `playwright-report/` e `test-results/` (relatório HTML, traces,
   screenshots e vídeos) por 14 dias.

Com `CI=1`, o Playwright faz até duas novas tentativas e grava trace na primeira
repetição. Localmente, screenshot/vídeo ficam só na falha.

## Achado registrado

As etapas do onboarding (`/boas-vindas/perfil`, `/boas-vindas/assuntos`,
`/boas-vindas/comunas`) estão no grupo público de boas-vindas e abrem por link direto
sem cadastro em andamento. Não há bypass de autenticação — o fluxo não chega ao feed —,
mas a tela aparece sem sessão e Comunas cai no estado de erro. O caso está em
`session-guards.spec.ts` como `test.fixme`: quando a guarda de "cadastro em andamento"
existir, remova o `.fixme` e o teste passa a cobrir a regressão.

## Limitações conhecidas

- **Sessão no web é só memória.** O refresh token usa Keychain/Keystore no aparelho;
  no navegador ele não persiste. Recarregar a página depois do login volta às
  boas-vindas. Por isso a suíte autentica pela UI em cada teste e não cobre
  "restaurar sessão" no web.
- **Google/Apple nativos não rodam no navegador.** O onboarding social (handle
  pendente, aceite legal social) continua exigindo aparelho/development build.
- Teclado, câmera, seleção de mídia, gestos, teclado físico e acessibilidade real do
  aparelho não são validados aqui.
- O smoke de UX mobile de `mobile-ux-smoke.spec.ts` cobre fluxo e semântica de
  controles no Chromium. Vídeo, pinça/arrasto, teclado nativo, leitor de tela,
  Reduce Motion, fonte ampliada e jank continuam no roteiro manual
  `docs/pop-64-mobile-ux-smoke-matrix.md`.
- A suíte prova navegação e regressão de rota, não aprovação visual. Para revisão de
  layout, use `docs/playwright-screenshots.md` e confira no aparelho.
- O primeiro carregamento compila o bundle; os primeiros testes podem levar mais
  tempo. O `expect` já espera até 20 s e o timeout do teste é 120 s.

## Como ampliar

1. Crie o spec em `e2e/specs/` com um `test.describe` por fluxo.
2. Instale o mock antes de navegar: `const api = await installApiMock(page)`.
3. Comece pelo ponto de entrada real (`/` ou link direto), não pela rota interna.
4. Prefira `visibleButton`/`visibleLink`/`visibleHeading` de `flows.ts`: o app mantém
   telas de abas anteriores montadas no DOM.
5. Confirme URL final, conteúdo visível, voltar (botão e navegador) e o caminho de
   erro. Se a feature mexe em autenticação/onboarding, repita os specs anexos.
6. Se o fluxo chamar um endpoint novo, acrescente o fixture e uma asserção do
   contrato (corpo enviado/quem chamou), como em `signup-onboarding.spec.ts`.

Artefatos (`test-results/`, `playwright-report/`) são evidência local e estão no
`.gitignore`; não versione.
