import type { Page, Route } from '@playwright/test';

/**
 * API falsa, instalada no navegador antes da primeira navegação.
 *
 * A suíte roda com `EXPO_PUBLIC_API_URL` apontando para a mesma origem do Metro
 * (`/api/v1`), então todas as chamadas passam por `page.route` e nenhuma chega ao
 * backend real. O estado é por página/contexto: cada teste começa de uma conta limpa.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Accept',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Cache-Control': 'no-store',
};

export type MockMe = {
  id: string;
  handle: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  bio: string;
  city: string | null;
  state: string | null;
  country: string | null;
  countryCode: string;
  stateIbgeCode: string | null;
  municipalityIbgeCode: string | null;
  interests: string[];
  platformRole: 'user' | 'platform_moderator' | 'admin';
  createdAt: string;
  updatedAt: string;
  pendingOnboarding: boolean;
  hasPassword: boolean;
  legalAccepted: boolean;
  welcomeDismissed?: boolean;
  followerCount: number;
  followingCount: number;
  avatarUrl: string | null;
};

export type MockApi = {
  /** Conta devolvida por GET /me; PATCH /me e o cadastro atualizam este objeto. */
  me: MockMe;
  /** Corpo enviado a POST /auth/register, para asserções do cadastro. */
  registration: Record<string, unknown> | null;
  /** Publicações criadas em POST /posts, da mais nova para a mais antiga. */
  createdPosts: Record<string, unknown>[];
  /** Requisições recebidas, na ordem. Útil para provar que uma chamada aconteceu. */
  requests: { method: string; path: string }[];
};

export const DEMO_EMAIL = 'equipe.demo@popularia.local';
export const DEMO_PASSWORD = 'demo-somente-local';
export const NEW_ACCOUNT_EMAIL = 'maria.e2e@popularia.local';
export const NEW_ACCOUNT_HANDLE = 'maria.e2e';

export const DEMO_ACCOUNT: MockMe = {
  id: '11111111-1111-4111-8111-111111111111',
  handle: 'equipe.demo',
  displayName: 'Equipe Demo',
  email: DEMO_EMAIL,
  emailVerified: true,
  bio: 'Conta de teste da automação E2E.',
  city: 'São Paulo',
  state: 'São Paulo',
  country: 'Brasil',
  countryCode: 'BR',
  stateIbgeCode: '35',
  municipalityIbgeCode: '3550308',
  interests: ['pol', 'edu'],
  platformRole: 'user',
  createdAt: '2026-01-15T12:00:00-03:00',
  updatedAt: '2026-02-01T12:00:00-03:00',
  pendingOnboarding: false,
  hasPassword: true,
  legalAccepted: true,
  followerCount: 42,
  followingCount: 7,
  avatarUrl: null,
};

const TOPICS = [
  { id: 'pol', label: 'Política brasileira', shortLabel: 'Política', group: 'Política e direitos' },
  { id: 'trab', label: 'Trabalho e direitos trabalhistas', shortLabel: 'Trabalho', group: 'Política e direitos' },
  { id: 'edu', label: 'Educação', shortLabel: 'Educação', group: 'Bem comum' },
  { id: 'saude', label: 'Saúde pública', shortLabel: 'Saúde', group: 'Bem comum' },
  { id: 'cult', label: 'Cultura, música e arte', shortLabel: 'Cultura', group: 'Cultura e ideias' },
  { id: 'clima', label: 'Meio ambiente e clima', shortLabel: 'Clima', group: 'Bem comum' },
  { id: 'tec', label: 'Tecnologia e ciência', shortLabel: 'Tecnologia', group: 'Cultura e ideias' },
];

const GAMIFICATION = {
  id: 'e2e-gamification',
  level: 1,
  xp: 10,
  currentLevelXp: 0,
  nextLevelXp: 100,
  streak: 1,
  lastActivityOn: '2026-02-01',
  missionBonusXp: 4,
  dayBonusXp: 6,
  missions: [
    { action: 'poll_participated', label: 'Participe de uma enquete', completed: false },
    { action: 'post_saved', label: 'Salve uma publicação', completed: false },
    { action: 'event_rsvp_positive', label: 'Confirme interesse em um evento', completed: false },
  ],
  achievements: [
    {
      code: 'primeiro_passo',
      title: 'Primeiro passo',
      detail: 'Participou da primeira enquete.',
      criterion: 'Participe de uma enquete.',
      unlocked: false,
      unlockedAt: null,
    },
  ],
};

