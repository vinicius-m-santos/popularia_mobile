# Popularia (mobile)

App da Popularia em React Native + Expo (SDK 58) + TypeScript + Expo Router.

**Com a API `popularia_backend`**: cadastro, confirmação de e-mail por código, login, sessão persistente,
recuperação de senha, `/me`, interesses e "sair deste/de todos os aparelhos"; **comunas** (lista, página,
publicações, entrar/sair/pedir entrada em privadas, criar, arquivar e excluir, gestão de membros e moderadores,
transferência de propriedade, pedidos de entrada), **feed** ("Para você" e "Minhas comunas", paginado),
**publicações** (ler e criar), **comentários** (ler, comentar e responder), **perfis/follow** e
**avisos internos** (histórico paginado, contador e leitura persistida, sem push).
**Ainda com dados fictícios**: explorar (pessoas, assuntos e publicações em destaque), "Perto de mim",
chamados da semana, denúncias e moderação da plataforma,
e as interações apoiar/ecoar/salvar/silenciar (só neste aparelho). Em desenvolvimento, o selo
"DADOS FICTÍCIOS" aparece nas telas que ainda usam mocks. **Não está pronto para produção.**

## Rodar no celular com Expo Go

1. Instale o **Expo Go** (Play Store ou App Store). Ele precisa ser compatível com o SDK 58.
2. No computador:

   ```bash
   npm install
   npx expo start
   ```

3. Com o celular na **mesma rede Wi-Fi** do computador:
   - **Android:** abra o Expo Go e escaneie o QR code do terminal.
   - **iOS:** escaneie o QR code com a câmera do iPhone.
4. Se a rede bloquear a conexão (Wi-Fi corporativo, WSL2, VPN), use `npx expo start --tunnel`.

Atalhos no terminal: `r` recarrega e `m` abre o menu de desenvolvimento.

## Scripts

| Comando             | O que faz                       |
| ------------------- | ------------------------------- |
| `npm start`         | Servidor de desenvolvimento     |
| `npm run lint`      | ESLint (`eslint-config-expo`)   |
| `npm run typecheck` | Verificação de tipos (`tsc`)    |
| `npm test`          | Testes (Jest com `jest-expo`)   |
| `npx expo-doctor`   | Diagnóstico de dependências     |

Os testes ficam em pastas `__tests__/` ao lado do código (nunca em `src/app/`, que é só de rotas) e cobrem
o cliente HTTP (renovação de sessão), a paginação, a participação em comunas e o contrato com a API
(caminhos, corpos enviados e conversão das respostas).

Para adicionar pacotes, use sempre `npx expo install <pacote>`: ele escolhe versões compatíveis com o SDK.

## Estrutura

```
src/
  app/                  Rotas (Expo Router): cada arquivo é uma tela
    _layout.tsx         Raiz: fontes, splash, pilha e ErrorBoundary
    (tabs)/             Abas: Início, Explorar, Avisos, Perfil
    criar.tsx           Modal "Criar publicação"
    criar-comuna.tsx    Modal "Nova comuna" (requer API)
    gerir-comuna/[id].tsx  Gestão de membros, moderação e configurações (requer API)
  components/           Componentes compartilhados (texto, ícones, tela, estados)
  features/<domínio>/   Acesso a dados (api.ts) e componentes do domínio
  hooks/                Hooks genéricos
  lib/                  Funções utilitárias puras (formatação etc.)
  mocks/                Dados fictícios
  types/                Modelos de domínio
  constants/            Tema (cores, fontes, espaçamentos) e configuração
assets/                 Ícone, splash e imagens
```

As telas nunca importam `src/mocks` diretamente: elas chamam `features/<domínio>/api.ts`.
Ao migrar um domínio para a API, só esses arquivos mudam (fetch + mapeamento JSON → modelo).

## Configuração e API

1. Suba o backend (`popularia_backend`, veja o README de lá).
2. Crie `.env.local` aqui com o IP do computador na rede Wi-Fi (não use `localhost`: no celular ele aponta
   para o próprio celular):

   ```bash
   EXPO_PUBLIC_API_URL=http://192.168.0.10:8080/api/v1
   ```

