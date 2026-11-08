# POP-61: decisão de adoção opcional de Lottie

Data: 08/11/2026. Base: `1360c6f` (main após POP-67). Status: **não adotado
agora; adoção condicional a um caso de produto real e a uma PoC aprovada.**

Referência do ticket: auditoria de fluidez (inspeção estática) no commit
`12c0369`, Seção 8 / decisão de biblioteca. O texto da auditoria não está
versionado neste clone — o commit `12c0369` deste repositório é a correção do
gate de review —, então esta decisão parte do ticket, do código atual e das
fontes externas listadas no fim. Também foram inspecionados
`src/constants/motion.ts`, `assets/` e `package.json`.

## Contexto

- `lottie-react-native` não está em `package.json` nem no lockfile, e não há
  arquivo `.json` ou `.lottie` de animação em `assets/`.
- Reanimated 4.7.1 já é dependência e sustenta pressed, confirmações, expansão
  de respostas, transições de mídia e gestos. `react-native-svg` 15.16.0 também
  já está instalado para ilustração vetorial.
- Os tokens de `src/constants/motion.ts` definem a linguagem da casa: 140, 180 e
  320 ms, sem loop e ligada a uma mudança de estado. O próprio arquivo proíbe
  animação decorativa contínua.
- As ilustrações atuais de onboarding, criação, Biblioteca e Praças são PNGs
  estáticos (`assets/onboarding`, `assets/create`, `assets/library` e
  `assets/squares`). Elas cumprem o papel editorial sem timeline.
- A auditoria não recomenda Lottie para like nem para placeholders. O feedback
  dessas ações é local, curto e já resolvido por Reanimated; um arquivo Lottie
  ali adicionaria peso e um segundo modelo de animação sem ganho.
- Não existe hoje um caso de produto que exija animação ilustrativa
  temporizada. A linguagem editorial pede efeitos discretos, não uma camada de
  movimento decorativo.

## Decisão

1. **Não adicionar `lottie-react-native` agora.** `package.json`, lockfile e
   `assets/` permanecem como estão. Uma dependência não entra apenas para
   produzir um efeito decorativo.
2. **Reanimated continua sendo o padrão de movimento.** Transições de estado,
   feedback de toque, confirmações, expansão, mídia e gestos não devem migrar
   para Lottie. Um segundo runtime de animação só se justifica pelo caso que o
   primeiro não resolve.
3. **Lottie fica permitido apenas condicionalmente**, para uma animação
   ilustrativa pontual de onboarding ou de confirmação de publicação, e somente
   depois de uma PoC aprovada por peso/custo e de revisão UX/performance no
   cenário que motivar o uso.
4. **Não usar Lottie para like, reação, comentário, placeholders, skeletons,
   loading, confirmação de toque, ícones ou decoração de fundo.** Esses usos
   continuam com Reanimated, `Animated` ou ilustração estática.
5. **A adoção exige atualizar esta decisão com evidência.** O resultado da PoC
   — aprovado ou rejeitado — deve ser registrado aqui, com os números medidos e
   o nome do cenário. Trocar a dependência sem esse registro é regressão de
   arquitetura, não uma evolução.

## Critérios para um uso eventual

Todos os critérios abaixo são obrigatórios. Se um deles não puder ser atendido,
o caminho é ilustração estática, Reanimated ou SVG, não Lottie.

### Produto e narrativa

- Existe um caso real, com tela e momento de uso definidos, e uma hipótese de
  produto que justifique uma animação ilustrativa. "Fica mais bonito" não é
  hipótese.
- A animação é pontual: no máximo uma por fluxo, reproduzida uma vez, com
  `loop={false}` explícito (o padrão do `LottieView` é `loop = true`).
- A composição dura menos de 600 ms. O limite vale para o arquivo exportado, não
  só para a prop de velocidade.
- A animação não bloqueia o conteúdo, a navegação ou o primeiro frame útil. Se
  ela atrasa a tarefa principal, não entra.