function tokens() {
  return {
    tokenType: 'Bearer',
    accessToken: 'e2e-access-token',
    accessTokenExpiresIn: 3600,
    refreshToken: 'e2e-refresh-token',
    refreshTokenExpiresIn: 86_400,
    sessionId: 'e2e-session',
  };
}

function pageOf(items: unknown[] = []) {
  return { items, nextCursor: null };
}

/** Paginação opaca por cursor para os cenários de lista longa (feed e Biblioteca). */
function cursorPage(items: unknown[], cursor: string | null, pageSize: number) {
  if (!Number.isFinite(pageSize) || pageSize <= 0) return pageOf(items);
  const parsed = Number.parseInt(cursor ?? '0', 10);
  const start = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  const end = start + pageSize;
  return {
    items: items.slice(start, end),
    nextCursor: end < items.length ? String(end) : null,
  };
}

function problem(status: number, type: string, title: string) {
  return { status, body: { type, title, status } };
}

function parseBody(route: Route): Record<string, unknown> {
  try {
    return (route.request().postDataJSON() as Record<string, unknown> | null) ?? {};
  } catch {
    return {};
  }
}

function profileOf(me: MockMe) {
  return {
    id: me.id,
    handle: me.handle,
    displayName: me.displayName,
    bio: me.bio,
    city: me.city,
    isPrivate: false,
    followerCount: me.followerCount,
    followingCount: me.followingCount,
    viewerFollowing: false,
    avatarUrl: me.avatarUrl,
    memberSince: me.createdAt,
  };
}

export type MockApiOptions = {
  /** Publicações devolvidas por GET /feed; vazio por padrão para não alterar os specs existentes. */
  feedItems?: unknown[];
  /** Quando presente, GET /feed pagina `feedItems` e as publicações criadas por POST /posts. */
  feedPageSize?: number;
  /** Publicações devolvidas por GET /users/{id}/posts; vazio por padrão. */
  profilePosts?: unknown[];
  /** Documentos devolvidos por GET /library/documents; vazio por padrão. */
  libraryDocuments?: unknown[];
  /** Quando presente, GET /library/documents pagina a lista por cursor. */
  libraryDocumentPageSize?: number;
  /** Pessoas que GET /me/blocks devolve como já bloqueadas. */
  blockedHandles?: string[];
  /** Corpo de GET /explore; sem ele, a descoberta volta vazia. */
  explore?: unknown;
  /** Corpo de GET /search; sem ele, usa o mesmo corpo de /explore. */
  search?: unknown;
  /** Praças devolvidas por GET /squares?section=mine e section=discover. */
  squares?: { mine?: unknown[]; discover?: unknown[] };
  /** Corpo de GET /squares/{id}; necessário para abrir uma Praça. */
  square?: unknown;
  /**
   * Mensagens de GET /squares/{id}/messages, da mais nova para a mais antiga.
   * O teste pode modificar este array (unshift) para simular o polling trazendo
   * mensagens novas. A paginação usa `squareMessagePageSize`.
   */
  squareMessages?: unknown[];
  /** Mensagens por página do histórico da Praça; padrão 30. */
  squareMessagePageSize?: number;
  /** Quando presente, PUT /events/{id}/attendance responde este problema em vez de 200. */
  attendanceError?: { status: number; type: string; title: string };
};

