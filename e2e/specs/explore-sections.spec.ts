import { expect, test, type Page } from '@playwright/test';

import { installApiMock } from '../support/api-mock';
import { signInToFeed, visibleButton, visibleHeading } from '../support/flows';

function post(id: string, title: string, comuna: { slug: string; name: string }, patch: Record<string, unknown> = {}) {
  return {
    id,
    body: title,
    title,
    createdAt: new Date().toISOString(),
    author: { id: `author-${id}`, handle: `autor-${id}`, displayName: 'Ana Linux', avatarUrl: null },
    comuna: { id: `uuid-${comuna.slug}`, slug: comuna.slug, name: comuna.name, status: 'active' },
    commentCount: 4,
    supportCount: 10,
    echoCount: 2,
    viewer: { isAuthor: false, canComment: true, canDelete: false, canRemove: false },
    ...patch,
  };
}

function comuna(slug: string, name: string, description: string, place: string, tone: string) {
  return {
    id: `uuid-${slug}`,
    slug,
    name,
    description,
    place,
    visibility: 'public',
    status: 'active',
    archivedAt: null,
    tone,
    topics: ['cult'],
    primaryTopic: null,
    foundedYear: 2024,
    memberCount: 120,
    moderationNote: '',
    coverUrl: null,
    markUrl: null,
    rules: [],
    owner: null,
    moderation: null,
    viewer: { isMember: false, role: null, permissions: {} },
  };
}

const EXPLORE = {
  topics: [
    { id: 'pol', label: 'Política brasileira', shortLabel: 'Política' },
    { id: 'trab', label: 'Trabalho e direitos', shortLabel: 'Trabalho' },
    { id: 'cult', label: 'Cultura', shortLabel: 'Cultura' },
    { id: 'games', label: 'Jogos', shortLabel: 'Jogos' },
    { id: 'clima', label: 'Clima', shortLabel: 'Clima' },
    { id: 'comun', label: 'Comunidade', shortLabel: 'Comunidade' },
  ],
  comunas: [
    comuna('hortas', 'Hortas da Zona Leste', 'Mutirões, mudas e compostagem no bairro.', 'São Paulo · SP', 'red'),
    comuna('comilanca', 'Comilança BH', 'Receitas, botecos e feiras da cidade.', 'Belo Horizonte · MG', 'cream'),
    comuna('jogatina', 'Jogatina BH', 'Tabuleiro, videogame e RPG.', 'Belo Horizonte · MG', 'black'),
    comuna('leitura', 'Clube do Livro BH', 'Leituras coletivas e encontros.', 'Belo Horizonte · MG', 'cream'),
    comuna('tarifa', 'Tarifa Zero BH', 'Transporte público gratuito e de qualidade.', 'Belo Horizonte · MG', 'black'),
    comuna('cursinho', 'Cursinho Popular', 'Pré-vestibular gratuito para estudantes.', 'Recife · PE', 'red'),
  ],
  people: [
    { id: 'camila', handle: 'camilarocha', displayName: 'Camila Rocha', following: false, avatarUrl: null },
    { id: 'marina', handle: 'marilopes', displayName: 'Marina Lopes', following: false, avatarUrl: null },
  ],
  posts: [
    post('livro', 'Qual livro a gente lê em novembro?', { slug: 'leitura', name: 'Clube do Livro BH' }, { commentCount: 9, poll: { id: 'poll-1', question: 'Qual livro a gente lê em novembro?', totalVotes: 3, votedOptionId: null, endsAt: null, options: [{ id: 'o1', label: 'Quarto de despejo', voteCount: 2, percent: 67, selected: false }, { id: 'o2', label: 'Pedagogia do oprimido', voteCount: 1, percent: 33, selected: false }] } }),
    post('tarifa', 'A tarifa subiu de novo. E o seu bairro?', { slug: 'tarifa', name: 'Tarifa Zero BH' }, { commentCount: 7, supportCount: 80, echoCount: 40 }),
    post('ato', 'Ato pela Tarifa Zero na Praça Sete', { slug: 'tarifa', name: 'Tarifa Zero BH' }, {
      commentCount: 3,
      event: {
        id: 'event-1', title: 'Ato pela Tarifa Zero', format: 'in_person', status: 'scheduled',
        startsAt: new Date(Date.now() + 86_400_000).toISOString(), endsAt: null, timeZone: 'America/Sao_Paulo',
        placeName: 'Praça Sete', address: null, goingCount: 12, maybeCount: 0, past: false,
      },
    }),
  ],
  recentPosts: [],
  next: { comunas: null, people: null, posts: null, events: null, documents: null },
};

async function openExplore(page: Page) {
  const api = await installApiMock(page, {}, { explore: EXPLORE, search: EXPLORE });
  await page.goto('/');
  await signInToFeed(page);
  await page.getByRole('tab', { name: 'Explorar' }).click();
  await expect(visibleHeading(page, 'Explorar')).toBeVisible();
  await expect(page.getByText('Em alta agora', { exact: true })).toBeVisible();
  return api;
}

test.describe('Explorar: Em alta agora e Comunas para conhecer', () => {
  test('mostra as seções na ordem e o card com três publicações', async ({ page }) => {
    await openExplore(page);

    const y = async (label: string) => {
      const box = await page.getByText(label, { exact: true }).filter({ visible: true }).first().boundingBox();
      expect(box).not.toBeNull();
      return box!.y;
    };
    expect(await y('Em alta agora')).toBeLessThan(await y('Assuntos'));
    expect(await y('Assuntos')).toBeLessThan(await y('Comunas para conhecer'));
    expect(await y('Comunas para conhecer')).toBeLessThan(await y('Pessoas para acompanhar'));

    await expect(page.getByText('01', { exact: true })).toBeVisible();
    await expect(page.getByText('02', { exact: true })).toBeVisible();
    await expect(page.getByText('03', { exact: true })).toBeVisible();
    await expect(page.getByText('Qual livro a gente lê em novembro?').filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/9 comentários/).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/· enquete/).filter({ visible: true }).first()).toBeVisible();
    await expect(page.getByText(/· chamado/).filter({ visible: true }).first()).toBeVisible();
  });

  test('participa de forma otimista e mantém o card na lista', async ({ page }) => {
    const api = await openExplore(page);

    await visibleButton(page, 'Participar de Hortas da Zona Leste').click();
    await expect(visibleButton(page, 'Participando de Hortas da Zona Leste')).toBeVisible();
    await expect(page.getByText('Hortas da Zona Leste').filter({ visible: true }).first()).toBeVisible();
    expect(api.requests).toContainEqual({ method: 'PUT', path: '/comunas/hortas/membership' });
  });

  test('o card abre a comuna e os dois Ver todas trocam a lista', async ({ page }) => {
    await openExplore(page);

    await page.getByRole('link', { name: 'Hortas da Zona Leste, Mutirões, mudas e compostagem no bairro.' }).click();
    await expect(page).toHaveURL(/\/explorar\/comuna\/hortas$/);
    await page.goBack();
    await expect(visibleHeading(page, 'Explorar')).toBeVisible();

    await visibleButton(page, 'Ver todas: Em alta agora').click();
    await expect(page.getByText('Em alta agora', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Qual livro a gente lê em novembro?').filter({ visible: true }).first()).toBeVisible();

    await page.getByRole('radio', { name: 'Tudo' }).click();
    await expect(page.getByText('Em alta agora', { exact: true })).toBeVisible();

    await visibleButton(page, 'Ver todas: Comunas para conhecer').click();
    await expect(page.getByText('Em alta agora', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Hortas da Zona Leste').filter({ visible: true }).first()).toBeVisible();
  });
});
