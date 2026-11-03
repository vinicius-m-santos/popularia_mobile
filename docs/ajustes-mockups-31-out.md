# Ajustes de design a partir dos mockups — outubro/2026

Data: 31/10/2026. Escopo: alinhar Praças, Conta, Biblioteca, Coleção, Documento, conversa da
Praça, criação de publicação (Escrever, Chamado e Enquete), folha “Onde publicar” e a
finalização pós-publicação aos mockups de `mockups_to_implement/` e de `to_implement.html`.

Este documento registra o que mudou, as opções consideradas, o que foi escolhido e o que ficou
de fora. As **regras de produto continuam em `CLAUDE.md` e `AGENTS.md`**; os desvios conscientes
em relação a elas estão listados no fim.

## Resumo

- O vocabulário visual dos mockups foi aplicado nas telas pedidas: chrome com voltar em caixa,
  cartões de 2 px, sombra sólida deslocada, tracejado para superfícies secundárias, amarelo de
  destaque, selos mono e títulos Anton.
- A criação de publicação virou um fluxo em quatro etapas, com destino escolhido em folha própria,
  três tipos de publicação, rodapé de mídia e barra fixa de publicação.
- A finalização (`/publicado`) passou a existir. Antes o app voltava direto ao feed/comuna.
- “Chamado” foi implementado usando a atividade de comuna já existente: cria o evento e publica
  a referência no mural. O backend não modela vagas, lista de espera nem “cada um leva”.
- Nenhuma migração de banco foi necessária. Os contratos de `/posts`, `/events`, `/library` e
  `/squares` foram preservados.
- `tsc --noEmit` e `expo lint` passam. Testes focados das áreas tocadas passam; a suíte completa
  foi executada com `--runInBand --forceExit` (ver a seção de verificação).

## Como revisar

1. Leia as decisões de linguagem abaixo; elas explicam as diferenças que não são óbvias no print.
2. Abra os prints em `docs/prints/ajustes-mockups/` e compare com `mockups_to_implement/`.
   As telas mais densas têm prints de topo e de rolagem; a Conta tem três (`03-conta-2x.png`,
   `03-conta-rolada-2x.png`, `03-conta-fim-2x.png`).
   `01-pracas-comparacao-390.png` é a comparação com selo de não lidas e descoberta injetados;
   `01-pracas-390.png` é a tela com os dados reais da conta de demonstração.
3. O roteiro de captura está em `docs/playwright-screenshots.md`. As capturas usam login de
   demonstração e não alteram o banco por interceptação, exceto as duas publicações de validação
   mencionadas na seção “Dados de validação”.

## Decisões de linguagem (valem para mais de uma tela)

### Chrome interno

Os mockups trocam o chrome de “voltar + divisória + rótulo” por **voltar em caixa de 44 px,
rótulo mono e uma regra de 2 px** embaixo. A caixa do voltar usa `Radius.sm`, borda 2 px e
`Colors.paper`; as ações da direita também ficam em caixas de 44 px. Implementei
`src/components/editorial-header.tsx` e usei em Conta, Coleção, Documento, Criação e na raiz da
Biblioteca. A conversa da Praça tem uma variante escura no próprio arquivo.

**Opções consideradas:** manter o `EventBar` existente; repetir o chrome atual em cada tela; criar
um componente novo. **Escolha:** componente novo e compartilhado, para as cinco telas não
divergirem. O mockup não tem divisória vertical entre voltar e título; a regra inferior de 2 px
substitui a de 1,5 px.

### Cartões, bordas e sombra

- Cartões de conteúdo: papel, borda 2 px `Colors.ink`, `Radius.sm`, padding 12.
- Superfícies secundárias/“acontecendo”: borda tracejada 2 px.
- Cartões de destaque (destino da publicação, capa de identidade da Conta, compositor de foto):
  sombra sólida de 2–3 px sem desfoque (`Shadows.offset`/`offsetSmall`).
- A ação primária continua vermelha com borda de tinta; a ação “Espiar”, os chips e os botões
  compactos usam papel com borda de tinta.
- O vermelho existente (`#D62718`) foi mantido. O mockup renderiza um vermelho mais escuro
  (`#BF3326`); a diferença vem do pipeline de captura e do protótipo, não de um token novo. O
  `../design/Popularia Praça.dc.html` confirma `#D62718`.
- O amarelo apareceu pela primeira vez como cor funcional (destaque de “acontecendo”, opções e
  interruptores). Adicionei `Colors.yellow` (`#F4C534`) e `Colors.yellowSoft` em
  `src/constants/theme.ts` em vez de repetir o tom em cada feature.

### Busca sem rótulo visível

Nos mockups, a busca de Praças, Biblioteca e Coleção é um campo alto com placeholder. As regras
de `CLAUDE.md` pedem rótulo persistente em todo campo editável. **Escolha:** manter o desenho do
mockup e garantir rótulo acessível (`accessibilityLabel`) nos três campos. É uma exceção restrita
a campos de **consulta**, não a formulários. Nos formulários de criação e de envio, o rótulo
persistente continua obrigatório.

### Tipografia

Nenhum tamanho existente foi reduzido. Onde o mockup pede mais presença, usei Anton e alturas
maiores: título de Biblioteca/Praças 54/68; título de documento e de chamado 40/46; título de
coleção 38/46; pergunta de enquete 27/33. Os textos de leitura continuam em 15,5/22.

### “Rascunho local” em vez de “Rascunho salvo”

