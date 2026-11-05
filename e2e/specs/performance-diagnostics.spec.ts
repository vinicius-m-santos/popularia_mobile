import { expect, test } from '@playwright/test';

import { installApiMock } from '../support/api-mock';
import { signInToFeed, visibleButton } from '../support/flows';

/**
 * A tela de diagnóstico é de desenvolvimento/staging. Este spec cobre o caminho
 * real de entrada (Conta -> Diagnóstico), a coleta durante a navegação, o harness
 * de 20 cartões e a exportação do JSON no navegador.
 */
test.describe('diagnóstico de performance', () => {
  test('coleta durante a navegação, abre o harness e exporta o JSON', async ({ page }) => {
    await installApiMock(page);
    await page.goto('/');
    await signInToFeed(page);

    await page.getByRole('tab', { name: 'Perfil' }).click();
    await expect(page).toHaveURL(/\/perfil$/);
    await visibleButton(page, 'Conta e sessões').click();
    await visibleButton(page, /Diagnóstico de performance/).click();

    await expect(page).toHaveURL(/\/diagnostico-performance$/);
    await expect(visibleButton(page, 'Iniciar medição')).toBeVisible();
    await visibleButton(page, 'Iniciar medição').click();
    await expect(visibleButton(page, 'Resetar medição')).toBeVisible();
    await expect(page.getByText('Coleta ativa')).toBeVisible();

    // O harness existente monta os 20 cartões do fixture de QA.
    await visibleButton(page, 'Abrir harness de 20 posts').click();
    await expect(page).toHaveURL(/\/diagnostico-performance-harness$/);
    await expect(page.getByText('Publicação de QA 1.')).toBeVisible();
    await visibleButton(page, 'Voltar').click();
    await expect(page).toHaveURL(/\/diagnostico-performance$/);

    // Volta para as abas e navega durante a coleta.
    await visibleButton(page, 'Voltar').click();
    await visibleButton(page, 'Voltar').click();
    await page.getByRole('tab', { name: 'Início' }).click();
    await expect(page).toHaveURL(/\/$/);
    await page.getByRole('tab', { name: 'Explorar' }).click();
    await expect(page).toHaveURL(/\/explorar$/);

    // Consulta os resultados ao retornar.
    await page.getByRole('tab', { name: 'Perfil' }).click();
    await visibleButton(page, 'Conta e sessões').click();
    await visibleButton(page, /Diagnóstico de performance/).click();
    await expect(page).toHaveURL(/\/diagnostico-performance$/);
    await expect(visibleButton(page, 'Resetar medição')).toBeVisible();
    await expect.poll(async () => Number(await page.getByTestId('metric-requests-value').textContent())).toBeGreaterThan(0);

    const downloadPromise = page.waitForEvent('download');
    await visibleButton(page, 'Exportar JSON').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('popularia-performance-diagnostico.json');
    const path = await download.path();
    expect(path).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { readFile } = require('node:fs/promises') as { readFile: (file: string, encoding: 'utf8') => Promise<string> };
    const report = JSON.parse(await readFile(path!, 'utf8')) as {
      enabled: boolean;
      sessionId: string | null;
      platform: string;
      requests: unknown[];
    };
    expect(report.enabled).toBe(true);
    expect(report.sessionId).toBeTruthy();
    expect(report.platform).toBe('web');
    expect(report.requests.length).toBeGreaterThan(0);
  });
});
