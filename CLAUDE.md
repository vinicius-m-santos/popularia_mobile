# Design da Popularia

## Direção e escopo

A Popularia é uma rede social com identidade editorial e brutalista: papel, tinta, vermelho,
tipografia de impacto e composição retilínea. O acabamento deve transmitir clareza e cuidado,
com conteúdo fácil de encontrar e controles fáceis de reconhecer.

A Biblioteca Pública, o Explorar, as Praças e o Início são referências visuais refinadas com o
usuário. Aplique os critérios abaixo a novas features e revisões solicitadas. Isso **não autoriza
uma migração automática das outras telas**, nem mudanças nos defaults de componentes
compartilhados para reproduzir uma única tela. Preserve decisões específicas de produto e
elementos que o usuário já removeu.

Fontes de implementação:

- Tokens: `src/constants/theme.ts`.
- Tipografia: `src/components/app-text.tsx`.
- Referência de composição: `src/features/library/library-screen.tsx`.
- Referência de card: variante `public` de `src/features/library/document-card.tsx`.
- Descoberta, busca e cabeçalho durante a rolagem: `src/features/explore/explore-screen.tsx`.
- Card social resumido: `src/features/explore/discovery-post-row.tsx`.
- Lista de comunidades, abertura e card: `src/features/squares/squares-screen.tsx`.
- Feed, abertura do dia e faixa de progresso: `src/app/(tabs)/(inicio)/index.tsx` e
  `src/features/gamification/progress-screen.tsx`.
- Foto no feed e em tela cheia: `src/features/posts/components/post-attachment.tsx` e
  `photo-viewer.tsx`.
- Títulos de seção reutilizáveis: `SectionHeading` com `appearance="editorial"`.

Os prints do Explorar, das Praças e do Início enviados pelo usuário validaram as composições
nessas telas. Eles não comprovam, sozinhos, comportamento do teclado, acessibilidade, desempenho
ou adaptação a todas as larguras. Preserve essa distinção ao avaliar novas telas.

## Hierarquia antes de decoração

- Dê prioridade ao conteúdo e à tarefa principal da tela. Títulos, ilustrações, ações e filtros
  não devem consumir toda a atenção antes de aparecer o conteúdo.
- Use títulos condensados e contrastes fortes nos pontos de identidade. Evite aplicar o mesmo
  peso a todos os botões, filtros, cards e divisórias.
- Uma abertura ilustrada deve apresentar a seção de forma compacta. Em telas de uso recorrente,
  avalie quanto a pessoa precisa rolar antes de alcançar o primeiro item útil.
- Ilustrações complementam o título; não devem competir com ele ou cobrir textos. Reserve espaço
  próprio no layout. Em larguras pequenas ou com fontes ampliadas, priorize o texto.
- Com ilustração ao lado do título, o bloco de texto define a altura da faixa: descrição na mesma
  coluna do título, arte alinhada ao topo. Centralizar um título de uma linha contra uma arte alta
  o deixa solto e ainda empurra a descrição para baixo. Nas Praças, a arte ocupa 40% da largura e
  desaparece abaixo de 360 ou com fonte ampliada.
- Em superfícies de descoberta social, dê espaço a pessoas, comunas e conversas. Uma grade extensa
  de categorias ou um banner não deve adiar indefinidamente a presença da comunidade.

## Cores, superfícies e bordas

Use os tokens existentes; não invente tons semelhantes em cada feature.

| Função | Referência |
| --- | --- |
| Fundo da tela | `Colors.cream` |
| Superfícies de campos, cards e botões secundários | `Colors.paper` |
| Texto principal e seleção forte | `Colors.ink` |
| Bordas finas de cards e controles secundários | `Colors.inkSoft` |
| Texto de apoio e metadados | `Colors.muted` |
| Ação principal e pequenos marcadores editoriais | `Colors.red` |
| Agrupamento de filtros e seleção suave | `Colors.strawLight` |

- Preserve contraste suficiente para reconhecer controles habilitados. Fundo igual ao da tela
  com borda bege quase invisível fez o filtro de assunto parecer desabilitado.