O mockup mostra “Rascunho salvo · 11:28”, mas o app não persiste rascunho entre sessões. Mostrar
“salvo” seria mentira. A tela diz **“Rascunho local · HH:MM”**. O aviso de saída e a preservação do
texto durante a sessão continuam funcionando. Persistir rascunho fica como próxima etapa.

## Tela por tela

### 1. Praças

**Mockup:** título e ilustração, busca, “Suas Praças” com prévia da última mensagem, hora e selo
de não lidas; “Movimentadas agora · perto de você” com cartões tracejados, presença e “Espiar”.

**Feito:**
- Abertura com o texto exato do mockup e “comunidade.” em vermelho.
- Busca com placeholder “Buscar praça. Ex.: tarifa zero” e rótulo acessível.
- Cartões de “Suas Praças” com marca de 52, título, hora da última mensagem, prévia
  “Autor: texto” e selo vermelho de não lidas. Sem prévia, aparece “Ninguém falou ainda. Puxa o
  assunto!”.
- Cartão com não lidas recebe sombra sólida; os demais mantêm a borda de 2 px.
- Seção “Movimentadas agora” com subtítulo “perto de você”, cartões tracejados, ponto vermelho
  só quando há presença, texto “N pessoas conversando agora” e botão “Espiar”.
- Paginação preservada com ações de “mais” no rodapé.

**Opções consideradas:** manter a lista única com cabeçalhos (escolhida) ou separar em duas
listas; usar os cartões atuais com tags de assunto (rejeitado: o mockup remove as tags e dá lugar
à última mensagem). O cartão inteiro abre a Praça; “Espiar” é um alvo separado para não aninhar
`Pressable` (o aninhamento gerava aviso de `<button>` dentro de `<button>` na web).

**Ajuste fino (revisão de 01/11):** depois da primeira entrega, cartões e busca foram
remeasados contra a imagem em 2× do mockup:
- busca com borda de 2, raio 5, 50 de altura, padding lateral 16, ícone 17 e texto 15,5/21;
- margens laterais de 16 nas seções, nos cartões e na busca;
- cartão com marca de 50 e borda de 2 (raio 5), borda de 2 (raio 5), padding 12, intervalo 12,
  título 16/21, prévia 14/19 em uma linha, hora em sans 13/18 e selo de não lidas 22 × 22;
- iniciais da marca em 38% do lado, para caber com a folga do mockup;
- sombra sólida de 3 px só no cartão com não lidas;
- “Espiar” sem sombra, com borda de 2 e raio 5;
- marca de comuna de tom claro em “Movimentadas agora” recebe o amarelo de destaque quando há
  presença; tons vermelho e preto continuam sendo a identidade da comuna.

**Dados:** usa `lastMessage`, `unread`, `presence` e `status` que já vinham de `/squares`. Nenhuma
mudança de backend. Na conta de demonstração não há Praças de descoberta; a seção só aparece
quando a API devolve itens. O print `01-pracas-comparacao-390.png` usa dados injetados apenas
para conferir o desenho do selo, da hora e dos cartões tracejados.

### 2. Conta

**Mockup:** cartão de identidade com avatar, nome, @, e-mail confirmado; seções “Sua conta”,
“Sobre” e “Sessão”; “Excluir conta” tracejado em vermelho; versão no rodapé.

**Feito:**
- Cartão de identidade com avatar **quadrado de 56**, nome 20/24 e @ logo abaixo (sem o intervalo
  extra que existia). E-mail em linha própria, com o selo “Confirmado” **ao lado do endereço** e a
  explicação “O e-mail não pode ser alterado.” logo embaixo. E-mail não confirmado ganha selo
  vermelho e a ação de confirmação.
- Grupos com borda de 2 px e linhas separadas por 1 px; ícone em quadrado de palha de 44.
- “Sair deste aparelho” e “Sair de todos os aparelhos” como linhas de menu, mantendo o
  comportamento de sessão. A fila da plataforma continua aparecendo para moderadores.
- “Excluir conta” em cartão tracejado vermelho, levando a `/conta/exclusao`.
- Versão lida de `Constants.expoConfig.version` (fallback `1.0.0`).
- Título e descrição de cada linha ficaram com 0 de intervalo e linha de 20, para o conjunto
  parecer um bloco, como no mockup.

**Opções consideradas:** manter a lista plana (rejeitada: o mockup agrupa por assunto); manter a
exclusão dentro da lista (rejeitada: o mockup dá destaque e separa a ação destrutiva).

### 3. Biblioteca Pública

**Mockup:** abertura grande com ilustração, “Adicionar PDF” de largura total, busca, segmentos de
origem, chips de assunto, “Coleções” com “Criar coleção”, “Documentos” com ordenação e cartões de
PDF com capa, autoria/coleção e chip de assunto.

**Feito:**
- Herói com 54/68, arte em 40% e **título + subtítulo na mesma coluna à esquerda da arte**.
- “Adicionar PDF” vermelho de largura total com sombra e 52 de altura; busca de 52, borda 2,
  raio 4 e texto 16/22. Essas duas medidas viraram regra de design.
- “Criar coleção” saiu da Biblioteca: o cabeçalho de “Coleções” agora tem **“Ver mais”**, que abre
  a lista de coleções. A criação continua na própria lista, no `+` do cabeçalho.
