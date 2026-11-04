import { expect, test } from '@playwright/test';

import { installApiMock } from '../support/api-mock';
import { visibleButton, visibleHeading, waitForWelcome } from '../support/flows';

/**
 * Guardas de sessão e links diretos. No web a sessão vive só na memória (o
 * refresh token usa o Keychain/Keystore no aparelho), então cada contexto novo
 * começa deslogado — exatamente o estado que estes testes precisam.
 */
test.describe('guardas de sessão', () => {
  for (const path of ['/biblioteca', '/avisos', '/conta', '/perfil', '/criar', '/progresso']) {
    test(`rota protegida ${path} sem sessão cai nas boas-vindas`, async ({ page }) => {
      await installApiMock(page);

      await page.goto(path);

      await waitForWelcome(page);
      await expect(page).toHaveURL(/\/boas-vindas\/?$/);
      await expect(page.getByRole('tab', { name: 'Início' })).toHaveCount(0);
    });
  }

  test('login é público por link direto', async ({ page }) => {
    await installApiMock(page);

    await page.goto('/boas-vindas/conta?modo=entrar');

    await expect(visibleHeading(page, /^ENTRAR$/)).toBeVisible();
    await expect(page).toHaveURL(/\/boas-vindas\/conta\?modo=entrar$/);
  });

  test('Sobre e legal é público por link direto', async ({ page }) => {
    await installApiMock(page);

    await page.goto('/sobre-e-legal');

    await expect(visibleHeading(page, 'Sobre e legal')).toBeVisible();
    await expect(page).toHaveURL(/\/sobre-e-legal$/);
  });

  test('documento legal por link direto usa a âncora do app no voltar', async ({ page }) => {
    await installApiMock(page);

    await page.goto('/documento-legal/termos');
    await expect(visibleHeading(page, 'Termos de Uso')).toBeVisible();

    // Sem histórico interno, o voltar retorna à âncora (tabs), que sem sessão
    // redireciona para as boas-vindas em vez de deixar a rota em branco.
    await visibleButton(page, 'Voltar').click();

    await expect(page).toHaveURL(/\/boas-vindas\/?$/);
    await waitForWelcome(page);
  });

  /**
   * Achado da automação, não corrigido nesta entrega: as etapas do onboarding
   * ficam no grupo público de boas-vindas e abrem por link direto sem cadastro
   * em andamento. O fluxo não chega ao feed, mas a tela aparece sem sessão
   * (Comunas tenta /comunas autenticado e cai no estado de erro).
   * Quando a guarda de "cadastro em andamento" existir, remova o `.fixme`.
   */
  test.fixme('etapas do onboarding não abrem por link direto sem cadastro em andamento', async ({ page }) => {
    await installApiMock(page);

    await page.goto('/boas-vindas/assuntos');

    await expect(page).toHaveURL(/\/boas-vindas\/?$/);
    await waitForWelcome(page);
  });
});
