import { expect, test, type Page } from '@playwright/test';

import { installApiMock, type MockApiOptions } from '../support/api-mock';
import { signInToFeed } from '../support/flows';

/**
 * POP-34: a Praça usa FlatList invertida. Este spec mede, no Chromium, o que
 * pode ser observado no DOM: posição do trecho lido, ordem das mensagens,
 * células vazias na viewport e o atalho de novas mensagens. Física de rolagem
 * nativa, teclado do sistema e FPS continuam exigindo aparelho.
 */

const MESSAGE_COUNT = 120;
const PAGE_SIZE = 30;
const BADGE = '↓ 1 novas mensagens';

type Message = ReturnType<typeof message>;
type VisibleRow = { label: string; id: number; top: number; height: number };

function message(index: number) {
  const id = `m${String(index).padStart(4, '0')}`;
  const minutesAgo = MESSAGE_COUNT - index;
  return {
    id,
    squareId: 'square-e2e',
    status: 'published' as const,
    body: `Mensagem ${index} com texto suficiente para ocupar duas linhas no histórico da Praça.`,
    author: {
      id: `author-${index % 4}`,
      handle: `pessoa${index % 4}`,
      displayName: `Pessoa ${index % 4}`,
      avatarUrl: null,
    },
    sticker: null,
    replyTo: null,
    reactions: [],
    createdAt: new Date(Date.UTC(2026, 10, 8, 12, 0, 0) - minutesAgo * 60_000).toISOString(),
    editedAt: null,
    revision: 1,
    clientId: null,
    viewer: {
      isAuthor: false,
      canDelete: false,
      canRemove: false,
      canReport: true,
      canReact: true,
      canReply: true,
    },
  };
}

function square(messages: Message[]) {
  return {
    id: 'square-e2e',
    title: 'Praça E2E',
    comuna: { id: 'comuna-e2e', slug: 'e2e', name: 'Comuna E2E', tone: 'red', visibility: 'public', topics: ['tec'] },
    status: 'active',
    closedAt: null,
    version: 1,
    presence: 2,
    unread: 0,
    lastReadId: null,
    lastMessage: messages[0],
    viewer: { canRead: true, isMember: true, canWrite: true, canManage: false, joinRequest: null },
  };
}

function scenario() {
  const messages = Array.from({ length: MESSAGE_COUNT }, (_, index) => message(MESSAGE_COUNT - index));
  const squareFixture = square(messages);
  const options: MockApiOptions = {
    squares: { mine: [squareFixture] },
    square: squareFixture,
    squareMessages: messages,
    squareMessagePageSize: PAGE_SIZE,
  };
  return { options, messages };
}

async function openSquare(page: Page, options: MockApiOptions) {
  await installApiMock(page, {}, options);
  await page.goto('/');
  await signInToFeed(page);
  await page.getByRole('tab', { name: 'Praças' }).click();
  await page.getByLabel('Entrar na Praça Praça E2E').filter({ visible: true }).last().click();
  await expect(page).toHaveURL(/\/praca\/square-e2e$/);
  await expect(page.getByText(/Mensagem 120 com texto/).filter({ visible: true }).last()).toBeVisible();
}

async function listMetrics(page: Page) {
  return page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('[data-testid="square-messages"]');
    if (!list) return null;
    return {
      scrollTop: Math.round(list.scrollTop),
      scrollHeight: Math.round(list.scrollHeight),
      clientHeight: Math.round(list.clientHeight),
    };
  });
}

/** Mensagens cujo rótulo acessível intersecta a viewport, na ordem visual. */
async function visibleMessages(page: Page): Promise<VisibleRow[]> {
  return page.evaluate(() => {
    const list = document.querySelector<HTMLElement>('[data-testid="square-messages"]');
    if (!list) return [];
    const bounds = list.getBoundingClientRect();
    return Array.from(list.querySelectorAll<HTMLElement>('[aria-label^="Pessoa"]'))
      .map((element) => {
        const label = element.getAttribute('aria-label') ?? '';
        const rect = element.getBoundingClientRect();
        return { label, id: Number(/Mensagem (\d+)/.exec(label)?.[1] ?? -1), top: Math.round(rect.top - bounds.top), height: Math.round(rect.height) };
      })
      .filter(({ height, top }) => height > 0 && top + height > 0 && top < bounds.height)
      .sort((left, right) => left.top - right.top);
  });
}

async function setScroll(page: Page, value: number) {
  await page.evaluate((offset) => {
    const list = document.querySelector<HTMLElement>('[data-testid="square-messages"]');
    if (list) list.scrollTop = offset;
  }, value);
  await page.waitForTimeout(250);
}

/**
 * Clica no rodapé sem o auto-scroll do Playwright. Um clique normal levaria a
 * lista até o botão antes de carregar, mascarando a preservação de posição.
 */
async function clickOlderWithoutScroll(page: Page) {
  await expect(page.getByText('Mensagens anteriores').last()).toBeAttached();
  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll<HTMLElement>('[role="button"]'))
      .find((element) => element.textContent?.trim() === 'Mensagens anteriores');
    button?.click();
  });
}

