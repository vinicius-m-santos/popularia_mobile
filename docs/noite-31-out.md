# O que foi feito na madrugada de 31/10

Resumo curto para leitura de manhã. Nada foi enviado para o remoto; cada tarefa tem seu commit.

## 1. Menu central de criação (publicação, PDF, comuna)

Estava com o problema de "tudo gritando": cada item com borda de 2 px tinta, título em Anton 28,
descrição em mono caixa-alta de 10,5.

- Bordas de conteúdo em 1 `inkSoft`; título do item em sans extrabold 16/22.
- Descrições e subtítulo em sans 13/18, caixa normal, até duas linhas.
- Chevron de 18 em `muted` no lugar da seta de 26; ilustração de 196 para 172, recuada.
- Título do sheet continua em Anton 40 — agora é o único peso alto ali.

`feat(main): create sheet hierarchy and readable descriptions`

## 2. Tela de comentários (a que estava fora do padrão)

- Ícone de salvar alinhado ao padrão do feed: sem moldura, 20 px, na ponta direita.
- Contagem de eco duplicada no selo de data removida.
- Cabeçalho dos comentários virou `Kicker` editorial com fio em `Colors.rule`.
- Chips de ordenação no grupo palha com seleção em tinta, sem contorno individual.

`feat(main): comment screen save action and editorial comments header`

## 3. Like (apoio) e eco persistidos

O backend não tinha nenhum dos dois; o app guardava só no aparelho e **zerava as contagens** ao
mapear a API.

- Backend: tabelas `post_support` e `post_echo` (uma linha por pessoa), operações
  `PUT|DELETE /posts/{id}/support` e `/posts/{id}/echo`, idempotentes, contagens e marca por pessoa
  no `PostView`. Migration aplicada no banco de desenvolvimento.
- App: store de reação por sessão, patch de cache em todas as listas, toque otimista com trava
  contra duplo toque e reversão em caso de erro.
- Teste de API novo: 1 caso, 17 asserções. App: 27 testes em posts + interactions.

`abb6b7e feat(main): persist post support and echo with per-viewer counters` (backend)
`b66a97b feat(main): persist post support and echo with optimistic updates` (app)

## 4. Compartilhar publicação

O backend já tinha prévia OG boa em `/p/{id}` (título, descrição, `og:type article`, link do app,
CSP e `noindex`) e a folha de opções já oferecia compartilhar. Faltava **descoberta**: agora o
detalhe da publicação tem botão de compartilhar ao lado do menu, com aviso quando o conteúdo ainda
não tem link público.

`feat(main): share post from the detail header`

## 5. Push no iPhone — a causa não era certificado

Duas causas reais, nenhuma delas de credencial:

1. **Ninguém entregava a fila.** O backend cria a notificação e deixa pronta para envio, mas
   `app:notifications:deliver` não estava no `docker compose` nem nos crons documentados da Railway.
2. **Nenhum aparelho registrado** no banco de desenvolvimento (`push_device` vazio). O app só
   registra depois que a permissão é concedida, e o convite existe apenas dentro de Avisos.

Simulação feita daqui: chamada real à API da Expo a partir do container respondeu **HTTP 200** com
`DeviceNotRegistered` para um token falso — rede e credenciais funcionam; o problema era operacional.
`EXPO_PUSH_ACCESS_TOKEN` está vazio no dev (a Expo aceita, mas vale definir em produção).

Correção: serviço `worker` no compose rodando `app:notifications:deliver --watch --interval=5`, e a
entrega de push entrou na lista de crons (a cada minuto).

`ed3b09a feat(main): run push delivery in a worker service and document the cron` (backend)

**Para funcionar no aparelho**: `docker compose up -d worker`, criar o Cron Job na Railway, abrir
Avisos no app e tocar em "Ativar avisos no aparelho". Precisa ser dev build ou produção — Expo Go no
iOS não tem push.

## 6. Pente fino

- Dois campos obrigatórios ganharam placeholder que faltava (descrição da comuna, nome de usuário
  do setup). Os campos de perfil ficaram para a frente do Perfil, que tem outro dono.
- Suíte completa: **426 testes passando, 1 falhando** — `src/features/profiles/__tests__/follow.test.tsx`.
  Confirmei que **já falhava antes deste trabalho** (rodei o teste com o meu diff em stash, no HEAD).
  Fica pendente de decisão: é a única vermelha do projeto.

## Libs avaliadas

Não instalei nada novo — módulo nativo exige build nova e eu não teria como validar hoje.

| Necessidade | Situação | Recomendação |
| --- | --- | --- |
| Feedback tátil ao apoiar/ecoar | `expo-haptics` ausente | Vale instalar: é o detalhe que faz like parecer físico |
| Listas longas | FlashList 2.3.2 já em uso | manter |
| Imagens com cache/placeholder | `expo-image` já em uso | manter |
| Copiar link | `expo-clipboard` já em uso | manter |
| Áudio de vídeo | `expo-video` cobre | não adicionar `expo-av` |
| Superfícies com gradiente/blur | ausentes | não vale: a direção é papel chapado e tinta |

## O que não foi feito e por quê

- **Screenshots (Playwright/Chrome)**: o outro agente continuou com o Metro no ar a madrugada toda e
  não publicou o documento de instruções. Não competi por memória nem usei o servidor dele.
- **Imagem do OG por publicação**: hoje é sempre o símbolo do Popularia. Usar a mídia exigiria uma
  rota pública estável, porque as URLs de mídia são assinadas e expiram.
- **Composer de publicação**: é a próxima frente de design e ainda não foi iniciada.
- **Chat da Praça / Perfil**: pertencem ao outro agente.

## Commits do app (ordem)

```
8769921 feat(main): fullscreen video with countdown and post chrome
2d08446 feat(main): document reader and PDF card in editorial direction
6fc056d feat(main): PDF upload with progress, editorial actions and share limit
fa7ca80 feat(main): create sheet hierarchy and readable descriptions
a10b2be docs(main): media and gesture rules, front status
5d04190 feat(main): comment screen save action and editorial comments header
b66a97b feat(main): persist post support and echo with optimistic updates
44cd8ec feat(main): share post from the detail header
7d77e3d feat(main): add missing field placeholders in settings and setup
```
