import { expect, test, type Locator, type Page } from '@playwright/test';

import { installApiMock, type MockApi } from '../support/api-mock';
import { signInToFeed, visibleButton, visibleHeading, visibleLink } from '../support/flows';
import {
  buildQaFeedPosts,
  buildQaImagePost,
  buildQaLibraryDocuments,
  QA_FEED_PAGE_SIZE,
  QA_IMAGE_POST_TEXT,
  QA_LIBRARY_PAGE_SIZE,
} from '../support/qa-dataset';

/**
 * Smoke determinístico da UX mobile crítica (POP-64).
 *
 * Cobre o que o navegador consegue provar sem depender de física nativa:
 * rolagem de 200+ posts em 3 páginas, troca de abas do feed, volta para uma
 * lista de 3 páginas, publicação, foco no campo de uma folha e abertura da foto.
 * Pinça/arrasto, teclado nativo, leitor de tela, Reduce Motion, fonte ampliada,
 * vídeo e jank continuam no roteiro manual de
 * `docs/pop-64-mobile-ux-smoke-matrix.md`.
 */

const QA_POST_240 = 'Publicação de QA 240. Rolagem longa do smoke mobile.';
const QA_POST_001 = 'Publicação de QA 001. Rolagem longa do smoke mobile.';
const QA_DOCUMENT_041 = 'Documento de QA 041';

function feedRequests(api: MockApi): number {
  return api.requests.filter((request) => request.method === 'GET' && request.path === '/feed').length;
}

function documentRequests(api: MockApi): number {
  return api.requests.filter((request) => request.method === 'GET' && request.path === '/library/documents').length;
}

function visibleText(page: Page, text: string | RegExp): Locator {
  return page.getByText(text, { exact: typeof text === 'string' }).filter({ visible: true }).last();
}

/**
 * Rola o container virtualizado até o texto aparecer.
 *
 * O FlashList só monta os cartões próximos da viewport, então não basta
 * `scrollIntoViewIfNeeded`: é preciso alimentar o scroll repetidamente para o
 * `onEndReached` buscar a próxima página e a virtualização montar o item.
 */
async function scrollUntilVisible(page: Page, target: Locator, attempts = 40): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await target.count()) {
      await target.scrollIntoViewIfNeeded();
      if (await target.isVisible()) return;
    }
    await page.mouse.move(195, 480);
    await page.mouse.wheel(0, 2200);
    await page.waitForTimeout(220);
    await page.evaluate(() => {
      const scrollers = Array.from(document.querySelectorAll<HTMLElement>('div'))
        .filter((element) => {
          const style = getComputedStyle(element);
          return /(auto|scroll)/.test(style.overflowY)
            && element.scrollHeight > element.clientHeight + 120
            && element.getBoundingClientRect().height > 240;
        })
        .sort((left, right) => right.scrollHeight - left.scrollHeight);
      const scroller = scrollers[0];
      if (scroller) scroller.scrollTop = Math.min(scroller.scrollHeight, scroller.scrollTop + 2600);
    });
    await page.waitForTimeout(220);
  }
  await expect(target).toBeVisible();
}

/** Offset do maior scroller vertical; o FlashList virtualiza dentro dele no web. */
async function mainScrollTop(page: Page): Promise<number> {
  return page.evaluate(() => {
    const scrollers = Array.from(document.querySelectorAll<HTMLElement>('div'))
      .filter((element) => {
        const style = getComputedStyle(element);
        return /(auto|scroll)/.test(style.overflowY)
          && element.scrollHeight > element.clientHeight + 120
          && element.getBoundingClientRect().height > 240;
      })
      .sort((left, right) => right.scrollHeight - left.scrollHeight);
    return scrollers[0]?.scrollTop ?? 0;
  });
}

async function openFeed(page: Page, options: { feedItems: unknown[]; feedPageSize?: number }): Promise<MockApi> {
  const api = await installApiMock(page, {}, options);
  await page.goto('/');
  await signInToFeed(page);
  await expect(visibleText(page, QA_POST_001)).toBeVisible();
  return api;
}

