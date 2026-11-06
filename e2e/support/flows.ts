import { expect, type Locator, type Page } from '@playwright/test';

import { DEMO_EMAIL, DEMO_PASSWORD } from './api-mock';

/** Elementos visíveis: o app mantém abas e telas anteriores montadas no DOM web. */
export function visibleButton(page: Page, name: string | RegExp): Locator {
  return page.getByRole('button', { name }).filter({ visible: true }).last();
}

export function visibleLink(page: Page, name: string | RegExp): Locator {
  return page.getByRole('link', { name }).filter({ visible: true }).last();
}

export function visibleHeading(page: Page, name: string | RegExp): Locator {
  return page.getByRole('heading', { name }).filter({ visible: true }).last();
}

/** Espera o app montar. O primeiro bundle do Metro pode levar dezenas de segundos. */
export async function waitForWelcome(page: Page): Promise<void> {
  await expect(visibleHeading(page, /A REDE É/)).toBeVisible({ timeout: 120_000 });
  await expect(visibleButton(page, 'Criar minha conta')).toBeVisible();
}

export async function openLogin(page: Page): Promise<void> {
  await waitForWelcome(page);
  await visibleLink(page, 'Já tem conta? Entrar').click();
  await expect(page).toHaveURL(/\/boas-vindas\/conta\?modo=entrar$/);
  await expect(visibleHeading(page, /^ENTRAR$/)).toBeVisible();
}

/**
 * Entra pela tela de login. O provedor social é nativo e não roda no navegador;
 * o caminho automatizado é sempre e-mail + senha.
 */
export async function signIn(
  page: Page,
  email = DEMO_EMAIL,
  password = DEMO_PASSWORD,
): Promise<void> {
  await openLogin(page);
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await visibleButton(page, 'Entrar').click();
}

/**
 * A mensagem editorial aparece entre o login e o feed. O botão de continuar
 * surge depois da sequência de abertura; o teste espera por ele em vez de dormir.
 */
export async function continueToFeed(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/boas-vindas\/mensagem$/, { timeout: 30_000 });
  const continueButton = visibleButton(page, 'Continuar para o aplicativo');
  const feedTab = page.getByRole('tab', { name: 'Início' });
  // A tela também avança sozinha um segundo após exibir o botão. No CI, esse
  // timer pode vencer antes do locator clicar; nesse caso o feed já é sucesso.
  await expect.poll(async () => {
    if (await feedTab.isVisible()) return 'feed';
    if (await continueButton.isVisible()) return 'button';
    return 'waiting';
  }, { timeout: 30_000 }).not.toBe('waiting');
  if (await continueButton.isVisible()) {
    try {
      await continueButton.click({ timeout: 5_000 });
    } catch (error) {
      if (!await feedTab.isVisible()) throw error;
    }
  }
  await expect(feedTab).toBeVisible({ timeout: 30_000 });
  await expect(page).toHaveURL(/\/$/);
}

export async function signInToFeed(page: Page, email = DEMO_EMAIL, password = DEMO_PASSWORD): Promise<void> {
  await signIn(page, email, password);
  await continueToFeed(page);
}
