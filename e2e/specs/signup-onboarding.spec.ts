import { expect, test } from '@playwright/test';

import { installApiMock, NEW_ACCOUNT_EMAIL, NEW_ACCOUNT_HANDLE, type MockApi } from '../support/api-mock';
import {
  continueToFeed,
  visibleButton,
  visibleHeading,
  waitForWelcome,
} from '../support/flows';

/**
 * Cadastro comum completo: credenciais → identidade → confirmação adiada →
 * assuntos → comunas → mensagem editorial → feed.
 *
 * O caminho social (Google/Apple) não é exercitado: os módulos nativos não rodam
 * no navegador. A API `/auth/social` está mockada, mas a troca de token depende do
 * aparelho.
 */
test.describe('cadastro e onboarding', () => {
  let api: MockApi;

  test.beforeEach(async ({ page }) => {
    api = await installApiMock(page);
  });

  test('cria a conta, conclui o onboarding e chega ao feed', async ({ page }) => {
    await page.goto('/');
    await waitForWelcome(page);

    // Etapa 1: credenciais e aceite legal
    await visibleButton(page, 'Criar minha conta').click();
    await expect(page).toHaveURL(/\/boas-vindas\/conta\?modo=cadastro$/);
    await expect(visibleHeading(page, 'CRIAR CONTA')).toBeVisible();

    await page.getByLabel('E-mail', { exact: true }).fill(NEW_ACCOUNT_EMAIL);
    await page.getByLabel('Senha', { exact: true }).fill('senha-do-e2e-123');
    await page
      .getByRole('checkbox', { name: /Tenho 18 anos ou mais e aceito os termos/ })
      .click();
    await visibleButton(page, 'Continuar').click();

    // Etapa 2: identidade e localização
    await expect(page).toHaveURL(/\/boas-vindas\/perfil$/);
    await expect(visibleHeading(page, /COMO VOCÊ QUER/)).toBeVisible();

    await page.getByLabel('Nome', { exact: true }).fill('Maria E2E');
    await expect(page.getByLabel('Nome de usuário', { exact: true })).toHaveValue(NEW_ACCOUNT_HANDLE);
    await expect(page.getByText('Disponível', { exact: true })).toBeVisible();

    await expect(page.getByRole('button', { name: /^Estado:/ })).toHaveAccessibleName('Estado: Selecione o estado');
    await page.getByRole('button', { name: /^Estado:/ }).click();
    await page.getByRole('radio', { name: 'São Paulo (SP)' }).click();

    await expect(page.getByRole('button', { name: /^Cidade:/ })).toHaveAccessibleName('Cidade: Selecione a cidade');
    await page.getByRole('button', { name: /^Cidade:/ }).click();
    await page.getByRole('radio', { name: 'São Paulo', exact: true }).click();

    await visibleButton(page, 'Continuar').click();

    // Confirmação de e-mail pode ser adiada no onboarding.
    await expect(page).toHaveURL(/\/boas-vindas\/verificar\?sent=1$/);
    await expect(visibleHeading(page, 'Confira seu e-mail')).toBeVisible();
    await expect(page.getByText(NEW_ACCOUNT_EMAIL)).toBeVisible();
    await visibleButton(page, 'Confirmar depois').click();

    // Etapa 3: assuntos
    await expect(page).toHaveURL(/\/boas-vindas\/assuntos$/);
    await expect(visibleHeading(page, /O que move/)).toBeVisible();
    await page.getByRole('checkbox', { name: 'Educação' }).click();
    await expect(page.getByText('1 de 7')).toBeVisible();
    await visibleButton(page, 'Continuar').click();

    // Etapa 4: comunas (lista vazia no mock, mas o caminho para o feed existe)
    await expect(page).toHaveURL(/\/boas-vindas\/comunas$/);
    await expect(visibleHeading(page, 'Comunas para você')).toBeVisible();
    await expect(page.getByText('Tudo bem pular. Dá para entrar em comunas depois.')).toBeVisible();
    await visibleButton(page, 'Ir para o meu feed').click();

    // Mensagem editorial e entrada no feed
    await continueToFeed(page);

    await expect(page.getByRole('tab', { name: 'Início' })).toBeVisible();
    await expect(page.getByLabel('SEU FEED ESTÁ PRONTO, MARIA.')).toBeVisible();
    await expect(page.getByText('1 ASSUNTO', { exact: true })).toBeVisible();
    await expect(page.getByText(/COMUNA/, { exact: true })).toHaveCount(0);
    await expect(page.getByText('Nenhuma publicação ainda')).toBeVisible();

    await visibleButton(page, 'Fechar boas-vindas').click();
    await expect(page.getByLabel('SEU FEED ESTÁ PRONTO, MARIA.')).toHaveCount(0);
    await expect.poll(() => api.me.welcomeDismissed).toBe(true);

    // Contrato observado pela API: o cadastro levou identidade e localização,
    // e a escolha de assunto foi persistida antes de seguir.
    expect(api.registration).toMatchObject({
      email: NEW_ACCOUNT_EMAIL,
      displayName: 'Maria E2E',
      handle: NEW_ACCOUNT_HANDLE,
      city: 'São Paulo',
      state: 'São Paulo',
      stateIbgeCode: '35',
      municipalityIbgeCode: '3550308',
    });
    expect(api.me.interests).toEqual(['edu']);
    expect(api.requests.some((request) => request.path === '/me/complete-onboarding')).toBe(false);
  });

  test('o cadastro não avança sem o aceite legal', async ({ page }) => {
    await page.goto('/');
    await waitForWelcome(page);
    await visibleButton(page, 'Criar minha conta').click();

    await page.getByLabel('E-mail', { exact: true }).fill(NEW_ACCOUNT_EMAIL);
    await page.getByLabel('Senha', { exact: true }).fill('senha-do-e2e-123');

    await expect(visibleButton(page, 'Continuar')).toBeDisabled();
    await expect(page).toHaveURL(/\/boas-vindas\/conta\?modo=cadastro$/);
  });
});
