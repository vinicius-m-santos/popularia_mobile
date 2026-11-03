# Popularia — prontidão para TestFlight externo (iOS)

**Data:** 01/11/2026  
**Escopo:** app Expo/React Native, configuração iOS, fluxos sensíveis à revisão da Apple, backend de produção e operação de TestFlight.  
**Veredito curto:** o app está **quase pronto tecnicamente** e os URLs públicos, o AASA e o Sentry já foram resolvidos. Ainda faltam **App Store Connect/TestFlight, conta de revisão, APNs e validação do build em aparelho**.

## O que já está bom

- `expo-doctor`: **20/20** checks após atualizar `expo`, `expo-router` e `react-native-screens` para os patches do SDK 58.
- `tsc --noEmit`, `expo lint` e Jest: **69 suítes / 438 testes** passando.
- Bundle iOS `com.popularia.mobile`, projeto EAS vinculado (`6e964283-951f-4a16-bf99-5a4d5236a338`).
- Ícone 1024 × 1024 **sem alpha**; splash configurada.
- `ITSAppUsesNonExemptEncryption: false`; ATS restrito a HTTPS.
- Sem permissões de câmera, microfone, localização ou contatos. A única permissão sensível é a fototeca, com texto claro.
- **Sign in with Apple** implementado e entitlement configurado; Google também está disponível, então a regra 4.8 da Apple está coberta.
- **Exclusão de conta** dentro do app, incluindo revogação Apple/Google.
- **UGC**: denúncia de post/comentário/perfil/comuna, bloqueio de pessoas, fila de moderação e termos/idade no cadastro.
- API de produção responde: `https://api.popularia.com.br/api/v1/health` → `200 {"status":"ok","database":"ok"}`; `/topics` → 200.
- Splash e interface em português; app declara beta para maiores de 18 anos.

## Resolvido nesta rodada

1. **Política de Privacidade e Suporte públicos** — site publicado no Railway (o mesmo projeto do backend), com o site principal, Termos, Privacidade e Suporte:
   - https://popularia.com.br/privacidade
   - https://popularia.com.br/suporte
   - https://popularia.com.br/termos
   - O contato público usa o e-mail que já recebe o suporte do backend, `vinicius.m.dos.s@gmail.com`. Troque por um endereço `@popularia.com.br` quando o encaminhamento estiver configurado.

2. **Universal Links** — AASA publicado em `https://popularia.com.br/.well-known/apple-app-site-association` (o host antigo `api.popularia.com.br` também mantém uma cópia para builds antigas), com `Content-Type: application/json`, Team ID `GUA3RMH4KC`, bundle `com.popularia.mobile` e os caminhos `/p`, `/u`, `/c`, `/d`, `/e` e `/t`. Resposta atual: **200 application/json**.

3. **Sentry** — os ambientes `production` e `preview` do EAS já têm `EXPO_PUBLIC_SENTRY_DSN` e `SENTRY_AUTH_TOKEN`. O `.env` local vazio é intencional (desenvolvimento não envia eventos para produção).

4. **Placeholders da beta** — “Perto de mim” foi removida das abas quando não há API, e “Chamados da semana” (fictício) não é renderizado fora do modo demonstração.

## Pendências P0

1. **App Store Connect + TestFlight externo**
   - `eas.json` agora tem `ascAppId: 6827749427` e `appleTeamId: GUA3RMH4KC` nos perfis `production` e `testflight-staging`.
   - O app record é `6827749427`; ainda faltam o grupo de testadores externos, “Test Information”, contato de revisão e “What to Test”.
   - Comandos previstos (exigem credenciais Apple e App Store Connect):
     ```bash
     npx eas-cli build --profile testflight-staging --platform ios
     npx eas-cli submit --profile testflight-staging --platform ios
     ```
   - O `eas submit` já pode rodar direto, sem prompt de app record.

2. **Conta de revisão da Apple**
   - O TestFlight externo passa por **Beta App Review**. É preciso uma conta de produção **comum, não administradora**, com:
     - e-mail verificado;
     - aceite legal concluído;
     - ao menos uma Praça/comuna e conteúdo para o revisor testar;
     - credenciais enviadas em “Sign-in Information”, sem 2FA.
   - `equipe.demo@popularia.local` é apenas do banco local; **não serve** para produção.

