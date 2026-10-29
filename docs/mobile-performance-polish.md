# Listas, cache e bottom sheets — auditoria e implementação

Data: 29/10/2026. Escopo: mobile, sem alteração de endpoints ou regras de negócio.

## Auditoria antes das mudanças

| Fluxo / arquivos | Implementação encontrada | Decisão nesta entrega |
| --- | --- | --- |
| Feed — `src/app/(tabs)/(inicio)/index.tsx` | FlatList, cursor e deduplicação via `usePaginatedData`; cache apenas enquanto o hook fica montado; spinner inicial; refresh de publicação substituía todas as páginas pela primeira | FlashList, skeleton inicial, cache de páginas, tipos de célula e viewability de vídeo |
| Perfil — `features/profiles/profile-screen.tsx`, `api.ts` | ScrollView + map; `getUserPosts` esgotava todos os cursores antes de retornar; `/me` repetido no perfil e loader de posts; três recargas ao retornar | Publicações e linhas de mídia virtualizadas; uma página por solicitação; handle já conhecido; perfil próprio usa conta restaurada como initialData, com revalidação real |
| Mídia de perfil — `components/profile-media-grid.tsx` | Grade montava todos os tiles e criava um player para cada vídeo, mesmo como miniatura | Uma linha de três tiles por célula; nenhuma instância de player na grade |
| Discussão — `discussion-screen.tsx` | FlatList de comentários, árvore local, carregamento paralelo de publicação/comentários; recarga em foco | Reuso de cartão como placeholder e prefetch de detalhe ao toque; comentários mantidos no hook atual por causa de respostas locais, colapso e ordenação |
| Avisos — `notifications-screen.tsx` | FlatList paginada; leitura valida acesso antes de navegar; estado isolado pelo provider de sessão | Lista compartilhada; mantém leitura, filtros, retry e atualização de contador |
| Explorar / busca — `explore-screen.tsx` | Home tem conjuntos limitados; busca acumula páginas em ScrollView, debounce de 350 ms e refetch em foco | Home mantida; busca agrupada merece migração própria para células por seção e cancelamento. Não substituir por uma única célula gigante |
| Comunas — `comuna-screen.tsx`, `components/members-list.tsx` | ScrollView com abas fixas; posts e membros renderizados com map; permissões e participação podem retirar acesso | Mantido; migrar juntamente com paginação de membros, moderação e acesso privado |
| Gestão / moderação — `manage-comuna-screen.tsx`, `moderation-screen.tsx`, `report-queue.tsx` | Filas, membros e solicitações com map, formulários com ScrollView | Sheets recebem a infraestrutura nova; filas ficam para migração específica |
| Praças — `squares-screen.tsx`, `square-screen.tsx` | FlatLists; mensagens têm paginação invertida, polling, reconciliação otimista, swipe de resposta e preservação de posição | Preservado o mecanismo de mensagens; sheets usam Gorhom, input de motivo integrado ao teclado |
| Biblioteca — `library-screen.tsx` | Documentos em FlatList; coleções no header com map; revalidação em foco/AppState; mesma lista usada dentro do sheet do compositor | Lista no sheet usa BottomSheetFlatList; buscas usam BottomSheetTextInput; impede retry automático contínuo após falha da próxima página |
| Conta / onboarding / formulários legais | ScrollViews de formulário ou conteúdo estático; seletores em sheet | Não há benefício em converter formulários em listas recicláveis; TextField integra teclado automaticamente dentro do sheet |
| Pequenas coleções | Chips, abas, opções fixas de denúncia, regras, eventos horizontais e opções de símbolos | Mantidas; sem troca de biblioteca por simples uniformidade |
| Outros modais | Picker de reação de Praça ancorado à mensagem; não é uma folha vertical | Mantido |

O cliente HTTP já oferecia timeout, AbortSignal e renovação de sessão compartilhada. Os hooks antigos ignoravam respostas obsoletas, mas não cancelavam transporte e não ofereciam cache entre montagens. Nenhum TanStack Query estava instalado. `expo-image`, `expo-video`, Reanimated e Gesture Handler já estavam instalados.

## Infraestrutura