export async function installApiMock(page: Page, initial: Partial<MockMe> = {}, options: MockApiOptions = {}): Promise<MockApi> {
  const state: MockApi = {
    me: { ...DEMO_ACCOUNT, ...initial },
    registration: null,
    createdPosts: [],
    requests: [],
  };
  // Última mensagem já entregue ao app; o polling pede só o que veio depois.
  let latestSquareMessageId: string | null = null;

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api\/v1/, '') || '/';
    const method = request.method();
    state.requests.push({ method, path });

    const fulfill = async (status = 200, body?: unknown) => {
      if (status === 204 || body === undefined) {
        await route.fulfill({ status, headers: CORS });
        return;
      }
      await route.fulfill({
        status,
        headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(body),
      });
    };

    try {
      if (method === 'OPTIONS') {
        await fulfill(204);
        return;
      }

      // Sessão
      if (path === '/auth/login' && method === 'POST') {
        const body = parseBody(route);
        const email = String(body.email ?? '');
        const password = String(body.password ?? '');
        const validDemo = email === DEMO_EMAIL && password === DEMO_PASSWORD;
        const validNew = state.registration !== null && email === state.me.email && password.length > 0;
        if (validDemo || validNew) {
          await fulfill(200, tokens());
          return;
        }
        const failure = problem(401, '/errors/invalid-credentials', 'E-mail ou senha incorretos.');
        await fulfill(failure.status, failure.body);
        return;
      }

      if (path === '/auth/register' && method === 'POST') {
        const body = parseBody(route);
        state.registration = body;
        state.me = {
          ...state.me,
          email: String(body.email ?? state.me.email),
          displayName: String(body.displayName ?? state.me.displayName),
          handle: String(body.handle ?? state.me.handle),
          bio: String(body.bio ?? ''),
          city: (body.city as string | undefined) ?? state.me.city,
          state: (body.state as string | undefined) ?? state.me.state,
          country: (body.country as string | undefined) ?? state.me.country,
          countryCode: String(body.countryCode ?? 'BR'),
          stateIbgeCode: (body.stateIbgeCode as string | undefined) ?? state.me.stateIbgeCode,
          municipalityIbgeCode: (body.municipalityIbgeCode as string | undefined) ?? state.me.municipalityIbgeCode,
          emailVerified: false,
          pendingOnboarding: false,
          legalAccepted: true,
          // Conta nova não herda os interesses da conta semeada.
          interests: [],
        };
        await fulfill(202, { status: 'accepted' });
        return;
      }

      if (path === '/auth/refresh' && method === 'POST') {
        const failure = problem(401, '/errors/unauthorized', 'Sua sessão terminou. Entre novamente.');
        await fulfill(failure.status, failure.body);
        return;
      }

      if ((path === '/auth/logout' || path === '/auth/logout-all') && method === 'POST') {
        await fulfill(204);
        return;
      }

      if (path === '/auth/social' && method === 'POST') {
        // A troca nativa Google/Apple não roda no navegador; a API existe só para
        // deixar explícito o contrato caso o fluxo seja exercitado no futuro.
        await fulfill(200, { ...tokens(), status: 'authenticated', onboardingRequired: false });
        return;
      }

      // Conta
      if (path === '/me' && method === 'GET') {
        await fulfill(200, state.me);
        return;
      }
      if (path === '/me' && method === 'PATCH') {
        const body = parseBody(route);
        state.me = {
          ...state.me,
          ...body,
          interests: Array.isArray(body.interests) ? body.interests.map(String) : state.me.interests,
          updatedAt: new Date().toISOString(),
        } as MockMe;
        await fulfill(200, state.me);
        return;
      }
      if (path === '/me/complete-onboarding' && method === 'POST') {
        await fulfill(200, state.me);
        return;
      }
      if (path === '/me/email-verification' && method === 'POST') {
        state.me = { ...state.me, emailVerified: true };
        await fulfill(204);
        return;
      }
      if (path === '/me/email-verification/resend' && method === 'POST') {
        await fulfill(202, { status: 'accepted' });
        return;
      }
      if (path === '/me/gamification' && method === 'GET') {
        await fulfill(200, GAMIFICATION);
        return;
      }
      if (path === '/me/notifications/unread-count' && method === 'GET') {
        await fulfill(200, { unreadCount: 0 });
        return;
      }
      if (path === '/me/notifications' && method === 'GET') {
        await fulfill(200, pageOf());
        return;
      }
      if (path === '/me/comunas' && method === 'GET') {
        await fulfill(200, pageOf());
        return;
      }
      if (path === '/me/saved-posts' && method === 'GET') {
        await fulfill(200, pageOf());
        return;
      }

      // Praças: lista, detalhe, histórico paginado e presença/leitura.
      if (path === '/squares' && method === 'GET') {
        const section = url.searchParams.get('section');
        await fulfill(200, pageOf(section === 'mine' ? options.squares?.mine ?? [] : options.squares?.discover ?? []));
        return;
      }
      if (/^\/squares\/[^/]+\/messages$/.test(path) && method === 'GET') {
        const all = options.squareMessages ?? [];
        const after = url.searchParams.get('after');
        const cursor = url.searchParams.get('cursor');
        const size = options.squareMessagePageSize ?? 30;
        let items: unknown[];
        let nextCursor: string | null = null;
        if (after !== null) {
          // O app informa o changeCursor numérico; a mensagem nova é a que veio
          // depois da última entregue nesta página.
          items = all.filter((item) => {
            const id = (item as { id?: string }).id ?? '';
            return latestSquareMessageId === null || id > latestSquareMessageId;
          });
        } else if (cursor) {
          const index = all.findIndex((item) => (item as { id?: string }).id === cursor);
          const start = index >= 0 ? index + 1 : 0;
          items = all.slice(start, start + size);
          nextCursor = start + size < all.length ? (items.at(-1) as { id?: string })?.id ?? null : null;
        } else {
          items = all.slice(0, size);
          nextCursor = size < all.length ? (items.at(-1) as { id?: string })?.id ?? null : null;
        }
        const newest = (items[0] as { id?: string } | undefined)?.id;
        if (newest) latestSquareMessageId = newest;
        await fulfill(200, {
          items,
          nextCursor,
          changeCursor: 1,
          hasMoreChanges: false,
          refreshed: [],
          square: options.square,
        });
        return;
      }
      if (/^\/squares\/[^/]+\/presence$/.test(path)) {
        await fulfill(200, { count: 2, people: [] });
        return;
      }
      if (/^\/squares\/[^/]+\/read$/.test(path) && method === 'PUT') {
        await fulfill(204);
        return;
      }
      if (/^\/squares\/[^/]+$/.test(path) && method === 'GET') {
        await fulfill(200, options.square);
        return;
      }

      // Publicações: criação real no mock e leitura por ID para a discussão.
      if (path === '/posts' && method === 'POST') {
        const body = parseBody(route);
        const created = {
          id: `e2e-created-post-${state.createdPosts.length + 1}`,
          body: String(body.body ?? ''),
          title: body.title ? String(body.title) : null,
          createdAt: new Date().toISOString(),
          author: {
            id: state.me.id,
            handle: state.me.handle,
            displayName: state.me.displayName,
            avatarUrl: state.me.avatarUrl,
          },
          comuna: null,
          commentCount: 0,
          supportCount: 0,
          echoCount: 0,
          viewer: { isAuthor: true, canComment: true, canDelete: true, canRemove: false },
          ...(body.topic ? { topic: body.topic } : {}),
          ...(body.poll && typeof body.poll === 'object' ? { poll: body.poll } : {}),
        };
        state.createdPosts.unshift(created);
        await fulfill(201, created);
        return;
      }
      if (/^\/posts\/[^/]+$/.test(path) && method === 'GET') {
        const id = decodeURIComponent(path.split('/')[2] ?? '');
        const post = [...state.createdPosts, ...(options.feedItems ?? [])]
          .find((item) => (item as { id?: string }).id === id);
        if (!post) {
          const failure = problem(404, '/errors/not-found', 'Publicação não encontrada.');
          await fulfill(failure.status, failure.body);
          return;
        }
        await fulfill(200, post);
        return;
      }
      if (/^\/posts\/[^/]+\/comments$/.test(path) && method === 'GET') {
        await fulfill(200, pageOf());
        return;
      }

      // Descoberta e feed
      if (path === '/feed' && method === 'GET') {
        const items = [...state.createdPosts, ...(options.feedItems ?? [])];
        await fulfill(200, options.feedPageSize
          ? cursorPage(items, url.searchParams.get('cursor'), options.feedPageSize)
          : pageOf(items));
        return;
      }
      if (path === '/library/documents' && method === 'GET') {
        const term = (url.searchParams.get('q') ?? '').trim().toLocaleLowerCase('pt-BR');
        const documents = (options.libraryDocuments ?? []).filter((item) => {
          if (!term) return true;
          const document = item as { title?: string | null; description?: string | null; author?: string | null };
          return [document.title, document.description, document.author]
            .some((value) => (value ?? '').toLocaleLowerCase('pt-BR').includes(term));
        });
        await fulfill(200, options.libraryDocumentPageSize
          ? cursorPage(documents, url.searchParams.get('cursor'), options.libraryDocumentPageSize)
          : pageOf(documents));
        return;
      }
      if (/^\/library\/documents\/[^/]+$/.test(path) && method === 'GET') {
        const id = decodeURIComponent(path.split('/')[3] ?? '');
        const document = (options.libraryDocuments ?? [])
          .find((item) => (item as { id?: string }).id === id);
        if (!document) {
          const failure = problem(404, '/errors/not-found', 'Documento não encontrado.');
          await fulfill(failure.status, failure.body);
          return;
        }
        await fulfill(200, document);
        return;
      }
      if (path === '/me/blocks' && method === 'GET') {
        await fulfill(200, (options.blockedHandles ?? []).map((handle) => ({ handle, displayName: handle })));
        return;
      }
      if (path === '/explore' && method === 'GET') {
        await fulfill(200, options.explore ?? {
          topics: [], comunas: [], people: [], posts: [], recentPosts: [],
          next: { comunas: null, people: null, posts: null, events: null, documents: null },
        });
        return;
      }
      if (path === '/comunas' && method === 'GET') {
        await fulfill(200, pageOf());
        return;
      }
      if (path === '/topics' && method === 'GET') {
        await fulfill(200, TOPICS);
        return;
      }
      if (path === '/search' && method === 'GET') {
        await fulfill(200, options.search ?? options.explore ?? {
          topics: [], comunas: [], people: [], posts: [], recentPosts: [],
          next: { comunas: null, people: null, posts: null, events: null, documents: null },
        });
        return;
      }

      // Presença em chamado: o cenário de e-mail não confirmado força o problema da API.
      if (/^\/events\/[^/]+\/attendance$/.test(path) && method === 'PUT') {
        if (options.attendanceError) {
          const failure = problem(options.attendanceError.status, options.attendanceError.type, options.attendanceError.title);
          await fulfill(failure.status, failure.body);
          return;
        }
        await fulfill(200, {});
        return;
      }

      // Cadastro: identificador e localização
      if (path === '/handles/suggestion' && method === 'GET') {
        await fulfill(200, { handle: NEW_ACCOUNT_HANDLE });
        return;
      }
      if (/^\/handles\/[^/]+\/availability$/.test(path) && method === 'GET') {
        const handle = decodeURIComponent(path.split('/')[2] ?? '');
        await fulfill(200, { handle, available: true });
        return;
      }
      if (path === '/locations/countries' && method === 'GET') {
        await fulfill(200, { items: [{ code: 'BR', name: 'Brasil' }] });
        return;
      }
      if (path === '/locations/br/states' && method === 'GET') {
        await fulfill(200, { items: [{ id: '35', name: 'São Paulo', abbreviation: 'SP' }] });
        return;
      }
      if (path === '/locations/br/states/35/municipalities' && method === 'GET') {
        await fulfill(200, { items: [{ id: '3550308', name: 'São Paulo' }] });
        return;
      }

      // Perfil
      if (/^\/users\/[^/]+\/posts$/.test(path) && method === 'GET') {
        await fulfill(200, pageOf(options.profilePosts));
        return;
      }
      if (/^\/users\/[^/]+$/.test(path) && method === 'GET') {
        await fulfill(200, profileOf(state.me));
        return;
      }
      if (/^\/users\/[^/]+\/follow$/.test(path) && method === 'GET') {
        await fulfill(200, { following: false, requested: false });
        return;
      }

      // Fallback: listas paginadas vazias e mutações aceitas.
      if (method === 'GET') {
        await fulfill(200, pageOf());
        return;
      }
      await fulfill(200, {});
    } catch (error) {
      // A página pode cancelar a requisição durante navegação; não deixe o teste falhar por isso.
      if (route.request().failure()) return;
      throw error;
    }
  });

  return state;
}
