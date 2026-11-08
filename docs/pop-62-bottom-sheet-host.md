# POP-62 — host único para bottom sheets

Data: 08/11/2026. Branch: `ai/pop-62`. Escopo: decisão de arquitetura da
apresentação das folhas; nenhuma mudança de rota, API, contrato de tela ou
dependência. Referência de partida: auditoria de fluidez no commit `12c0369`,
Seção 4.5. O documento original da auditoria não está neste clone; a hipótese
usada aqui é a do ticket: cada abertura cria um `Modal` nativo e um
`GestureHandlerRootView`, e isso pode custar na abertura.

## Decisão

**Manter o wrapper atual, com um `Modal` nativo por folha.** Não haverá host
global nesta entrega.

A medição no host mostra que o trabalho síncrono de montagem da apresentação
custa cerca de **0,9 ms por reabertura** no renderer de teste (cerca de 5% do
orçamento de um frame de 60 Hz, mas isso não é frame time) e que a primeira
abertura da instância monta a apresentação inteira nas duas arquiteturas. O
custo que a hipótese realmente discute, a criação da janela nativa do `Modal`
no Android/iOS, **não foi medido** neste ambiente. Sem essa evidência, trocar
o wrapper por um host único seria uma mudança estrutural que afeta os 26
pontos de montagem (16 arquivos), com risco real de regressão em back,
acessibilidade, teclado e empilhamento.

O wrapper atual (`src/components/bottom-sheet.tsx`) já resolve esses contratos no
código e nos testes focados, e não tem regressão medida na suíte. O comportamento
nativo (teclado, leitor de tela, back real) continua pendente de aparelho. A
decisão pode ser reaberta pelo protocolo abaixo se o trace nativo mostrar que a
janela do `Modal` domina a abertura.

## O que foi medido

Benchmark reproduzível no host (Node/Jest), não no aparelho:

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest \
  --runTestsByPath benchmarks/pop-62-bottom-sheet-host.bench.ts \
  --testMatch '**/*.bench.ts' --runInBand --silent=false
