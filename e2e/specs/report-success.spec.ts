import { expect, test } from '@playwright/test';

import { installApiMock } from '../support/api-mock';
import { signInToFeed, visibleButton, visibleHeading, visibleLink } from '../support/flows';

const REPORTER_POST = {
  id: 'e2e-report-post',
  body: 'Qual livro vamos ler no próximo encontro?',
  title: 'Qual livro vamos ler no próximo encontro?',
  createdAt: '2026-11-02T12:00:00-03:00',
  author: { id: 'e2e-vinicius', handle: 'u01a1', displayName: 'Vinicius Santos', avatarUrl: null },
  comuna: { id: 'e2e-devs', slug: 'devs', name: 'Devs do Brasil', status: 'active' },
  commentCount: 0,
  supportCount: 0,
  echoCount: 0,
  viewer: { isAuthor: false, canComment: true, canDelete: false, canRemove: false },
  poll: {
    id: 'e2e-poll',
    question: 'Qual livro vamos ler no próximo encontro?',
    totalVotes: 0,
    votedOptionId: null,
    endsAt: null,
    options: [
      { id: 'opt-1', label: 'Pedagogia do oprimido', voteCount: 0, percent: 0, selected: false },
      { id: 'opt-2', label: 'Quarto de despejo', voteCount: 0, percent: 0, selected: false },
    ],
  },
};

async function reportPost(page: import('@playwright/test').Page) {
  await visibleButton(page, 'Mais opções').click();
  await visibleButton(page, 'Denunciar publicação').click();
  await page.getByRole('radio', { name: 'Spam' }).click();
  await visibleButton(page, /Enviar denúncia/).click();
  await expect(page.getByText('DENÚNCIA ENVIADA.')).toBeVisible();
}

test.describe('confirmação da denúncia', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMock(page, {}, { feedItems: [REPORTER_POST] });
  });

  test('mostra o que foi denunciado e abre as Regras da Comunidade', async ({ page }) => {
    await page.goto('/');
    await signInToFeed(page);
    await reportPost(page);

    const reportedCard = page.getByLabel(/^Conteúdo denunciado:/);
    await expect(reportedCard).toContainText('ENQUETE');
    await expect(reportedCard).toContainText('Qual livro vamos ler no próximo encontro?');
    await expect(reportedCard).toContainText('c/ Devs do Brasil');
    await expect(page.getByText('A pessoa não fica sabendo quem denunciou.')).toBeVisible();
    await expect(page.getByText('Se o conteúdo quebrar as regras, ele sai do ar.')).toBeVisible();

    await visibleLink(page, 'Regras da Comunidade').click();

    await expect(page).toHaveURL(/\/documento-legal\/regras$/);
    await expect(visibleHeading(page, 'Regras da Comunidade')).toBeVisible();
  });

  test('bloqueia, desfaz, bloqueia de novo e tira a publicação do feed ao fechar', async ({ page }) => {
    await page.goto('/');
    await signInToFeed(page);
    await reportPost(page);

    await visibleButton(page, 'Bloquear Vinicius Santos').click();
    await expect(page.getByText('Vinicius Santos foi bloqueado')).toBeVisible();
    await expect(page.getByText('Dá pra desfazer em Conta › Bloqueios')).toBeVisible();

    await visibleButton(page, 'Desfazer bloqueio de Vinicius Santos').click();
    await expect(visibleButton(page, 'Bloquear Vinicius Santos')).toBeVisible();

    await visibleButton(page, 'Bloquear Vinicius Santos').click();
    await expect(page.getByText('Vinicius Santos foi bloqueado')).toBeVisible();

    await visibleButton(page, 'Entendi').click();
    await expect(page.getByText('DENÚNCIA ENVIADA.')).toBeHidden();
    await expect(page.getByText('Qual livro vamos ler no próximo encontro?')).toHaveCount(0);
  });
});