- Use bordas de 1 em cards e controles secundários. A ação principal editorial mantém borda
  de 1.5 em `Colors.ink`, inclusive quando seu preenchimento é vermelho.
- `Colors.rule` serve a separadores discretos; não deve ser o único contorno de um controle
  que precisa se destacar do fundo creme.
- Evite selos vermelhos para informações repetidas pelo contexto. Dentro de “Documentos públicos”,
  marcar cada card como “Público” compete com o título sem acrescentar informação. Preserve a
  indicação de acesso quando houver escopos misturados ou conteúdo restrito.
- Um marcador não pode contradizer o texto ao lado. O ponto de presença só aparece quando a praça
  está ativa e há alguém: “0 pessoas” com marcador vermelho lê como erro, não como informação.

## Formas e botões

**Nenhum botão com texto usa `Radius.pill`.** A regra inclui ações, filtros, chips e tags de seleção.
O nome legado `PillButton` não é uma instrução para criar pílulas: ele usa `Radius.sm`.

- Controles: prefira `Radius.sm` (4), incluindo botões, campos e filtros da direção refinada.
- Cards, banners e blocos editoriais: mantenha cantos retos como referência.
- Botões apenas com ícone podem ser circulares. Avatares e decoração circular também são permitidos.
- Cantos retos de fluxos existentes podem permanecer até uma revisão solicitada. Não misture raios
  arbitrários entre controles com a mesma função.

Antes de criar um botão, reutilize `EditorialAction`, `PillButton`, `JoinButton` ou `IconButton`.
Não copie a implementação desses componentes para a feature.

| Ação | Tratamento na direção refinada |
| --- | --- |
| Principal, como “Adicionar PDF” | `EditorialAction`, `tone="red"`, texto claro, borda tinta 1.5 |
| Secundária importante, como “Criar coleção” | `EditorialAction`, `tone="paper"`, texto escuro, borda tinta 1 |
| Terciária, como “Cancelar” | `tone="ghost"` quando o contexto já deixa a interação clara |

- A ação secundária ao lado da principal deve continuar parecendo um botão. Não use `ghost`
  para “Criar coleção”: o teste no aparelho mostrou perda de definição e presença.
- Para ações de uso frequente nessa direção, use `labelVariant="button"`: sans em caixa normal.
  O componente ainda tem defaults quadrados e mono; aplique a variante e `Radius.sm` explicitamente
  pela API existente, sem alterar todos os consumidores.
- Ações editoriais têm altura mínima 50, ícone 22 e intervalo ícone/texto 8. Ações pareadas
  compartilham altura, raio e tipografia. Dimensione pelo layout, sem reduzir a fonte para caber.
- Empilhe ações quando a largura ou a ampliação de fonte impedir a leitura completa dos rótulos.
- A área de toque mínima é 44. Alturas devem poder crescer quando o conteúdo exigir.
- Preserve feedback de toque e estados selecionado, indisponível e em andamento. Informe também
  o estado às tecnologias assistivas; não dependa apenas de cor.

## Tipografia e legibilidade

Cada família tem uma função:

- **Anton / condensada:** títulos de impacto e identidade da seção.
- **Archivo:** leitura, títulos de conteúdo e controles frequentes.
- **IBM Plex Mono:** pequenos rótulos editoriais e títulos de seção em caixa alta.

Referências locais, em unidades de layout do React Native, não pixels da captura:

| Uso | Tamanho / altura de linha |
| --- | --- |
| Título principal Anton da Biblioteca | 42–50 / aproximadamente 1.25 × o tamanho |
| Título principal Anton do Explorar | 54 / 68, acompanha a rolagem |
| Título principal Anton das Praças | 54 / 68 |
| Título de seção mono | 12.5 / 18 |
| Título de documento | 16 / 22, extrabold |
| Texto de leitura (`body`) | 15.5 / 22 |
| Texto de botão (`button`) | 13.5 / 18 |
| Metadados (`caption`) | 13 / 18 |
| Trecho de publicação no Explorar | 16 / 22, bold, até três linhas |
| Texto de busca do Explorar | 18 / 24 |

