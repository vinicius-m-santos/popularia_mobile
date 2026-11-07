# POP-27 — montagem do visualizador de foto sob demanda

Data: 10/11/2026. Escopo: `src/features/posts/components/post-attachment.tsx`
e testes de foto. Sem mudança de rota, contrato de mídia, API ou dependência.
A referência de auditoria é a seção 4.6 de `12c0369` (custo por célula), cujo
objeto não está disponível neste clone; o ponto `post-attachment.tsx:81` do
relatório corresponde ao `PhotoViewer` renderizado por `PostPhoto`.

## Problema

Cada `PostPhoto` renderizava um `PhotoViewer` mesmo fechado. O `Modal` nativo
ficava invisível, mas o componente já criava todos os seus hooks: três gestos
(pinça, arrasto e toque duplo), cerca de uma dúzia de shared values do
Reanimated, estilos animados e a leitura de safe area. Em um feed de 100+ fotos
isso acontecia uma vez por cartão, mesmo sem ninguém abrir nenhuma foto.

O `PhotoViewer` já é um `Modal` controlado por `visible`; a montagem preguiçosa
pode ser feita no consumidor sem mudar o contrato do visualizador.

## Medição do custo removido

Benchmark reproduzível no host (Node/Jest), não no aparelho:

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest \
  --runTestsByPath benchmarks/pop-27-photo-viewer-allocations.bench.ts \
  --testMatch '**/*.bench.ts' --runInBand --silent=false
```

O benchmark reconstrói o caminho anterior e o compara com o atual na mesma
árvore de 100 `PostAttachment` de foto: com um `PhotoViewer` fechado por cartão
(caminho anterior) e sem o viewer (caminho atual). Também mede a montagem do
único viewer no toque.

Execução local em 10/11/2026, Jest 30, Linux/WSL, 8 rodadas de 100 cartões:

| Cenário | Mediana | Mín | Máx |
| --- | --- | --- | --- |
| 100 cartões + `PhotoViewer` fechado (antes) | 131,05 ms | 96,65 ms | 166,62 ms |
| 100 cartões sem viewer (depois) | 91,62 ms | 71,24 ms | 131,11 ms |
| 1 `PhotoViewer` montado no toque | 2,70 ms | 2,26 ms | 41,13 ms |

O custo removido ficou em **≈ 0,394 ms por cartão fechado** no host; nos 100
cartões, ≈ 39 ms de trabalho de montagem a menos. A montagem que passa a
acontecer no toque é de ≈ 2,70 ms (mediana), paga uma única vez e apenas pela
foto aberta.

Esses números são de CPU do renderer de teste. Não são FPS, frame time, memória
ou tempo de abertura no aparelho; a comparação serve para justificar a mudança
de arquitetura, não como orçamento de release.

### Host compartilhado

Um host único (provider no topo da árvore com um só `PhotoViewer`) também
eliminaria a montagem por cartão, mas exigiria mover o estado de abertura e o
preview para um contrato compartilhado entre feed, perfil, comuna, tópico,
salvos, detalhe de publicação e composer. A montagem sob demanda remove o custo
de todos os cartões fechados sem alterar esses consumidores nem a propriedade
do preview por cartão. A medição não mostrou necessidade de pagar o risco maior.

## Implementação

- `PostPhoto` agora mantém `viewerMounted` separado de `open`. O `PhotoViewer`
  só é renderizado depois do primeiro toque; cartões fechados não executam
  nenhum hook nem gesto do visualizador.
- Ao fechar, `open` vira `false` e a montagem permanece por
  `PHOTO_VIEWER_EXIT_MS = 300` ms, o tempo da transição nativa de saída do
  `Modal` (`animationType="fade"`). Depois disso o viewer é desmontado e seus
  hooks/gestos são liberados.
- Reabrir durante o fade cancela o timer e reutiliza a mesma montagem: a foto
  volta a ficar visível sem remontar no meio da transição.
- A variante reduzida (`Image.loadAsync`) continua sendo pedida no toque e
  liberada ao fechar. A leitura em voo é invalidada no unmount e o timer é
  limpo junto.
- O contrato de `PhotoViewer` não mudou: `uri`, `preview`, `mediaId`, `visible`,
  `onClose`, `width` e `height` continuam iguais. Pinça, duplo toque, arrasto,
  retorno elástico, descarte, backdrop, chrome inferior e reabertura limpa
  seguem no mesmo componente.
- Reciclagem: o viewer acompanha o ciclo do `PostPhoto`/`PostAttachment`; se a
  célula for desmontada com o viewer aberto, o cleanup cancela o timer e libera
  a montagem.

## Testes

`src/features/posts/components/__tests__/post-attachment-photo.test.tsx`:

- 100 fotos fechadas montam **zero** `PhotoViewer` (e continuam com os 100
  botões acessíveis de abertura);
- o toque monta um único viewer com `visible`, `preview`, `mediaId`, `uri` e
  dimensões corretos;
- abrir sem preview e não disputar rede enquanto o feed carrega continuam
  cobertos;
- o fechamento mantém a montagem durante o fade, solta o preview e desmonta
  depois dos 300 ms;
- reabrir durante o fade não remonta hooks nem perde a transição;
- reciclar a célula para outra foto libera a montagem anterior e a nova começa
  fechada.

`photo-viewer.test.tsx` e `photo-viewer-geometry.test.ts` continuam cobrindo
pinça, foco entre os dedos, limite de borda, duplo toque, arrasto, descarte,
retorno por mola, gesto cancelado, botão acessível, voltar do Android,
reabertura e geometria. Nada nesses testes foi removido ou afrouxado.

## Validação executada

```bash
NODE_OPTIONS=--max-old-space-size=512 npx jest \
  src/features/posts/components/__tests__/post-attachment-photo.test.tsx \
  src/features/posts/components/__tests__/photo-viewer.test.tsx \
  src/features/posts/components/__tests__/photo-viewer-geometry.test.ts \
  src/features/posts/components/__tests__/post-attachment.test.tsx \
  src/features/posts/components/__tests__/post-attachment-fullscreen.test.tsx \
  src/features/posts/components/__tests__/post-card-media-visibility.test.tsx \
  --runInBand --ci
