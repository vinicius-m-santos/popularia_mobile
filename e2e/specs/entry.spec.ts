import { expect, test } from '@playwright/test';

import { installApiMock } from '../support/api-mock';
import { openLogin, visibleButton, visibleHeading, visibleLink, waitForWelcome } from '../support/flows';

/**
 * Ponto de entrada real do app: `/` sem sessão precisa terminar nas boas-vindas,
 * sem depender de o roteador escolher outra rota pública.
 */
test.describe('entrada inicial', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMock(page);
  });

  test('a raiz abre as boas-vindas quando não há sessão', async ({ page }) => {
    await page.goto('/');

    await waitForWelcome(page);
    await expect(page).toHaveURL(/\/boas-vindas\/?$/);
    await expect(visibleHeading(page, /A REDE É/)).toBeVisible();
    await expect(visibleButton(page, 'Criar minha conta')).toBeVisible();
    await expect(visibleLink(page, 'Já tem conta? Entrar')).toBeVisible();
    await expect(page.getByText('UM LUGAR NOSSO', { exact: true })).toBeVisible();
    // Sem sessão, a barra de abas não pode aparecer atrás das boas-vindas.
    await expect(page.getByRole('tab', { name: 'Início' })).toHaveCount(0);
  });

  test('recarregar a rota pública mantém as boas-vindas', async ({ page }) => {
    await page.goto('/boas-vindas');
    await waitForWelcome(page);

    await page.reload();

    await expect(page).toHaveURL(/\/boas-vindas\/?$/);
    await waitForWelcome(page);
  });

  test('o voltar do login (botão do app) retorna às boas-vindas', async ({ page }) => {
    await page.goto('/');
    await openLogin(page);

    await visibleButton(page, 'Voltar').click();

    await expect(page).toHaveURL(/\/boas-vindas\/?$/);
    await waitForWelcome(page);
  });

  test('o voltar do navegador no login retorna às boas-vindas', async ({ page }) => {
    await page.goto('/');
    await openLogin(page);

    await page.goBack();

    await expect(page).toHaveURL(/\/boas-vindas\/?$/);
    await waitForWelcome(page);
  });
});