```

O benchmark monta a mesma folha curta (14 opções, alvo de 48) em duas
apresentações:

- **atual**: `BottomSheet` real, que monta `Modal` +
  `GestureHandlerRootView` + Gorhom a cada abertura;
- **host único (modelo)**: depois da primeira abertura, `Modal`,
  `GestureHandlerRootView` e Gorhom permanecem montados; fechar desmonta só o
  conteúdo e reabrir remonta só o conteúdo.

Cada rodada mede o trabalho síncrono de render/montagem até o conteúdo reportar
layout. A reabertura é a mediana de 6 aberturas na mesma instância; cada valor é
a mediana de 8 rodadas. Execução local em 08/11/2026, Jest 30.5.2, Node
v24.22.1, Linux/WSL:

| Medida | Rodada 1 | Rodada 2 | Rodada 3 |
| --- | ---: | ---: | ---: |
| Primeira abertura da instância, Modal por folha | 2,27 ms | 2,22 ms | 2,16 ms |
| Primeira abertura da instância, host único (modelo) | 1,63 ms | 1,63 ms | 1,64 ms |
| Reabertura, Modal por folha | 1,60 ms | 1,84 ms | 1,87 ms |
| Reabertura, host único (modelo) | 0,83 ms | 0,92 ms | 1,00 ms |
| Diferença de reabertura | 0,77 ms | 0,91 ms | 0,87 ms |

O teste determinístico do mesmo arquivo confirma a diferença estrutural: ao
final do fechamento, o wrapper atual remove o `Modal` da árvore; o modelo de host
mantém um único `Modal` montado. É essa remontagem por abertura que o host evita.

### Limites desta medição

- É CPU do renderer de teste (React em Node). **Não é** FPS, frame time,
  latência de abertura, memória nem criação de janela nativa.
- "Primeira abertura" aqui é a primeira abertura da instância com módulos já
  aquecidos. Não é processo frio, abertura do app ou primeiro toque no
  aparelho.
- O modelo de host é deliberadamente simplificado: não recria `safe area`,
  redução de movimento, backdrop, ações acessíveis, fallback de fechamento,
  fila de empilhamento nem teclado. Por isso a linha de primeira abertura do
  host é apenas referência, não um ganho prometido. Num host real esses
  contratos também custariam montagem/atualização.
- O `Modal` do Jest é um mock de componente; a janela nativa do Android/iOS
  não existe nesse ambiente.

## O que não foi medido

Não houve execução em aparelho Android ou iOS nesta sessão. O ambiente não tem
`adb`, emulador, Xcode ou dispositivo conectado. Portanto:

- não há vídeo de 60 fps, trace Perfetto/Instruments, contagem de frames
  perdidos, jank ou memória;
- não há tempo de criação da janela nativa do `Modal`;
- não há latência de toque → primeiro quadro da folha;
- não foram validados teclado nativo, TalkBack/VoiceOver, fonte ampliada,
  movimento reduzido, rotação, gesto de voltar do Android nem empilhamento em
  aparelho.

Nenhum desses valores deve ser inferido dos milissegundos acima. O benchmark
justifica a decisão de **não** pagar a refatoração sem evidência nativa; ele não
declara que a abertura no aparelho é fluida.

## Por que não trocar agora

### Contratos que o `Modal` nativo já entrega

| Contrato | Como o wrapper atual garante |
| --- | --- |
| Voltar do Android | `Modal.onRequestClose` chama o fechamento; teste focado cobre folha dismissível e não dismissível |
| Gestos dentro da folha | `GestureHandlerRootView` próprio dentro da janela do `Modal`; no Android, gestos em outra janela precisam desse root |
| Foco acessível | `accessibilityViewIsModal` no root e alça com ações `escape`/`decrement`; testes verificam o foco e o fechamento por ação |
| Teclado | `keyboardBehavior="interactive"`, `keyboardBlurBehavior="restore"`, blur por gesto e `adjustResize` no Android, dentro da janela do modal |
| Empilhamento | cada folha é uma janela nativa; o sistema fecha a do topo no back e a animação de saída mantém o `Modal` montado até terminar |
| Contexto dos filhos | o conteúdo continua na posição original da árvore; não é movido para um portal no topo, preservando providers de tela, sessão, navegação e moderação |

### O que um host único exigiria

1. Um `Modal` raiz permanente, escondido e sem interceptar toque/back quando
   nenhuma folha está aberta.
2. Uma fila LIFO com foco, `accessibilityViewIsModal`, `onRequestClose` e
   animação de saída por folha — o `Modal` nativo faz isso sem código nosso.
3. Reimplementar o comportamento de teclado para a janela única, incluindo
   `adjustResize`, blur e restauração.
4. Um portal que preserve o contexto React dos filhos; mover o conteúdo para o
   topo da árvore pode perder providers locais da tela.
5. Conviver com o `ActionsSheetProvider`, que já é uma folha global, e com
   qualquer folha aberta dentro de outra tela.

A biblioteca oferece `BottomSheetModal` + `BottomSheetModalProvider`, que usam
`@gorhom/portal` e uma fila de empilhamento. É a alternativa mais próxima de um
host pronto, mas ela **não** usa `Modal` nativo: não há `onRequestClose` nem
`accessibilityViewIsModal` no host do portal, então back e isolamento acessível
teriam de ser reimplementados. Também muda a semântica de teclado e de janela.
Trocar todos os consumidores por ela seria uma migração maior do que o ganho
medido justifica.

### Custo x benefício

- A primeira abertura paga a árvore inteira em qualquer arquitetura; o host só
  economiza da segunda abertura em diante.
- A economia JS medida é ~0,9 ms por reabertura. O host real acrescentaria o
  custo da fila, do foco e da ocultação, reduzindo essa margem.
- O possível ganho relevante — não criar uma janela nativa por reabertura — é
  exatamente o que falta medir.
- Folhas são aberturas ocasionais e iniciadas por toque; não estão no caminho
  de rolagem contínua. Não há bug de fluidez comprovado no ticket.

## Protocolo para fechar a validação no aparelho

Executar no mesmo aparelho, build, conta/dataset e rede, com 5 repetições por
cenário. Registrar valores brutos, mediana e p95; não descartar execução ruim
sem anotar o motivo. Guardar vídeo, trace e commit junto da tabela.

Definições:

- **frio**: processo encerrado (`adb shell am force-stop`) e primeira abertura
  da folha depois de o app assentar na tela inicial;
- **quente**: fechar a folha e reabrir na mesma sessão, sem matar o processo;
- **latência de abertura**: toque no gatilho → primeiro quadro com a folha
  visível; separar desse número a animação até a altura final.

### Android

1. Build de diagnóstico/staging com o mesmo commit e, se for medir o snapshot
   JS, `EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1`.
2. Antes de cada repetição, limpar frame stats e iniciar o trace:

   ```bash
   adb shell dumpsys gfxinfo com.popularia.mobile reset
   adb shell perfetto -o /data/misc/perfetto-traces/pop62.perfetto-trace -t 15s \
     -a com.popularia.mobile sched gfx view input binder_driver
   ```

   O caminho e as categorias exatas variam por versão do Android; usar a UI do
   Perfetto/Android Studio se o comando não estiver disponível.
3. Abrir a folha pelo gatilho real (**Criar** na barra de abas, **⋯** de uma
   publicação, assunto da Biblioteca etc.), fechar pelo backdrop, pela alça e
   pelo back; reabrir.
4. Coletar frame stats e o trace:

   ```bash
   adb shell dumpsys gfxinfo com.popularia.mobile framestats
   adb pull /data/misc/perfetto-traces/pop62.perfetto-trace .
   adb shell screenrecord --bugreport --time-limit 15 /sdcard/pop62.mp4
   adb pull /sdcard/pop62.mp4 .
   ```

5. No Perfetto, correlacionar o toque com `Choreographer#doFrame`, a criação da
   janela do `ReactModalHostView` e o primeiro frame da folha. No vídeo,
   confirmar que não há abertura parcial seguida de salto.
