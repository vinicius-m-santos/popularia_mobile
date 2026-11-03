# Domínio popularia.com.br — site + API separada

**Decisão final:**  
- site e páginas legais em **https://popularia.com.br**;  
- API continua em **https://api.popularia.com.br/api/v1**;  
- **não** existe API em `https://popularia.com.br/api/v1`.

## Arquitetura

```text
popularia.com.br        → Railway service `site` (nginx + páginas legais + AASA)
www.popularia.com.br    → redireciona para popularia.com.br
api.popularia.com.br    → Railway service `backend` (API Symfony)
```

O AASA fica no site, em `https://popularia.com.br/.well-known/apple-app-site-association`. O app usa `applinks:popularia.com.br` para compartilhar links, mas continua chamando a API em `api.popularia.com.br`.

## DNS

No painel do domínio (Cloudflare ou registrador):

| Tipo | Nome | Valor | Proxy |
| --- | --- | --- | --- |
| CNAME | `@` | `btvupp84.up.railway.app` | DNS only |
| TXT | `_railway-verify` | `railway-verify=c572cb5ee327d2394f00101b67ac0b97d415ec5643c16e9c7056a422b0102265` | — |
| CNAME | `www` | `inl13ll3.up.railway.app` | DNS only |
| TXT | `_railway-verify.www` | `railway-verify=739440a9444e0e7de10f6dadef5ed0653b835bbc6dda1c9b5403d54a8c74f66a` | — |

- No Cloudflare, `@` usa **CNAME flattening**. O certificado do Railway já está válido; o proxy laranja pode ficar ligado no site (SSL/TLS em **Full (strict)**). Para `api`, veja a observação sobre uploads abaixo.
- **Não altere o registro de `api`**; ele continua no backend.
- Confira:
  ```bash
  cd /home/vini/projects/popularia-site
  railway domain status popularia.com.br --service site --environment production
  railway domain status www.popularia.com.br --service site --environment production
  ```

## O que está configurado

- `popularia-site/nginx.conf`: serve o site, redireciona `www` para o apex, serve o AASA como `application/json` e responde **404** em `/api/`.
- `popularia-site/index.html`: a lista de espera chama `https://api.popularia.com.br/api/v1`.
- `popularia-site/Dockerfile`: inclui Termos, Privacidade, Suporte e AASA.
- Backend `CORS_ALLOW_ORIGIN`: permite `https://popularia.com.br`, `https://www.popularia.com.br` e o host Railway do site; necessário para a lista de espera no navegador.
- `popularia_mobile/app.config.js`: produção usa API `https://api.popularia.com.br/api/v1` e link origin `https://popularia.com.br`; o associated domain é `popularia.com.br`.
- EAS `production`:
  - `EXPO_PUBLIC_API_URL=https://api.popularia.com.br/api/v1`
  - `EXPO_PUBLIC_LINK_ORIGIN=https://popularia.com.br`

## Depois do DNS

```bash
curl -i https://popularia.com.br/
curl -i https://popularia.com.br/privacidade
curl -i https://popularia.com.br/suporte
curl -i https://popularia.com.br/.well-known/apple-app-site-association
curl -i https://api.popularia.com.br/api/v1/health
```

Esperado: site 200, AASA 200 `application/json`, `/api/` no site 404, health da API 200.

## Build e App Store

1. Gere um **build novo** (o build antigo ainda usa o link origin/associated domain antigos).
2. Teste um link `https://popularia.com.br/p/...` em um iPhone com o app instalado; deve abrir o app.
3. No App Store Connect:
   - Privacy Policy: `https://popularia.com.br/privacidade`
   - Support: `https://popularia.com.br/suporte`
   - Marketing: `https://popularia.com.br`
4. No Google Cloud Console, adicione `popularia.com.br` aos domínios autorizados; use as URLs novas no consent screen.
5. Confirme os client IDs do Google usados pelo app e pelo backend.

## Observações

- `api.popularia.com.br` continua sendo o host direto do backend; não há proxy `/api` no site.
- O AASA antigo em `api.popularia.com.br` continua no ar para builds antigas.
- O e-mail público das páginas ainda é `vinicius.m.dos.s@gmail.com`; troque quando configurar um endereço `@popularia.com.br`.
- **Cloudflare + API:** o plano Free/Pro limita o corpo da requisição a 100 MB. O app aceita vídeo de até 100 MB, então um arquivo no limite pode falhar com multipart. Para manter o proxy no `api`, reduza o limite do vídeo para ~90 MB; para manter 100 MB, deixe `api` como **DNS only**. Não ative “Under Attack”/Bot Fight no host da API sem testar o app.