- Busca sem rótulo visível; placeholder “Buscar no acervo. Ex.: organização popular”.
- Segmentos “Tudo / De pessoas / De comunas” com borda de 2 px e seleção preta.
- Chips “Todos / Educação / Política / Cultura / Mais assuntos”. A ordem dos três assuntos foi
  fixada para bater com o mockup; “Mais assuntos” abre a taxonomia completa em folha.
- Coleções em faixa horizontal com cartão de 250, marca de 48, padding 16, borda 2, raio 5,
  sombra sólida e metadados em uma linha. Uma coleção única ocupa a largura toda.
- “Documentos” com “Mais recentes / Mais relevantes” em folha. Não existe “Mais antigos” na API,
  então não criei essa opção.
- Cartão público novo: capa de PDF de 56 × 80 (tarja vermelha centralizada e quatro linhas
  cinza), título em **até duas linhas**, autoria · coleção, chip do assunto, páginas · tamanho.
  Sem “Público” repetido: o escopo já é “Documentos”.
- O modo pessoal, de comuna e de salvos continua usando as variantes anteriores; o redesenho foi
  aplicado ao acervo público e à coleção.

**Opções consideradas:** manter o select de assunto (rejeitado: o mockup usa chips); manter as
duas ações no topo (rejeitado: ocupa a largura do “Adicionar PDF”); navegar por “Mais coleções”
dentro da faixa (rejeitado: o usuário pediu uma tela própria). A escolha foi “Ver mais” para
`/biblioteca/colecoes`, com busca, paginação e criação no topo.

**Limites:** a faixa de coleções ainda carrega todas as páginas já buscadas; a evolução para lista
vertical com busca própria continua pendente, como já registrado em `CLAUDE.md`.

### 4. Coleção

**Mockup:** capa grande com iniciais, título, origem, contagem + selo público, descrição,
“Adicionar PDF”, busca + “Assunto”, “Documentos” com ordenação e cartão de PDF com download.

**Feito:**
- Cabeçalho de coleção com overflow para editar (o mockup usa as reticências; a ação de edição
  deixou de ficar no corpo).
- Capa de 98 px com borda e iniciais em Anton; título Anton; “1 documento” e selo vermelho com
  globo.
- “Adicionar PDF” de largura total; busca e botão “Assunto” abrem a folha de assuntos.
- Documentos com “Mais recentes / Mais relevantes” e cartão de PDF com botão de download.
- O download usa o mesmo caminho autenticado do leitor (`openPdf`): na web baixa, no aparelho
  abre o compartilhamento do sistema.

**Opções consideradas:** manter a capa preta decorativa (rejeitada: o mockup usa uma folha de PDF
pequena); manter “Editar coleção” no corpo (rejeitada: o mockup usa o menu do chrome). Os testes
de tela foram ajustados para a nova posição do controle.

### 5. Documento

**Mockup:** capa de PDF grande, assunto e páginas, título Anton, autoria, descrição, caixa
tracejada “Publicar no feed”, “Detalhes”, “Onde está disponível” e barra fixa “Abrir PDF”.

**Feito:**
- Chrome com voltar, “Documento”, salvar (bookmark) e overflow. Salvar saiu do corpo e foi para o
  chrome, como no mockup.
- Capa grande de PDF, chip do assunto, páginas, tamanho e data curta.
- Título 40/46, autoria “por …”, descrição. Sem descrição e com permissão, aparece “Sem descrição
  ainda. Adicionar” levando à edição do documento.
- Caixa tracejada “Publicar no feed” com ícone amarelo; continua abrindo o compositor com
  `documentId`.
- “Detalhes” com responsável (avatar quadrado), biblioteca, data longa e coleção acionável.
- “Onde está disponível” com a biblioteca de origem (casa, selos Original/Público), distribuições
  e Biblioteca Pública. Quando o documento não é público, a linha da Biblioteca Pública mostra
  “Fora do acervo público” em vez de um selo falso.
- Rodapé fixo com “Abrir PDF” vermelho; a barra respeita a área segura inferior.
- Compartilhar, editar, excluir, denunciar e a remoção pela moderação foram preservados no menu.

**Opções consideradas:** manter as ações no corpo (rejeitada: o mockup fixa “Abrir PDF” e move
salvar para o topo); esconder a linha da Biblioteca Pública quando o documento não é público
(rejeitada: a linha explica a ausência, em vez de sumir sem contexto).

### 6. Conversa da Praça

**Mockup:** cabeçalho escuro com voltar em caixa, nome, presença e avatares; mensagens agrupadas
por autoria; balão claro para os outros e escuro para a pessoa; respostas citadas, reações em
selos, mensagem apagada tracejada, regras de dia centralizadas; compositor com “+”, emoji e
enviar; céu vazio até o compositor.

**Feito:**
- Cabeçalho escuro com caixa de voltar de 44, **seta de linha** (não chevron), título mono,
  pilha de presença com até 3 avatares (foto de perfil quando existe) e “N na praça agora”; o
  menu de opções fica à direita.
- Mensagens agrupadas: nome e @ só na primeira mensagem de um grupo; avatar quadrado de 28 com a
  cor de identidade e borda de tinta, alinhado ao topo do balão; balão papel com borda 2 para os
  outros;
  balão tinta para a pessoa. Horário dentro do balão, à direita e próximo do texto.
