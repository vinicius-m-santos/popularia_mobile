# POP-64 — Matriz de smoke tests e E2E da UX mobile crítica

Data: 06/11/2026. Escopo: roteiro reproduzível de smoke manual em iPhone/Android
e automação E2E dos cenários que o navegador consegue provar sem depender de
física nativa. Referências: auditoria estática de UI/UX/fluidez (commit
`12c0369`), Seções 6 e 10 / S1–S12, e baseline de performance POP-5.

Este documento **não substitui** a medição nativa de FPS, memória ou jank de
`docs/mobile-performance-baseline.md`. Ele define o que executar, como preparar
ambiente/rede/dataset e como anexar o resultado ao ticket.

## 1. O que está automatizado e o que é manual

| Camada | O que cobre | Onde |
| --- | --- | --- |
| E2E (Playwright, Chromium 390×844) | 240 posts em 3 páginas, rolagem até o fim, troca de abas do feed, volta de publicação para a lista carregada, 3 páginas da Biblioteca e volta do documento, publicação, foco/valor no campo da folha, abertura/fechamento da foto e semântica básica de controles | `e2e/specs/mobile-ux-smoke.spec.ts` |
| Manual em aparelho | 3+ vídeos, pinça/duplo toque/arrasto, teclado nativo na folha, VoiceOver/TalkBack, Reduce Motion, fonte ampliada, comentários e memória/jank | matriz S1–S12 abaixo |

O E2E usa a API interceptada no navegador. Ele prova fluxo e regressão de
navegação, **não** mede física de gesto, teclado do sistema, acessibilidade real,
FPS, memória ou reprodução nativa de vídeo. No web a sessão vive só em memória;
cada teste autentica pela UI.

### Comando

```bash
npm run test:e2e
# foco no smoke de UX mobile:
NODE_OPTIONS=--max-old-space-size=1024 npx playwright test e2e/specs/mobile-ux-smoke.spec.ts
```

Pré-requisitos e solução de bibliotecas do Chromium em WSL estão em
`docs/e2e.md`. A suíte sobe e derruba o próprio Metro na porta 8099; não reutilize
um servidor aberto.

## 2. Ambiente

Preencha uma linha por execução. Sem esses campos o resultado não é comparável.

| Campo | O que registrar |
| --- | --- |
| Commit/build | hash curto + versão e build number do app |
| Tipo de build | release de produção, staging ou development build |
| Aparelho | modelo, ano, RAM e armazenamento livre |
| SO | versão exata do iOS/Android |
| Tela | polegadas e resolução; brilho fixo durante a execução |
| Configurações | fonte do sistema, tamanho de exibição, Reduce Motion/remoção de animações, leitor de tela |
| Rede | perfil da tabela da seção 3 e ferramenta usada |
| Dataset | conta/ambiente e contagem de posts, vídeos, páginas e documentos |
| Cache | instalação limpa (frio) ou app já usado (quente) |
| Executor/data | pessoa e data/hora com fuso |

Mínimo para fechar a matriz: **um iPhone real e um Android real**. Emulador,
simulador e Chromium não substituem aparelho para os itens S2, S5, S7–S10 e S12.

## 3. Rede

| Perfil | Configuração de referência | Uso |
| --- | --- | --- |
| Wi-Fi estável | ≥ 50 Mbps, RTT < 30 ms | caminho feliz de todas as S |
| 4G | ~10 Mbps down / 5 Mbps up, RTT ~80 ms | repetir S1, S2, S4 e S6 |
| 3G lenta | ~400 kbps down/up, RTT ~400 ms, sem perda | S1/S4 (paginação), S2 (TTFF) e estados de carregamento |
| Offline/instável | avião ligado ou perda intermitente | erro/retry de feed, vídeo, publicação e S11 (thread); registrar o caminho de erro |

Como aplicar:

- **iOS:** Network Link Conditioner (Settings → Developer) ou proxy
  (Proxyman/Charles) no aparelho.
- **Android:** throttling do emulador quando o cenário for de tela; em aparelho
  físico, proxy com perfil de banda/latência. Se usar `tc`, registre que houve
  root e os parâmetros exatos.
