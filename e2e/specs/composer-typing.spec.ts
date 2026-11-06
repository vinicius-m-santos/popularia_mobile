import { expect, test } from '@playwright/test';

import { installApiMock } from '../support/api-mock';
import { signInToFeed, visibleButton } from '../support/flows';

/**
 * Smoke do composer após isolar o estado de digitação (POP-18): o rascunho de
 * "Escrever" continua preservado ao alternar variantes, e a prévia lê o texto e
 * o título atuais.
 */
test.describe('composer de publicação', () => {
  test('preserva o rascunho e sincroniza prévia, enquete e chamado', async ({ page }) => {
    await installApiMock(page, {});
    await page.goto('/');
    await signInToFeed(page);

    // Navegação interna: recarregar a página no web perde a sessão em memória.
    await visibleButton(page, 'Criar publicação').click();
    await expect(page).toHaveURL(/\/criar$/);
    await expect(page.getByText('Nova publicação')).toBeVisible({ timeout: 30_000 });

    await page.getByLabel('Texto da publicação').fill('Primeiro texto');
    await page.getByRole('button', { name: 'Prévia da publicação' }).click();
    await expect(page.getByLabel(/Pré-visualização: Primeiro texto/)).toBeVisible();

    await page.getByRole('button', { name: 'Prévia da publicação' }).click();
    await expect(page.getByLabel('Texto da publicação')).toHaveValue('Primeiro texto');

    await page.getByRole('button', { name: 'Adicionar título' }).click();
    await page.getByLabel('Título da publicação').fill('Ato na quinta');
    await page.getByLabel('Texto da publicação').fill('Segundo texto');

    await page.getByRole('button', { name: 'Prévia da publicação' }).click();
    await expect(page.getByLabel(/Pré-visualização: Ato na quinta\. Segundo texto/)).toBeVisible();
    await page.getByRole('button', { name: 'Prévia da publicação' }).click();

    // Enquete: campos próprios continuam editáveis e o rascunho de escrita fica guardado.
    await page.getByRole('tab', { name: 'Enquete' }).click();
    await page.getByLabel('Pergunta da enquete').fill('Qual livro vamos ler?');
    await page.getByLabel('Opção A').fill('O cortiço');
    await page.getByLabel('Opção B').fill('Capitães da Areia');
    await expect(page.getByLabel('Pergunta da enquete')).toHaveValue('Qual livro vamos ler?');
    await expect(page.getByLabel('Opção B')).toHaveValue('Capitães da Areia');

    // Chamado: título, detalhes e data.
    await page.getByRole('tab', { name: 'Chamado' }).click();
    await page.getByLabel('Título do chamado').fill('Noite de jogos');
    await page.getByLabel('Detalhes do chamado').fill('Leve um jogo de tabuleiro');
    await page.getByRole('button', { name: 'Hoje' }).click();
    await expect(page.getByLabel('Título do chamado')).toHaveValue('NOITE DE JOGOS');
    await expect(page.getByLabel('Detalhes do chamado')).toHaveValue('Leve um jogo de tabuleiro');

    // Voltar para escrever restaura o rascunho e o título, e a prévia os reflete.
    await page.getByRole('tab', { name: 'Escrever' }).click();
    await expect(page.getByLabel('Texto da publicação')).toHaveValue('Segundo texto');
    await expect(page.getByLabel('Título da publicação')).toHaveValue('Ato na quinta');
    await page.getByRole('button', { name: 'Prévia da publicação' }).click();
    await expect(page.getByLabel(/Pré-visualização: Ato na quinta\. Segundo texto/)).toBeVisible();
  });
});
