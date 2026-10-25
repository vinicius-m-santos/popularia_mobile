# Popularia (mobile)

Protótipo do app da Popularia em React Native + Expo (SDK 58) + TypeScript + Expo Router.
Usa **apenas dados fictícios**. Não há backend, autenticação ou armazenamento de dados pessoais.
**Não está pronto para produção.**

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
| `npx expo-doctor`   | Diagnóstico de dependências     |

Para adicionar pacotes, use sempre `npx expo install <pacote>`: ele escolhe versões compatíveis com o SDK.

## Estrutura

```
src/
  app/                  Rotas (Expo Router): cada arquivo é uma tela
    _layout.tsx         Raiz: fontes, splash, pilha e ErrorBoundary
    (tabs)/             Abas: Início, Explorar, Avisos, Perfil
    criar.tsx           Modal "Criar publicação"
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
Quando a API Symfony/API Platform existir, só esses arquivos mudam (fetch + mapeamento JSON-LD → modelo).

## Configuração

`EXPO_PUBLIC_API_URL` (opcional) define a URL da futura API. Sem ela, o app usa os mocks.
Variáveis `EXPO_PUBLIC_*` vão para dentro do app e ficam visíveis a qualquer pessoa:
**nunca coloque segredos nelas.**