- `components/list/popularia-list.tsx`: FlashList 2, mantendo sua API (ref, header/footer, separadores, tipos de célula, viewability, sticky headers, onLoad, comportamento de scroll). `state` é opcional e independe da biblioteca de fetching. Estados compartilhados de empty/error/retry e skeleton estático em arquivo próprio.
- `hooks/use-cached-pages.ts`: adaptador pequeno para TanStack Query; cursor, deduplicação por ID, proteção de concorrência, refresh manual separado de fetching de background. Revalida páginas carregadas sem substituí-las pela primeira. A lista permanece montada durante fetching.
- `lib/query/client.ts`: cache em memória, limpo no início/fim da sessão e no reset de conta. Recusas 401/403/404/410 apagam os dados da query, mantendo erro/retry. Não conserva conteúdo revogado para reaparecer no próximo refetch. Sem persistência em disco de dados de conta.
- Feed: fresco por 30 s, retido sem observadores por 10 min. Perfil: 60 s / 10 min. Detalhe de publicação: 15 s / 5 min. São políticas explícitas por domínio: retornos breves devem ser instantâneos; publicação e permissões têm janela menor. Pode-se configurar tempos diferentes no hook.
- AppState revalida somente queries ativas e stale ao retomar o app, sem cancelar requests já em andamento. Publicação invalida feed e perfil, inclusive queries sem tela montada.
- `features/posts/queries.ts`: `onPressIn` antecipa **uma** query de detalhe; o toque final usa a mesma chave e deduplica a request. O cartão é placeholder, não uma resposta definitiva de permissões. Comentários continuam carregando em paralelo ao detalhe. Não há prefetch de mídia nem download antecipado de várias páginas.

A navegação continua com Expo Router e suas pilhas por aba. Feed e perfil não recebem uma `key` dependente do fetching nem são desmontados para mostrar loader durante refresh. FlashList mantém conteúdo visível; o fluxo feed → publicação → voltar conserva a instância da lista.

## Bottom sheets

`components/bottom-sheet.tsx` mantém `visible/onClose/title/scrollable`, adicionando `virtualized` e `dismissible`. Também exporta `PopulariaBottomSheet`, `PopulariaBottomSheetScrollView`, `PopulariaBottomSheetFlatList` e `PopulariaBottomSheetTextInput`.

Gorhom 5 delega snapping, velocidade, animação, gesto do handle/conteúdo e integração de scroll. A apresentação usa Modal nativo com GestureHandlerRootView próprio no Android: preserva os contextos de conta, navegação e moderação dos filhos e o isolamento acessível do modal. Não exige um portal que mova os filhos para fora desses providers. O Modal permanece montado até a animação terminar.

A área do handle tem pelo menos 48 px e inclui o título inteiro; o indicador visual continua com 40 × 4 px. Papel, tinta, tipografia, padding lateral e bordas existentes são preservados. Ações acessíveis permitem fechar sem gesto; o botão voltar nativo também fecha. Formulários com envio protegido usam `dismissible={false}`. Teclado usa comportamento `interactive`, retorno `restore`, blur por gesto e `adjustResize` no Android. TextField escolhe o input integrado dentro do contexto da folha; inputs diretos de denúncia e biblioteca foram adaptados.

Tamanho dinâmico é limitado a 86% da janela; seletores/listas usam snap de 86% e os scrollables oficiais, sem nesting em ScrollView. Expo UI foi considerado, mas demandaria integração e aparência distintas por plataforma para os mesmos formulários/listas. Gorhom reutiliza as dependências de gesto/animação já presentes. Não foram adicionados haptics nem animações decorativas.

## Mídia e reciclagem

Imagens de anexos e grade usam expo-image, cache memory-disk, `recyclingKey`, contentFit e transição curta. Dimensões do contrato reservam a área antes do download; erro de imagem conserva essa área. Estado de imagem é reiniciado ao mudar URI. A grade começa com uma largura útil, evitando tiles de 1 px até o primeiro layout.

Vídeo só monta player após toque. Em feed/perfil, viewability remove o player fora da viewport; sair da rota pausa a reprodução. Uma nova mídia reciclada não herda a intenção da anterior. Sem autoplay. O contrato atual só oferece URL original e dimensões, não thumbnail de vídeo ou variante de imagem: a grade usa a marca de play/duração existente sobre fundo editorial. Não se baixa um vídeo inteiro para obter sua capa. Thumbnails de servidor ficam como evolução explícita, sem inventar parâmetros de resize na URL.

