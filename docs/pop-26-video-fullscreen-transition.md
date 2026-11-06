# POP-26 — frame preto na transição para o visualizador de vídeo

Data: 07/11/2026. Escopo: `PostAttachment` → `VideoViewer` → volta ao feed em
iOS/Android. Sem mudança de rota, API, design ou dependência. Base: POP-5
(baseline/instrumentação) e POP-22 (pôster de vídeo).

## Problema e hipótese

O visualizador de tela cheia usa um segundo `VideoView` sobre o mesmo
`VideoPlayer`. Ao abrir, o `VideoView` do feed é desmontado (`expanded ? null`)
e outro `VideoView` é montado dentro do `Modal`; ao voltar, o caminho inverso
acontece. A hipótese do ticket é que a recriação da surface nativa deixe um
frame preto perceptível entre a saída de uma surface e o primeiro quadro da
outra. O player, o áudio, a posição, o mudo e a velocidade **não** são
recriados — o mesmo objeto é reutilizado.

A auditoria estática não é medição de performance e **não confirmou** o frame
preto. Nenhum iPhone ou Android real foi usado nesta entrega. O que foi
confirmado no código é a troca de surface; o que não foi confirmado é o efeito
visual e sua duração.

## Auditoria de lifecycle

| Etapa | O que acontece no código | Consequência |
| --- | --- | --- |
| Player | `LoadedPostVideo` chama `useVideoPlayer` uma vez; `VideoViewer` recebe esse mesmo `player` por prop | Não há segundo player nem segunda saída de áudio; `activePlayer` continua pausando qualquer outro player |
| Abrir | `openFullscreen()` registra a transição e faz `setExpanded(true)`; o `VideoView` do feed sai da árvore e o `Modal` monta outro `VideoView` com o mesmo player | A surface nativa é recriada; posição, mudo e `playbackRate` permanecem no player |
| Durante | `VideoViewer` usa `VideoView` próprio, `nativeControls={false}`, chrome e gestos da casa | Controles, áudio, 2× e ações do post continuam nos mesmos handlers |
| Voltar | `closeFullscreen()` faz `setExpanded(false)`; o `Modal` fecha e o `VideoView` do feed é remontado | A surface do feed é recriada e precisa receber o quadro atual outra vez |
| Fundo nativo | `expo-video` 58.0.13: Android troca o alvo com `PlayerView.switchTargetView` e emite `onRenderedFirstFrame` por target; iOS cria outro `AVPlayerViewController` e observa `isReadyForDisplay` | É plausível que a nova surface fique sem quadro por um ou poucos frames; a duração depende do aparelho/build e não foi medida |

No Android, `VideoView` só mantém a surface escondida até o primeiro quadro do
**item de mídia**; ao anexar o mesmo player já reproduzido a outro `VideoView`,
`shouldHideSurfaceView` já é `false`. No iOS, o primeiro quadro da nova surface
chega por `isReadyForDisplay`. Em ambas as plataformas, o `Modal` com
`animationType="fade"` e fundo `Colors.ink` pode tornar a lacuna visível.

## Mudança aplicada

Não houve troca de arquitetura nem terceiro player. A transição ganhou uma
cobertura curta com o pôster já conhecido:

- **Tela cheia:** `FullscreenSurface` cobre o novo `VideoView` com o pôster até
  `onFirstFrameRender`; uma chave que muda só na abertura reinicia a cobertura
  sem remontar a surface durante o fade de fechamento.
- **Volta ao feed:** ao fechar, o pôster cobre o `VideoView` remontado até o
  primeiro quadro do feed. A cobertura some no evento ou, no máximo, em
  `VIDEO_SURFACE_COVER_TIMEOUT_MS` (500 ms), para uma plataforma que não emita o
  evento não deixar o pôster preso.