- Resposta citada em bloco palha; reações em selos com borda; “+” para mais reações.
- Mensagem apagada em caixa tracejada com “Mensagem apagada · HH:MM”.
- Regras de dia centralizadas com fios dos dois lados; mantive o marcador de “Novas mensagens”.
- Compositor com “+” (figurinhas), campo “Mensagem para a praça” com emoji e botão de enviar.
  O rótulo “MENSAGEM” saiu; a área de toque do envio continua ≥ 44.
- A lista invertida recebeu `flexGrow`/`justifyContent: flex-end` para uma conversa curta começar
  no topo, como no mockup, em vez de deixar um vazio grande antes da primeira mensagem.
- O fundo opaco do item cobre a ação de deslizar; antes a seta de resposta aparecia atrás dos
  balões mesmo sem gesto.

**Não feito:** “Marina está escrevendo…” não foi inventado. Não há evento de digitação no
backend; um indicador falso seria pior que a ausência.

**Opções consideradas:** manter a linha por mensagem com avatar e nome repetidos (rejeitada: o
mockup agrupa); usar balão escuro para todas as mensagens (rejeitada: o mockup só escurece a
autoria da pessoa).

### 7. Criação de publicação

**Mockup:** quatro etapas numeradas, cartão de destino, três tipos (Escrever, Chamado, Enquete),
editor com “Rascunho” e contador, foto, título, enquete/chamado, “Sobre o quê?”, rodapé de mídia e
barra vermelha fixa.

**Feito:**
- Cabeçalho com “Nova publicação”, “Rascunho local · HH:MM” e “Prévia”.
- **01 Publicar em**: cartão de 2 px com marca, nome, visibilidade (pública/só membros) e
  “Trocar”. Abre a folha “Onde publicar”.
- **02 O que você quer fazer?**: três blocos iguais, ativo em tinta com marcador vermelho.
- **03**: editor de texto com cabeçalho “RASCUNHO” e contador, botão “+ Título” (o título só
  aparece quando pedido), área de foto com troca/remoção, enquete com pergunta, opções A/B/C,
  adicionar/remover e contador, chamado com título, detalhes, data/hora e local.
- **04**: “Sobre o quê?” com assuntos oficiais (um assunto) quando o destino é o perfil; quando é
  comuna, o assunto é herdado e a tela explica isso. Na enquete, a etapa 04 é “Regras”, com o
  prazo (1 dia, 3 dias, 1 semana).
- Rodapé de mídia: Foto, Vídeo, PDF e Evento (Evento só em comuna e fora do modo demonstração).
- Barra fixa vermelha com o rótulo do tipo (“Publicar”, “Convocar”, “Publicar enquete”), o destino
  e um botão de 56 com seta/avião.
- Prévia continua usando `PostCard`; no Chamado, o botão avisa que a prévia aparece depois de
  publicado.

**Chamado — decisão de escopo:** o backend não tem vagas, lista de espera, “cada um leva” nem
capa de chamado. Em vez de inventar campos que não seriam persistidos, o Chamado cria uma
**atividade de comuna** (`createEvent`) e uma publicação com `eventId`. A tela diz isso em uma
linha discreta. Se o evento for criado e a publicação falhar, o evento fica — não há transação
entre os dois; isso está registrado como risco.

**Enquete — decisão de escopo:** só o prazo é persistido hoje. “Votos anônimos”, “Resultado depois
do voto” e “Modo assembleia” não têm modelo no backend; a tela registra que ainda não fazem parte
da enquete, em vez de exibir interruptores que não fariam nada. O prazo padrão passou a ser 7 dias
para bater com “1 semana” do mockup.

**Sobre o quê? — decisão de escopo:** a API aceita **um** assunto, e só em publicação de perfil
(em comuna o assunto é herdado). O mockup mostra “até 2” e categorias que não existem na
taxonomia (Papo, Meme, Comida). Usei a taxonomia oficial com um assunto e escrevi “até 1”,
mantendo a semântica real. Para comunas, a seção explica a herança.

**O que não entrou:** “Spoiler”, “+ Local”, ALT da foto, “Botão no final” (link/ingresso/vaquinha)
e impressão de cartaz com QR. Nenhum tem contrato no backend nem renderização no feed; criar só a
aparência seria um controle que não age. Ficam como próxima etapa, com o modelo de dados
correspondente.

### 8. Onde publicar

**Mockup:** folha com título, busca, “Minhas · N / Perto de mim”, lista de comunas com marca,
membros e visibilidade, seleção, “Criar uma comuna” e barra vermelha de confirmação.

**Feito:**
- Folha com “Onde publicar?”, subtítulo, busca por nome/bairro/assunto, abas “Minhas · N” e
  “Perto de mim”, “Meu perfil” na primeira aba, cartões de comuna com marca de 44, membros e
  visibilidade, seleção com borda vermelha e check, “+ Criar uma comuna” e rodapé vermelho.
- “Perto de mim” compara a cidade da conta com `place` das comunas e busca a lista completa só
  quando a aba é aberta. Sem cidade, explica como definir em Meus dados. Não usei geolocalização
  nem distância real.
- A confirmação fecha a folha e mantém o destino escolhido; o rodapé de publicação repete o
  destino.

**Opções consideradas:** lista simples sem busca (rejeitada: o mockup pede busca e abas); tabs
falsas (rejeitada: “Perto de mim” filtra de verdade pela cidade).

### 9. Finalização da postagem

**Mockup:** “PUBLICADO · AGORA”, carimbo “COLADO NO MURAL”, frase com a comuna, prévia do post,
“Chama mais gente” com Copiar link/WhatsApp/Mais e barra escura “Ver no mural”.