## Evidência e limites

Baseline executado antes das mudanças: lint e TypeScript passaram; Jest teve 201 testes passando e 1 falha anterior, que procurava `Fechar` no formulário de comuna onde o botão já se chamava `Voltar`. A expectativa foi corrigida para o rótulo existente, sem mudar a tela.

Os testes adicionados verificam resultados concretos:

- Retornar/remontar uma query fresca: **0 requests adicionais**, conteúdo disponível na primeira renderização; antes o hook sempre carregava novamente.
- Perfil: **1 request de página**, mesmo quando a resposta contém próximo cursor; antes o loader buscava N páginas antes de disponibilizar qualquer publicação. Posts não fazem `/me`; perfil e primeira página podem carregar em paralelo.
- Dois `onEndReached` concorrentes: **1 request de próxima página**, sem IDs repetidos.
- Refresh em background preserva todas as páginas e não liga o indicador de pull-to-refresh.
- Troca de consulta aborta o sinal anterior; falha de rede mantém conteúdo; recusa de acesso limpa cache.
- Vídeo sem toque: **0 inicializações de player**; saída da viewport desmonta o player, e outro vídeo não herda a intenção.

Isso mede comportamento de requests/montagem em testes, não FPS ou memória reais. Os testes de listas mantêm FlashList real com medidas de layout simuladas; os testes de sheet usam mock do componente nativo e não comprovam física ou teclado.

### Checks finais executados

- `npm run typecheck`: passou.
- `npm run lint`: passou, sem avisos.
- `npm test -- --runInBand --silent`: **33 suítes / 214 testes passaram**.
- `npx expo export --platform all --output-dir /tmp/popularia-polish-export --max-workers 2`: passou; bundles Hermes de Android/iOS e bundle web produzidos. Expo Router emitiu avisos de resolução de exports com fallback, sem impedir o build.
- `git diff --check`: passou.

Os arquivos previamente alterados no workspace foram preservados; as mudanças desta entrega estão sobrepostas a esse estado, sem commit ou publicação.

### Roteiro de validação em release

Executar no mesmo Android intermediário e iPhone, mesma conta/dataset e rede, antes/depois, com ao menos cinco repetições:

1. Dataset com 200+ publicações, textos de comprimentos distintos, imagens/vídeos e perfil com mais de uma página. Abrir frio, abrir cached, paginar, atualizar e voltar de discussão.
2. Contar requests por rota/cursor (sem registrar tokens ou conteúdo privado); medir tempo até conteúdo utilizável e `FlashList.onLoad`. Usar React Profiler em build apropriado para contar commits das células.
3. Capturar frames lentos, JS/UI frame time e pico de memória com Android Studio Profiler / Perfetto e Instruments. Development mode serve apenas para diagnóstico; não é evidência de ganho em release.
4. Arrastar pelo título/handle, gesto lento/rápido, backdrop, voltar Android, conteúdo longo e scroll no topo. Repetir em folhas aninhadas: biblioteca → coleção / assunto.
5. Teclado em textarea, multiline, seletor e busca de biblioteca: abrir/fechar, girar aparelho, fonte ampliada, VoiceOver/TalkBack e reduzir movimento.
6. Revogar acesso, simular rede lenta/offline, trocar conta durante request, repetir toque de paginação e publicar voltando a um perfil previamente cached.

FPS, memória e gestos em release nativo não foram medidos neste ambiente. Exportar bundles de produção valida integração/empacotamento, mas não substitui esse roteiro.

## Próximo polish

Migrar busca agrupada, posts/membros de comuna, coleções grandes e filas de gestão; medir antes de fragmentar o contexto global de interações (hoje uma ação pode atualizar todos os cartões consumidores). Paginação de mídia percorre páginas de publicações pelo botão de continuidade, sem varrer automaticamente um histórico de texto para encontrar imagens. O contador do perfil mostra `N+` enquanto ainda há páginas, pois o contrato não retorna o total de publicações. Lista de episódios demonstrativos e comunas do perfil ainda usam pequenos blocos no conteúdo; não há promessa de virtualização desses subfluxos nesta entrega.