- **Contratos preservados:** o mesmo player, o mesmo `toggle`, `muted`,
  `speed`, `currentTime`, `activePlayer` e as ações de `chrome`. A cobertura é
  `pointerEvents="none"` e não intercepta toque, gesto ou controle.
- **Sem pôster:** se a geração do primeiro quadro falhou, não há cobertura; o
  comportamento anterior permanece.

A mudança é uma guarda para a lacuna de surface, não uma alegação de que o
frame preto foi reproduzido. Se a gravação em aparelho mostrar o frame mesmo
com a cobertura, o evento e o frame devem ser anexados ao ticket antes de
qualquer mudança maior.

## Instrumentação da transição

O snapshot local (`src/lib/performance`) ganhou três eventos de vídeo:

| Evento | Campos | Uso |
| --- | --- | --- |
| `fullscreen-enter` | `mediaId`, `atMs` | Marca a abertura |
| `fullscreen-exit` | `mediaId`, `atMs` | Marca o fechamento |
| `surface-first-frame` | `mediaId`, `surface` (`fullscreen`/`feed`), `valueMs`, `atMs` | Espera até o primeiro quadro da surface de destino |

A tela `/diagnostico-performance` mostra **Transição de vídeo**: aberturas,
voltas, média/máximo do primeiro quadro ao abrir e ao voltar. O JSON exportado
inclui os eventos brutos, que podem ser alinhados à gravação pelo `atMs`.
Nada é enviado à rede e a coleta continua fechada em produção.

Os números medem o evento nativo de primeiro quadro, não pixels. **Frame preto
só é detectado por gravação de tela em 60/120 fps**; o snapshot serve para
correlacionar o momento e confirmar se houve segunda montagem de player.

## Protocolo de validação em aparelho

### Build e dataset

1. Uma build de staging/development com
   `EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1` para os tempos.
2. Uma build de release/staging sem instrumentação para a gravação visual (a
   coleta não existe em produção).
3. Conta de QA com pelo menos 3 vídeos: um na primeira dobra, um com duração
   maior que 30 s e um curto. Registrar modelo, SO, taxa de atualização da tela,
   versão/build e se o cache estava frio ou quente.

### Repetições

Executar 5 vezes por aparelho, zerando a medição entre repetições:

1. Feed com o vídeo tocando mudo → tocar para abrir a tela cheia.
2. Fechar pelo “X”.
3. Abrir e fechar arrastando para baixo.
4. Abrir e voltar pelo botão físico/gesto do Android.
5. Abrir, segurar para 2× e fechar; repetir com som ligado.
6. Abrir, pausar, fechar e reabrir; conferir se a posição e o estado continuam.
7. Deixar terminar, tocar em “Ver de novo” e fechar.
8. Abrir, ir para background e voltar, depois fechar.

Em cada repetição, confirmar: no máximo um player montado/tocando, sem áudio
duplicado, posição contínua e 2× preservado. Exportar o JSON ao final.

### Gravação 60/120 fps

- **iPhone:** gravação de tela pelo Control Center (60 fps quando o aparelho
  permitir) e, para o requisito de 120 fps, filmar a tela com a câmera lenta do
  iPhone (120/240 fps). A câmera externa pode introduzir moiré e rolagem;
  registrar que a evidência é externa.
- **Android:** `adb shell screenrecord --size 1080x1920 --bit-rate 50M
  --time-limit 20 /sdcard/pop26.mp4`; em aparelho de 120 Hz, usar captura de
  tela de alta taxa (`scrcpy --max-fps=120` quando disponível) ou câmera lenta
  externa. Não declarar 120 fps sem medir a taxa do arquivo.
- **Análise:** extrair quadros com `ffmpeg -i captura.mp4 -vf fps=120
  quadros/%04d.png` e procurar quadros pretos na transição. Registrar quantos
  quadros pretos, a duração em ms e o instante em relação ao toque. Anexar o
  vídeo e o JSON ao ticket.

### Critério de aceite