3. **Build iOS atual e teste em aparelho**
   - O build **#11 (1.0.0 build 11)** foi gerado com sucesso em 02/11; IPA: https://expo.dev/artifacts/eas/MT6-WdMWnYJzAYXtILS4UxO1QHQyxTD7X0jJScrWkAA.ipa. O #10 foi substituído por incluir a correção de criação de post e as alturas de linha. Ele já contém o privacy manifest do Sentry, o API host `api.popularia.com.br` e o link origin `popularia.com.br`.
   - Antes de submeter, testar em iPhone físico: login e-mail, Apple, Google, verificação de e-mail, upload de foto/vídeo, PDF, chamado, enquete, biblioteca, denúncia, bloqueio, exclusão de conta, teclado e área segura.

4. **APNs**
   - O IPA do build #9 foi inspecionado: o provisioning profile tem `aps-environment: production`, Team `GUA3RMH4KC` e o entitlement de associated domains. O app está habilitado para push.
   - Ainda falta confirmar a **APNs key do Expo** e testar a entrega real no aparelho; o código de registro e o worker de envio já existem.
   - O build #11 é o atual; o #10 foi enviado por você, mas não contém a correção desta rodada. Envie o #11 ao TestFlight quando for testar. O `eas submit` agora pode rodar non-interactive com o `ascAppId` configurado.

## Como preencher o App Store Connect

As respostas detalhadas de privacidade estão em [app-store-privacy.md](./app-store-privacy.md).

1. **App Information**
   - Privacy Policy URL: `https://popularia.com.br/privacidade`
   - Support URL: `https://popularia.com.br/suporte`
   - Marketing URL (opcional): `https://popularia.com.br/`
   - Categoria: rede social / comunidade; classificação etária 18+.

2. **App Privacy**
   - Declare: e-mail, conteúdo do usuário (posts, comentários, fotos/vídeos/PDFs), identificadores (User ID e push token) e diagnóstico (Sentry: crash, performance, outros diagnósticos).
   - Dados vinculados à identidade: sim. Rastreamento: não. Publicidade: não.

3. **TestFlight → External Testing**
   - Crie o grupo, adicione o build e preencha “What to Test”.
   - “Test Information”: descrição beta, e-mail de feedback, contato e a conta de revisão.
   - A conta de revisão deve ser **comum**, não administradora, com e-mail verificado, termos aceitos e uma Praça com conteúdo.

4. **Beta App Review**
   - Envie o build para revisão; depois aprove e convide o grupo externo.

## Após o deploy

- `https://popularia.com.br/api/v1/health` → 200 (via proxy do site).
- `https://api.popularia.com.br/api/v1/health` → 200 (host direto do backend).
- `https://popularia.com.br/api/v1/topics` → 200.
- AASA → 200 `application/json`.
- Site, Termos, Privacidade e Suporte → 200.
- Backend de produção foi atualizado com as migrações pendentes; o arquivo `Version20261113130000.php` estava com permissão 600 e foi corrigido para 644 antes do deploy.

## Pendências P1

- **APNs**: testar permissão, registro do token e entrega no TestFlight; conferir a chave no EAS.
- **Google OAuth**: confirmar que a tela de consentimento está em produção (ou com os testadores adicionados). Clientes iOS/web estão nos perfis EAS, mas isso não garante o consent screen aberto.
- **Privacy manifests**: Google Sign-In já aparece no IPA com `PrivacyInfo.xcprivacy`. O Sentry é estático e não traz manifest próprio; adicionei `ios.privacyManifests` no `app.json` com crash/performance/outros diagnósticos. Confirme no próximo archive que o relatório do Sentry está preenchido.
- **`npm audit`**: 34 vulnerabilidades moderadas em dependências de produção (e uma alta transitiva em ferramenta de dev). Não bloqueia TestFlight; não rodar `npm audit fix --force` (o npm sugere downgrade do Expo).

### Como configurar APNs no EAS

1. Tenha uma **Apple Push Notifications service key** (`.p8`) criada no Apple Developer → Certificates, Identifiers & Profiles → Keys, com “Apple Push Notifications service (APNs)”.
2. No diretório do app:
   ```bash
   npx eas-cli credentials -p ios
   ```
3. Escolha o perfil `testflight-staging` → configure as credenciais de distribuição → **Push Notifications** → selecione a key `.p8` (Key ID e Team ID `GUA3RMH4KC`).
4. Gere um build novo e teste: abrir **Avisos**, permitir notificações, confirmar o token no backend e enviar um aviso de teste.
5. O backend precisa do worker `app:notifications:deliver` rodando em produção; ele já existe como serviço `worker` no Railway.

### Como confirmar o Google OAuth em produção