- Reutilize variantes de `AppText`. Esses valores são referências por função, não uma autorização
  para substituir toda a escala tipográfica existente ou uniformizar elementos diferentes.
- Título dentro de card ou linha de lista é conteúdo: usa sans extrabold. A condensada pertence à
  abertura da tela e às marcas de identidade, não ao título de cada item de uma lista.
- Não reduza tamanhos de fonte ou alturas de linha existentes sem solicitação explícita.
  Resolva excesso de altura primeiro com hierarquia, repetição de informação e espaçamento.
- Ao aumentar uma fonte, ajuste também a altura de linha. Na Biblioteca, o título de seção em
  12.5 herdava linha 14; foi ajustado para 18 para acomodar os acentos.
- Confira palavras como “COLEÇÕES”, “PÚBLICA” e números. Ausência de erro de compilação não garante
  ausência de corte visual. Evite altura fixa e `overflow: hidden` em contêineres de texto.
- Títulos longos precisam de espaço: o card público permite até três linhas e a coleção até duas.
  Não diminua a fonte para forçar um título de documento a caber em uma linha.

## Layout e ritmo vertical

- Reutilize `Screen`, `MaxContentWidth` (640) e os tokens de espaçamento. Na Biblioteca,
  a margem lateral é `Spacing.five` (18); alinhe título, campos, cabeçalhos e cards nessa guia.
- Use 4–8 para relações próximas, 8–12 dentro de grupos e 16–24 quando for preciso separar blocos.
  Escolha pelo agrupamento do conteúdo; não some margem e padding sem observar o intervalo final.
- Título de seção e sua descrição devem parecer um grupo. “Adicionados recentemente” fica próximo
  de “Documentos públicos”, sem criar uma segunda abertura antes da lista.
- Preserve espaços de leitura, mas evite vazios grandes entre filtros, coleções e documentos.
  Reduzir esses intervalos aproximou o acervo sem diminuir o texto.
- Cards de coleção são mais compactos que cards de documento: mínimo 72 na referência atual,
  crescendo com o conteúdo. Não imponha altura fixa a uma lista com títulos variáveis.
- O cabeçalho interno usa o chrome compartilhado da Biblioteca descrito em `AGENTS.md`.
  Não crie outra combinação de voltar, título e separadores para cada feature.
- Para novos títulos de seção nessa direção, reutilize `SectionHeading appearance="editorial"`:
  marcador vermelho, rótulo mono 12.5/18 e ação em sans/tinta com alvo mínimo 44. “Ver todas”
  é navegação secundária; não precisa competir em vermelho com o conteúdo.
- Não acrescente uma linha preta forte acima de toda seção. Alinhamento, espaçamento e o marcador
  editorial já podem estabelecer a separação. Use divisórias discretas entre linhas de pessoas.

## Busca e filtros

- Agrupe busca e filtros visualmente. Use rótulo persistente para o campo e placeholder curto
  e realista. Na Biblioteca: “Buscar no acervo” e “Ex.: organização popular”.
- Diferencie filtro de formulário: “Todos os assuntos” comunica ausência de restrição;
  “Assunto · opcional” e “Sem assunto” pertencem ao contexto de preenchimento.
- Reutilize `SingleTopicField` com `appearance="filter"` para esse uso; não altere o comportamento
  das variantes de formulário para atender a uma tela de consulta.
- Filtros de origem usam sans, fundo agrupador palha e seleção em tinta com texto claro.
  Os filtros não precisam de contornos fortes individuais como se todos fossem ações principais.
- Mostre uma forma clara de limpar filtros. Ao filtrar documentos, as coleções gerais deixam de
  ocupar a área de resultados, pois não correspondem necessariamente à consulta.
- Diferencie carregamento, acervo vazio, nenhum resultado e erro. Preserve retry e paginação.

## Descoberta social: entrada e resultados

- A entrada do Explorar é uma visão resumida da comunidade. Na composição validada, discussões
  aparecem antes da grade de assuntos; pessoas e comunas ficam antes do banner da Biblioteca.
  Preserve essa prioridade ao evoluir a tela.