**Feito:**
- Nova rota `/publicado` (protegida, fora do fluxo de boas-vindas) e tela própria.
- Carimbo vermelho girado com borda dupla, prévia do post com fita e cabeçalho escuro, imagem
  quando houver.
- “Copiar link” usa a URL canônica do post; “WhatsApp” abre `wa.me`; “Mais” usa o compartilhamento
  do sistema.
- “Ver no mural” leva à comuna ou ao feed.
- O compositor publica e navega para a finalização em vez de voltar direto.

**Não feito:** “Imprimir cartaz com QR”. Exigiria geração de QR e um fluxo de impressão; ficou
fora para não entregar um botão sem efeito. O espaço do mockup foi omitido.

### 10. Explorar

O mockup de Explorar reapresenta rankings numerados, uma grade de assuntos e banners. A direção
refinada em `CLAUDE.md` removeu os rankings e priorizou pessoas/comunas antes de grades, e a tela
atual já é a referência aprovada. **Não refiz o Explorar**: seria uma regressão de decisões de
produto já validadas. A tela foi usada apenas como caminho para a Biblioteca nas capturas.
Se o objetivo for mesmo voltar ao desenho do mockup, isso precisa de uma decisão explícita de
produto e de uma rodada própria.

## Backend

Não houve migração. O Chamado reutiliza `POST /comunas/{slug}/events` e `POST /posts` com
`eventId`. A finalização não precisa de endpoint: usa a resposta de `POST /posts` e a tela lê o
último item da sessão.

Na revisão da conversa, `GET/PUT /squares/{id}/presence` passou a devolver `avatarUrl` junto de
`id`, `handle` e `displayName`. A consulta em lote usa `StoredImageUrl::avatarFor(...)` para montar
a URL a partir de `avatar_key`, sem hidratar a entidade `User` por pessoa. O contrato adicional é
compatível: `avatarUrl` é anulável, como nos demais autores. O teste `SquareTest` cobre a chave
(`11 testes`, `242 asserções`).

## Dados de validação

As capturas foram feitas com a conta `equipe.demo@popularia.local`, backend local e interceptação
apenas para remover vídeos (limitação do `expo-video` web). Duas publicações reais de validação
foram criadas no banco local:

- “Fiz o pão de queijo da minha avó…” em c/Tarifa Zero BH (tela de finalização e fluxo Escrever);
- “Roda de conversa sobre moradia” em c/Tarifa Zero BH (fluxo Chamado, cria evento + post).

Não há dados de produção alterados.

## Verificação

- `NODE_OPTIONS=--max-old-space-size=512 npx tsc --noEmit` — passa.
- `NODE_OPTIONS=--max-old-space-size=512 npx expo lint` — passa sem erros.
- Testes focados: `src/features/library`, `src/features/squares`, `src/features/compose`,
  `src/features/explore` — passam após atualização das expectativas de cópia/estrutura.
- Suíte completa: **71 suítes, 443 testes, todos passando** (`jest --runInBand --forceExit`).
  A área de Biblioteca tem 38 testes entre os arquivos de tela e API, incluindo a tela de
  coleções e os casos de descrição do documento. Log completo em `.cache-pw/jest-full.log`.
- Backend: `docker exec popularia_backend-php-1 bin/phpunit tests/Api/SquareTest.php` —
  **11 testes, 242 asserções**, passando após a inclusão de `avatarUrl` na presença.

## Revisão de 01/11 — Biblioteca

- O subtítulo do herói passou para a coluna do título, ao lado da arte, em vez de ficar embaixo
  dos dois.
- O chrome já usa `arrowLeft`; a captura nova mostra a seta no lugar do chevron.
- Busca e ação de corpo passaram a 52 de altura; busca com borda 2, raio 4, ícone 20 e texto
  16/22. A régua foi registrada em `CLAUDE.md` e `AGENTS.md`.
- O card de coleção passou a 250 de largura, marca de 48, padding 16, intervalo 16, borda 2,
  raio 5 e sombra sólida. O metadado fica em uma linha (11,5/16).
- “Criar coleção” virou “Ver mais” e abre `/biblioteca/colecoes`; a nova tela tem busca, lista
  vertical, paginação e criação pelo `+`.
- O ícone de PDF do card foi refeito e depois ampliado para **56 × 80**, com tarja “PDF”
  centralizada e quatro linhas cinza, para ocupar melhor a altura do card.
- O título do documento no card público e no card da coleção corta em duas linhas.
- O subtítulo do herói ficou em 15,5/22 e o intervalo entre a coluna de texto e a arte caiu para
  4, para as duas linhas do mockup (“Conhecimento compartilhado” / “pela comunidade.”).
- Os segmentos de origem ficaram com 48 de miolo + 2 de borda = 52 externos, em vez de 52 de
  miolo + borda. A barra não parece mais alta que o mockup.
- As marcas das coleções passaram a usar uma paleta de identidade estável e **mais viva** que a de
  avatar (`CollectionColors`), derivada do sufixo do ID — o hash FNV colidia em UUIDs criados em
  sequência. “Teste coleção” ficou laranja e “Tetse” ficou esmeralda; a mesma cor acompanha a
  coleção na faixa, na lista e na capa.

## Revisão de 01/11 — Criação de publicação

- O composer usa a seta no voltar, passos **01/02/03/04** em etiqueta vermelha com número
  extrabold e cartão de destino compacto (64 de altura, marca de 42 com borda 2).