6. Repetir com teclado aberto (campo de busca/motivo), fonte ampliada,
   TalkBack e movimento reduzido. Testar uma folha sobre outra, se o fluxo
   existir, e o back em cada uma.

### iOS

1. Build de development/staging no iPhone com o mesmo commit.
2. Instruments: Time Profiler + Core Animation; gravar toque → folha visível e
   a animação completa. Usar signposts ou o timeline de frames para separar a
   apresentação do `UIViewController` do `Modal` da animação do Gorhom.
3. Gravar a tela em 60 fps com ReplayKit ou gravação do sistema; repetir frio e
   quente, com VoiceOver, fonte ampliada, teclado e movimento reduzido.
4. Guardar trace, vídeo, modelo do aparelho, versão do SO, build e cache.

### Critério para reabrir a decisão

Reabrir somente se, em 5 repetições no mesmo aparelho/build, o trace mostrar que
a criação da janela do `Modal` é o bloqueio dominante da abertura e que um
protótipo de host reduz a latência de forma consistente (mediana e p95) sem
regressão de back, foco, teclado ou empilhamento. Um ganho de ~1 ms de JS, como
o medido aqui, não é motivo para a refatoração.

## Validação executada nesta sessão

- Benchmark POP-62: 2 testes passando, com as três execuções registradas acima.
- `src/components/__tests__/bottom-sheet.test.tsx`: 16 testes passando, incluindo
  o novo caso de fechamento pelo back do Android em folha dismissível.
- `npm run check:fast`: ESLint e TypeScript passaram.
- Suíte Jest completa: **175 suítes / 1062 testes passaram** (`--runInBand`).
- Nenhuma lógica de produção foi alterada; o wrapper ganhou apenas um comentário
  apontando para esta decisão.
