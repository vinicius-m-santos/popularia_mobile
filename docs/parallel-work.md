# Frentes em paralelo: worktrees, workspaces e um Metro

Data: 30/10/2026. Escopo: fluxo de trabalho. Nenhuma alteração de código de produto.

## Modelo mental

| Conceito | O que é |
| --- | --- |
| **Workspace** | Um diretório que é repositório (tem `.git`). Dele saem as instruções do `AGENTS.md`/`CLAUDE.md` e a visão de diff. |
| **Sessão** | Um agente com sandbox de escrita naquele workspace e contexto próprio. Duas sessões não compartilham memória. |
| **Fronteira** | **Leitura atravessa** workspaces (o agente lê outro repositório para conferir contratos). **Escrita não**: editar outro repositório exige uma sessão nele. |

Consequência prática: o par "app + backend" é o equivalente a duas pastas no IDE, com uma diferença — quem escreve em cada lado é uma sessão distinta.

## 1. Criar a worktree

```bash
cd ~/projects/popularia_mobile
git worktree add ../popularia-<frente> -b feat/<frente>
```

- **Uma worktree por frente.** O histórico é compartilhado (`.git` único, ~41 MB), o diretório de trabalho não.
- **`node_modules` não é compartilhado**: cada worktree precisa do seu (~1,1 GB). Copie ou instale:

```bash
cd ../popularia-<frente>
cp -a ../popularia_mobile/node_modules .
# ou: npm ci   (mais lento, ocupa menos cache local)
```

- **Não use symlink de `node_modules`**: Metro e os módulos nativos se perdem com resolução por link.
- **Arquivos não versionados** não viajam: copie `.env`, keystores e configs locais.

## 2. Registrar no DSH

1. Barra lateral → **Add workspace…** → aponte para `~/projects/popularia-<frente>`.
2. Dentro dele → **New session**.
3. Alterne pela barra lateral; as sessões seguem vivas.

Uma aba do navegador basta. Duas abas podem compartilhar a seleção de sessão — não conte com elas para paralelismo.

## 3. Um Metro por vez

O bundler serve **um** projeto por servidor. Regra do time:

- Enquanto a sessão edita a worktree B, o Metro pode estar na A — você testa A.
- Para testar B, pare o Metro e suba de novo na B.
- Dois Metros (`npx expo start --port 8082` na segunda) só com folga de memória; ver a tabela abaixo.

O development build instalado no aparelho aponta para a URL do Metro; trocar de worktree é trocar de servidor, não de app.

**Dependência nativa nova** (qualquer biblioteca com código nativo) exige novo development build — `npx expo run:ios|android` ou `eas build --profile development`. Ela vale para todas as worktrees; o build com o módulo extra continua compatível com quem não o importa.

## 4. Fronteira app ↔ backend

| Tarefa | Como fazer |
| --- | --- |
| Conferir contrato, campo, regra de permissão | Sessão do app **lê** `../popularia_backend` (`src/Entity`, `src/Api`, `migrations/`, `tests/`) |
| Alterar endpoint, entidade, validação | Sessão no workspace `popularia_backend` |
| Feature que atravessa os dois | Descreva o contrato na sessão do app depois de fechar no backend: rota, payload, erros |

No backend: Symfony 8 + API Platform 4.4 + Doctrine; `bin/console` e `bin/phpunit` disponíveis na raiz.

## 5. Propriedade dos arquivos compartilhados

Conflito em arquivo compartilhado é o que mais atrasa frente paralela. Regra: **um dono por área**, os demais pedem.

| Área | Dono | Regra |
| --- | --- | --- |
| `src/constants/theme.ts`, `app-text`, `editorial-action`, `section-heading`, `icon`, `avatar` | frente "base" | Mudança de default só com revisão dela; as outras não tocam |
| `src/components/list/*`, `hooks/use-cached-pages`, `lib/query/*` | frente "base" | Idem: é infraestrutura compartilhada |
| `AGENTS.md`, `CLAUDE.md` | frente "base" | Frentes propõem a regra; quem consolida é a base |
| `package.json` e lockfile | quem instalar primeiro | Instalações serializam; avise a outra sessão |
| Telas e componentes de feature | a própria frente | Conflito inesperado = algo invadiu a fronteira |

## 6. Orçamento de memória

Medido nesta máquina: **7,6 GB totais, 3,6 em uso, 3,8 livres**.

| Processo | Custo aproximado |
| --- | --- |
| Sessão DSH extra | dezenas de MB |
| Metro | ~1 GB |
| `tsc` / Jest | picos de centenas de MB |
| Backend em Docker (compose + MySQL) | 1–2 GB |

**Combinação segura**: 1 Metro + 1 backend + 2–3 sessões de agente. Dois Metros com Docker ligado é swap. Verificações pesadas seguem a regra do `AGENTS.md`: uma por vez, `NODE_OPTIONS=--max-old-space-size=512`.

## 7. Ciclo de uma frente

1. `git worktree add` e copiar dependências.
2. Registrar o workspace e abrir a sessão.
3. Implementar; rodar `npx tsc --noEmit` e `npx expo lint` **dentro da worktree**.
4. Testes focados com `--runInBand`.
5. Teste no aparelho com o Metro apontado para essa worktree.
6. Rebase em `main` cedo e com frequência; diferenças pequenas, conflitos pequenos.
7. PR; merge da base antes das frentes; rodar as verificações de novo depois do rebase.

## 8. Ordem de merge

- Base primeiro (tema, componentes, infraestrutura, docs).
- Frentes depois, uma a uma, cada uma rebased na `main` já atualizada.
- Se a frente precisou de um componente novo, ele entra pela base — não pela frente.

## 9. Limites conhecidos

- **Escrita entre workspaces é bloqueada** por sandbox. Não é teimosia: é o que impede uma sessão de estragar outra frente.
- **Contexto não é compartilhado.** A sincronia é o código e este documento; o que uma decide, a outra não sabe.
- **Pasta pai como workspace não funciona bem**: sem `.git` na raiz, o harness não acha o projeto — some o carregamento de `AGENTS.md`/`CLAUDE.md` e some o diff. Além disso o sandbox passa a incluir `design/`, `docs/`, `popularia-site/` e afins.
- **Worktree é descartável, não é backup.** Commit ou stash antes de remover.

## 10. Limpeza

```bash
git worktree list
git worktree remove ../popularia-<frente>
git branch -d feat/<frente>      # depois do merge
```

Remover a worktree não apaga `node_modules` do disco automaticamente se você copiou: apague junto.
