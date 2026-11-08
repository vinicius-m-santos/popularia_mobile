# POP-25: atraso do primeiro quadro e avaliação de prefetch de vídeo

Data: 08/11/2026. Escopo: viewport de mídia das listas (feed, perfil, comuna,
tópico e publicações salvas), `PostCard`, `PostAttachment`,
`use-list-visibility` e a instrumentação local do POP-5. Sem mudança de player,
autoplay, rotas, API, design ou dependência.

## Problema

O vídeo só monta o player depois que a lista confirma que o cartão está na
viewport. Em rede lenta, o intervalo entre essa confirmação e o primeiro quadro
pode ser percebido como atraso no início do playback. O TTFF existente mede do
pedido de reprodução ao primeiro quadro, mas não inclui o tempo de montagem e
commit do cartão na lista. Também não havia uma decisão registrada sobre
prefetch do próximo vídeo.

A referência de auditoria é a seção 4.6 de `12c0369` (S8). A análise estática
aponta o caminho, mas **não é métrica de performance**.

## O que já existia

- **POP-5**: sessão local, `recordVideoFirstFrame` (play → primeiro quadro),
  contadores de players montados/tocando e exportação JSON.
- **POP-20/21/28/30/69**: only-visible monta player; o cartão assina apenas o
  próprio ID; foco da rota bloqueia a mídia; um `activePlayer` por vez.
- **POP-22**: o primeiro quadro vira pôster em um cache limitado, reutilizado
  fora da viewport.
- **POP-26**: transições feed ↔ tela cheia e a espera da surface de destino.

O que faltava era o marco da viewport chegar até o player e o primeiro quadro,
separando o custo de montagem/commit do custo de rede/decodificação.

## Instrumentação adicionada

A linha do tempo de um vídeo em lista passa a ter quatro marcos:

| Marco | Onde é capturado | O que representa |
| --- | --- | --- |
| `t0` | `visibleSince(postId)` em `use-list-visibility` | Viewability confirmada pela lista (20% do item por 100 ms) |
| `t1` | efeito de montagem de `LoadedPostVideo` | Player criado e cartão montado |
| `t2` | primeiro `player.play()` | Pedido de reprodução (TTFF começa aqui) |
| `t3` | `onFirstFrameRender` | Primeiro quadro entregue pela surface nativa |

Com isso o evento `first-frame` ganhou dois campos opcionais:

- `viewportMs = t3 - t0`: espera total da viewport até o quadro;
- `viewportToMountMs = t1 - t0`: parcela gasta até o player existir.

O TTFF continua sendo `valueMs = t3 - t2`. O snapshot agrega
`viewportFirstFrameCount/TotalMs/MaxMs` e `viewportToMountCount/TotalMs/MaxMs`.
A tela `/diagnostico-performance` mostra **Viewport → 1º quadro** e
**Viewport → player**, com média e máximo. O JSON exportado leva os eventos
brutos e os agregados para correlacionar com a gravação de tela.

Regras do marco:

- o mesmo instante vale para todos os IDs que entram na mesma viewability;
- repetir a mesma janela não troca o marco;
- sair da viewport remove o marco;
- ao voltar o foco da rota, o marco é recriado no retorno, porque o player
  remonta e a espera do primeiro quadro recomeça;
- prévia do compositor, cartão isolado e harness não têm viewport de lista e
  não entram nas métricas de viewport;
- a leitura do marco não cria assinatura, estado ou render extra por cartão.

Não foi adicionada dependência de rede. O tipo de rede não é inferido pelo app:
cada execução (Wi-Fi ou 3G) é uma sessão separada e o perfil de rede deve ser
anotado na planilha de execução ao lado do JSON exportado.

## Decisão sobre prefetch (nesta entrega)

**Prefetch não implementado.** A decisão é deliberada e segue o critério de
aceite "só implementar se o ganho for comprovado":

1. **Não há medição em aparelho nesta entrega.** Sem números de Wi-Fi e 3G
   simulados, não existe ganho comprovado para justificar o custo.
2. **Um prefetch real exigiria um segundo player** (ou preparar a mesma mídia
   em um player oculto). Isso quebra a política de um player por vídeo visível
   e adiciona decoder, buffers e memória sem resolver o áudio duplicado.
