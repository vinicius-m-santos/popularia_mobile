# Redesign do front: direção de arte e divisão das frentes

Data: 30/10/2026. Escopo: execução do redesign. As **regras** continuam em `CLAUDE.md` e
`AGENTS.md`; este documento organiza quem faz o quê e como as duas frentes não divergem.

## Regra de ouro

Nenhuma tela inventa linguagem própria. O que vale é `CLAUDE.md` + `AGENTS.md`. Quando faltar
resposta ali, a frente **para e pergunta** — não improvisa um tom, um raio ou um peso de borda.
Divergência entre frentes se resolve no documento de regras, não no código.

## A linguagem, por tipo de superfície

Toda tela nova ou revisada passa por esta lista. É a mesma para as duas frentes.

| Superfície | O que define | Referência |
| --- | --- | --- |
| **Abertura de tela** | Título Anton 42–54, descrição na mesma coluna, arte com faixa própria (nunca sob o texto), busca com rótulo persistente | `squares-screen`, `library-screen` |
| **Chrome interno** | 58 de altura, voltar, divisória 1.5 × 28, rótulo mono; ação opcional à direita, spacer de 44 quando ausente | `AGENTS.md` |
| **Cabeçalho de seção** | `SectionHeading appearance="editorial"`: marcador 8, mono 12.5/18, ação em tinta com alvo 44 | `section-heading` |
| **Card de conteúdo** | Anatomia pela quantidade de metainformação: cabeçalho + bloco indentado (ícone pequeno, 3+ linhas) ou duas colunas com marca grande e 1–2 linhas | `document-card` (public), `squares-screen` |
| **Lista e separadores** | Dia/seção abrem com regra nomeada; entre itens, fio de 1 em `Colors.rule`; nunca 1.5 tinta por item | `(inicio)/index` |
| **Bottom sheet** | Chrome compartilhado do `BottomSheet`, título, `TextField appearance="editorial"`, `EditorialAction` full-width, ações empilhadas | `bottom-sheet`, `collection-editor` |
| **Formulário** | Rótulo persistente, placeholder `Ex.: …` realista, controle 52 e `Radius.sm`, ação primária vermelha ao final | `AGENTS.md` |
| **Ações** | Primária vermelha com borda 1.5 tinta; secundária importante em papel com borda 1 tinta; terciária `ghost`; 50 de altura | `editorial-action` |
| **Mídia** | Foto com `cover` e proporção limitada; vídeo com autoplay mudo e chrome próprio; PDF como card, sem repetir formato | `post-attachment`, `photo-viewer` |
| **Estados** | Carregando com listra da casa, vazio explicativo com caminho de saída, erro com retry; nada de tela em branco | `state-view`, `popularia-list` |

## Divisão das frentes

| Frente | Escopo | Por quê |
| --- | --- | --- |
| **main** (esta) | Fechar Início → bottom sheets e o chrome de folha → área de criação de publicação → Biblioteca: leitor de documento e envio de PDF | Folhas e criação compartilham o mesmo vocabulário; Biblioteca é leitura e arquivo, o par natural |
| **popularia-second** | Perfil e todas as suas telas → chat da Praça | Identidade e conversa: duas linguagens novas, ambas de uso diário |

Depois dessas duas rodadas, ficam para uma terceira: comunas (página, gestão, moderação), eventos,
avisos, onboarding e progresso. **Não antecipe** — a linguagem de folha e de card precisa estar
fechada antes de espalhar.

### Ordem dentro de cada frente

1. **Main**: Início (pendências) → `BottomSheet` base e as folhas de ação → `criar` → leitor de
   documento → envio de PDF.
2. **Second**: chrome do perfil (cabeçalho, abas, ações) → grade de mídia → relações e seguidores →
   `conta` e `interesses` → chat da Praça (lista, mensagem, compositor, figurinhas).

## Propriedade da base

As duas frentes podem **ler** tudo. Só a `main` escreve em:

- `src/constants/theme.ts`
- `src/components/{app-text,icon,avatar,editorial-action,section-heading,kicker,bottom-sheet,text-field,state-view}.tsx`
- `src/components/list/*`, `src/hooks/use-cached-pages.ts`, `src/lib/query/*`
- `AGENTS.md`, `CLAUDE.md`

A `popularia-second` **pede** mudança nesses arquivos, com o motivo e o uso. Isso evita o pior
cenário: duas telas novas empurrando o componente compartilhado em direções diferentes.

`package.json` e lockfile: quem instalar primeiro avisa. Instalação é serial.

## Por que a direção não diverge

Três travas, nesta ordem:

1. **As regras viajam com o código.** `AGENTS.md` e `CLAUDE.md` estão na worktree; a sessão nova
   lê antes de tocar em qualquer tela.
2. **A base é de uma só frente.** Mudança de componente compartilhado passa pela `main`, então o
   vocabulário não bifurca.
3. **Gate de revisão por tela.** Antes de mergear, a frente manda prints e responde:
   - a primeira área visível mostra conteúdo, não só abertura?
   - a hierarquia tem três níveis (conteúdo, controle, metadado) e não todos iguais?
   - as bordas têm peso diferente por função?
   - os estados de carregando, vazio e erro existem e são distintos?
   - funciona com título longo, metadado ausente, 360 de largura e fonte ampliada?

Sem os prints e essas respostas, o merge espera. **Print aprovado não substitui teste no aparelho**
— teclado, acessibilidade e gestos continuam sendo conferidos no device.

## Pendências conhecidas que continuam valendo

- O card de documento dentro do post ainda repete "PDF" e mostra selo "Público" (regra já escrita;
  entra na rodada da Biblioteca).
- Feed e perfil divergem no separador: o feed usa regra por dia, perfil/comuna ainda usam 1.5 tinta
  por item. A segunda frente fecha isso no perfil; a comuna fica para a terceira rodada.
- Barra de progresso e arrastar para buscar no vídeo não existem (o chrome nativo saiu). Fica como
  melhoria após a primeira volta das duas frentes.

## Ritual de sincronização

- **Rebase em `main`** no começo de cada bloco de trabalho, não no fim.
- **Nada de dois `tsc`/Jest ao mesmo tempo**: uma verificação pesada por vez, com
  `NODE_OPTIONS=--max-old-space-size=512` e `--runInBand`.
- **Um Metro por vez.** A worktree que está sendo testada é a que tem o bundler ligado.
- Ao fechar uma tela, anote aqui (ou no PR) a decisão que não estava prevista nas regras. É assim
  que o documento de regras cresce com fato, não com opinião.
