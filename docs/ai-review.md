# AI review e gate de merge

Data: 04/11/2026. Este documento descreve o portão de code review automático do
`popularia_mobile` e o que é necessário para ativá-lo no GitHub.

## Visão geral

```text
PR aberto/atualizado
  ├─ Quality      (ESLint + TypeScript + Jest)  ─┐
  ├─ Playwright   (E2E web)                      ├─ checks obrigatórios
  └─ AI review    (Claude + gate do repositório) ─┘
             │ achou blocker/major?
             ├─ não → merge liberado (se os demais checks estiverem verdes)
             └─ sim → label ai:fix
                        └─ Claude fix corrige, roda lint/typecheck/Jest
                           e dá push na branch do PR
                              └─ Quality + Playwright + AI review rodam de novo
```

O bloqueio não é um comentário: é o check obrigatório **`AI review`**. Um
comentário de aprovação do modelo não libera o merge; quem libera são os checks
verdes.

## Workflows

| Arquivo | Papel |
| --- | --- |
| `.github/workflows/quality.yml` | Roda ESLint, TypeScript e Jest em cada PR/push na `main`. Check: `Quality`. |
| `.github/workflows/e2e.yml` | Roda a suíte Playwright. Check: `Playwright`. |
| `.github/workflows/claude-review.yml` | Roda o Claude com `REVIEW.md`, publica o parecer e falha o check `AI review` se houver `blocker`/`major`. |
| `.github/workflows/claude-fix.yml` | Disparado pela label `ai:fix`: corrige os achados, roda lint/typecheck/Jest, commita e dá push. |

O review usa o **Claude Code Action** com `CLAUDE_CODE_OAUTH_TOKEN` (token da
assinatura Claude, gerado com `claude setup-token`). O push do fix é feito pelo
Claude GitHub App, não pelo `GITHUB_TOKEN`; por isso o GitHub dispara o CI e o
review novamente. Se o push fosse feito com `GITHUB_TOKEN`, nenhum workflow
seria disparado.

## Setup manual (uma vez por repositório)

1. **Instalar o Claude GitHub App** no repositório: <https://github.com/apps/claude>.
   Sem o App, o action não consegue comentar nem dar push.
2. **Gerar o token da assinatura** na sua máquina:

   ```bash
   claude setup-token
   ```

   Copie o token e cadastre como secret do repositório:

   ```bash
   gh secret set CLAUDE_CODE_OAUTH_TOKEN --repo vinicius-m-santos/popularia_mobile
   ```

3. **Criar as labels** usadas pelo fluxo:

   ```bash
   gh label create ai:fix --repo vinicius-m-santos/popularia_mobile \
     --color FBCA04 --description "Pede ao Claude para corrigir o AI review"

   gh label create ai-review:skip --repo vinicius-m-santos/popularia_mobile \
     --color D4C5F9 --description "Pula o AI review (exige revisão humana)"
   ```

4. **Criar o ruleset** depois que este PR estiver na `main` e os checks
   `Quality` e `AI review` já tiverem rodado ao menos uma vez. O nome do check
   só aparece para seleção depois da primeira execução.

## Ruleset da `main`

O `gh` 2.4 não tem `gh ruleset`; use a API:

```bash
gh api repos/vinicius-m-santos/popularia_mobile/rulesets \
  --method POST --input - <<'JSON'
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/heads/main"], "exclude": [] }
  },
  "rules": [
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": true,
        "required_review_thread_resolution": true
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "Quality" },
          { "context": "Playwright" },
          { "context": "AI review" }
        ]
      }
    },
    { "type": "non_fast_forward" },
    { "type": "deletion" }
  ]
}
JSON
```

- `required_approving_review_count: 0` funciona para projeto solo: exige PR,
  mas não aprovação humana. Se quiser 1 aprovação, o Copilot pode aprovar e
  contar desde setembro/2026, mas ele não substitui os testes.
- `strict_required_status_checks_policy: true` exige a branch atualizada com a
  `main`. Se gerar re-runs demais, troque para `false`.
- `required_review_thread_resolution: true` obriga resolver os comentários
  inline. Se incomodar no começo, comece com `false`.
- Deixe bypass apenas para admin, com auditoria. Para rigor total, não inclua
  `bypass_actors`.

## Como usar

1. Abra o PR normalmente. O review roda em `opened`, `synchronize`,
   `ready_for_review` e `reopened`.
2. Leia o comentário do gate (`<!-- ai-review-gate -->`). Se houver
   `blocker`/`major`, o check fica vermelho.
3. Para correção automática, aplique a label **`ai:fix`**. O Claude corrige,
   roda `npm run lint`, `npm run typecheck` e
   `npm test -- --ci --maxWorkers=2`, commita e dá push. O workflow remove a
   label no fim.
4. O push dispara Quality, Playwright e AI review de novo. Se ainda houver
   bloqueio, reaplique `ai:fix` para uma segunda tentativa; depois disso,
   resolva manualmente.
5. Emergência: aplique `ai-review:skip` e **reexecute o check** `AI review`.
   O gate passa com um comentário de auditoria; use só depois de revisar o diff
   você mesmo.

## Limites e segurança

- **Fork**: PRs de fork não recebem secrets; o review falha com mensagem clara.
  Um mantenedor precisa revisar manualmente e aplicar `ai-review:skip` (e
  reexecutar o check).
- **Prompt injection**: o review roda com ferramentas restritas (leitura e
  `git diff`), sem escrita. A rubrica `REVIEW.md` e as regras de
  `CLAUDE.md`/`AGENTS.md` são restauradas da base antes da revisão, para que o
  PR não altere os próprios critérios. O fix é acionado por label de uma pessoa
  com escrita e roda apenas em branch do próprio repositório.
- **Custo**: cada review e cada fix consomem tokens da assinatura/API e minutos
  de CI. O fix reroda o E2E; por isso o limite de duas tentativas.
- **E2E mocka a API**: ele não prova contrato com o backend. Mudança de DTO ou
  `schema.d.ts` exige o CI do backend e, quando aplicável, PR correspondente.
- **Falha do serviço**: se o Claude ou o token falhar, o check falha (fail
  closed). Reexecute o job; não mergeie com o check vermelho.

## Validação local

```bash
npm run check        # lint + typecheck + Jest
npm run test:e2e     # quando a mudança tocar fluxo/navegação

node scripts/ai-review-gate.mjs   # smoke test do gate, com env de PR
```

O hook `.claude/hooks/pre-commit-check.sh` roda ESLint e TypeScript em todo
`git commit` feito pelo Claude Code e bloqueia o commit se algo falhar.
