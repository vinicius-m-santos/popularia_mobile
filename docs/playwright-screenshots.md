# Capturas de tela com Playwright — guia operacional

Data: 31/10/2026. Escopo: ferramenta de revisão visual. Nenhuma alteração de produto.

Este é o processo usado para revisar Perfil, Praça, Conta, Interesses, Progresso e Comuna no
navegador. Ele assume que o backend local está no ar e que o app tem uma conta de demonstração
semeada. **Não substitui** teste no aparelho: teclado, gestos, acessibilidade e fonte ampliada
continuam pendentes no device.

Antes de começar, leia `AGENTS.md`, `CLAUDE.md` e `docs/parallel-work.md`.

## 1. Pré-requisitos

- Worktree com `node_modules` instalado e backend local em `http://localhost:8080`.
- Playwright instalado no projeto (`@playwright/test`) e o Chromium do Playwright no cache.
- O Chromium do Playwright precisa de `libnspr4` e `libnss3`. Em Ubuntu/WSL, elas podem não estar
  no sistema. Não instale como root: baixe e extraia dentro da worktree.

```bash
# 1. Descubra o executável do Chromium
node -e "console.log(require('@playwright/test').chromium.executablePath())"

# 2. Baixe as bibliotecas que o Chromium pede (não precisa de root)
mkdir -p .cache-pw/debs .cache-pw/libs
cd .cache-pw/debs
apt-get download libnspr4 libnss3
for f in *.deb; do dpkg-deb -x "$f" ../libs; done
cd ../..

# 3. Confira que não falta nenhuma biblioteca
LD_LIBRARY_PATH="$PWD/.cache-pw/libs/usr/lib/x86_64-linux-gnu" \
  ldd "$(node -e "console.log(require('@playwright/test').chromium.executablePath())")" \
  | grep 'not found' || echo 'deps ok'
```

O `LD_LIBRARY_PATH` precisa existir **no processo que lança o Playwright**, não só no shell do
`ldd`:

```bash
export LD_LIBRARY_PATH="$PWD/.cache-pw/libs/usr/lib/x86_64-linux-gnu"
```

Se o `apt-get download` falhar por rede, tente de novo com `apt-get update` ou use
`npx playwright install-deps` em uma máquina onde você possa usar root. Não versione
`.cache-pw/`: ele contém lixo de execução.

## 2. Um Metro por vez

A captura precisa de **um** Metro desta worktree. Antes de subir:

```bash
ss -ltnp | grep ':8081' || true
ps -eo pid,cmd | grep -E 'expo start|metro' | grep -v grep || true
```

Se a 8081 estiver ocupada, descubra de qual worktree é o processo. Se for de **outra**
worktree, não derrube sem autorização: siga `docs/parallel-work.md` e peça para parar. Se for
desta worktree, aproveite o Metro existente. Nunca suba um segundo Metro por conveniência.

Subida recomendada, com heap limitado e API apontando para o backend local:

```bash
NODE_OPTIONS=--max-old-space-size=1024 \
EXPO_PUBLIC_API_URL=http://localhost:8080/api/v1 \
EXPO_PUBLIC_LINK_ORIGIN=http://localhost:8080 \
npx expo start --web --port 8081
```

Espere a página responder:

```bash
for i in $(seq 1 40); do
  code=$(curl -s -o /dev/null -w '%{http_code}' http://localhost:8081/ || true)
  [ "$code" = "200" ] && { echo ready; break; }
  sleep 2
done
```

Observação: um Metro já em execução pode ter sido iniciado com o `.env` da worktree (por
exemplo, `EXPO_PUBLIC_API_URL=http://192.168.x.x:8080/api/v1`). As capturas não dependem de
localhost se o backend estiver acessível; confirme no login. A interceptação da seção 4
funciona nos dois casos.

## 3. Login e navegação

Conta de demonstração semeada no backend local:

```text
e-mail: equipe.demo@popularia.local
senha:  demo-somente-local
```

Fluxo:

1. Abra `http://localhost:8081/`.
2. Espere ~5 s.
3. Clique em **Já tenho conta**.
4. Preencha os dois inputs e clique em **Entrar**.
5. Se aparecer a tela de boas-vindas, clique em **Continuar para o aplicativo**.
6. Navegue pelas abas por `role=tab` (`Perfil`, `Praças`, `Explorar`, `Início`).

No web a sessão não é persistida. Cada execução do Playwright começa do zero e precisa fazer
login. Reaproveite a mesma página dentro de uma execução para tirar várias telas.

## 4. Interceptação de API (obrigatória para o web)

O `expo-video` web não implementa `generateThumbnailsAsync`. Um anexo de vídeo no feed derruba
a tela com o error boundary. Para revisar as telas, remova os anexos de vídeo **somente na
resposta interceptada**, sem tocar no backend:

```js
function stripVideo(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(stripVideo); return; }
  if (node.attachment && node.attachment.type === 'video') node.attachment = null;
  if (node.media && node.media.type === 'video') node.media = null;
  for (const value of Object.values(node)) stripVideo(value);
}

await page.route('**/api/v1/**', async (route) => {
  try {
    const response = await route.fetch();
    const contentType = response.headers()['content-type'] || '';
    if (!contentType.includes('json')) return route.fulfill({ response });
    const body = await response.json();
    stripVideo(body);
    await route.fulfill({ response, json: body });
  } catch {
    await route.continue();
  }
});
```

Esse mesmo interceptador permite estados sem mexer no banco:

- vazio de publicações: responder `{ "items": [], "nextCursor": null }` para
  `**/users/*/posts`.
- vazio de comunas do perfil: idem para `**/me/comunas`.
- listas longas de select: use os países reais; role a lista até o fim.

Para abrir uma folha de denúncia de uma **outra pessoa**, quando o seed só tem conteúdo do
próprio usuário, troque `author` e `viewer` na resposta interceptada. Não faça isso no backend
compartilhado.

## 5. Script base

Salve o script em `.cache-pw/*.cjs` (ignorado localmente) ou rode por heredoc. Não coloque
credenciais em arquivo versionado.

```js
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-crash-reporter',
      '--disable-breakpad',
    ],
    env: {
      ...process.env,
      LD_LIBRARY_PATH: `${process.env.PWD}/.cache-pw/libs/usr/lib/x86_64-linux-gnu`,
    },
  });

  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1,
  });

  const btn = (name) =>
    page.getByRole('button', { name }).filter({ visible: true }).last();
  const tab = (name) =>
    page.getByRole('tab', { name }).filter({ visible: true }).last();
  const shot = async (name) => {
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `.cache-pw/prints/${name}.png` });
    console.log('SHOT', name);
  };

  try {
    await page.goto('http://localhost:8081/', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    await page.waitForTimeout(5000);

    await btn(/tenho conta/i).click();
    await page.waitForTimeout(2000);
    const inputs = page.locator('input');
    await inputs.nth(0).fill('equipe.demo@popularia.local');
    await inputs.nth(1).fill('demo-somente-local');
    await btn('Entrar').click();
    await page.waitForTimeout(6500);
    await btn(/Continuar para o aplicativo/i).click();
    await page.waitForTimeout(5000);

    await tab('Perfil').click();
    await page.waitForTimeout(2500);
    await shot('perfil-390');

    // Exemplo: abrir uma comuna pelo card da aba Comunas
    await tab('Comunas').click();
    await page.waitForTimeout(2000);
    await page
      .getByText('Tarifa Zero BH', { exact: true })
      .filter({ visible: true })
      .last()
      .click();
    await page.waitForTimeout(3000);
    await shot('comuna-390');
  } finally {
    await browser.close();
  }
})();
```

Execução:

```bash
LD_LIBRARY_PATH="$PWD/.cache-pw/libs/usr/lib/x86_64-linux-gnu" \
  node .cache-pw/nome-do-script.cjs
```

Use `waitUntil: 'domcontentloaded'`. **Não use `networkidle`**: o app mantém websocket/HMR e a
navegação nunca fica ociosa. Prefira esperar elementos ou um `waitForTimeout` curto.

## 6. Convenções de captura

- Viewport padrão: **390 × 844**. Repita as telas mais densas em **360 × 800** e, quando
  testar empilhamento de ações, **320 × 720**.
- Nome do arquivo: `tela-390.png`, `tela-360.png`, `sheet-foto.png`, `comuna-opcoes.png`.
  Prefixos ajudam a ordenar: `f01-`, `n01-`, `c01-`.
- Pasta: `.cache-pw/prints/`. O `.cache-pw/.gitignore` com `*` mantém isso fora do Git.
- Antes de cada captura, espere ~1,2 s para imagens e fontes entrarem.
- Tire uma captura por estado: topo, depois de rolar, aba vazia, folha aberta, erro/retry.
- Para rolar: `page.mouse.move(195, 500); await page.mouse.wheel(0, 500)`.
- Para tabs use `role=tab`; para cards e ações use `role=button`/texto com
  `.filter({ visible: true })`.
- O DOM mantém telas de abas anteriores montadas. Por isso os helpers usam
  `.filter({ visible: true }).last()`; sem isso o seletor pega um botão do feed escondido.
- Textos com `text-transform` continuam com o valor original no DOM; use o texto tal como está
  no código.
- Emojis aparecem como quadrados no Chromium headless quando falta fonte. Isso é do ambiente,
  não do app. Anote no relatório.

## 7. Estados e folhas úteis

- **Folha de foto/capa/marca**: Perfil → botão da câmera; confira confirmar colorido e cancelar
  com borda.
- **Folha da Praça**: Praças → card → `Opções da Praça`.
- **Opções da comuna**: Perfil → Comunas → card → três pontinhos.
- **Denúncia de mensagem**: segure uma mensagem (`locator.click({ delay: 800 })`) → “Mais ações”
  → “Denunciar”.
- **Denúncia de conteúdo**: “Mais opções” do post → “Denunciar” → escolha o motivo.
- **Select de país/estado/cidade**: Conta → Meus dados → campo; role até o fim para provar que
  a lista alcança a última opção.
- **Vazio**: intercepte as rotas da seção 4 e recarregue a mesma aba; não altere dados.

## 8. Limpeza

Sempre feche o browser no `finally`. Depois:

```bash
# confirme que o Metro não ficou órfão
ss -ltnp | grep ':8081' || true

# remova apenas o que é descartável; mantenha os prints
rm -rf .cache-pw/libs .cache-pw/debs .cache-pw/*.cjs

# memória
free -h
```

Não deixe um segundo Metro, Chromium ou Jest rodando em paralelo. A combinação de captura é
**um Metro + um Chromium**; não rode a suíte Jest nesse momento. Se o Metro foi iniciado por
outra sessão, não o mate sem autorização.

## 9. Checklist antes de mandar para revisão

- [ ] `npx tsc --noEmit` e `npx expo lint` passaram na worktree.
- [ ] Testes focados rodaram com `NODE_OPTIONS=--max-old-space-size=512 ... --runInBand`
  (e `--forceExit` só quando um handle de teste conhecido impedir o encerramento).
- [ ] Prints de topo, rolagem, folha aberta e estado vazio/erro das telas tocadas.
- [ ] 390 e 360; 320 quando o layout empilha ações.
- [ ] Nenhuma rota/dado de produção alterado; interceptação só no browser.
- [ ] Limitações declaradas: web não valida teclado, gestos, acessibilidade ou fonte ampliada.
- [ ] Metro fechado (ou explicitamente pertencente a outra sessão) e memória livre.