- **Web (referência):** DevTools → Network → Slow 3G. O E2E **não** aplica
  throttling: os cenários de rede lenta são manuais.

Anote a ferramenta e os números medidos; “4G” sem parâmetros não é reproduzível.
Para o S2, registre o tempo até o primeiro quadro (TTFF) com e sem cache.

## 4. Dataset

### E2E (determinístico, sem rede)

`e2e/support/qa-dataset.ts` monta:

- **240 publicações** de texto em **3 páginas de 80** no feed (`/feed`);
- **60 documentos** em **3 páginas de 20** na Biblioteca (`/library/documents`);
- uma publicação com **foto PNG em data URI**, sem host externo;
- criação de post via `POST /posts` no próprio mock.

Esse dataset é isolado do backend e existe para repetir rolagem, paginação,
volta de detalhe e publicação. Ele não inclui vídeos: o player web não representa
autoplay mudo, um player por viewport, pôster e ciclo de vida nativos.

### Aparelho

Para S1–S4 e S11, use uma conta de QA em staging/local com:

- **≥ 200 publicações no feed principal**, com pelo menos **3 páginas** de cursor;
- **≥ 3 vídeos** com URLs acessíveis (MP4/MOV, ≤ 30 s), sendo um deles na primeira
  dobra e outro depois da segunda página;
- **≥ 60 documentos públicos** na Biblioteca, com **3 páginas**;
- pelo menos uma publicação com **3+ comentários** e uma folha que abre teclado
  (menu de destino do composer, “Onde publicar?”);
- uma publicação de foto em retrato e uma em paisagem.

O fixture `src/features/performance/qa-fixture.ts` define 240 posts, 3 páginas e
80 vídeos/160 fotos, mas hoje alimenta o harness de 20 cartões, não o feed real.
Não copie números dele para o app sem semear a mesma conta/ambiente. Se o
ambiente não tiver o dataset mínimo, registre **NÃO EXECUTADO — dataset
insuficiente** em vez de marcar como aprovado.

Para o teste de publicação, use uma conta confirmada e sem conteúdo sensível.
Não publique em comuna de produção real durante o smoke.

## 5. Preparação do aparelho

| Recurso | iOS | Android |
| --- | --- | --- |
| Fonte ampliada | Ajustes → Acessibilidade → Tela e Tamanho do Texto → Texto Maior (máximo) | Ajustes → Acessibilidade → Tamanho da fonte e exibição (fonte no máximo; repetir com exibição ampliada) |
| Reduce Motion | Ajustes → Acessibilidade → Movimento → Reduzir Movimento | Ajustes → Acessibilidade → Remover animações (ou escalas de animação em 0 no modo desenvolvedor) |
| Leitor de tela | VoiceOver | TalkBack |
| Teclado | teclado virtual visível; testar também com fonte ampliada | Gboard visível; testar também com fonte ampliada |
| Gravação | Control Center → Gravação de Tela + Instruments quando aplicável | `adb shell screenrecord` + Perfetto/Android Studio quando aplicável |

Antes de cada repetição: feche o app, limpe o cache quando o cenário for de
cache frio, volte as configurações ao padrão quando o cenário não for de
acessibilidade e confirme a conta/dataset.

### Checklist por plataforma

| Verificação | iOS | Android |
| --- | --- | --- |
| Build/commit instalado e anotado | ☐ | ☐ |
| Conta de QA com o dataset mínimo | ☐ | ☐ |
| Perfil de rede aplicado e medido | ☐ | ☐ |
| Fonte/exibição no padrão para S1–S8, S11 e S12 | ☐ | ☐ |
| Reduce Motion desligado para S1–S8, S11 e S12 | ☐ | ☐ |
| VoiceOver/TalkBack desligado fora do S8 | ☐ | ☐ |
| Teclado virtual disponível para S7 | ☐ | ☐ |
| Gravação de tela pronta | ☐ | ☐ |
| S1–S12 executados e marcados | ☐ | ☐ |
| Evidências anexadas ao ticket | ☐ | ☐ |

## 6. Matriz de smoke S1–S12

