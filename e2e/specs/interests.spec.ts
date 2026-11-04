import { expect, test } from '@playwright/test';

import { installApiMock } from '../support/api-mock';
import { signInToFeed, visibleButton, visibleHeading } from '../support/flows';

test.describe('interesses pela Conta', () => {
  test('abre com os assuntos atuais, salva no perfil e volta', async ({ page }) => {
    const api = await installApiMock(page);
    await page.goto('/');
    await signInToFeed(page);

    await page.getByRole('tab', { name: 'Perfil' }).click();
    await visibleButton(page, 'Conta e sessões').click();
    await expect(page).toHaveURL(/\/conta$/);

    await visibleButton(page, /Interesses/).click();
    await expect(page).toHaveURL(/\/interesses$/);
    await expect(visibleHeading(page, /O QUE MOVE/)).toBeVisible();
    await expect(page.getByText('2 DE 3')).toBeVisible();

    await page.getByRole('checkbox', { name: 'Educação' }).click();
    await expect(page.getByText('1 DE 3')).toBeVisible();
    await visibleButton(page, 'Salvar interesses').click();

    await expect(page).toHaveURL(/\/conta$/);
    await expect.poll(() => api.me.interests).toEqual(['pol']);
  });
});