- Limite a amostra de cada seção para que uma categoria não ocupe várias telas antes das demais.
  O Explorar mostra até três itens por seção de conteúdo e seis assuntos. Esses limites são
  decisões dessa tela, não limites universais para qualquer lista do app.
- Toda amostra precisa de um caminho para o restante. “Ver todas” abre a categoria completa;
  “Ver todos” dos assuntos abre `BottomSheet` com a taxonomia inteira. Feche a folha ao selecionar.
  Não corte itens silenciosamente nem invente um “Ver todos” que apenas acrescente outra amostra.
- Seções sem conteúdo não devem aparecer como cabeçalhos soltos. Se toda a descoberta estiver
  vazia, mostre um estado explicativo. Não preencha lacunas com métricas ou conteúdo inventados.
- Categorias específicas mostram resultados paginados; a busca geral pode agrupá-los por tipo.
  Ao trocar de categoria, preserve o termo e, na página de assunto, o assunto selecionado.
- Banners de outros recursos são caminhos complementares. O da Biblioteca tem altura mínima
  144, cresce com o texto e aparece após o conteúdo social. Não retorne ao banner grande no topo
  sem uma mudança explícita de prioridade do produto.

## Cabeçalho durante a rolagem

- Em descoberta e listas longas, o título de impacto pode aparecer na abertura, mas deve sair
  com a rolagem. Fixe apenas os controles úteis à consulta, como busca e filtros. Não mantenha
  um título grande consumindo permanentemente a área de leitura.
- O bloco fixo tem fundo opaco `Colors.cream`, respeita a área segura e mantém os alinhamentos
  laterais. Conteúdo pode passar por trás dele durante a rolagem; texto atravessando visualmente
  o fundo do cabeçalho ou controles sobrepostos são falhas.
- Mantenha a mesma instância do campo ao alternar entre descoberta, carregamento e resultados.
  Recriar o campo a cada caractere pode perder foco ou fechar o teclado. Evite árvores distintas
  de busca para cada estado e chaves que mudem com o texto digitado.
- A implementação do Explorar usa uma `FlatList`: título no cabeçalho e controles na primeira
  célula fixa. Não envolva uma lista vertical virtualizada em outro scroll vertical para obter
  esse efeito. Preserve chaves estáveis e diferencie itens de tipos distintos pelo tipo e ID.
- Após uma nova busca ou troca de categoria, apresente o início dos resultados abaixo dos controles.
  Acrescentar uma página ou revalidar ao voltar de um detalhe não deve resetar deliberadamente
  a navegação. Confira também teclado aberto, lista curta e fontes ampliadas no aparelho.
- Filtros horizontais podem mostrar parte da próxima opção na borda, indicando continuação.
  Mantenha seus rótulos inteiros quando a opção estiver visível e traga a seleção para a área
  visível quando ela mudar por outro caminho, como “Ver todas”.

## Feed: a edição do dia

Referência: `src/app/(tabs)/(inicio)/index.tsx` e `src/features/gamification/progress-screen.tsx`.

- Cada dia abre com uma regra: rótulo mono (“Hoje”, “Ontem”, “7 nov”) e um fio de 1 preenchendo a
  linha. Entre publicações do mesmo dia, fio discreto em `Colors.rule`. Não volte à linha de 1.5
  em `Colors.ink` entre cada publicação: ela transforma o feed numa grade de caixas.
- Progresso é status no feed, não checklist: sequência, marcadores de missão e atalho para
  `/progresso` em uma faixa compacta. O checklist completo fica na tela de progresso. Não mostre
  quadradinhos fixos que imitam caixas de seleção.
- O composer é a única superfície de controle antes do primeiro post: borda 1 em `Colors.ink`,
  `Radius.sm`, 52 de altura e o convite do dia em uma linha. Evite empilhar caixas no topo.
- Cada aba é uma lista própria: trocar de aba recomeça do topo e mantém o cache da aba. A aba
  ativa precisa entrar na área visível quando muda por gesto, não só por toque.

## Fotos e mídia

Referência: `src/features/posts/components/post-attachment.tsx` e `photo-viewer.tsx`.

- No feed, a foto enche o quadro: `cover` com proporção derivada do arquivo, limitada a 4:5 no
  retrato e 16:9 na paisagem. Não use `contain`: faixa morta lê como imagem quebrada.