3. Reinicie `npx expo start`. Os códigos de confirmação e de recuperação chegam no Mailpit
   (http://localhost:8025 no computador).

Sem `EXPO_PUBLIC_API_URL`, o app roda em **modo demonstração**: nada é enviado, "Entrar" abre o perfil fictício
e feed, comunas e discussões voltam a usar os mocks. Com a variável, essas telas usam só a API: se uma chamada
falhar, a tela mostra o erro (com "Tentar de novo"), nunca dados fictícios no lugar.
Variáveis `EXPO_PUBLIC_*` vão para dentro do app e ficam visíveis a qualquer pessoa: **nunca coloque segredos nelas.**

### Como a sessão funciona

- `src/lib/api/client.ts`: cliente HTTP único (URL base, tempo limite, erros `problem+json` → `ApiError`/`NetworkError`).
  Renova a sessão sozinho quando a API responde 401, uma vez só mesmo com várias chamadas simultâneas.
- `src/lib/api/token-store.ts`: o refresh token fica no **expo-secure-store** (Keychain/Keystore, só neste aparelho).
  O access token fica só na memória. Nada em AsyncStorage. No navegador a sessão não é guardada.
- `src/features/account/api.ts` + `account-context.tsx`: as telas usam o contexto, nunca `fetch`.
- Ao abrir o app, a sessão guardada é retomada antes de esconder a splash.
- Não pedimos CPF.

O contrato da API está em `popularia_backend/docs/openapi.json` (gerado com `composer openapi` no backend).
Os tipos usados aqui (`MeDto`, `TokensDto`) foram escritos à mão a partir dele; quando houver muitos
endpoints, vale gerar com `npx openapi-typescript ../popularia_backend/docs/openapi.json -o src/lib/api/schema.d.ts`.

### Comunas, feed, publicações e comentários

- `features/comunas/api.ts`, `features/feed/api.ts`, `features/posts/api.ts` e `features/discussion/api.ts`
  chamam a API e convertem o JSON (`lib/api/dto.ts`) para os modelos de `types/models.ts`. No app, a comuna é
  identificada pelo **slug** (é o endereço da rota); o UUID da API fica em `Comuna.serverId`, usado para publicar.
- Listas paginadas por cursor usam `hooks/use-paginated-data.ts`: primeira página, "carregar mais", puxar para
  atualizar, sem itens duplicados, e uma falha ao atualizar não apaga o que já está na tela.
- **Autoria, papéis e permissões vêm do servidor** (`viewer.isAuthor`, `viewer.canComment`, `viewer.role`,
  `viewer.permissions`): o app não compara IDs, não calcula papéis nem manda autoria ou contagens.
  O ID local `"me"` de `useMe()` só serve às telas que ainda são fictícias.
- Entrar e sair de uma comuna esperam a resposta da API (sem atualização otimista); o resultado fica num cache
  da sessão (`features/interactions`) para as outras telas. Depois de publicar, feed e comuna recarregam.
- Publicar e comentar exigem e-mail confirmado: as telas avisam antes e oferecem "Confirmar e-mail"; isso nunca
  encerra a sessão. Comentários apagados, removidos ou de quem tem bloqueio com você aparecem como marcadores
  sem texto nem autoria (o servidor já filtra publicações de pessoas bloqueadas).

### Criar e gerir comunas (requer API configurada)

- A tela **Nova comuna** (`criar-comuna`) verifica a cota antes de mostrar o formulário.
  Se `canCreate` for `false`, explica o motivo (limite atingido ou e-mail não confirmado)
  sem mostrar o formulário. Em modo demonstração (`EXPO_PUBLIC_API_URL` ausente) a tela mostra uma
  mensagem e não envia nada.
- A tela **Gerir** (`gerir-comuna/[id]`) tem abas por permissão: Membros (sempre), Pedidos (só se
  `canReviewJoinRequests`) e Comuna (só fundadores). As ações de membro (nomear, transferir, remover)
  são exibidas com base em `viewer.permissions` que vêm do servidor.
- A página da comuna mostra, via `viewer.permissions`: "Gerir" (fundador), "Gerir (moderação)"
  (moderadores), "Pedir para entrar" / "Pedido enviado · retirar" (privadas sem membro), e uma
  transferência de propriedade de entrada para aceitar ou recusar.
- Arquivamento e exclusão exigem confirmação explícita; a exclusão só é mostrada quando
  `canDelete` é true. Se o servidor recusar com `has-members` ou `has-content`, o app oferece
  arquivar no lugar.
- O próprio perfil lista "Criar comuna" e, para cada comuna que a pessoa funda ou modera,
  um atalho para a tela de gestão.

### Testar no celular com a API

1. No backend: `docker compose up -d`, migrations e, para ter comunas,
   `docker compose exec php bin/console app:dev:seed`.
2. Aqui: `.env.local` com o IP do computador (acima) e `npx expo start` (ou `--tunnel` se a rede bloquear).
3. Crie uma conta pelo app, confirme o e-mail com o código do Mailpit e entre em uma comuna.
4. Roteiro básico: feed nas duas abas, puxar para atualizar e rolar até o fim; abrir uma comuna, entrar e sair;
   publicar numa comuna e no perfil; abrir a discussão, comentar e responder; fechar e reabrir o app
   (a sessão volta); sair e entrar de novo; testar sem internet (modo avião) para ver os erros e o "Tentar de novo".
   Para ver o aviso de e-mail, use uma conta ainda não confirmada.
5. Roteiro de criação e gestão de comunas (use uma conta nova, não a `equipe.demo`):
   - Abra o perfil → botão "Criar comuna"; preencha nome, descrição e uma regra; confirme e verifique que
     a tela da nova comuna abre.
   - Crie mais 2 comunas e tente criar uma 4ª: o app deve explicar o limite antes do formulário.
   - Na page da sua comuna, toque "Proprietário · Gerir": abra a aba "Membros", depois a aba "Comuna".
   - Crie uma **segunda conta** (pode ser pelo mesmo celular com outro perfil do Expo Go, ou no simulador):
     entre na sua comuna pública com a 2ª conta; na aba "Membros" da tela de gestão da 1ª conta, nomeie a
     2ª conta como moderadora; depois a dispense.
   - Tente excluir com a 2ª conta ainda como membro: o app deve explicar e oferecer "Arquivar". Arquive.
     Verifique que a página da comuna mostra o banner "arquivada" e que não é mais possível publicar.
   - Com a outra comuna (sem outros membros), exclua: confirme os 3 pontos no alerta e verifique que o
     app navega para o perfil.
   - Com 3 comunas ativas, arquive ou exclua uma e crie outra imediatamente: a vaga é liberada,
     sem cooldown. Uma 4ª comuna ativa continua sendo recusada.

A conta fictícia do seed (`equipe.demo@popularia.local` / `demo-somente-local`) tem 4 comunas ativas como
fundadora (acima do limite de 3 — legacy de antes da migração). Por isso o limite já bloqueia a criação
nessa conta; use uma conta nova para testar o fluxo de criação.