function gaps(rows: VisibleRow[]) {
  return rows.slice(1).map((row, index) => row.top - (rows[index].top + rows[index].height));
}

function expectContiguous(rows: VisibleRow[]) {
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.map((row) => row.id)).toEqual(rows.map((_, index) => rows[0].id + index));
  expect(gaps(rows).every((gap) => Math.abs(gap) <= 2)).toBe(true);
}

test.describe('Praça: chat invertido', () => {
  test('mensagens numerosas e prepend preservam a posição sem células em branco', async ({ page }) => {
    const { options } = scenario();
    await openSquare(page, options);

    expect((await listMetrics(page))?.scrollTop).toBe(0);
    expectContiguous(await visibleMessages(page));

    await setScroll(page, 1_500);
    const before = await listMetrics(page);
    const anchor = (await visibleMessages(page))[0];
    expectContiguous(await visibleMessages(page));

    await clickOlderWithoutScroll(page);
    await expect.poll(async () => (await listMetrics(page))?.scrollHeight ?? 0)
      .toBeGreaterThan((before?.scrollHeight ?? 0) + 300);

    const after = await listMetrics(page);
    const afterRows = await visibleMessages(page);
    expect(after?.scrollTop).toBe(before?.scrollTop);
    expect(afterRows[0]).toMatchObject({ id: anchor.id, top: anchor.top });
    expectContiguous(afterRows);
  });

  test('nova mensagem fora do fim não desloca a leitura e o atalho leva às recentes', async ({ page }) => {
    const { options } = scenario();
    await openSquare(page, options);
    await setScroll(page, 1_500);

    const anchor = (await visibleMessages(page))[0];
    const heightBefore = (await listMetrics(page))?.clientHeight;
    options.squareMessages?.unshift(message(121));
    await expect(page.getByText(BADGE).filter({ visible: true }).last()).toBeVisible({ timeout: 15_000 });

    // O atalho é uma sobreposição: se entrasse no fluxo, a viewport encolheria
    // 52 px e o trecho lido sairia do lugar.
    expect((await listMetrics(page))?.clientHeight).toBe(heightBefore);
    expect((await visibleMessages(page))[0]).toMatchObject({ id: anchor.id, top: anchor.top });
    await expect(page.getByLabel(/Mensagem 121/)).toHaveCount(0);

    await page.getByText(BADGE).filter({ visible: true }).last().click();
    await expect(page.getByText(/Mensagem 121 com texto/).filter({ visible: true }).last()).toBeVisible();
    await expect.poll(async () => (await listMetrics(page))?.scrollTop ?? -1).toBe(0);
    await expect(page.getByText(BADGE).filter({ visible: true })).toHaveCount(0);
    expectContiguous(await visibleMessages(page));

    options.squareMessages?.unshift(message(122));
    await expect(page.getByText(/Mensagem 122 com texto/).filter({ visible: true }).last()).toBeVisible({ timeout: 15_000 });
    expect((await listMetrics(page))?.scrollTop).toBe(0);
    const rows = await visibleMessages(page);
    expectContiguous(rows);
    expect(rows.at(-1)?.id).toBe(122);
  });

  test('rolagem rápida mantém as células da viewport renderizadas', async ({ page }) => {
    const { options } = scenario();
    await openSquare(page, options);

    const samples = await page.evaluate(async () => {
      const list = document.querySelector<HTMLElement>('[data-testid="square-messages"]');
      if (!list) return [];
      const max = list.scrollHeight - list.clientHeight;
      const collected: { rows: number; maxGap: number }[] = [];
      const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
      for (let step = 0; step <= 30; step += 1) {
        list.scrollTop = Math.round((max * step) / 30);
        await frame();
        const bounds = list.getBoundingClientRect();
        const rects = Array.from(list.querySelectorAll<HTMLElement>('[aria-label^="Pessoa"]'))
          .map((element) => element.getBoundingClientRect())
          .filter((rect) => rect.height > 0 && rect.bottom > bounds.top && rect.top < bounds.bottom)
          .sort((left, right) => left.top - right.top);
        const rowGaps = rects.slice(1).map((rect, index) => rect.top - rects[index].bottom);
        collected.push({ rows: rects.length, maxGap: Math.round(Math.max(0, ...rowGaps)) });
      }
      return collected;
    });

    expect(samples).toHaveLength(31);
    expect(samples.every((sample) => sample.rows > 0)).toBe(true);
    expect(Math.max(...samples.map((sample) => sample.maxGap))).toBeLessThanOrEqual(2);
  });

  test('focar e digitar no composer não move o histórico', async ({ page }) => {
    const { options } = scenario();
    await openSquare(page, options);
    await setScroll(page, 1_500);

    const before = await listMetrics(page);
    const anchor = (await visibleMessages(page))[0];
    const composer = page.getByLabel('Conversar na praça');
    await composer.click();
    await composer.fill('Rascunho durante a leitura do histórico');
    expect((await listMetrics(page))?.scrollTop).toBe(before?.scrollTop);
    expect((await visibleMessages(page))[0]).toMatchObject({ id: anchor.id, top: anchor.top });
  });
});
