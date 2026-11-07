import { expect, test, type Page } from '@playwright/test';

import { installApiMock } from '../support/api-mock';
import { signInToFeed, visibleHeading } from '../support/flows';

function profilePost(index: number) {
  const id = `profile-scroll-${index}`;
  const withImage = index % 6 === 0;
  return {
    id,
    body: `Publicação ${index} do perfil com texto suficiente para rolar a lista por vários cartões.`,
    createdAt: new Date(Date.UTC(2026, 10, 2, 12, 0, 0) - index * 60_000).toISOString(),
    author: { id: 'me', handle: 'equipe.demo', displayName: 'Equipe Demo', avatarUrl: null },
    comuna: null,
    commentCount: 0,
    supportCount: 0,
    echoCount: 0,
    viewer: { isAuthor: true, canComment: true, canDelete: true, canRemove: false },
    ...(withImage ? {
      media: {
        id: `media-${id}`,
        type: 'image',
        mimeType: 'image/png',
        byteSize: 68,
        width: 1200,
        height: 800,
        durationMs: null,
        url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgwJ/lY3nWQAAAABJRU5ErkJggg==',
      },
    } : {}),
  };
}

const posts = Array.from({ length: 24 }, (_, index) => profilePost(index));

async function openProfile(page: Page) {
  await installApiMock(page, {}, { profilePosts: posts, feedItems: posts, feedPageSize: 12 });
  await page.goto('/');
  await signInToFeed(page);
  await page.getByRole('tab', { name: 'Perfil' }).click();
  await expect(visibleHeading(page, /Equipe Demo/i)).toBeVisible();
  await expect(page.getByText(/^Publicação 0 do perfil/).filter({ visible: true }).last()).toBeVisible();
}

/** O scroller da lista do perfil; o feed continua montado e não deve ser confundido. */
async function profileScrollTop(page: Page) {
  return page.evaluate(() => {
    const scroller = Array.from(document.querySelectorAll<HTMLElement>('div'))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return /(auto|scroll)/.test(style.overflowY)
          && element.scrollHeight > element.clientHeight + 20
          && Array.from(element.querySelectorAll('[role="tab"]')).some((tab) => tab.textContent?.trim() === 'Publicações');
      })
      .sort((left, right) => right.scrollHeight - left.scrollHeight)[0];
    return scroller?.scrollTop ?? 0;
  });
}

async function setProfileScroll(page: Page, offset: number) {
  await page.evaluate((value) => {
    const scroller = Array.from(document.querySelectorAll<HTMLElement>('div'))
      .filter((element) => {
        const style = window.getComputedStyle(element);
        return /(auto|scroll)/.test(style.overflowY)
          && element.scrollHeight > element.clientHeight + 20
          && Array.from(element.querySelectorAll('[role="tab"]')).some((tab) => tab.textContent?.trim() === 'Publicações');
      })
      .sort((left, right) => right.scrollHeight - left.scrollHeight)[0];
    if (scroller) scroller.scrollTop = value;
  }, offset);
  await expect.poll(() => profileScrollTop(page)).toBeGreaterThanOrEqual(Math.min(offset, 100));
}

async function switchProfileTab(page: Page, name: string) {
  await page.getByRole('tab', { name }).filter({ visible: true }).last().click();
  await expect(page.getByRole('tab', { name }).filter({ visible: true }).last()).toBeVisible();
}

test.describe('Perfil: retenção de rolagem', () => {
  test('voltar de uma publicação e trocar de aba inferior preservam a posição', async ({ page }) => {
    await openProfile(page);
    await setProfileScroll(page, 620);
    const beforeOpen = await profileScrollTop(page);

    await page.getByText(/^Publicação 0 do perfil/).filter({ visible: true }).last().click();
    await expect(page).toHaveURL(/\/perfil\/post\/profile-scroll-0$/);
    await page.goBack();
    await expect(page.getByText(/^Publicação 0 do perfil/).filter({ visible: true }).last()).toBeVisible();
    await expect.poll(async () => Math.abs((await profileScrollTop(page)) - beforeOpen)).toBeLessThanOrEqual(2);

    await setProfileScroll(page, 900);
    const beforeBottomTab = await profileScrollTop(page);
    await page.getByRole('tab', { name: 'Início' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('tab', { name: 'Perfil' }).click();
    await expect(page.getByText(/^Publicação 0 do perfil/).filter({ visible: true }).last()).toBeVisible();
    await expect.poll(async () => Math.abs((await profileScrollTop(page)) - beforeBottomTab)).toBeLessThanOrEqual(2);
  });

  test('alternar entre abas internas é determinístico e mantém a barra de abas visível', async ({ page }) => {
    await openProfile(page);
    await setProfileScroll(page, 620);

    const positions: number[] = [];
    for (let round = 0; round < 2; round += 1) {
      await switchProfileTab(page, 'Mídia');
      const mediaTop = await profileScrollTop(page);
      expect(mediaTop).toBeGreaterThan(0);

      await switchProfileTab(page, 'Publicações');
      await expect(page.getByText(/^Publicação 0 do perfil/).filter({ visible: true }).last()).toBeVisible();
      positions.push(await profileScrollTop(page));
    }

    // A segunda volta para Publicações cai no mesmo ponto da primeira.
    expect(positions[1]).toBe(positions[0]);
    expect(positions[0]).toBeGreaterThan(0);
    await expect(page.getByRole('tab', { name: 'Publicações' }).filter({ visible: true }).last()).toBeVisible();
  });
});
