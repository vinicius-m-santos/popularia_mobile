import { expect, test } from '@playwright/test';

import { installApiMock } from '../support/api-mock';
import {
  openLogin,
  visibleButton,
  visibleHeading,
  visibleLink,
  waitForWelcome,
} from '../support/flows';

/**
 * Documentos legais e a área "Sobre e legal". A área abre sem sessão (login e
 * cadastro) e também dentro da Conta; por isso não pode depender de autenticação.
 */
test.describe('navegação legal', () => {
  test.beforeEach(async ({ page }) => {
    await installApiMock(page);
  });

  test('boas-vindas abre os Termos de Uso e o voltar retorna', async ({ page }) => {
    await page.goto('/');
    await waitForWelcome(page);

    await visibleLink(page, 'Termos de Uso').click();

    await expect(page).toHaveURL(/\/documento-legal\/termos$/);
    await expect(visibleHeading(page, 'Termos de Uso')).toBeVisible();
    await expect(page.getByText(/O Popularia reúne pessoas/)).toBeVisible();
    // O documento não repete o título na barra de origem.
    await expect(page.getByText('Sobre e legal', { exact: true })).toBeVisible();

    await visibleButton(page, 'Voltar').click();

    await expect(page).toHaveURL(/\/boas-vindas\/?$/);
    await waitForWelcome(page);
  });

  test('boas-vindas abre a Política de Privacidade e o navegador volta', async ({ page }) => {
    await page.goto('/');
    await waitForWelcome(page);

    await visibleLink(page, 'Política de Privacidade').click();

    await expect(page).toHaveURL(/\/documento-legal\/privacidade$/);
    await expect(visibleHeading(page, 'Política de Privacidade')).toBeVisible();
    await expect(page.getByText(/O que a gente guarda sobre você/)).toBeVisible();

    await page.goBack();

    await expect(page).toHaveURL(/\/boas-vindas\/?$/);
    await waitForWelcome(page);
  });

  test('Sobre e legal abre as licenças e o voltar volta um nível por vez', async ({ page }) => {
    await page.goto('/');
    await openLogin(page);

    await visibleLink(page, 'Sobre e legal').click();
    await expect(page).toHaveURL(/\/sobre-e-legal$/);
    await expect(visibleHeading(page, 'Sobre e legal')).toBeVisible();
    await expect(page.getByText(/O combinado entre a gente/)).toBeVisible();

    await visibleButton(page, /Licenças de código aberto/).click();

    await expect(page).toHaveURL(/\/licencas$/);
    await expect(visibleHeading(page, /licenças de código aberto/i)).toBeVisible();
    await expect(page.getByText('Fontes', { exact: true })).toBeVisible();
    await expect(page.getByText(/^Bibliotecas · \d+$/)).toBeVisible();
    await expect(page.getByText('Anton', { exact: true })).toBeVisible();

    // Voltar pelo navegador (equivalente ao hardware back) sai de Licenças para Sobre e legal.
    await page.goBack();
    await expect(page).toHaveURL(/\/sobre-e-legal$/);
    await expect(visibleHeading(page, 'Sobre e legal')).toBeVisible();

    // O voltar do app sai de Sobre e legal para o login, sem pular a etapa anterior.
    await visibleButton(page, 'Voltar').click();
    await expect(page).toHaveURL(/\/boas-vindas\/conta\?modo=entrar$/);
    await expect(visibleHeading(page, /^ENTRAR$/)).toBeVisible();
  });

  test('Sobre e legal abre as Regras da Comunidade e volta', async ({ page }) => {
    await page.goto('/');
    await openLogin(page);
    await visibleLink(page, 'Sobre e legal').click();

    await visibleButton(page, /Regras da Comunidade/).click();

    await expect(page).toHaveURL(/\/documento-legal\/regras$/);
    await expect(visibleHeading(page, 'Regras da Comunidade')).toBeVisible();
    await expect(page.getByText(/Valem pra todo mundo/)).toBeVisible();

    await visibleButton(page, 'Voltar').click();
    await expect(page).toHaveURL(/\/sobre-e-legal$/);
    await expect(visibleHeading(page, 'Sobre e legal')).toBeVisible();
  });
});