Execute na ordem em que fizer sentido para o build; registre cada linha com
resultado, evidência e observações. O esperado descreve o comportamento do
produto, não uma preferência visual subjetiva.

| ID | Cenário | Passos | Esperado | Automação |
| --- | --- | --- | --- | --- |
| S1 | Rolagem de 200+ posts | Abrir o feed, rolar até depois do 200º post, subir e descer rápido; repetir com cache quente | Lista continua fluida, sem branco persistente, sem salto para o topo e sem duplicar/pular posts; paginação carrega as 3 páginas | E2E cobre 240 posts/3 páginas; fluidez é manual |
| S2 | 3+ vídeos | Rolar por três vídeos; sair da viewport, trocar de aba, abrir tela cheia, voltar e ir para background | No máximo um player toca; vídeo entra mudo e para ao sair; pôster cobre o quadro parado; tela cheia abre o quadro inteiro e voltar não duplica player | Manual (player nativo) |
| S3 | Troca de abas | Alternar Início/Explorar/Praças/Perfil e as abas do feed (“Para você”, “Seguindo”, “Minhas comunas”); voltar | Cada aba mantém o próprio cache e recomeça no topo quando muda; a aba ativa fica visível; não há tela em branco nem perda de sessão | E2E cobre as abas do feed |
| S4 | Back para lista de 3 páginas | Carregar 3 páginas do feed e da Biblioteca, abrir um item do fim da terceira e voltar pelo botão e pelo gesto do sistema | A lista mantém as 3 páginas e a posição; não refaz a primeira página nem volta ao topo; o item de origem continua disponível | E2E cobre feed e Biblioteca pelo botão; gesto do sistema é manual |
| S5 | Pinça/tap/duplo toque/arrasto na foto | Abrir foto em tela cheia; pinçar de 1× a 4×; arrastar até a borda; duplo toque; arrastar para descartar | Zoom acompanha os dedos e assenta nos limites; movimento não vira duplo toque; arrasto sem zoom descarta; foto abre inteira na próxima vez | E2E cobre abrir/fechar por toque; física é manual |
| S6 | Publicação | Criar post com texto/título; publicar no perfil e em até 3 comunas; voltar ao feed; repetir com e-mail não verificado e com erro de API | Post aparece no destino e no feed; botão desabilita enquanto publica; erro preserva o rascunho e explica a recusa | E2E cobre texto no perfil + contrato; demais casos são manuais |
| S7 | Teclado na folha | Abrir “Onde publicar?”, tocar no campo, digitar, rolar a folha, fechar o teclado e confirmar; repetir com fonte ampliada | Campo mantém foco e valor; folha sobe com o teclado; conteúdo e botão de confirmar continuam alcançáveis; nada fica sob o teclado | E2E cobre foco/valor; física do teclado é manual |
| S8 | Leitor de tela | Ativar VoiceOver/TalkBack e percorrer feed, card, ações, folha, composer e foto | Ordem de foco faz sentido; controles têm nome, papel e estado; botão só de ícone é anunciado; modal prende o foco e o fechar é alcançável | E2E cobre papéis/nomes/estados; locução é manual |
| S9 | Reduce Motion | Ativar redução de movimento; abrir app, feed, progresso, foto e folhas | Animações não essenciais são suprimidas ou encurtadas; não há movimento brusco; conteúdo e navegação continuam funcionando | Manual (configuração do sistema) |
| S10 | Fonte ampliada | Fonte do sistema no máximo; percorrer feed, card, composer, sheet, Biblioteca e documento | Nenhum texto corta ou sobrepõe; botões crescem sem sumir; ações empilham quando necessário; rolagem continua alcançando o fim | Manual (escala nativa) |
| S11 | Discussão e comentários | Abrir post com 3+ comentários, rolar a thread, responder, apoiar, abrir “⋯” e voltar duas vezes | Comentários não duplicam; foco do composer permanece; folha abre/fecha; voltar restaura a lista e a contagem | Manual (E2E existente cobre rotas, não a física) |
| S12 | Memória/jank | Executar S1–S2 com Perfetto/Instruments; repetir 5×; exportar snapshot JS e trace nativo | Sem crescimento monotônico de players/observers, sem ANR/travamento e sem jank persistente; comparar com baseline POP-5 | Manual/instrumentado |

