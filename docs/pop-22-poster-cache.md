# POP-22: cache limitado de pôsteres de vídeo

Data: 05/11/2026. Escopo: `PostAttachment`, geração de thumbnail do
`expo-video`, ciclo de vida dos players e instrumentação local. Sem mudança de
design, API, rota, navegação ou dependência.

## Problema

A `main` (`8038689`, POP-21) mantinha `posterCache` como um `Map` sem limite em
`post-attachment.tsx`. Cada primeiro quadro gerado por
`generateThumbnailsAsync` ficava retido durante toda a vida do processo. Ao
percorrer vídeos diferentes, o número de miniaturas nativas crescia sem teto,
mesmo depois de os cartões saírem da lista.

A auditoria também confirmou o que já estava correto e não deveria regredir:

- `mediaVisible` decide entre player e pôster; fora da viewport
  `useVideoPlayer` nem é chamado.
- `activePlayer` mantém no máximo uma reprodução e pausa o player anterior.
- Autoplay é bloqueado em `background`, `inactive` e `extension`; sair de
  `active` pausa o player.
- `VideoPoster` mostra o primeiro quadro já gerado ou a listra escura.
- `generateThumbnailsAsync` só roda fora da web e a falha já caía no fallback.

Esses contratos foram preservados. A mudança ficou restrita ao cache e à
instrumentação.

## Política implementada

Novo módulo `src/features/posts/poster-cache.ts`:

- **LRU com limite de 16 entradas.** O limite cobre a janela curta da
  `FlashList` e o retorno de alguns cartões sem regenerar o quadro. É um limite
  de entradas, não de bytes: o custo real de uma miniatura depende da resolução
  do vídeo e precisa ser observado no aparelho.
- **Proteção de pôster em uso.** `usePoster` reserva a mídia enquanto o
  componente está montado. A reserva vale mesmo antes de o pôster existir, para
  que uma geração concorrente já nasça protegida. Se todas as entradas estiverem
  em uso, o cache pode exceder 16 temporariamente; a próxima liberação volta a
  aplicar o limite. A reserva não é apagada por `clear`, porque ela representa
  um componente montado, não uma miniatura.
- **Concorrência.** `load` deduplica gerações em andamento da mesma mídia: duas
  instâncias (por exemplo, feed e detalhe) compartilham a mesma promise. Uma
  geração atrasada não substitui o pôster canônico já publicado.
- **Falha segura.** Rejeição, resultado vazio ou thumbnail ausente resolvem
  `null`, não entram no cache e não derrubam o vídeo. A próxima montagem pode
  tentar de novo; não há retry automático em loop.
- **Limpeza.** `clear()` descarta miniaturas, invalida gerações em voo por época
  e avisa os assinantes. O logout (`resetToSignedOut`) limpa o cache para que
  miniaturas da conta anterior não passem para a próxima.
- **Evicção sem quebrar a tela.** A referência sai do `Map`, mas o
  `VideoThumbnail` não recebe `release()` na evicção: um componente pode estar
  exibindo a mesma referência entre o render e o efeito de reserva. O objeto
  nativo é liberado pelo ciclo de vida do `expo-image`/GC quando não houver mais
  referência JS. Um pôster já renderizado também não é apagado por uma
  notificação de evicção; se o componente continuar montado, ele mantém o
  quadro até desmontar.

`post-attachment.tsx` passou a usar `usePoster` (leitura + reserva + assinatura)
e `posterCache.load` (hit ou geração deduplicada). O resto da máquina de vídeo
permaneceu intacto.

## Instrumentação

`getPerformanceSnapshot()` ganhou a seção `posters`, com estado do processo:

- `size`/`capacity` e `retained` (miniaturas em uso);
- `hits`, `misses`, `stores`, `evictions`;
- `generationRequests`, `generationFailures`, `dedupedGenerations`;
- `discardedGenerations` e `clears`.

A tela `/diagnostico-performance` mostra a seção **Pôsteres de vídeo**. O JSON
exportado também inclui os contadores. Eles não são estimativa de memória: são
contagens de miniaturas, requisições de geração, compartilhamentos, falhas e
evicções. Nenhum dado é enviado à rede.

## Testes

`src/features/posts/__tests__/poster-cache.test.ts` (13 testes
determinísticos):

- 120 vídeos percorridos: o cache estabiliza em 16 entradas e 104 são
  evictadas;
