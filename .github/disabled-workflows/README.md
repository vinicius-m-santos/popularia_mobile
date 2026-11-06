# Workflows desativados

Os workflows de quality e E2E foram retirados de `.github/workflows` para
não consumir minutos do GitHub Actions. As definições foram preservadas aqui
apenas como referência e não são executadas pelo GitHub.

Esses checks rodam localmente no orchestrator antes de qualquer push:

- lint;
- typecheck;
- Jest;
- Playwright E2E.

Se um rebase em `main` alterar a branch, o orchestrator executa os checks
novamente antes de publicar o commit.