- O conteúdo continua compreensível sem a animação. Ela reforça a narrativa; não
  é a única forma de transmitir informação, erro ou confirmação.

### Carregamento e fallback

- **Lazy-load:** o componente e o arquivo da animação são carregados apenas pela
  tela/ação que os usa. Não importar Lottie no layout raiz, na tab bar, no feed
  ou em cartões de lista.
- Se o Metro não separar o arquivo do bundle, a PoC deve comparar o custo de um
  asset remoto versionado com o de um `require` local. A escolha precisa estar
  registrada; "lazy" não pode ser apenas um nome no código.
- **Fallback estático:** antes do carregamento, em erro, offline ou timeout,
  mostrar o primeiro frame ou uma ilustração estática equivalente, no mesmo
  quadro e com o mesmo rótulo acessível. O layout não pode pular quando a
  animação assume.
- Usar `onAnimationFailure` para cair no fallback. Falha de leitura do arquivo
  não pode deixar um espaço vazio nem travar a tela.
- O asset remoto, se houver, precisa de versão, cache e tratamento de conteúdo
  inválido. JSON de animação é dado não confiável, não código.

### Movimento e acessibilidade

- Com Reduce Motion ativo, não montar/reproduzir a animação: mostrar o frame
  final ou a ilustração estática. O estado final precisa continuar visível.
- O caminho normal e o caminho reduzido usam o hook `useReducedMotion` já
  existente em `src/hooks/use-reduced-motion.ts`; não criar uma segunda leitura
  da preferência.
- A animação tem um rótulo acessível único e útil. Não criar foco por quadro,
  não esconder texto essencial dentro do desenho e não depender só de cor.
- Com fonte ampliada e leitor de tela, o conteúdo ao redor continua legível e
  alcançável. A animação nunca captura o foco.

### Implementação e operação

- Isolar o `LottieView` em um componente de feature com a política embutida
  (duração, `loop`, fallback e Reduce Motion). Não espalhar `LottieView` pelas
  telas.
- Controlar `autoPlay` e `play()` pela montagem/visibilidade; pausar e limpar no
  blur, no unmount e ao ir para background. Uma animação por vez.
- Não usar Lottie em listas virtualizadas, cartões do feed, placeholders ou
  qualquer superfície que repita por item.
- O asset precisa funcionar nas densidades reais e no tema claro; conferir
  recorte, contraste e tamanho mínimo em tela pequena.
- Adicionar teste do caminho estático/fallback e do caminho com movimento
  reduzido. Testar o componente Lottie nativo pode exigir mock; o mock não pode
  esconder o fallback que o app usa em produção.

## Comparação com o que já existe

| Critério | Reanimated 4.7.1 (instalado) | `react-native-svg` + Reanimated (instalado) | Lottie (não instalado) |
| --- | --- | --- | --- |
| Custo de dependência | Zero: já está no app | Zero: SVG já está no app | Nova dependência JS + bibliotecas nativas `lottie-ios`/`lottie-android`; impacto no binário precisa ser medido |
| Autoria | Código: transformações, opacidade, molas e sequências | Código: formas e caminhos vetoriais desenhados/animados | Exportação do After Effects; melhor para timeline vetorial complexa |
| Movimento complexo | Bom para estado, toque, gesto e transição; custoso para ilustração densa | Bom para ilustração simples; custo de engenharia cresce com a complexidade | Ponto forte: múltiplas camadas, máscaras e morphing dentro do suporte do formato |
| Integração com gesto/estado | Nativa: worklets, RNGH e valores compartilhados | Nativa para as props suportadas | Pode ser dirigida por Reanimated via `progress`, mas adiciona um segundo runtime |
| Reduce Motion | `ReduceMotion.System` já é o padrão dos helpers | Precisa gate explícito no componente | Não há prop de Reduce Motion documentada na API v7; o gate tem de ser explícito no app |
| Fallback | O estado final já é o fallback natural | A forma estática é o fallback natural | Exige frame estático + `onAnimationFailure`; sem isso, falha vira vazio |
| Peso e carregamento | Já no bundle; sem asset adicional | Já no bundle; SVGs pequenos ou componentes | Módulo nativo, parser e arquivo de animação; o custo real só existe em build de release medido |
| Testes/CI | Já coberto pelo setup atual | Já coberto pelo setup atual | Exige mock do módulo nativo e teste do fallback; mais superfície de CI |
| Web | Já suportado | Já suportado | Exige player web adicional (`@lottiefiles/dotlottie-react` na v7) |
| Quando escolher | Padrão para estado, toque, gesto e confirmação | Ilustração vetorial simples que a equipe consegue manter em código | Somente quando uma ilustração exportada do design não for viável em SVG/Reanimated e a PoC pagar o custo |