- LRU real: o item usado recentemente sobrevive, o menos recente sai;
- hit não chama o gerador;
- pôster reservado não é evictado e o excesso é corrigido na liberação;
- duas instâncias compartilham **uma** geração;
- falha/rejeição/resultado vazio não envenenam o cache e permitem nova tentativa;
- geração atrasada depois de um pôster canônico é descartada;
- `clear` invalida geração em voo e preserva reservas de componentes montados;
- assinantes recebem o pôster e o fallback da limpeza;
- snapshot de performance expõe os contadores.

`post-attachment.test.tsx` ganhou quatro casos de integração:

- pôster em cache não regenera e continua disponível ao sair da viewport;
- pôster não é herdado quando a célula é reciclada para outra mídia;
- falha de geração mantém o vídeo e o cache vazio;
- duas instâncias da mesma mídia geram uma única vez.

Validação executada:

- `npm run check:fast`: ESLint e TypeScript passaram.
- Suítes focadas (mídia, feed, vídeo, tópicos, salvos, diagnóstico, conta):
  passaram.
- `npm run check`: **111 suítes / 636 testes passaram**.
- E2E de autenticação e saída (`e2e/specs/auth.spec.ts`): **4/4 passaram**.
  A primeira execução a frio estourou o timeout de 120 s enquanto o Metro
  compilava o bundle; a repetição com `--timeout=600000` e o bundle aquecido
  passou em 27,9 s. Não foi uma falha funcional.

Os testes provam a política de cache no host. **Não são métricas de memória,
FPS ou TTI.** A suíte completa emitiu avisos de `act(...)` e um aviso de worker
que não encerrou graciosamente; nenhum deles é falha e não foi introduzido por
esta entrega.

## Critérios de aceite

- [x] Cache não cresce ilimitadamente ao percorrer vídeos diferentes: LRU de 16
  entradas, testado com 120 vídeos. Em uso, o excesso temporário é limitado
  pelos componentes montados e é corrigido na liberação.
- [x] Pôster permanece disponível durante o carregamento: o componente lê o
  cache no primeiro render, mantém a referência no estado e assina a geração que
  termina depois da troca para fora da viewport.
- [x] Sem regressão visual conhecida nem retenção pelo cache após evicção: a
  entrada sai do `Map`; o componente pode manter a referência apenas enquanto
  está montado, por design. O visual do pôster não é apagado por evicção.
- [x] Fallback seguro em falha de geração: sem thumbnail, o vídeo continua
  disponível e o cache fica sem entrada.
- [x] `mediaVisible`, player ativo, autoplay, background e viewability
  preservados: nenhum desses caminhos foi alterado.

## Validação em device (pendente)

Não houve aparelho/emulador neste ambiente. Para validar de verdade:

1. Build de desenvolvimento com `EXPO_PUBLIC_PERFORMANCE_INSTRUMENTATION=1` e
   `EXPO_PUBLIC_APP_ENV` diferente de `production`.
2. Abrir feed/comuna com dezenas de vídeos e rolar por pelo menos 30 deles.
3. Em `/diagnostico-performance`, seção **Pôsteres de vídeo**, observar:
   `Cache` (deve estabilizar em 16 quando nada estiver em uso), `Hits`,
   `Gerações`, `compartilhadas`, `Evictados` e `falhas`.
4. Medir memória nativa no Android Studio Profiler/Perfetto e no Instruments,
   antes/depois, sem tratar os contadores do app como memória.
5. Repetir: rolar rápido, parar sobre 3 vídeos, voltar, abrir uma publicação,
   trocar de aba, sair da rota, mandar para segundo plano e fazer logout.

Também precisa de device: a geração real do primeiro quadro em iOS/Android, a
física da viewability, a qualidade visual do thumbnail e o comportamento da
pilha nativa.

## Observações fora do escopo

- O cache usa `media.id`. No compositor local, o vídeo usa o id `'local'`; hoje
  há no máximo um vídeo local por rascunho, então não há colisão observada. Se o
  compositor passar a aceitar mais de um vídeo local, a chave deve incluir a URI.
- O limite é por entrada, não por bytes. Um orçamento de memória com
  `width × height` e/ou `maxWidth`/`maxHeight` na geração seria uma próxima
  evolução, mas mudaria a qualidade do pôster e precisa de validação visual em
  device.
- Gerar thumbnail ainda ocorre na montagem do player visível. Falhas não têm
  cooldown; a próxima montagem tenta de novo. Um cooldown exigiria relógio e
  política de retry, deliberadamente fora desta entrega.
- A abertura de uma publicação por cima da lista mantém o player da lista
  montado, como documentado no POP-21; este card não alterou navegação/foco.
