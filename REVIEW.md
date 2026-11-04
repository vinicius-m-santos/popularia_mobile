# REVIEW.md — critérios do AI review

Este arquivo é lido pelo review automático do Claude (`.github/workflows/claude-review.yml`)
e pelo agente de correção (`claude-fix.yml`). Ele complementa `AGENTS.md` e `CLAUDE.md`:
as regras de produto e design continuam nesses arquivos.

## Objetivo

Encontrar o que os testes automáticos não pegam: regressão de comportamento, falha de
segurança/autorização, quebra de contrato, teste fraco e violação das regras de design.
O review é conservador: na dúvida, não bloqueia; bloqueia quando há evidência concreta.

## Severidades

| Severidade | Quando usar | Bloqueia? |
| --- | --- | --- |
| `blocker` | Bug que quebra fluxo, perda/corrupção de dados, falha de autorização, segredo exposto, contrato de API quebrado sem migração. | Sim |
| `major` | Regressão provável, teste ausente para comportamento alterado, violação clara de regra de design/negócio, erro de estado que o usuário vê. | Sim |
| `minor` | Manutenibilidade, clareza, caso de borda improvável, melhoria de UX sem quebra. | Não |
| `nit` | Preferência de estilo, nome, comentário. | Não |

`blocker` e `major` precisam de arquivo e linha do diff. Se não conseguir apontar a linha,
explique no `body` e use a linha mais próxima do bloco alterado.

## O que verificar

### Comportamento e navegação

- Rotas do Expo Router, entrada real (`/` ou deep link), voltar/hardware back, recarregar,
  guardas de sessão (ausente, restaurando, autenticada, onboarding pendente).
- Formulários: validação, erro, estado em andamento, retry, perda de foco/teclado.
- Mudança de fluxo: todos os pontos de entrada que compartilham o contrato alterado
  (cadastro comum, onboarding social, perfil, API e testes).

### Dados, API e contrato

- DTO/schema, paginação, cache, revalidação, erro de rede e estados vazios.
- Mudança em `src/lib/api/schema.d.ts`, DTOs ou campos de resposta: sinalize dependência
  do backend e exigência de PR/CI correspondente.
- O E2E mocka a API; ele não prova contrato real. Não trate E2E verde como prova de
  integração com o backend.

### Segurança e privacidade

- Sessão/tokens em `expo-secure-store`, nunca em log ou storage inseguro.
- Autorização no servidor, IDOR, exposição de PII, URLs assinadas, uploads.
- Pessoas bloqueadas fora de feed, busca, conversas e perfil; o filtro deve acontecer
  antes da paginação, não na tela.

### Testes

- Mudança de comportamento exige teste Jest do contrato/fluxo alterado.
- Mudança de navegação, rota, autenticação, onboarding ou formulário exige spec
  Playwright em `e2e/specs/`; sem isso, é `major`.
- Mudança só de documentação não exige E2E; não bloqueie por isso.

### Design e plataforma

- Siga `CLAUDE.md` e `AGENTS.md`. Exemplos que já causaram regressão:
  - botão com texto usando `Radius.pill`;
  - tipografia reduzida ou `lineHeight` curto cortando acentos;
  - altura fixa em texto que pode quebrar com fonte ampliada;
  - controle de acervo fora dos 52 px;
  - ação editorial copiada em vez de reutilizar `EditorialAction`;
  - `ios/`/`android/` editados à mão (são gerados por CNG);
  - API do Expo assumida de memória em vez dos docs do SDK 58.
- Confira acessibilidade mínima: rótulo acessível, alvo de 44, estado não só por cor.
- Confira largura pequena, fonte ampliada, teclado aberto e mídia.

### Performance

- Listas longas sem aninhar virtualizadas; imagens com placeholder e proporção;
  um vídeo por vez; sem trabalho pesado no render.

## O que não reportar

- Erros que ESLint, TypeScript ou Jest já pegam (o CI cobre).
- Formatação, aspas, ordem de imports.
- Gosto pessoal sem regra escrita no `CLAUDE.md`/`AGENTS.md`.
- Arquivos gerados, `package-lock.json`, `assets/`, `docs/prints/`, `dist/`.
- Sugestão de refatoração ampla sem relação com o diff.

## Formato da resposta

O workflow usa `--json-schema`; responda apenas com o JSON validado pelo schema:

```json
{
  "verdict": "approve | request_changes",
  "summary": "1–3 frases sobre o risco geral do PR",
  "findings": [
    {
      "severity": "blocker | major | minor | nit",
      "file": "src/features/.../arquivo.tsx",
      "line": 123,
      "title": "frase curta",
      "body": "o que está errado, por que importa e como reproduzir",
      "suggestion": "correção concreta"
    }
  ]
}
```

Se não houver achados, use `findings: []` e `verdict: "approve"`.
Não invente arquivos, linhas ou comportamento; baseie-se no diff e no contexto lido.

## Política de bloqueio

O gate (`scripts/ai-review-gate.mjs`) bloqueia o merge quando existe pelo menos um
finding `blocker` ou `major`. `minor` e `nit` aparecem no resumo, mas não bloqueiam.
O check `AI review` é obrigatório no ruleset da `main`; um comentário de aprovação
não substitui os checks verdes.