3. **Baixar o próximo arquivo por HTTP** compete com o vídeo atual na mesma
   rede. Em 3G isso pode atrasar o primeiro quadro do vídeo que a pessoa está
   vendo, gastar dados móveis e mascarar o problema em vez de resolvê-lo.
4. **O cache de pôster não ajuda antes do player existir.** O pôster é gerado
   pelo próprio player (`generateThumbnailsAsync`), então não é um caminho de
   prefetch do próximo vídeo.
5. O código atual usa `useCaching: false` no player. Mudar isso é uma decisão
   separada, com impacto de disco e memória que também precisa ser medido.

### Critério para reabrir a avaliação

Executar o protocolo abaixo em aparelho, 5 vezes por rede, com cache frio e
quente. Considerar um prefetch limitado do próximo vídeo **somente se**:

- a mediana ou o p95 de **Viewport → 1º quadro** em 3G ficar acima de **1 s**;
- **Viewport → player** ficar baixo (referência: p95 abaixo de **100 ms**), ou
  seja, o gargalo estiver em rede/decodificação e não em montagem/commit;
- um experimento sem player extra (por exemplo, aquecer conexão/DNS/TLS sem
  baixar o arquivo inteiro) reduzir o p95 em **pelo menos 30%**;
- não aumentar players simultâneos, memória de pico, bytes de rede por sessão
  nem erros de reprodução.

Se o gargalo estiver em **Viewport → player**, prefetch de mídia não resolve:
o próximo passo seria reduzir trabalho de montagem/commit, não baixar vídeo.

## Protocolo de validação (Wi-Fi e 3G simulado)

### Build e dataset

1. Build de development/staging com
   `EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1` e
   `EXPO_PUBLIC_APP_ENV` diferente de `production`.
2. Conta com pelo menos **3 vídeos consecutivos** no mesmo feed, com um curto,
   um longo (mais de 30 s) e outro curto. Registrar se o cache estava frio ou
   quente.
3. Wi-Fi estável e 3G simulado (referência do roteiro de QA: ~400 kbps de
   download/upload, RTT ~400 ms, sem perda). Em aparelho físico, usar throttle
   de rede no roteador/proxy; em emulador, registrar que não é um aparelho real.

### Repetições

Para cada rede (Wi-Fi e 3G), repetir 5 vezes:

1. Em `/diagnostico-performance`, tocar em **Iniciar medição**.
2. Voltar ao feed e rolar até o primeiro vídeo; esperar o primeiro quadro.
3. Rolar para o segundo e o terceiro vídeos, deixando cada um entrar na
   viewport e sair. Não abrir a tela cheia durante a medição principal.
4. Voltar ao diagnóstico e conferir players montados/tocando, TTFF,
   **Viewport → 1º quadro** e **Viewport → player**.
5. Exportar o JSON e anotar aparelho, build, rede, cache, repetição e gravação
   de tela.
6. Resetar a medição antes da repetição seguinte.

### O que registrar

| Campo | Como obter |
| --- | --- |
| Viewport → 1º quadro (mediana/p95) | Cards (média/máximo) e eventos `first-frame` do JSON exportado |
| Viewport → player (mediana/p95) | Cards (média/máximo) e eventos `first-frame` do JSON exportado |
| TTFF (mediana/p95) | Card "TTFF médio/máximo" e eventos `first-frame` |
| Players montados / tocando | Contadores do instante da leitura |
| Memória de pico | Profiler nativo (Android Studio / Instruments) |
| Bytes de rede | Captura do proxy/plataforma, não estimativa do app |
| Erros e frames pretos | Eventos `error` + gravação de tela |

Tabela a preencher na execução real (até lá, **NÃO MEDIDO**):

| Aparelho/build | Rede | Cache | Repetições | Viewport→1º (mediana/p95) | Viewport→player (mediana/p95) | TTFF (mediana/p95) | Players máx. | Memória pico | Bytes de rede | Conclusão |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| NÃO MEDIDO | Wi-Fi | frio | 5 | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO |
| NÃO MEDIDO | Wi-Fi | quente | 5 | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO |
| NÃO MEDIDO | 3G | frio | 5 | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO |
| NÃO MEDIDO | 3G | quente | 5 | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO | NÃO MEDIDO |

