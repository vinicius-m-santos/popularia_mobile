import { expect, test, type Page } from '@playwright/test';

import { installApiMock } from '../support/api-mock';
import { signIn } from '../support/flows';
import { buildQaFeedPosts } from '../support/qa-dataset';

/**
 * POP-32: a barra inferior some na discussão e volta no back. O layout da cena
 * encolhe/cresce junto com a barra, em vez de trocar de altura num único quadro.
 *
 * O Chromium não reproduz a física da pilha nativa. Este spec prova o que ele
 * consegue: a troca de rota, o compositor no rodapé, a barra inacessível e a
 * geometria sem salto de quadro. Gesto nativo e FPS continuam no aparelho.
 */

type LayoutSample = {
  t: number;
  composerBottom: number | null;
  tabTop: number | null;
  tabHeight: number | null;
};

const POST_TEXT = 'Publicação de QA 001. Rolagem longa do smoke mobile.';

// A amostragem de quadros depende da animação de layout; um sistema com
// movimento reduzido troca a barra instantaneamente por contrato.
test.use({ reducedMotion: 'no-preference' });

async function signInToFeed(page: Page): Promise<void> {
  await page.goto('/');
  await signIn(page);
  // A mensagem editorial avança sozinha depois de um segundo.
  await expect(page.getByRole('tab', { name: 'Início' })).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
}

async function startLayoutSampler(page: Page): Promise<void> {
  await page.evaluate(() => {
    const win = window as unknown as { __pop32Samples: LayoutSample[]; __pop32Sampling: boolean };
    win.__pop32Samples = [];
    win.__pop32Sampling = true;
    const started = performance.now();
    const rectOf = (element: Element | null) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom, height: box.height };
    };
    const tick = () => {
      if (!win.__pop32Sampling) return;
      const composer = rectOf(document.querySelector('[aria-label="Escrever comentário"]'));
      const host = rectOf(document.querySelector('[data-testid="tab-bar-host"]'));
      win.__pop32Samples.push({
        t: Math.round(performance.now() - started),
        composerBottom: composer ? composer.bottom : null,
        tabTop: host ? host.top : null,
        tabHeight: host ? host.height : null,
      });
      if (performance.now() - started < 1200) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

async function stopLayoutSampler(page: Page): Promise<LayoutSample[]> {
  return page.evaluate(() => {
    const win = window as unknown as { __pop32Samples: LayoutSample[]; __pop32Sampling: boolean };
    win.__pop32Sampling = false;
    return win.__pop32Samples;
  });
}

/** Maior salto entre dois quadros consecutivos em que o elemento existe. */
function maxFrameDelta(samples: LayoutSample[], key: 'tabTop' | 'composerBottom'): number {
  let previous: number | null = null;
  let max = 0;
  for (const sample of samples) {
    const value = sample[key];
    if (value === null) {
      previous = null;
      continue;
    }
    if (previous !== null) max = Math.max(max, Math.abs(value - previous));
    previous = value;
  }
  return max;
}

/** A barra passou por uma posição intermediária, em vez de pular direto. */
function movedThroughIntermediate(samples: LayoutSample[]): boolean {
  const tops = samples.map((sample) => sample.tabTop).filter((value): value is number => value !== null);
  if (tops.length < 3) return false;
  const first = tops[0];
  const last = tops[tops.length - 1];
  const low = Math.min(first, last);
  const high = Math.max(first, last);
  if (high - low < 2) return false;
  return tops.some((top) => top > low + 1 && top < high - 1);
}

test.describe('rota de post e barra inferior', () => {
  test('push e back mudam a barra de layout sem salto e preservam o feed', async ({ page }) => {
    await installApiMock(page, {}, { feedItems: buildQaFeedPosts(6) });
    await signInToFeed(page);

    const post = page.getByText(POST_TEXT, { exact: true }).filter({ visible: true }).last();
    await expect(post).toBeVisible();
    const host = page.getByTestId('tab-bar-host');
    await expect.poll(async () => Math.round((await host.boundingBox())?.height ?? 0)).toBeGreaterThan(60);

    await startLayoutSampler(page);
    await post.click();
    await page.waitForTimeout(1200);
    const pushSamples = await stopLayoutSampler(page);

    await expect(page).toHaveURL(/\/post\/qa-feed-post-1$/);
    await expect(page.getByRole('heading', { name: 'Discussão' })).toBeVisible();
    await expect(page.getByLabel('Escrever comentário')).toBeVisible();
    // A barra continua montada, mas sai da árvore de acessibilidade e do toque.
    await expect(page.getByRole('tab', { name: 'Início' })).toHaveCount(0);
    await expect.poll(async () => Math.round((await host.boundingBox())?.height ?? 0)).toBe(0);

    // O compositor acompanha a barra em passos de quadro, não em um salto único.
    expect(maxFrameDelta(pushSamples, 'composerBottom')).toBeLessThan(48);
    expect(maxFrameDelta(pushSamples, 'tabTop')).toBeLessThan(48);
    expect(movedThroughIntermediate(pushSamples)).toBe(true);

    await startLayoutSampler(page);
    await page.getByRole('button', { name: 'Voltar' }).filter({ visible: true }).last().click();
    await page.waitForTimeout(1200);
    const backSamples = await stopLayoutSampler(page);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('tab', { name: 'Início' })).toBeVisible();
    await expect(post).toBeVisible();
    await expect.poll(async () => Math.round((await host.boundingBox())?.height ?? 0)).toBeGreaterThan(60);

    expect(maxFrameDelta(backSamples, 'tabTop')).toBeLessThan(48);
    expect(movedThroughIntermediate(backSamples)).toBe(true);
  });
});
