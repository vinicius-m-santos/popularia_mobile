# Popularia — prontidão para TestFlight externo (iOS)

**Data:** 04/11/2026  
**Escopo:** app Expo/React Native, configuração iOS, fluxos sensíveis à revisão da Apple, backend de produção e operação de TestFlight.  
**Veredito curto:** app, backend e worker de push estão **no ar em produção**, e o build **#15** já foi enviado ao App Store Connect. Falta a parte operacional do TestFlight externo — grupo, “What to Test”, conta de revisão, APNs e validação no aparelho.

## Estado em 04/11/2026

- **Build #15 (1.0.0)** gerado do HEAD `d524abc` com o perfil `production`; conclusão às 14:35. IPA: https://expo.dev/artifacts/eas/ULB6SLMOHM61eha5F6RMvWxlP94cxsuGzxKHMr1CqCE.ipa
- **Submissão EAS** do #15 concluída; processamento no App Store Connect e disponibilidade no TestFlight ainda não foram conferidos.
- **Backend de produção** atualizado para o código de `113347d` (deployment `dac394a3`, SUCCESS). A migration `Version20261115120000` foi aplicada (cadastro social pendente e versões legais).
- **Worker de push em produção** ativo: serviço `notifications-worker`, cron `*/5 * * * *`, executando `app:notifications:deliver` a cada 5 minutos.
- `tsc --noEmit` e `expo lint` passam; Jest **86 suítes / 498 testes**; Playwright **23 passando, 1 skip**.
- URLs públicos, AASA, Termos, Privacidade, Suporte e health da API respondem **200**.
- Bundle iOS `com.popularia.mobile`, projeto EAS `6e964283-951f-4a16-bf99-5a4d5236a338`; app record `6827749427`.
- Ícone 1024 × 1024 sem alpha; splash configurada; `ITSAppUsesNonExemptEncryption: false`; ATS restrito a HTTPS.
- Sem permissões de câmera, microfone, localização ou contatos. A única permissão sensível é a fototeca.
- **Sign in with Apple** implementado e entitlement configurado; Google também disponível (regra 4.8 coberta).
- **Exclusão de conta** no app, incluindo revogação Apple/Google.
- **UGC**: denúncia de post/comentário/perfil/comuna, bloqueio de pessoas, fila de moderação e aceite legal/idade no cadastro.

## O que foi resolvido nesta rodada

1. **Backend de produção atrás do app** — produção ainda não tinha os endpoints de 04/11. O deploy foi feito e agora respondem:
   - `POST /auth/social/complete` → 422 de validação (rota existe; antes era 404);
   - `GET /handles/suggestion` → 200;
   - `GET /handles/{handle}/availability` → 200;
   - `GET /api/v1/health` → 200 `{"status":"ok","database":"ok"}`.
   A migration pendente foi aplicada no start do container.

2. **Worker de push em produção** — antes só existia em staging. O serviço `notifications-worker` usa a mesma imagem do backend (Dockerfile, alvo `prod`), roda em cron a cada 5 minutos e lê `APP_ENV=prod`, `DATABASE_URL`, `APP_SECRET` e Sentry por referência às variáveis do serviço `backend`. As execuções de 15:20 e 15:25 retornaram `Notificações processadas: 0`, confirmando conexão com o banco e fila vazia.

3. **Build atual** — o #15 substitui o #14 e contém o onboarding em duas etapas, aceite legal, cadastro social pendente, Sobre e legal/Licenças e a suíte E2E. A submissão foi feita pelo perfil `production` (API de produção, nome “Popularia”, Sentry `production`).

4. **Verificações** — typecheck, lint, Jest e Playwright passaram. O `expo-doctor` acusa **1 check falhando**: 9 pacotes com patch/minor atrás do SDK 58 (`expo`, `expo-router`, `expo-notifications`, `react-native-safe-area-context` etc.). Não bloqueia o #15; alinhar antes do próximo build.

## Pendências P0

1. **App Store Connect + TestFlight externo**
   - O app record é `6827749427`; ainda faltam o grupo de testadores externos, “Test Information”, contato de revisão e “What to Test”.
   - Confirmar que o #15 terminou o processamento sem erro de export compliance e adicioná-lo ao grupo.
   - Depois: enviar para **Beta App Review** e, aprovado, convidar o grupo externo.