test.describe('smoke de UX mobile: feed longo e troca de abas', () => {
  test('rola 200+ posts em 3 páginas e volta à primeira aba sem perder o cache', async ({ page }) => {
    const api = await openFeed(page, {
      feedItems: buildQaFeedPosts(),
      feedPageSize: QA_FEED_PAGE_SIZE,
    });

    await scrollUntilVisible(page, visibleText(page, QA_POST_240));

    await expect(visibleText(page, QA_POST_240)).toBeVisible();
    expect(feedRequests(api)).toBe(3);

    // Trocar de aba remonta a lista do topo; o mock devolve o mesmo recorte nas
    // três abas, então o retorno ao primeiro post é a prova de que a lista
    // recomeçou em vez de herdar a rolagem.
    await page.getByRole('tab', { name: 'Seguindo' }).click();
    await expect(visibleText(page, QA_POST_001)).toBeVisible();
    await page.getByRole('tab', { name: 'Para você' }).click();
    await expect(visibleText(page, QA_POST_001)).toBeVisible();

    const requestsBeforeReturn = feedRequests(api);
    await scrollUntilVisible(page, visibleText(page, QA_POST_240));
    await expect(visibleText(page, QA_POST_240)).toBeVisible();
    // Nenhuma página nova: o cache da aba já contém as 240 publicações.
    expect(feedRequests(api)).toBe(requestsBeforeReturn);
  });

  test('abre a publicação do fim da terceira página e volta para a lista carregada', async ({ page }) => {
    const api = await openFeed(page, {
      feedItems: buildQaFeedPosts(),
      feedPageSize: QA_FEED_PAGE_SIZE,
    });

    await scrollUntilVisible(page, visibleText(page, QA_POST_240));
    const requestsBeforeOpen = feedRequests(api);

    await visibleText(page, QA_POST_240).click();

    await expect(page).toHaveURL(/\/post\/qa-feed-post-240$/);
    await expect(visibleHeading(page, 'Discussão')).toBeVisible();
    await visibleButton(page, 'Voltar').click();

    await expect(page).toHaveURL(/\/$/);
    await expect(visibleText(page, QA_POST_240)).toBeVisible();
    expect(feedRequests(api)).toBe(requestsBeforeOpen);
  });
});

test.describe('smoke de UX mobile: Biblioteca e publicação', () => {
  test('carrega 3 páginas da Biblioteca e volta do documento sem perder a lista', async ({ page }) => {
    const api = await installApiMock(page, {}, {
      libraryDocuments: buildQaLibraryDocuments(),
      libraryDocumentPageSize: QA_LIBRARY_PAGE_SIZE,
    });
    await page.goto('/');
    await signInToFeed(page);

    await page.getByRole('tab', { name: 'Explorar' }).click();
    await visibleLink(page, 'Abrir Biblioteca Pública').click();
    await expect(page).toHaveURL(/\/biblioteca$/);
    await expect(visibleText(page, 'Documento de QA 001')).toBeVisible();

    await visibleButton(page, 'Mais documentos').click();
    await expect.poll(() => documentRequests(api)).toBe(2);
    await visibleButton(page, 'Mais documentos').click();
    await expect.poll(() => documentRequests(api)).toBe(3);

    const document = page.getByRole('button', { name: `${QA_DOCUMENT_041}, PDF` }).filter({ visible: true }).last();
    await scrollUntilVisible(page, document);
    const readingPosition = await mainScrollTop(page);
    expect(readingPosition).toBeGreaterThan(100);
    await document.click();

    await expect(page).toHaveURL(/\/biblioteca\/documento\/qa-library-document-041$/);
    await expect(visibleText(page, 'Documento')).toBeVisible();
    await expect(visibleText(page, QA_DOCUMENT_041)).toBeVisible();

    await visibleButton(page, 'Voltar').click();
    await expect(page).toHaveURL(/\/biblioteca$/);
    // A revalidação ao voltar pode buscar o prefixo de novo, mas não pode
    // descartar as páginas 2 e 3 já carregadas nem devolver a lista ao topo.
    await expect(visibleText(page, QA_DOCUMENT_041)).toBeVisible();
    await expect.poll(async () => Math.abs((await mainScrollTop(page)) - readingPosition)).toBeLessThan(300);
    expect(documentRequests(api)).toBeGreaterThanOrEqual(3);
  });

  test('publica pelo composer e o novo post aparece no feed', async ({ page }) => {
    const api = await installApiMock(page, {}, { feedItems: buildQaFeedPosts(3) });
    await page.goto('/');
    await signInToFeed(page);

    await visibleButton(page, 'Criar publicação').click();
    await expect(page).toHaveURL(/\/criar$/);
    await expect(page.getByText('Nova publicação')).toBeVisible();

    const body = 'Publicação criada no smoke de UX mobile.';
    await page.getByLabel('Texto da publicação').fill(body);
    await visibleButton(page, 'Publicar').click();

    await expect(page).toHaveURL(/\/$/);
    await expect(visibleText(page, body)).toBeVisible();
    expect(api.requests).toContainEqual({ method: 'POST', path: '/posts' });
    expect(api.createdPosts).toHaveLength(1);
    expect(api.createdPosts[0]).toMatchObject({ body, title: null });
  });
});