- Enquanto carrega, use a listra da casa (`StripedPlaceholder`); a imagem entra por cima com fade.
  O lugar da foto já nasce preenchido com a linguagem do app, nunca com um spinner solto.
- Tocar abre a foto em tela cheia, dentro da área útil: a imagem não corre sob o recorte e o chrome
  fica embaixo, ao alcance do polegar, com divisória em `Colors.inkRule`. É o caminho para ver o
  que o corte do feed escondeu — por isso o corte pode ser firme.
- Gestos da foto: pinça de 1× a 4×, arrasto limitado à imagem, toque duplo alterna o zoom e, sem
  zoom, arrastar descarta a foto. Um gesto de movimento nunca pode virar toque duplo.
- Vídeo toca sozinho ao entrar na viewport, **sem som**, e para ao sair: um player por vez. O som
  é escolha da sessão e vale para o próximo vídeo, como nos apps de vídeo.
- O primeiro quadro vira pôster (`generateThumbnailsAsync`) e cobre o vídeo quando ele sai da tela.
  Antes disso, listra escura: o vazio do vídeo usa a mesma linguagem da foto.
- Os controles são nossos, não os nativos: tocar pausa, segurar acelera em 2×, o som fica no canto
  inferior direito e o fim mostra “Ver de novo” sobre um véu. O chrome nativo cobre o quadro, não
  aceita estilo e não convive com esses gestos.

## Cards sociais e linhas de pessoas

- No Explorar, a identidade de quem publicou substitui a numeração grande de ranking. Não
  reintroduza esses números como decoração. Avatar, nome e @ deixam a descoberta mais humana.
- Ordem do card social: avatar/nome/@ → comuna, quando houver → trecho da publicação → tempo,
  comentários e indicação de mídia. Não ocupe uma linha com “No perfil” quando não houver comuna.
- Referência do resumo social: fundo papel, borda 1 `Colors.inkSoft`, cantos retos, padding 12,
  intervalos internos 8 e distância entre cards 8. Avatar 36; trecho em bold 16/22, até três linhas.
  A altura é determinada pelo conteúdo, nunca fixada para simular uma grade.
- Reutilize `Avatar` e `PostBody`, preservando fotos, iniciais, menções e links. O toque no card
  abre a publicação; links internos devem conservar seu destino sem acionar também o card.
- O resumo do Explorar não é automaticamente o padrão do feed completo ou do detalhe de publicação.
  Não replique o texto todo em negrito em conteúdos longos sem avaliar a leitura.
- Pessoas e comunas podem permanecer como linhas com avatar, informações e ação lateral. Não
  envolva cada linha em uma caixa só porque publicações usam cards. Separe a área que abre o perfil
  da ação “Seguir”, mantendo os componentes e estados de relacionamento existentes.

## Cards e coleções

- Ordem de leitura do documento: título → autoria, quando disponível → origem/coleção → formato,
  páginas e tamanho. Agrupe metadados e evite linhas vazias para valores ausentes.
- Não repita “PDF” na decoração e novamente no conteúdo. Um pequeno ícone e a informação de formato
  nos metadados são suficientes. Capas decorativas repetidas não devem roubar largura do título.
- O card inteiro deve ser acionável, com nome acessível e indicação de navegação consistente.
- Escolha a anatomia do card pela quantidade de metainformação, não por imitação de outro card.
  Com ícone pequeno e três ou mais linhas de metadado, funciona cabeçalho + bloco indentado (card
  público). Com marca ou avatar grande e uma ou duas linhas, use uma linha de duas colunas —
  identidade, coluna única de conteúdo, chevron centrado — e a altura passa a ser conteúdo mais
  padding. Empilhar metadado sob uma marca de 44 abre faixa vazia sob o título e embaixo da marca.
- Não repita o título na linha de apoio. Se a origem tem o mesmo nome, omita a linha: texto
  idêntico ao título lê como defeito de renderização, não como informação.