Legenda: **P** passou, **F** falhou, **N/A** não se aplica àquele aparelho/build,
**N/E** não executado (com motivo). Nunca marque P sem a evidência anexada.

## 7. Resultados e evidências para o ticket

### Nome dos arquivos

```text
pop64-S01-ios17-iphone13-wifi-2026-11-06.mp4
pop64-S02-android14-moto-g-wifi-2026-11-06-perfetto.zip
pop64-S08-ios17-iphone13-voiceover-2026-11-06.png
pop64-S12-android14-moto-g-4g-2026-11-06-snapshot.json
```

Use o ID do cenário, plataforma, versão do SO, modelo, rede e data. Vídeos de
15–30 s são suficientes para evidenciar o gesto; traces e snapshots vão como
anexo separado. Remova dados pessoais, tokens, e-mails e conteúdo privado antes
de anexar.

### Tabela para copiar no ticket

| ID | Resultado | Evidência | Observações |
| --- | --- | --- | --- |
| S1 | P/F/N/E | link do anexo | o que diferiu, se algo |
| S2 | P/F/N/E | link do anexo | TTFF, player que tocou, erros |
| S3 | P/F/N/E | link do anexo | aba e cache |
| S4 | P/F/N/E | link do anexo | botão/gesto e posição |
| S5 | P/F/N/E | link do anexo | zoom mínimo/máximo e descarte |
| S6 | P/F/N/E | link do anexo | destino, rascunho e erro |
| S7 | P/F/N/E | link do anexo | teclado/fonte |
| S8 | P/F/N/E | link do anexo | VoiceOver/TalkBack |
| S9 | P/F/N/E | link do anexo | Reduce Motion |
| S10 | P/F/N/E | link do anexo | fonte/exibição |
| S11 | P/F/N/E | link do anexo | thread/folha |
| S12 | P/F/N/E | link do anexo | trace/snapshot e repetições |

Preencha também o cabeçalho de ambiente da seção 2 e o perfil de rede da seção 3.
Anexos do Playwright (`test-results/`, `playwright-report/`) são evidência local
e não devem ser versionados; anexe o relatório ou o trace ao ticket.

## 8. Limitações conhecidas

- O E2E roda no Chromium e intercepta a API. Ele não prova contrato com o
  backend real, física de rolagem/gestos, teclado nativo, VoiceOver/TalkBack,
  Reduce Motion, escala de fonte do sistema, FPS, memória, TTFF ou jank.
- O mock do feed devolve o mesmo recorte nas três abas; o teste de S3 prova a
  remontagem/estado da lista, não a diferença de conteúdo entre abas.
- A folha “Onde publicar?” usa o `BottomSheetTextInput` do Gorhom. No web, o blur
  do campo registra um erro interno da biblioteca (`currentlyFocusedInput`), sem
  quebrar o fluxo; o comportamento nativo segue manual em S7.
- Foto e vídeo no web não substituem o aparelho. O dataset E2E usa um PNG em data
  URI para não depender de rede; os vídeos ficam fora da automação.
- A matriz só é válida com o dataset mínimo da seção 4. Ambiente sem 200+ posts
  ou 3 vídeos deve ser registrado como N/E, não como aprovado.
- Nesta entrega a automação (`check:fast`, E2E e Jest) foi executada, mas a
  matriz manual não foi rodada por falta de aparelho e de uma conta de QA com o
  dataset mínimo. Até a execução em iPhone/Android real, as linhas S2, S5 e
  S7–S12 permanecem **N/E** — não presuma aprovação por o E2E ter passado.

## 9. Referências

- `e2e/specs/mobile-ux-smoke.spec.ts` — automação deste ticket.
- `e2e/support/qa-dataset.ts` — fixtures determinísticos do E2E.
- `docs/e2e.md` — como a suíte Playwright funciona e como ampliá-la.
- `docs/mobile-performance-baseline.md` — instrumentação, TTFF, trace e matriz de
  build/aparelho do POP-5.
- `CLAUDE.md` e `AGENTS.md` — regras de gesto, acessibilidade, mídia e validação.
