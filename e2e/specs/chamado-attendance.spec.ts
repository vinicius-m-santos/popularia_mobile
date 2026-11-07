import { expect, test, type Page } from '@playwright/test';

import { installApiMock } from '../support/api-mock';
import { signInToFeed, visibleButton } from '../support/flows';

const EVENT_ID = '019abcde-0000-7000-8000-000000000073';
const NOTICE = 'Confirme seu e-mail para marcar presença neste chamado.';

/** Chamado ligado a uma publicação, no mesmo contrato de GET /feed. */
const CHAMADO_POST = {
  id: 'e2e-chamado-post',
  body: 'Ato pela Tarifa Zero na Praça Sete.',
  title: 'Ato pela Tarifa Zero',
  createdAt: '2026-11-02T12:00:00-03:00',
  author: {
    id: 'e2e-autora-chamado',
    handle: 'helena',
    displayName: 'Helena Duarte',
    avatarUrl: null,
  },
  comuna: {
    id: 'e2e-comuna-chamado',
    slug: 'tarifa-zero',
    name: 'Tarifa Zero',
    status: 'active',
  },
  commentCount: 0,
  supportCount: 0,
  echoCount: 0,
  viewer: { isAuthor: false, canComment: true, canDelete: false, canRemove: false },
  event: {
    id: EVENT_ID,
    title: 'Ato pela Tarifa Zero',
    format: 'in_person',
    status: 'scheduled',
    startsAt: '2099-11-05T19:00:00-03:00',
    endsAt: null,
    timeZone: 'America/Sao_Paulo',
    placeName: 'Praça Sete de Setembro',
    address: 'Rua X, 123',
    goingCount: 12,
    maybeCount: 4,
    viewerAttendance: null,
    past: false,
  },
};

async function openFeed(page: Page, options: Parameters<typeof installApiMock>[2] = {}, me: Parameters<typeof installApiMock>[1] = {}) {
  const api = await installApiMock(page, me, { feedItems: [CHAMADO_POST], ...options });
  await page.goto('/');
  await signInToFeed(page);
  await expect(visibleButton(page, 'Eu vou: Ato pela Tarifa Zero')).toBeVisible();
  return api;
}

test.describe('presença em chamado no card real', () => {
  test('e-mail não confirmado: Eu vou mostra o aviso e não envia PUT', async ({ page }) => {
    const api = await openFeed(page, {}, { emailVerified: false });

    await visibleButton(page, 'Eu vou: Ato pela Tarifa Zero').click();

    await expect(page.getByText(NOTICE)).toBeVisible();
    await expect(visibleButton(page, 'Verificar e-mail')).toBeVisible();
    expect(api.requests).not.toContainEqual({ method: 'PUT', path: `/events/${EVENT_ID}/attendance` });

    await visibleButton(page, 'Verificar e-mail').click();
    await expect(page).toHaveURL(/\/verificar-email$/);
  });

  test('recusa da API com e-mail não verificado vira o mesmo aviso, sem toast genérico', async ({ page }) => {
    const api = await openFeed(page, {
      attendanceError: { status: 403, type: '/errors/email-not-verified', title: 'Confirme seu e-mail para continuar.' },
    });

    await visibleButton(page, 'Eu vou: Ato pela Tarifa Zero').click();

    await expect(page.getByText(NOTICE)).toBeVisible();
    await expect(visibleButton(page, 'Verificar e-mail')).toBeVisible();
    expect(api.requests).toContainEqual({ method: 'PUT', path: `/events/${EVENT_ID}/attendance` });
    await expect(page.getByText('Não foi possível atualizar sua presença. Tente de novo.')).toHaveCount(0);
  });
});