2. **Conta de revisão da Apple**
   - O TestFlight externo passa por Beta App Review. É preciso uma conta de produção **comum, não administradora**, com:
     - e-mail verificado;
     - aceite legal concluído;
     - ao menos uma Praça/comuna e conteúdo para o revisor testar;
     - credenciais em “Sign-in Information”, sem 2FA.
   - `equipe.demo@popularia.local` é apenas do banco local; **não serve** para produção.

3. **Validação do #15 em iPhone físico**
   - Login e-mail, Apple e Google; verificação de e-mail; upload de foto/vídeo; PDF; chamado; enquete; biblioteca; denúncia; bloqueio; exclusão de conta; teclado e área segura.
   - TestFlight interno da equipe é o primeiro gate; não declarar validação em aparelho sem aparelho.

4. **APNs**
   - O app está habilitado para push e o worker de produção está ativo, mas a **entrega real** ainda não foi observada.
   - Falta confirmar a APNs key no EAS, permitir notificações em Avisos no #15 e verificar o token no backend e o recebimento no aparelho.

## Pendências P1

- **Google OAuth**: confirmar o consent screen em produção (não “Testing”). Os client IDs nos perfis EAS não provam que a tela está pública.
- **Privacy manifests**: confirmar no archive do #15 que Sentry e Google Sign-In trazem `PrivacyInfo.xcprivacy` e que as categorias batem com o App Store Connect.
- **Textos legais e operação**: os documentos estão publicados, mas a revisão jurídica e a definição de quem atende suporte/denúncias durante a beta continuam pendentes.
- **`npm audit`**: 34 vulnerabilidades moderadas em dependências de produção e uma alta transitiva de tooling. Não bloqueia TestFlight; não rodar `npm audit fix --force`.
- **Documentação**: `docs/privacy-policy-beta.md` ainda é um rascunho com placeholders; a versão publicada no site é a fonte para a loja.

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
   - Crie o grupo, adicione o build #15 e preencha “What to Test”.
   - “Test Information”: descrição beta, e-mail de feedback, contato e a conta de revisão.
   - A conta de revisão deve ser **comum**, não administradora, com e-mail verificado, termos aceitos e uma Praça com conteúdo.

4. **Beta App Review**
   - Envie o build para revisão; depois aprove e convide o grupo externo.

## Operação de produção

### Backend

```bash
# a partir de popularia_backend, com a main limpa
railway up --service backend --environment production --detach \
  -m "chore(prod): deploy <commit>"
```

O start do container aplica migrations e limpa cadastros sociais expirados antes de subir o FrankenPHP. Depois do deploy, conferir:

- `https://api.popularia.com.br/api/v1/health` → 200;
- `https://popularia.com.br/privacidade`, `/suporte`, `/termos` → 200;
- `https://popularia.com.br/.well-known/apple-app-site-association` → 200 `application/json`.

### Worker de push