```

Resultado: **6 suítes, 62 testes** verdes.

- Suíte completa: **154 suítes, 920 testes** verdes (`--ci --maxWorkers=2
  --forceExit`, com os avisos de `act(...)`/worker já existentes em outras
  suítes).
- `npx expo lint`: verde.
- `NODE_OPTIONS=--max-old-space-size=1024 npx tsc --noEmit`: verde. Com 512 MB
  o heap do TypeScript estourou nesta máquina, como já registrado em tarefas
  anteriores.
- Benchmark POP-27: verde, com os números acima.
- Playwright focado em `mobile-ux-smoke.spec.ts -g "abre a foto em tela cheia"`
  no Chromium: **1 teste** verde, abrindo e fechando a foto pelo controle
  acessível e voltando à URL `/`.

O Playwright cobre o fluxo web de abertura/fechamento e a semântica acessível;
ele não mede gesto, memória nem transição nativa.

## Limitações e validação pendente em aparelho

- **Não houve Profiler em aparelho** nem feed real de 100+ fotos nesta entrega.
  FPS, frame time de JS/UI, pico de memória, latência percebida e o custo real
  do `Modal` em iOS/Android continuam **não medidos**. O roteiro está em
  `docs/mobile-performance-baseline.md`: build de staging/development com
  profiling, feed de 100+ fotos, rolagem, abertura/fechamento e comparação
  antes/depois no mesmo aparelho, rede, cache e build.
- Os testes de gesto usam mocks de gesto e de Reanimated. Eles provam limites,
  ordem de callbacks e preservação do contrato, não a física da pinça/mola nem
  a disputa real entre gestos no aparelho.
- O benchmark do host mede montagem de componentes no renderer de teste; ele
  não mede alocação nativa de `Modal`, memória de bitmap ou GPU.
- A montagem no toque acrescenta ≈ 2,70 ms de trabalho de JS no host antes de
  o `Modal` aparecer. Se a medição em aparelho mostrar atraso perceptível na
  abertura, o próximo passo é aquecer a montagem no `onPressIn` ou adotar o host
  compartilhado; nenhum dos dois foi necessário com os números atuais.