- A fita adesiva do mockup foi replicada no cartão de destino e no campo da foto.
- A grade “O que você quer fazer?” perdeu o `space-between` que abria um vão entre ícone e
  texto; gap 8, raio 8 e sem a borda duplicada na ponta direita.
- O card do editor ganhou raio 8 e a sombra sólida de 3 à direita/abaixo; a barra “Rascunho”
  ficou em 30 e o campo da foto também tem raio 8.
- O botão de seta do “Publicar” ficou com raio 8.
- Capturas de topo, rolagem e fim em `07-criar-escrever-2x.png`,
  `07-criar-escrever-rolado-2x.png` e `07-criar-escrever-fim-2x.png`.
- O primeiro passo começa 12 abaixo do chrome; o ícone de Chamado virou o speaker/megafone; a
  foto do rascunho ganhou tilt de -1,2° e a fita ficou mais aparente.
- No perfil, “Escolher assunto” abre uma folha com toda a taxonomia em grupos e rolagem,
  selecionável por completo. O seletor de anexos perdeu “Evento” e ficou com Foto, Vídeo e PDF,
  sem a borda duplicada na direita.
- Capturas do assunto em `07-criar-assunto-perfil-2x.png`,
  `07-criar-assunto-sheet-selecionado-2x.png` e `07-criar-assunto-selecionados-2x.png`.
- A API de publicação aceita `topics` (até 3) e persiste em `post.topics`; o `topic` primário
  continua em `post.topic` para a descoberta existente. Migration `Version20261114100000`.
  O backend `PostTest` cobre dois assuntos e o limite de três.
- O avatar do responsável no Documento passou a usar Anton (bold).

## Revisão de 01/11 — Chamado

- O card do Chamado ganhou a sombra sólida de 3 à direita/abaixo, cabeçalho de 30 e título mais
  justo; o divisor tracejado agora separa a descrição do “Quando”.
- O “Quando” virou a grade **DIA / Nº / MÊS / HORA** do mockup. A grade inteira abre um único
  seletor de data e hora, sem horário de fim; no Android é data → hora, no iOS/web é uma folha
  com os dois. Os atalhos Hoje/Amanhã/Sex/Outra ocupam a largura toda, com “Sex 06” sempre na
  sexta mais próxima.
- O “Onde” consulta o **Photon/OpenStreetMap** (sem chave) e sugere lugares; digitar ainda
  funciona quando a busca não responde.
- “Endereço só para quem confirmar”, “Quantas pessoas” e “Cada um leva” entraram no card. O
  contador acelera ao segurar, para em 1000 e mostra “+1000 pessoas”; “Cada um leva” começa
  vazio. A capacidade e os itens entram no texto do evento/publicação.
- O seletor de anexos do Chamado ficou com Foto, Vídeo e PDF; o botão de confirmar usa o
  **speaker** e o subtítulo mostra as vagas.
- Capturas em `08-criar-chamado-2x.png`, `08-criar-chamado-rolado-2x.png` e
  `08-criar-chamado-itens-2x.png`.
- A fita do rascunho ficou menor (56) e a foto ganhou 16 de respiro antes do campo, sem encostar
  no botão “+ Título”. Removi “Quando lotar…” e “Endereço só para quem confirmar” (seletor e
  subtexto); essa lógica fica fora desta versão.

## Revisão de 01/11 — Publicado

- A rota `publicado` foi removida do app e o `Stack` não a registra mais. Depois de publicar
  (ou de uma chamada local), o compositor redireciona direto para o feed (`/`). A tela e o
  `last-publication` continuam no código para uma futura revisão, mas estão fora do fluxo.
- Teste ajustado para exigir `router.replace('/')`.

## Revisão de 01/11 — Onde publicar

- A folha passou a usar o **creme** do app, não o papel branco.
- Busca, abas, itens, botão de fechar e “Criar uma comuna” usam **raio 8**; o “Perto de mim” não
  duplica a borda à direita.
- O item selecionado tem borda de tinta e **sombra vermelha** de 3 à direita/abaixo, como no
  mockup. Avatares (inclusive o de foto) ficaram quadrados com cantos arredondados e borda preta.
- O rodapé “Publicar em” virou uma faixa vermelha de largura e base inteiras.
- “Perto de mim” foi ocultado; o rodapé vermelho agora cobre toda a base, sem faixa creme.
- Os itens agora são **checkboxes**: é possível marcar até **3 comunas** e o rodapé mostra “2 locais”/“3 locais”.
  O perfil segue exclusivo. A API continua com uma comuna por publicação, então o app cria uma
  cópia por destino (cada uma com seus próprios comentários/reações). Foto/vídeo ficam bloqueados
  para múltiplos destinos por causa da restrição de anexo único por publicação; PDF e enquete
  podem ser copiados.
- Capturas em `10-onde-publicar-2x.png`, `10-onde-publicar-multi-2x.png` e
  `10-onde-publicar-multi-card-2x.png`.

## Revisão de 01/11 — Enquete e anexos do Chamado

- O card da Enquete passou a usar raio 8, sombra sólida de 3 e cabeçalho de 30, como o rascunho.
  Nenhuma opção de Foto, Vídeo, PDF ou Evento aparece na Enquete.
- No Chamado, o seletor ficou com **Capa** e **Vídeo**; PDF e Evento ficam ocultos. A capa e o
  vídeo são anexados à publicação do chamado; a capa tem prévia e remoção no card.