O `lottie-react-native` compatível com o Expo SDK 58 é `~7.5.0` segundo o
`bundledNativeModules.json` do próprio Expo. Ele não aparece na lista de
bibliotecas de terceiros suportadas no Expo Go do SDK 58; até validação em
contrário, a adoção deve ser testada em development build, não presumida no Expo
Go.

## PoC: quando e como avaliar

A PoC só começa quando existir um caso de produto real. Ela é um spike em branch
separada, não uma dependência antecipada.

### Gatilho

- Uma tela de onboarding ou de confirmação de publicação precisa de uma
  ilustração temporizada que não seja bem atendida por SVG/Reanimated.
- UX e produto definem o momento, a duração desejada, o frame estático e o que a
  pessoa perde se a animação não rodar.
- A pergunta da PoC é objetiva: "esta animação entrega valor suficiente para
  pagar o peso, o custo nativo e a manutenção?".

### Roteiro

1. Registrar a linha de base do mesmo cenário sem Lottie: build, bundle, tempo
   até o conteúdo, memória e frame timing no aparelho escolhido.
2. Em branch de spike, instalar com `npx expo install lottie-react-native` e
   confirmar a versão resolvida e a necessidade de development build. Não
   commitar a dependência na `main` antes da decisão.
3. Implementar a animação atrás do componente isolado, com `loop={false}`,
   duração <600 ms, carregamento sob demanda, fallback estático e gate de Reduce
   Motion.
4. Comparar com a melhor alternativa já instalada (Reanimated ou SVG) fazendo a
   mesma narrativa, no mesmo quadro e com o mesmo fallback.
5. Medir e registrar os deltas. Se não houver medição, a PoC não está concluída.

### Matriz mínima de medição

| Dimensão | Como comparar | O que registrar |
| --- | --- | --- |
| Tamanho do app | Build de release Android (APK/AAB) e iOS (archive/TestFlight) com o mesmo perfil e commit | Delta absoluto e relativo do binário; separar código nativo de assets |
| Bundle/JS e assets | Análise de bundle do Expo e peso do arquivo de animação | Delta do bundle, peso do JSON/`.lottie`, se entrou no bundle inicial ou foi carregado sob demanda |
| Primeiro conteúdo útil | Mesmo aparelho, mesma rede e mesmo estado de cache, com e sem a animação | Tempo até o conteúdo e até o primeiro frame da animação; mediana de execuções |
| Memória | Instruments (iOS) e Android Studio Memory Profiler no mesmo fluxo | Pico adicional e memória retida depois de sair da tela |
| Frame timing | Perfil de release no aparelho; usar o coletor de `docs/pop-72-performance-metrics-automation.md` quando aplicável | Frames perdidos/jank no aparelho de referência e em um Android modesto; não declarar FPS sem medição |
| Falha e rede | Asset ausente, JSON inválido, offline, timeout e retorno à tela | Fallback visível, layout estável, nenhum espaço vazio, nenhum crash |
| Acessibilidade | VoiceOver/TalkBack, fonte ampliada, Reduce Motion ligado e desligado | Rótulo, foco, estado final e ausência de movimento no modo reduzido |
| Custo de manutenção | Design, exportação, atualização do asset, mock de teste, CI e web | Horas estimadas e risco; não só o tamanho em bytes |