- Uma única coleção, sem próximas páginas, ocupa toda a largura disponível. Várias coleções podem
  aparecer em faixa horizontal, deixando perceptível a continuação. Uma única caixa estreita com
  espaço sobrando à direita parece um layout incompleto.
- Avalie a composição com zero, um e vários itens, títulos longos e metadados ausentes.

## Praças: lista de comunidades

Referência de abertura, busca e card: `src/features/squares/squares-screen.tsx`.

- Abertura com título Anton 54/68, descrição na mesma coluna e arte de 40% ao lado, alinhada ao
  topo. A busca vem em seguida, com rótulo persistente “Buscar Praças” e exemplo concreto.
- Ordene as praças em “Suas Praças” e “Acontecendo agora” com
  `SectionHeading appearance="editorial"`. Não acrescente agrupamento decorativo nem título de
  seção sem conteúdo.
- Card: papel, borda 1 `Colors.inkSoft`, cantos retos, padding 12, distância 8 entre cards. Marca
  da comuna em 44, coluna única de conteúdo (título 16/22 extrabold → origem, quando difere →
  atividade → assuntos) e chevron 18 em `Colors.muted`, centrado com o conteúdo.
- Presença em `caption`; o ponto vermelho de 6 acompanha apenas praça ativa com alguém.
  Assuntos aparecem como chips `strawLight`, `Radius.sm`, sans 13/17, sem contorno, no máximo dois.
- O caminho para descobrir comunas é `EditorialAction` com ícone, não um `PillButton` com seta
  dentro do rótulo.
- A listagem não tem ordenação no servidor: “Mais recentes” foi removido por não ter ação. Para
  reintroduzir, `listSquares` precisa receber `sort`; não recrie o controle como decoração.

## Limites conhecidos da Biblioteca e melhorias adiadas

O usuário decidiu manter a navegação atual por enquanto. **Não implemente os itens abaixo como
efeito colateral de aplicar este documento.** São pendências para uma tarefa futura:

- A faixa horizontal atual de coleções é paginada, mas renderiza todos os cards carregados.
  Ela não é a referência para navegar por centenas de coleções. A evolução discutida é uma amostra
  curta na entrada e “Ver todas” levando a uma lista vertical com busca própria e virtualização.
- Documentos usam páginas de 20 e `FlatList`; busca e filtros vão ao servidor. Isso é uma base
  adequada, não uma comprovação de desempenho com milhares de itens. Dados carregados continuam
  acumulados na memória e o desempenho do backend precisa ser medido separadamente.
- A revalidação atual pode substituir páginas acumuladas pela primeira ao retornar à tela.
  Preservar os resultados e a posição ao voltar de um documento ainda precisa de implementação.

## Como revisar e validar

Antes de considerar uma tela pronta, confira a hierarquia, a primeira área visível, a clareza das
ações, os alinhamentos e o comportamento com conteúdo real. Inspecione também largura pequena,
fonte ampliada, acentos, títulos longos e os estados de carregamento, vazio e erro.

- Não trate um teste automatizado como validação visual no aparelho. Declare o que não foi conferido.
- Para mudanças em descoberta/busca, confira acesso aos itens fora da amostra, preservação do termo
  e assunto, seleção de categoria, carregamento, erro/retry e paginação. Prints de sucesso não
  substituem esses cenários. Limpe temporizadores de cache nos testes para que o processo encerre.
- Evite mudanças globais para corrigir uma tela. Documente variantes explícitas e preserve os demais
  consumidores até que sua revisão seja solicitada.
- **Restrição do ambiente do usuário:** o WSL sofre com carga alta. Execute verificações pesadas
  uma por vez, com `NODE_OPTIONS=--max-old-space-size=512`; testes Jest focados usam `--runInBand`
  e sem watch. Esse limite é do heap do Node, não da memória total do processo.
- Em telas com gestos, confira no aparelho: pinça no mínimo e no máximo, arrasto parando na
  borda, toque duplo, e o assentamento ao soltar. Disputa entre gestos só aparece no aparelho.
- Não abra Expo, Chromium e suítes de teste simultaneamente. Não repita suítes amplas sem uma
  mudança ou falha que justifique. Para ajustes apenas de documentação, prefira revisão do diff.