- Capturas em `09-criar-enquete-2x.png` e `09-criar-enquete-rolado-2x.png`; o Chamado atualizado
  aparece em `08-criar-chamado-fim-2x.png`.

## Revisão de 01/11 — Documento

- Salvar e reticências ficaram **soltos**, sem caixa, borda ou fundo.
- O ícone grande do PDF ganhou o **tilt de -3°** e mantém a borda de tinta.
- O título do documento passou para **title case** (primeira letra de cada palavra), em vez de
  caixa alta.
- Sem descrição, visitante não vê nada; dono vê “Sem descrição ainda. **Adicionar**” sublinhado,
  que abre a edição do documento.
- “Publicar no feed” ficou mais compacto: 64 de altura, ícone amarelo de 40 com borda 2 e
  tipografia menor.
- Os títulos de seção “Detalhes” e “Onde está disponível” encostaram no conteúdo: gap 0 e padding
  de 4, deixando só o respiro do `SectionHeading`.
- “Abrir PDF” perdeu a linha de topo da barra; o botão ficou com 52 de altura e borda de 2.
- A captura de topo e a rolagem estão em `06-documento-2x.png` e `06-documento-rolado-2x.png`.
- O avatar do responsável ganhou iniciais maiores; o rodapé “O original fica...” tem 8 de margem
  acima; e o “Abrir PDF” ganhou sombra sólida de 3 à direita/abaixo.
- O estado sem descrição foi capturado nas duas visões:
  `07-documento-sem-descricao-dono-2x.png` (com “Adicionar” sublinhado, indo para
  `/biblioteca/enviar?edit=...`) e `07-documento-sem-descricao-visitante-2x.png` (sem a linha).

## Revisão de 01/11 — Coleção

- O menu de reticências ficou **solto**, sem borda nem fundo; o voltar continua em caixa.
- A capa da coleção voltou a ter a moldura de tinta **com sombra sólida**, como no mockup.
- “Adicionar PDF” ficou com 52 de altura e borda de 2, no mesmo padrão da busca.
- Busca e “Assunto” compartilham 52 de altura, borda de 2, raio 4; o filtro ficou com 120 de
  largura, como no mockup.
- O card do documento passou a raio 8, um pouco mais redondo que o card de coleção.
- O título do documento segue cortado em duas linhas e o ícone de PDF é o novo, de 52 × 64.

## Revisão de 01/11 — Conta

- O voltar do chrome passou de chevron para **seta de linha** (`arrowLeft`), no componente
  compartilhado `EditorialHeader`.
- A foto do perfil passou a ser **quadrada** de 56, com cantos arredondados.
- O nome e o @ ficaram sem intervalo; a linha do nome usa 20/24.
- O “E-MAIL” virou rótulo isolado; o endereço e o selo “Confirmado” ficaram na mesma linha, e a
  explicação encostou no endereço (3 px). O endereço trunca antes do selo, como no mockup.
- O intervalo entre título e descrição das opções caiu para 0; o intervalo entre o título da
  seção e o grupo também caiu para 0, deixando só o respiro do chrome do `SectionHeading`.
- Ícones alinhados ao mockup: `block` (círculo cortado) para Pessoas bloqueadas e `logout`
  espelhado (porta à direita, seta para a esquerda) para Sair deste aparelho, além da seta do
  voltar.
- “Excluir conta” perdeu o fundo rosa do ícone; o lixo vermelho fica direto no creme, com
  padding 16 e ícone de 22, como no mockup.
- A captura agora cobre o topo (`03-conta-2x.png`), a rolagem intermediária
  (`03-conta-rolada-2x.png`) e a tela até o rodapé (`03-conta-fim-2x.png`).

## Revisão de 01/11 — Conversa da Praça

- O voltar do cabeçalho passou de chevron (`back`) para **seta de linha** (`arrowLeft`, novo ícone
  em `src/components/icon.tsx`), igual ao mockup.
- A pilha de presença não aparecia porque o primeiro `GET /presence` chegava antes do heartbeat
  que atualiza a contagem e não era repetido. O efeito agora depende de `square.presence` e tenta
  de novo enquanto a lista vier vazia. Com isso a foto de perfil de quem está na praça aparece.
- O endpoint de presença passou a devolver `avatarUrl`; sem isso o cliente só tinha as iniciais.
  A consulta não hidrata usuário: usa a `avatar_key` e monta a URL com `StoredImageUrl::avatarFor`.
- Os avatares do topo ficaram em 18, quadrados com cantos arredondados, **sem a borda creme** e
  com sobreposição de 4 px entre eles. A pilha mostra até três pessoas; o print tem três pessoas
  reais. A conversa mostra mensagens de duas pessoas e a própria.
- O avatar ao lado da mensagem passou a ser quadrado de 28 com a mesma cor de identidade do topo
  e borda de tinta, alinhado ao **topo do balão**, não à base. O espaço entre o texto e o horário
  caiu para 3 px + 1 px de margem; o horário passou a sans 12/16.
- O print de validação é `02-chat-2x.png` (780 × 1800).

## Revisão de 01/11 — Praças

O retorno do usuário foi específico: o cartão e a busca de Praças ainda não estavam fiéis. A
segunda passada mediu a imagem do mockup em 2× (780 px) e ajustou:

| Item | Antes | Depois |
| --- | --- | --- |
| Borda da busca | 1,5 | 2 |
| Raio da busca | 4 | 5 |
| Altura da busca | 52 | 50 |
| Padding da busca | 12 | 16 |
| Ícone da busca | 21 | 17 |
| Fonte do placeholder | 18 | 15,5 |
| Margem lateral | 18 | 16 |
| Marca do cartão | 52, sem borda | 50, borda 2, raio 5 |
| Iniciais da marca | 43% | 38% |
| Borda do cartão | 2 | 2 (raio 5) |
| Sombra do cartão não lido | 2 | 3 sólidos |
| Selo de não lidas | 26 | 22 |
| Hora | mono 12 | sans 13 |
| Prévia | 14,5, 2 linhas | 14, 1 linha |
| “Espiar” | 14, com sombra | 15,5, sem sombra, raio 5 |

A decisão de usar amarelo na marca de descoberta vale só para comunas de tom claro com presença;
não inventei um quarto tom no backend. A conta de demonstração não tem Praças de descoberta, por
isso a tela real não mostra a seção “Movimentadas agora”.

### Conferência em 2×

As primeiras capturas foram feitas em 1× (390 px). O mockup tem 780 px (2×), então a borda de
2 unidades lógicas aparece com 2 px na captura e com 4 px no mockup. Isso faz a borda parecer mais
fina e a cor parecer diferente quando as duas imagens são abertas no mesmo tamanho. A conferência
correta é em 2×:

- `01-pracas-comparacao-2x.png`: mockup à esquerda e app à direita, ambos em 780 px;
- `01-pracas-mock-data-2x.png`: app em 2× com selo de não lidas e descoberta injetados para
  comparar o desenho completo.

Na comparação em 2×, busca e cartões ficam com 4 px de borda (2 lógicas), o mesmo raio medido no
mockup (10 px para a busca e o cartão, 10 px para a marca) e o mesmo preenchimento de papel. A
cor da borda é `Colors.ink` (`#16120F`), a mesma dos demais controles; o mockup rasteriza `#15120F`
por diferença de perfil de cor, sem diferença visual.
- Playwright: Praças, conversa, Conta, Biblioteca, lista de coleções, Coleção, Documento,
  Criação (Escrever/Chamado/Enquete), Onde publicar e Finalização. As capturas de Biblioteca,
  Coleção e Documento foram refeitas em 2×; a Biblioteca tem topo, rolagem de coleções e a lista
  completa em `04-biblioteca-2x.png`, `04-biblioteca-colecoes-2x.png` e `04-colecoes-lista-2x.png`.
  Prints em `docs/prints/ajustes-mockups/`.
- No composer, os blocos de tipo, o cartão de destino e o rodapé foram ajustados para 320 px:
  os rótulos “Escrever”, “Chamado” e “Enquete” passaram a caber em uma linha. Em 360 px a criação
  e a Biblioteca também foram conferidas.
- Não validado: teclado no aparelho, gestos de pinça/arrasto, leitor de tela, fonte ampliada e
  320 px em todas as telas. O web também não prova o comportamento nativo de download/print.

## Pendências e riscos conhecidos

1. **Vagas/lista de espera do Chamado** ainda não são aplicadas pelo backend: a capacidade e os itens entram no texto do evento/publicação, mas não bloqueiam presença nem criam fila. A privacidade do endereço também é uma decisão de interface; o endereço completo ainda não é escondido pelo servidor.
2. **Regras de enquete** (anônima, resultado depois do voto, assembleia) não estão modeladas.
3. **Rascunho** não persiste entre sessões; o rótulo diz “local”.
4. **Assunto da publicação**: um assunto, só no perfil; em comuna é herdado.
5. **ALT de foto, Spoiler, Local, botão de link e cartaz com QR** não foram implementados.
6. **Explorar** não foi migrado para o mockup por conflito com a direção aprovada.
7. **Teste no aparelho**: os prints web não substituem teclado, acessibilidade, gestos e fonte
   ampliada. A conversa curta foi ajustada no web; no aparelho é preciso conferir o teclado e o
   compositor.
8. **Dados de descoberta**: a conta de demonstração não tem Praças de descoberta; a seção
   “Movimentadas agora” só aparece quando a API devolve itens. A captura com dados injetados não
   foi usada como prova de layout final.
9. **Publicar enquete e chamado** foram validados no fluxo real (o chamado criou evento + post).
   A enquete foi validada por teste automatizado e pelo formulário; não criei uma enquete real
   apenas para o print.

## Arquivos principais

| Área | Arquivos |
| --- | --- |
| Chrome e tokens | `src/components/editorial-header.tsx`, `src/constants/theme.ts`, `src/components/section-heading.tsx`, `src/components/icon.tsx` |
| Praças e conversa | `src/features/squares/squares-screen.tsx`, `src/features/squares/square-screen.tsx`, `src/features/squares/components/message-row.tsx`, `src/features/squares/components/square-composer.tsx` |
| Conta | `src/features/account/account-settings-screen.tsx` |
| Biblioteca | `src/features/library/library-screen.tsx`, `document-card.tsx`, `document-screen.tsx`, `pdf-mark.tsx` |
| Criação e finalização | `src/features/compose/create-post-screen.tsx`, `published-screen.tsx`, `last-publication.ts`, `src/app/publicado.tsx` |
| Testes atualizados | `src/features/{squares,library,compose}/__tests__` |
| Documento | `docs/ajustes-mockups-31-out.md`, `docs/prints/ajustes-mockups/` |