- Serviço: `notifications-worker` (produção), mesmo repositório/imagem do backend.
- Comando: `php -d memory_limit=512M bin/console app:notifications:deliver --no-debug`.
- Cron: `*/5 * * * *` (a Railway tem granularidade mínima de 5 minutos).
- Configuração versionada em `popularia_backend/railway.worker.toml`.
- Variáveis: `APP_ENV=prod`, `APP_SECRET`, `DATABASE_URL`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` e `TRUSTED_PROXIES` por referência ao serviço `backend`.
- Log esperado a cada execução: `[OK] Notificações processadas: N; envios tentados: …; recibos consultados: …`.
- Se ativar a segurança de envio do Expo, definir `EXPO_PUSH_ACCESS_TOKEN` no backend **e** no worker.

### Configurar APNs no EAS

1. Tenha uma **Apple Push Notifications service key** (`.p8`) no Apple Developer → Keys, com “Apple Push Notifications service (APNs)”.
2. No diretório do app:
   ```bash
   npx eas-cli credentials -p ios
   ```
3. Escolha o perfil `testflight-staging` (ou `production`) → credenciais de distribuição → **Push Notifications** → selecione a key `.p8` (Key ID e Team ID `GUA3RMH4KC`).
4. Gere um build novo, abra **Avisos** no aparelho, permita notificações e confirme o token no backend.
5. Envie um aviso de teste e confira a execução do `notifications-worker` no Railway.

### Confirmar o Google OAuth em produção

1. Google Cloud Console → **APIs & Services → OAuth consent screen**.
2. Confirme o status **In production** (não “Testing”).
3. Confira nome, e-mail de suporte, logo, **Privacy Policy URL** e **Terms of Service URL**.
4. Em **Credentials**, confirme os clientes iOS (`com.popularia.mobile`) e Web usados pelo backend, com os IDs dos perfis EAS.
5. Teste em um iPhone que não seja seu, com uma conta Google fora da lista de test users.

### Conferir os privacy manifests no archive

1. Gere o archive iOS (EAS ou Xcode) e abra **Organizer → Distribute App → Validate App**.
2. No Xcode, use **Product → Archive → Generate Privacy Report**.
3. Confirme Sentry e Google Sign-In com `PrivacyInfo.xcprivacy` e categorias iguais às do App Store Connect.
4. Se faltar manifest, atualize o SDK ou adicione via config plugin; não crie `ios/` à mão no fluxo Expo (CNG).

## Configuração iOS observada

- `ios.bundleIdentifier`: `com.popularia.mobile`.
- `ios.usesAppleSignIn`: `true`; `CFBundleURLTypes` inclui scheme próprio e Google.
- `NSPhotoLibraryUsageDescription`: presente; câmera/microfone desabilitados.
- `NSAppTransportSecurity.NSAllowsArbitraryLoads`: `false`.
- `ITSAppUsesNonExemptEncryption`: `false`.
- `UISupportedInterfaceOrientations`: portrait/portrait upside down; `supportsTablet` não habilitado (iPhone).
- `associatedDomains`: `applinks:popularia.com.br`; AASA no site respondendo 200.
- Build number gerenciado remotamente (`appVersionSource: remote`, `autoIncrement: true`).

## Checklist de envio

### Antes do build
- [x] Política de Privacidade e Suporte publicados em HTTPS.
- [x] AASA publicado e respondendo 200.
- [x] Sentry com DSN e auth token no EAS.
- [x] “Perto de mim” e “Chamados da semana” ocultos fora do modo demonstração.
- [x] Backend de produção com os endpoints de 04/11 e migrations aplicadas.
- [x] Worker de push rodando em produção.
- [ ] Confirmar Google OAuth em produção.
- [ ] Revisão jurídica dos textos publicados.
- [ ] Preencher “What to Test” e “Beta App Review Information”.

### Build/submit
```bash
npx eas-cli build --profile testflight-staging --platform ios
npx eas-cli submit --profile testflight-staging --platform ios
```
- [x] Build #15 gerado e submetido (perfil `production`).
- [ ] Build processado no App Store Connect sem erro de export compliance.
- [ ] TestFlight interno (equipe) aprovado em iPhone físico.
- [ ] Build #15 enviado à Beta App Review.
- [ ] Após aprovação, convidar o grupo externo.

### Beta App Review — sugestão de notas
> Popularia is a community network for neighborhood organizing. The app requires an account. Use the provided account; it is email-verified and has accepted the Terms. You can browse the feed, open Praças, create a text post, poll, or call, upload a photo/PDF, report/block content, and delete the account under Conta → Excluir conta. There are no in-app purchases, ads, or tracking. The app is 18+.

### Privacidade (App Store Connect)
Declarar, no mínimo:
- **Contact Info**: e-mail.
- **User Content**: posts, comments, photos/videos, PDFs and reports.
- **Identifiers**: user ID and push token.
- **Diagnostics**: crash/performance data via Sentry.
- **Usage Data**: interactions needed for feed/moderation, if collected.
- **Linked to identity**: yes. **Tracking**: no. **Advertising**: no.
- Exclusão de conta disponível no app.

## O que não foi validado

- Processamento do #15 no App Store Connect, instalação via TestFlight, revisão da Apple e teste em iPhone físico.
- APNs real, push ponta a ponta, Google login e Apple login em aparelho.
- Universal links no aparelho, fonte ampliada, teclado em iPhone e gestos.
- Carga e comportamento do backend sob uso real; o worker foi verificado com a fila vazia.
