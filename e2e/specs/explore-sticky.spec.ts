import { expect, test, type Page } from '@playwright/test';

import { installApiMock } from '../support/api-mock';
import { signInToFeed, visibleHeading } from '../support/flows';

const SEARCH_LABEL = 'Buscar na Popularia';

function post(id: string) {
  return {
    id,
    body: `Discussão ${id} sobre moradia e transporte na cidade`,
    title: `Discussão ${id}`,
    createdAt: new Date().toISOString(),
    author: { id: `author-${id}`, handle: `autor-${id}`, displayName: 'Ana Linux', avatarUrl: null },
    comuna: { id: 'uuid-hortas', slug: 'hortas', name: 'Hortas', status: 'active' },
    commentCount: 4,
    supportCount: 10,
    echoCount: 2,
    viewer: { isAuthor: false, canComment: true, canDelete: false, canRemove: false },
  };
}

const longPosts = Array.from({ length: 24 }, (_, index) => post(`sticky-${index}`));
const shortPosts = [post('curto-0'), post('curto-1')];

const exploreFixture = {
  topics: [{ id: 'pol', label: 'Política brasileira', shortLabel: 'Política' }],
  comunas: [],
  people: [],
  posts: longPosts.slice(0, 3),
  recentPosts: [],
  next: { comunas: null, people: null, posts: null, events: null, documents: null },
};

async function openExplore(page: Page, posts = longPosts) {
  await installApiMock(page, {}, {
    explore: { ...exploreFixture, posts: posts.slice(0, 3) },
    search: { ...exploreFixture, posts },
  });
  await page.goto('/');
  await signInToFeed(page);
  await page.getByRole('tab', { name: 'Explorar' }).click();
  await expect(visibleHeading(page, 'Explorar')).toBeVisible();
  await expect(page.getByText('Em alta agora', { exact: true })).toBeVisible();
}

function searchBox(page: Page) {
  return page.getByLabel(SEARCH_LABEL).filter({ visible: true }).last();
}

/** O scroller vertical que contém o campo fixo do Explorar (não o feed oculto). */
async function exploreScrollTop(page: Page) {
  return page.evaluate(() => {
    const input = document.querySelector<HTMLElement>('input[aria-label="Buscar na Popularia"]');
    let node = input?.parentElement ?? null;
    while (node) {
      const style = window.getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) return node.scrollTop;
      node = node.parentElement;
    }
    return 0;
  });
}

async function scrollExploreTo(page: Page, offset: number) {
  await page.evaluate((value) => {
    const input = document.querySelector<HTMLElement>('input[aria-label="Buscar na Popularia"]');
    let node = input?.parentElement ?? null;
    while (node) {
      const style = window.getComputedStyle(node);
      if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight) {
        node.scrollTop = value;
        return;
      }
      node = node.parentElement;
    }
  }, offset);
  await expect.poll(() => exploreScrollTop(page)).toBeGreaterThanOrEqual(Math.min(offset, 80));
}

test.describe('Explorar: header fixo e filtros', () => {
  test('troca de resultado curto para longo sem perder os controles fixos', async ({ page }) => {
    await openExplore(page);
    const search = searchBox(page);
    await search.fill('Discussão');
    await expect(page.getByText(/Discussão sticky-0/).filter({ visible: true }).first()).toBeVisible();

    await scrollExploreTo(page, 600);
    expect((await search.boundingBox())!.y).toBeLessThan(60);

    // Comunas não tem itens neste cenário: a lista fica curta e o cabeçalho volta
    // a aparecer por inteiro. A busca continua no mesmo campo, com o mesmo termo.
    await page.getByRole('radio', { name: 'Comunas' }).filter({ visible: true }).last().click();
    await expect.poll(async () => (await search.boundingBox())?.y ?? 0).toBeGreaterThan(80);
    await expect(search).toHaveValue('Discussão');

    // Publicações volta a ter 24 resultados. O scroll pendente só é aplicado
    // quando o novo conteúdo alcança o offset do cabeçalho.
    await page.getByRole('radio', { name: 'Publicações' }).filter({ visible: true }).last().click();
    await expect(page.getByText(/Discussão sticky-0/).filter({ visible: true }).first()).toBeVisible();
    await expect.poll(() => exploreScrollTop(page)).toBeGreaterThan(0);
    expect((await search.boundingBox())!.y).toBeLessThan(60);
    await expect(search).toHaveValue('Discussão');
  });

  test('dataset curto mantém filtros visíveis e utilizáveis', async ({ page }) => {
    await openExplore(page, shortPosts);
    const search = searchBox(page);
    await search.fill('Discussão');
    await page.getByRole('radio', { name: 'Publicações' }).filter({ visible: true }).last().click();

    await expect(page.getByText(/Discussão curto-0/).filter({ visible: true }).first()).toBeVisible();
    await expect(search).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Publicações' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'Tudo' })).toBeVisible();
    expect((await search.boundingBox())!.y).toBeLessThan(200);
  });
});