- Nenhum frame preto perceptível na abertura e na volta; ao analisar a 120 fps,
  nenhum intervalo preto que o olho perceba na transição.
- Um único player/áudio; sem pausa involuntária, salto de posição ou perda de
  2×/mudo.
- Controles, chrome, gesto de arrastar e voltar do sistema continuam
  funcionando.

## Resultado desta entrega

**NÃO EXECUTADO em aparelho.** Não há iPhone/Android nem build instalada neste
ambiente. O frame preto não foi confirmado nem negado; a cobertura e os eventos
foram validados apenas por Jest/TypeScript. A tabela abaixo deve ser preenchida
na execução real:

| Aparelho/SO | Build | Repetições | Quadros pretos na abertura | Quadros pretos na volta | Player/áudio duplicado | 1º quadro full (média/máx.) | 1º quadro feed (média/máx.) | Evidência |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO |

## Testes automatizados

```bash
NODE_OPTIONS=--max-old-space-size=512 \
  npx jest src/features/posts/components/__tests__/video-viewer.test.tsx \
             src/features/posts/components/__tests__/post-attachment-fullscreen.test.tsx \
             src/lib/performance/__tests__/performance.test.ts \
             src/features/performance/__tests__/diagnostics.test.ts \
             --runInBand --ci
```

Cobrem:

- a cobertura aparece antes do primeiro quadro, some no evento e recobre na
  reabertura; o limite de 500 ms evita pôster preso;
- a transição registra `fullscreen-enter`, `surface-first-frame` da tela cheia,
  `fullscreen-exit` e `surface-first-frame` do feed;
- o mesmo `LoadedPostVideo` mantém **uma** montagem de player ao abrir/voltar;
- a agregação da tela de diagnóstico separa a espera da tela cheia e do feed.

Execução desta entrega:

- `npx expo lint`: passou, sem avisos.
- `npx tsc --noEmit`: passou.
- Jest focado nas 7 suítes afetadas: **51 testes passaram**.
- Suíte completa: **137 suítes / 816 testes passaram**. Na execução sem
  `--forceExit` o processo Jest não encerrou sozinho (aviso de operações
  assíncronas, comportamento já observado nos timers de cache de teste); com
  `--forceExit` a execução terminou com código 0. As suítes novas, rodadas
  isoladamente, encerram normalmente.

## Limitações

- Sem aparelho, não há FPS, memória, TTFF real, gravação em 120 fps nem
  confirmação visual. Os valores de Jest são comportamento, não performance.
- O pôster é o primeiro quadro do vídeo; se a reprodução já estiver adiantada e
  o evento de primeiro quadro não chegar em 500 ms, a cobertura pode mostrar um
  quadro antigo por esse intervalo. O fallback existe para não deixar o vídeo
  escondido.
- A cobertura depende de um pôster já gerado (POP-22). Vídeo sem pôster mantém
  o caminho anterior.
- No web, `onFirstFrameRender` pode não ser reemitido ao remontar um player já
  carregado; por isso o limite de 500 ms é obrigatório.
- O comportamento nativo foi lido no `expo-video` 58.0.13 instalado; a leitura
  não substitui a gravação no aparelho.

## Referências

- `src/features/posts/components/post-attachment.tsx` — player, abertura,
  fechamento e eventos de transição.
- `src/features/posts/components/video-viewer.tsx` — `Modal`, surface de tela
  cheia e cobertura.
- `src/features/posts/components/video-surface.ts` — limite da cobertura.
- `src/lib/performance/index.ts` — eventos e snapshot.
- `src/features/performance/diagnostics.ts` e
  `performance-diagnostics-screen.tsx` — leitura na tela de diagnóstico.
- `docs/mobile-performance-baseline.md` — instrumentação, TTFF e captura nativa.
- `docs/pop-64-mobile-ux-smoke-matrix.md` — cenário S2 (3+ vídeos).