1. Google Cloud Console → **APIs & Services → OAuth consent screen**.
2. Confirme o status **In production** (não “Testing”). Em “Testing”, só os test users conseguem entrar.
3. Confira o nome do app, e-mail de suporte, logo, **Privacy Policy URL** e **Terms of Service URL** (use os URLs públicos acima).
4. Em **Credentials**, confirme:
   - OAuth client **iOS** com bundle `com.popularia.mobile`;
   - OAuth client **Web** usado pelo backend;
   - os IDs batem com `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` e `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` no EAS.
5. Teste em um iPhone que não seja seu, com uma conta Google que não esteja na lista de test users.

### Como conferir os privacy manifests no archive

1. Gere o archive iOS (EAS ou Xcode) e abra o **Organizer → Distribute App → Validate App**.
2. No Xcode, use **Product → Archive → Generate Privacy Report**.
3. Confirme que os SDKs Sentry e Google Sign-In aparecem com `PrivacyInfo.xcprivacy` e que as categorias declaradas batem com o App Store Connect (e-mail, conteúdo, identificadores, diagnóstico).
4. Se faltar manifest, atualize o SDK ou adicione um `PrivacyInfo.xcprivacy` via config plugin; não crie `ios/` à mão no fluxo Expo (CNG).

## Configuração iOS observada

- `ios.bundleIdentifier`: `com.popularia.mobile`.
- `ios.usesAppleSignIn`: `true`; `CFBundleURLTypes` inclui scheme próprio e Google.
- `NSPhotoLibraryUsageDescription`: presente; câmera/microfone desabilitados.
- `NSAppTransportSecurity.NSAllowsArbitraryLoads`: `false`.
- `ITSAppUsesNonExemptEncryption`: `false`.
- `UISupportedInterfaceOrientations`: portrait/portrait upside down; `supportsTablet` não habilitado (iPhone).
- `associatedDomains`: `applinks:popularia.com.br` no próximo build; AASA no site, respondendo 200 no host Railway. O host antigo `api.popularia.com.br` continua com AASA para builds antigas.
- Build number gerenciado remotamente (`appVersionSource: remote`, `autoIncrement: true`).

## Checklist de envio

### Antes do build
- [x] Política de Privacidade e Suporte publicados em HTTPS; usar os URLs no App Store Connect.
- [ ] Criar/confirmar o app record `com.popularia.mobile` e o grupo de testadores externos.
- [ ] Criar conta de revisão verificada e aceita; preparar uma Praça com conteúdo.
- [ ] Confirmar APNs do Expo e testar push no aparelho.
- [x] AASA publicado e respondendo 200.
- [x] Sentry com DSN e auth token no EAS.
- [ ] Confirmar Google OAuth em produção.
- [x] “Perto de mim” e “Chamados da semana” ocultos fora do modo demonstração.
- [ ] Preencher “What to Test” e “Beta App Review Information”.

### Build/submit
```bash
npx eas-cli build --profile testflight-staging --platform ios
npx eas-cli submit --profile testflight-staging --platform ios
```
- [ ] Build processado no App Store Connect sem erro de export compliance.
- [ ] TestFlight interno (equipe) aprovado em iPhone físico.
- [ ] Enviar o build #10 ao TestFlight e para Beta App Review.
- [ ] Após aprovação, convidar o grupo externo.

### Beta App Review — sugestão de notas
> Popularia is a community network for neighborhood organizing. The app requires an account. Use the provided account; it is email-verified and has accepted the Terms. You can browse the feed, open Praças, create a text post, poll, or call, upload a photo/PDF, report/block content, and delete the account under Conta → Excluir conta. There are no in-app purchases, ads, or tracking. The app is 18+.

### Privacidade (App Store Connect)
Declarar, no mínimo:
- **Contact Info**: e-mail.
- **User Content**: posts, comments, photos/videos, PDFs and reports.
- **Identifiers**: user ID and push token.
- **Diagnostics**: crash/performance data via Sentry, if enabled.
- **Usage Data**: interactions needed for feed/moderation, if collected.
- **Linked to identity**: yes. **Tracking**: no. **Advertising**: no.
- Exclusão de conta disponível no app.

## O que não foi validado

- Build EAS iOS, archive, App Store Connect, APNs, push real, Google login em aparelho, Apple login em aparelho, universal links, câmera (não usada), fonte ampliada, teclado em iPhone, e a revisão da Apple.
- O backend completo e a carga de produção não foram testados nesta revisão.