O critério de aprovação é uma decisão registrada com os deltas acima e revisão
UX/performance no cenário real. Não há orçamento numérico inventado nesta
decisão: se o time definir um teto, ele deve ser registrado antes da medição.

### Saídas possíveis

- **Rejeitada:** remover a dependência e os assets do spike, manter a solução
  estática/Reanimated/SVG e registrar aqui o motivo e os números.
- **Aprovada:** atualizar esta decisão com a evidência, adicionar a dependência
  via `npx expo install`, manter o componente isolado com fallback e testes e
  abrir a revisão UX/performance do cenário.
- **Adiada:** não é uma terceira decisão. Significa que o caso real ainda não
  existe; a dependência continua fora do app.

## Consequências

- O app continua com um único modelo de movimento para estado e feedback,
  coberto por `src/constants/motion.ts`, Reanimated e o hook de Reduce Motion.
- O bundle e o build nativo não crescem por uma animação que ainda não tem caso
  de uso. A contrapartida aceita é não ter, hoje, uma timeline exportada do
  After Effects.
- Se o produto trouxer o caso, o caminho é uma PoC com medição e revisão, não um
  PR que apenas instala a biblioteca e adiciona um arquivo.
- O guard `scripts/__tests__/animation-dependencies.test.js` impede que
  `lottie-react-native` entre sem que esta decisão e o próprio guard sejam
  atualizados no mesmo PR.

## Validação desta decisão

- Inspeção estática de `package.json`, lockfile, `assets/`, `src/constants/motion.ts`
  e dos pontos que já usam Reanimated/`useReducedMotion`.
- Nenhuma dependência foi adicionada e nenhum asset de animação foi criado.
- `npm run check:fast` passou com `NODE_OPTIONS=--max-old-space-size=1024`;
  com 512 o ESLint passa e o `tsc` estoura o heap do host, sem erro de tipo. O
  teste focado do guard (1 suíte / 1 teste) e `motion.test.ts` (1 suíte / 2
  testes) passaram com `--runInBand`.
- Não houve build de release, medição de tamanho, FPS, memória ou teste em
  aparelho. Esta entrega não declara nenhum desses números.
- E2E não se aplica: não há rota, tela, formulário, autenticação ou onboarding
  alterado.

## Critérios de aceite

- [x] Não adicionar dependência apenas por efeito decorativo; `package.json` e
      lockfile permanecem sem Lottie.
- [x] Registrar a decisão e a comparação com Reanimated (e com a alternativa SVG
      já instalada).
- [x] Definir critérios de uso eventual: animação ilustrativa pontual,
      onboarding/publicação, menos de 600 ms, sem loop, lazy-load, fallback
      estático e Reduce Motion.
- [x] Definir como uma PoC futura será avaliada por peso/custo, com matriz de
      medição e revisão UX/performance.
- [ ] Executar a PoC e validar em aparelho — não aplicável enquanto não houver
      caso de produto real; não declarado como feito.

## Referências externas

- Expo SDK 58, `bundledNativeModules.json`: `lottie-react-native` `~7.5.0`.
- Expo SDK 58, bibliotecas de terceiros suportadas no Expo Go:
  https://docs.expo.dev/versions/v58.0.0/sdk/third-party-overview/
- `lottie-react-native` v7.5.0, API do componente:
  https://github.com/lottie-react-native/lottie-react-native/blob/v7.5.0/docs/api.md
- `lottie-react-native` v7.5.0, README (instalação, web e `.lottie`):
  https://github.com/lottie-react-native/lottie-react-native/blob/v7.5.0/README.md
