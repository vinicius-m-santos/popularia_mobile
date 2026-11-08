# Observabilidade e privacidade (Sentry)

Data: 08/11/2026. Escopo: erros, breadcrumbs e tracing do `@sentry/react-native`.
Este documento é a referência citada em `src/lib/monitoring.ts`; a avaliação dos
gates da auditoria está em
[`docs/pop-67-quality-gates.md`](./pop-67-quality-gates.md), seção 7.

## Regra principal

**Conteúdo da comunidade não é telemetria.** Posts, comentários, mensagens da
Praça, PDFs, rascunhos, títulos, nomes, e-mails, telefones, tokens e URLs
assinadas não podem aparecer em eventos, breadcrumbs, spans, anexos ou Replay.

O Sentry fica desligado em desenvolvimento local (DSN vazio ou ambiente
`development`). O DSN do cliente é público por definição do SDK; o auth token de
upload de source maps **não** entra no app nem em variáveis `EXPO_PUBLIC_*`.

## Configuração atual

| Controle | Valor | Consequência |
| --- | --- | --- |
| Erros | `initSentry` + `captureException` no ErrorBoundary e `captureApiError` em 5xx | Só erros inesperados geram evento; 4xx esperados não |
| `tracesSampleRate` | `0` | Sem tracing de performance no Sentry |
| `profilesSampleRate` | `0` | Sem profiling no Sentry |
| Replay | `0` / `0` | Sem gravação de tela |
| `sendDefaultPii` | `false` | SDK não anexa PII automaticamente |
| Usuário | `{ id: <UUID interno>, ip_address: '0.0.0.0' }` | Sem e-mail, nome ou IP real |
| `beforeSend` | remove `request`, `extra`, `breadcrumbs` e `contexts.react` | Corpo, formulário, rascunho e stack de componente não vão no evento |
| `beforeBreadcrumb` | descarta `http` e `console` | URL, query, resposta e log não viram breadcrumb |
| Breadcrumb de navegação | `sanitizePath` troca UUID/numérico por `:id` | IDs de conteúdo não viram tag/breadcrumb |
| `captureApiError` | tags `api_path`, `http_method`, `http_status`, `request_id` | Correlação com o backend sem corpo da requisição |
| Instrumentação local | `src/lib/performance/` em memória | Não é Sentry e não faz upload |

## O que o SDK ainda pode registrar

- Nome do erro, mensagem técnica, stack e `release`/`environment`.
- Caminho da API **sem query string**, status HTTP e `request_id` em erros 5xx;
  a tag de método hoje é `HTTP` (não diferencia GET/POST/PUT).
- Rota atual como breadcrumb de navegação, se `setSentryRoute` for chamado.
- Modelo/SO e metadados do SDK que não identifiquem a pessoa.

Se um evento novo precisar de mais contexto, prefira tags de enum/rota a texto
livre. Nunca anexe o objeto de domínio inteiro.

## Tracing: decisão para o beta

**Desligado.** O beta prioriza erro, não APM. O coletor local POP-72 já mede
frames, PSS, CPU, rede e snapshot JS sem enviar conteúdo ao Sentry. Ligar tracing
sem uma pergunta de produto e sem revisar cada span aumentaria a superfície de
exposição sem evidência de ganho.

Para ligar no futuro, em staging e com dono definido:

1. `tracesSampleRate` baixo (começar em `0.05`) e `profilesSampleRate` separado.
2. `beforeSendTransaction` para reduzir `transaction` e `span.description` a
   **template de rota** (`/post/:id`, `/biblioteca/documento/:id`).
3. Remover query string, corpo, nome de arquivo, título, autor e qualquer texto
   livre de spans e tags.
4. Manter Replay desligado; não usar screenshot nem anexo.
5. Revisar um trace real com conta canário sem conteúdo sensível.
6. Registrar sample, ambiente, rollback e critério de remoção no ticket.
7. Rodar o teste de política e um E2E de fumaça antes de produção.

## Achados de revisão

- Os blocos de sanitização de HTTP/console em `beforeBreadcrumb` são
  inalcançáveis: o primeiro `if` devolve `null` para os dois tipos. O efeito é
  seguro (descarta tudo), mas o código não prova que uma URL foi sanitizada.
- `setSentryRoute` não tem chamador hoje; a navegação pode não gerar breadcrumb
  por esse caminho.
- `captureApiError` recebe `method: 'HTTP'` do cliente; a tag não diferencia
  GET/POST/PUT. A correlação fina fica com `request_id` e `api_path`.
- `sanitizePath` não remove query string. O cliente passa `pathname`, então a
  query não entra hoje; o contrato deve continuar sendo “nunca passar URL com
  query”.

Esses pontos são de cobertura e clareza, não vazamentos observados. A correção
de qualquer um deles deve vir com teste em `src/lib/__tests__/monitoring.test.ts`.

## Verificação

```bash
NODE_OPTIONS=--max-old-space-size=1024 npx jest \
  src/lib/__tests__/monitoring.test.ts --runInBand --ci
```

O teste trava: tracing/profiling/Replay em zero, `sendDefaultPii: false`,
remoção de request/extras/breadcrumbs/contexto React, descarte de erro de rede
esperado, descarte de HTTP/console, sanitização de navegação, usuário somente por
UUID e tag de caminho sanitizada.

## Arquivos

- `src/lib/monitoring.ts` — inicialização, filtros e helpers.
- `src/constants/config.ts` — DSN e ambiente.
- `src/app/_layout.tsx` — inicialização no boot e ErrorBoundary.
- `src/lib/api/client.ts` — captura de 5xx com `request_id`.
- `src/lib/performance/` — instrumentação local, sem upload.
- `docs/pop-67-quality-gates.md` — gate 5 e decisão de tracing.
- `docs/app-store-privacy.md` — declaração de privacidade da loja.
