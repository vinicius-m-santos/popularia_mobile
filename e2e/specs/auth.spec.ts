import { expect, test } from '@playwright/test';

import { DEMO_EMAIL, DEMO_PASSWORD, installApiMock, type MockApi } from '../support/api-mock';
import {
  continueToFeed,
  openLogin,
  signIn,
  signInToFeed,
  visibleButton,
  visibleHeading,
  waitForWelcome,
} from '../support/flows';

test.describe('entrar e sair', () => {
  let api: MockApi;

  test.beforeEach(async ({ page }) => {
    api = await installApiMock(page);
  });

  test('login válido entra na mensagem editorial e depois no feed', async ({ page }) => {
    const apiOrigins = new Set<string>();
    page.on('request', (request) => {
      if (request.url().includes('/api/v1/')) apiOrigins.add(new URL(request.url()).origin);
    });

    await page.goto('/');
    await signInToFeed(page);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('tab', { name: 'Início' })).toBeVisible();
    await expect(page.getByText('Nenhuma publicação ainda')).toBeVisible();
    // Um login não é cadastro: o banner de boas-vindas do cadastro não aparece.
    await expect(page.getByText(/Seu feed está pronto/)).toHaveCount(0);
    expect(api.requests.some((request) => request.method === 'POST' && request.path === '/auth/login')).toBe(true);
    expect(api.requests.some((request) => request.method === 'GET' && request.path === '/me')).toBe(true);
    // Toda chamada de API fica na mesma origem do Metro. Se o .env local vencer
    // a variável do webServer, o teste falha aqui em vez de depender de CORS.
    expect([...apiOrigins]).toEqual([new URL(page.url()).origin]);
  });

  test('credenciais inválidas mostram o erro e mantêm o formulário', async ({ page }) => {
    await page.goto('/');
    await openLogin(page);

    await page.getByLabel('E-mail', { exact: true }).fill(DEMO_EMAIL);
    await page.getByLabel('Senha', { exact: true }).fill('senha-errada');
    await visibleButton(page, 'Entrar').click();

    await expect(page.getByRole('alert')).toContainText('E-mail ou senha incorretos.');
    await expect(page).toHaveURL(/\/boas-vindas\/conta\?modo=entrar$/);
    await expect(page.getByLabel('E-mail', { exact: true })).toHaveValue(DEMO_EMAIL);
    await expect(page.getByRole('tab', { name: 'Início' })).toHaveCount(0);
  });

  test('campos vazios são validados sem chamar a API', async ({ page }) => {
    await page.goto('/');
    await openLogin(page);

    await visibleButton(page, 'Entrar').click();

    await expect(page.getByText('Preencha o e-mail')).toBeVisible();
    await expect(page.getByText('Preencha a senha')).toBeVisible();
    expect(api.requests.some((request) => request.path === '/auth/login')).toBe(false);
  });

  test('sair da conta pela Conta volta às boas-vindas e fecha a sessão', async ({ page }) => {
    await page.goto('/');
    await signIn(page, DEMO_EMAIL, DEMO_PASSWORD);
    await continueToFeed(page);

    await page.getByRole('tab', { name: 'Perfil' }).click();
    await expect(page).toHaveURL(/\/perfil$/);
    await visibleButton(page, 'Conta e sessões').click();

    await expect(page).toHaveURL(/\/conta$/);
    await expect(visibleHeading(page, 'Conta')).toBeVisible();
    await expect(page.getByText(DEMO_EMAIL)).toBeVisible();

    await visibleButton(page, 'Sair deste aparelho').click();

    await expect(page).toHaveURL(/\/boas-vindas\/?$/);
    await waitForWelcome(page);
    await expect(page.getByRole('tab', { name: 'Início' })).toHaveCount(0);
    expect(api.requests.some((request) => request.method === 'POST' && request.path === '/auth/logout')).toBe(true);
  });
});