test.describe('smoke de UX mobile: folhas, foco e foto', () => {
  test('busca na folha de destino, confirma e preserva o rascunho', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/');
    await signInToFeed(page);

    await visibleButton(page, 'Criar publicação').click();
    await expect(page).toHaveURL(/\/criar$/);
    await page.getByLabel('Texto da publicação').fill('Rascunho preservado');

    await visibleButton(page, 'Publicar em seu perfil. Trocar destino').click();
    await expect(page.getByText('Onde publicar?')).toBeVisible();

    // O campo precisa manter o foco e o valor enquanto a folha está aberta.
    // A física do teclado nativo (altura, safe area, dismiss) é manual.
    const search = page.getByLabel('Buscar comuna');
    await search.click();
    await search.fill('Hortas');
    await expect(search).toHaveValue('Hortas');
    await expect(search).toBeFocused();

    await visibleButton(page, 'Confirmar publicação em seu perfil').click();
    await expect(page.getByText('Onde publicar?')).toBeHidden();
    await expect(page.getByLabel('Texto da publicação')).toHaveValue('Rascunho preservado');
  });

  test('abre a foto em tela cheia e fecha pelo controle acessível', async ({ page }) => {
    await installApiMock(page, {}, { feedItems: [buildQaImagePost()] });
    await page.goto('/');
    await signInToFeed(page);

    await expect(visibleText(page, QA_IMAGE_POST_TEXT)).toBeVisible();

    // Semântica mínima para leitor de tela: papéis, nomes e estados dos
    // controles críticos. A locução real no VoiceOver/TalkBack é manual.
    await expect(page.getByRole('tab', { name: 'Início' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Criar publicação' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Apoiar, 0' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Comentar, 0' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ecoar, 0' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Salvar' })).toBeVisible();

    await visibleButton(page, 'Abrir foto em tela cheia').click();

    await expect(visibleButton(page, 'Fechar foto')).toBeVisible();
    await expect(page.getByText('Foto', { exact: true }).filter({ visible: true }).last()).toBeVisible();

    await visibleButton(page, 'Fechar foto').click();
    await expect(visibleButton(page, 'Fechar foto')).toBeHidden();
    await expect(page).toHaveURL(/\/$/);

    // Pinça, duplo toque e arrasto para descartar dependem da física do
    // aparelho e ficam no roteiro manual.
    await expect(page.getByLabel('Foto da publicação')).toHaveCount(0);
  });
});