## Autoplay e segurança preservados

A mudança é somente de leitura/instrumentação:

- `PostAttachment` continua montando **um** player apenas quando `visible` é
  verdadeiro e desmontando fora da viewport;
- `activePlayer` continua pausando o player anterior, então no máximo um
  vídeo reproduz;
- o autoplay continua mudo e bloqueado em background/inactive/extension;
- nenhum player, download, timer, intervalo ou listener de rede foi adicionado;
- o pôster e a tela cheia continuam no mesmo caminho.

Os testes de `PostCard`/comuna já cobrem "fora da viewport = zero players",
"três vídeos na viewport = um tocando" e "rolar para fora desmonta". O teste
novo apenas confirma que o marco chega do cartão ao evento de primeiro quadro.

## Testes automatizados

```bash
NODE_OPTIONS=--max-old-space-size=512 \
  npx jest \
    src/hooks/__tests__/use-list-visibility.test.tsx \
    src/hooks/__tests__/use-route-media-focus.test.tsx \
    src/lib/performance/__tests__/performance.test.ts \
    src/features/performance/__tests__/diagnostics.test.ts \
    src/features/performance/__tests__/performance-diagnostics-screen.test.tsx \
    src/features/posts/components/__tests__/post-attachment-fullscreen.test.tsx \
    src/features/posts/components/__tests__/post-card-media-visibility.test.tsx \
    --runInBand --ci
```

Cobrem:

- o marco de viewport é criado, preservado na mesma janela, removido ao sair e
  recriado no retorno do foco da rota;
- `useMediaVisibility` entrega visibilidade e marco na mesma assinatura;
- o `PostCard` leva o marco até o `PostAttachment`, que registra
  `viewportMs`/`viewportToMountMs` no primeiro quadro;
- cartão isolado ou prévia não inventa métrica de viewport;
- o snapshot agrega contagem, total e máximo, e a tela de diagnóstico mostra
  média/máximo;
- a política de um player por vídeo visível e no máximo um tocando permanece.

Execução desta entrega: **8 suítes / 60 testes focados passaram**, 4 suítes /
24 testes dos consumidores de viewport (feed, tópico, salvos e comuna) e a
suíte completa **162 suítes / 973 testes** passaram. `npx tsc --noEmit` e
`npx expo lint` passaram. Esses números provam comportamento, **não performance
de aparelho**.

## Limitações

- **Nenhum iPhone/Android foi usado.** Não há medição real de Wi-Fi, 3G,
  memória, bytes de rede, FPS ou frames pretos; a tabela acima continua
  "NÃO MEDIDO".
- `t0` é a confirmação da viewability da lista, não o primeiro pixel do cartão
  na tela. É o marco que o app controla e o que dispara a montagem do player.
- `viewportToMountMs` inclui o tempo de commit/efeito do React; não é um tempo
  nativo de criação do decoder.
- O evento de primeiro quadro é o evento da surface nativa, não uma leitura de
  pixels; frame preto e fluidez exigem gravação de tela (POP-26).
- O app não classifica a rede automaticamente. Comparações Wi-Fi/3G dependem de
  sessões separadas e do registro do perfil de rede na planilha.
- Números de Jest são sintéticos e não devem ser colados como resultado de
  performance.

## Referências

- `src/hooks/use-list-visibility.ts` — viewport, foco e marco `visibleSince`.
- `src/features/posts/components/post-card.tsx` — assinatura e repasse do marco.
- `src/features/posts/components/post-attachment.tsx` — montagem, play e
  primeiro quadro.
- `src/lib/performance/index.ts` — eventos e agregados.
- `src/features/performance/diagnostics.ts` e
  `performance-diagnostics-screen.tsx` — leitura na tela de diagnóstico.
- `docs/mobile-performance-baseline.md` — protocolo geral de captura.
- `docs/pop-26-video-fullscreen-transition.md` — primeiro quadro por surface.
- `docs/pop-64-mobile-ux-smoke-matrix.md` — cenário S2 (3+ vídeos e 3G).
