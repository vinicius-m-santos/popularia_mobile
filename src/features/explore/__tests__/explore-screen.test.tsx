import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { settleQueryClient } from '@/features/events/query-test-utils';
import { goBack } from '@/lib/routes';
import { queryClient } from '@/lib/query/client';
import { discoveryKeys } from '@/lib/query/keys';

import { searchDiscovery, getDiscoveryData, type DiscoveryData, type DiscoveryEntry } from '../api';
import ExploreScreen, { stableInterestsFor, TopicScreen } from '../explore-screen';
import type { Page } from '@/lib/pagination';
import type { TopicId } from '@/types/models';

const mockFocusCallbacks = new Set<() => void>();
const mockOpenProfile = jest.fn();
const mockOpenComuna = jest.fn();
const mockOpenPost = jest.fn();
let mockTopicId = 'tec';
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
  useScrollToTop: () => undefined,
  useLocalSearchParams: () => ({ id: mockTopicId }),
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual<typeof import('react')>('react');
    React.useEffect(() => {
      mockFocusCallbacks.add(callback);
      callback();
      return () => { mockFocusCallbacks.delete(callback); };
    }, [callback]);
  },
}));
jest.mock('@/lib/routes', () => ({
  useNav: () => ({ openProfile: mockOpenProfile, openComuna: mockOpenComuna, openPost: mockOpenPost }),
  goBack: jest.fn(),
}));
jest.mock('@/features/account/account-context', () => {
  const interests = ['tec'];
  return { useMe: () => ({ id: 'me' }), useAccount: () => ({ interests, profile: { city: 'São Paulo · SP' } }) };
});
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('@/features/interactions/interactions-context', () => ({ useInteractions: () => ({ membershipOf: () => false, setOn: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/features/comunas/components/join-button', () => ({ JoinButton: () => null }));
jest.mock('@/features/profiles/components/person-row', () => ({
  PersonRow: ({ user, onOpen }: { user: { name: string }; onOpen: () => void }) => {
    const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
    return <Pressable onPress={onOpen} accessibilityLabel={`Abrir pessoa ${user.name}`}><Text>{user.name}</Text></Pressable>;
  },
}));
jest.mock('../api', () => ({ getDiscoveryData: jest.fn(), searchDiscovery: jest.fn() }));

const getData = jest.mocked(getDiscoveryData);
const search = jest.mocked(searchDiscovery);
const person = { id: 'ana', handle: 'analinux', name: 'Ana Linux', initials: 'AL', tone: 'red' as const };
const comunaRef = { id: 'linux', name: 'Linux Brasil', status: 'active' as const };
const post = { id: 'post1', authorId: 'ana', author: person, comunaId: 'linux', comuna: comunaRef, text: 'Linux nas escolas', createdAt: new Date().toISOString(), supportCount: 0, commentCount: 2, echoCount: 0, event: null, topCommentAuthor: null };
const comuna = { id: 'linux', name: 'Linux Brasil', handle: 'linux', initials: 'LB', tone: 'red' as const, description: 'Software livre', memberCount: 3, topics: ['tec' as const], place: '', foundedYear: '2026', coverAlt: '', stats: [], rules: [], moderationNote: '', pinned: null, moderatorIds: [], founderRole: '', featuredMemberIds: [], visibility: 'public' as const };
const event = {
  id: 'ev1', title: 'Assembleia', description: 'Pauta do mês', format: 'in_person' as const, status: 'scheduled' as const,
  timeZone: 'America/Manaus', startsAt: '2026-11-05T19:00:00-04:00', endsAt: null, placeName: 'Sindicato', address: null, onlineUrl: null,
  comuna: { id: 'c', slug: 'hortas', name: 'Hortas', visibility: 'public', status: 'active' }, organizer: null,
  goingCount: 2, maybeCount: 0, viewerAttendance: null, canManage: false, canRespond: true, past: false,
  createdAt: '2026-11-01T15:00:00Z', updatedAt: '2026-11-01T15:00:00Z', cancelledAt: null,
};
const entries: DiscoveryEntry[] = [
  { id: comuna.id, kind: 'comunas', value: comuna },
  { id: person.id, kind: 'people', value: person },
  { id: post.id, kind: 'posts', value: post },
];
const data: DiscoveryData = {
  topics: [{ id: 'tec', label: 'Tecnologia e ciência', shortLabel: 'Tecnologia' }],
  comunas: [comuna], people: [person], posts: [post], recentPosts: [], documents: [], events: [],
  next: { comunas: null, people: null, posts: null, events: null, documents: null },
};

beforeEach(() => {
  settleQueryClient();
  queryClient.clear();
  mockFocusCallbacks.clear();
  jest.clearAllMocks();
  // `clearAllMocks` não descarta filas de `mockResolvedValueOnce` de outro teste.
  getData.mockReset();
  search.mockReset();
  getData.mockResolvedValue(data);
  search.mockImplementation(async (_me, _q, filter) => ({ items: filter === 'all' ? entries : entries.filter((e) => e.kind === filter), nextCursor: null }));
  mockTopicId = 'tec';
});
afterEach(() => { cleanup(); mockFocusCallbacks.clear(); });

// A busca permanece montada na descoberta; descarte também seus timers de cache ao encerrar.
afterAll(() => { queryClient.clear(); });

async function debounce() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
}

describe('Explorar', () => {
  it('reaproveita a referência de interests com o mesmo conteúdo', () => {
    const first: TopicId[] = ['pol'];
    const second: TopicId[] = ['pol'];
    expect(stableInterestsFor(first, 'pol')).toBe(first);
    expect(stableInterestsFor(second, 'pol')).toBe(first);

    const changed: TopicId[] = ['trab'];
    expect(stableInterestsFor(changed, 'trab')).toBe(changed);

    const empty = stableInterestsFor(undefined, '');
    expect(stableInterestsFor(undefined, '')).toBe(empty);
  });

  it('mantém todos os assuntos acessíveis sem alongar a entrada e abre o escolhido', async () => {
    const topics = Array.from({ length: 8 }, (_, index) => ({ id: `topic-${index}` as typeof data.topics[number]['id'], label: `Assunto ${index}`, shortLabel: `Assunto ${index}` }));
    getData.mockResolvedValue({ ...data, topics });
    await render(<ExploreScreen />);
    await screen.findByLabelText('Explorar Assunto 0');
    expect(screen.queryByLabelText('Explorar Assunto 7')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver todos: Assuntos' }));
    await fireEvent.press(await screen.findByLabelText('Explorar Assunto 7'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/explorar/assunto/[id]', params: { id: 'topic-7' } });
    await waitFor(() => expect(screen.queryByText('Todos os assuntos')).toBeNull());
  });

  it('limita os destaques e dá acesso às demais publicações pela categoria', async () => {
    const posts = Array.from({ length: 5 }, (_, index) => ({ ...post, id: `post-${index}`, text: `Discussão ${index}` }));
    getData.mockResolvedValue({ ...data, posts });
    search.mockResolvedValue({ items: posts.map((value) => ({ id: value.id, kind: 'posts', value })), nextCursor: null });
    await render(<ExploreScreen />);
    await screen.findByText('Discussão 0');
    expect(screen.queryByText('Discussão 3')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver todas: Em alta agora' }));
    expect(await screen.findByText('Discussão 4')).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Tudo' }));
    expect(await screen.findByText('Em alta agora')).toBeTruthy();
    expect(screen.queryByText('Discussão 4')).toBeNull();
  });

  it('voltar de um detalhe preserva termo e filtro e revalida os resultados', async () => {
    await render(<ExploreScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Buscar na Popularia'), 'Linux');
    await debounce();
    await fireEvent.press(await screen.findByLabelText('Ver todas: Publicações'));
    await fireEvent.press(await screen.findByLabelText(/Abrir publicação de Ana/));
    const before = search.mock.calls.length;
    await act(async () => { mockFocusCallbacks.forEach((focus) => focus()); });
    await waitFor(() => expect(search.mock.calls.length).toBe(before + 1));
    expect(screen.getByLabelText('Buscar na Popularia').props.value).toBe('Linux');
    expect(search).toHaveBeenLastCalledWith('me', 'Linux', 'posts', undefined, null, expect.anything());
    expect(mockOpenPost).toHaveBeenCalledWith('post1');
  });

  it('remonta a descoberta com o cache compartilhado e sem spinner', async () => {
    const { rerender } = await render(<ExploreScreen key="first" />);
    await screen.findByText('Comunas para conhecer');
    expect(getData).toHaveBeenCalledTimes(1);

    await rerender(<ExploreScreen key="second" />);
    expect(screen.getByText('Comunas para conhecer')).toBeTruthy();
    expect(screen.queryByTestId('trending-skeleton')).toBeNull();
    expect(getData).toHaveBeenCalledTimes(1);
  });

  it('remonta a busca com as páginas já carregadas e sem repetir a consulta', async () => {
    const secondPerson = { ...person, id: 'bia', handle: 'bia', name: 'Bia Rural' };
    const searchMarker = { ...post, id: 'search-marker', text: 'Resultado exclusivo da busca' };
    search.mockImplementation(async (_me, _q, filter, _topic, cursor) => {
      if (filter !== 'people') return { items: [{ id: searchMarker.id, kind: 'posts', value: searchMarker }], nextCursor: null };
      return cursor
        ? { items: [{ id: secondPerson.id, kind: 'people', value: secondPerson }], nextCursor: null }
        : { items: [{ id: person.id, kind: 'people', value: person }], nextCursor: 'p2' };
    });
    const { rerender } = await render(<ExploreScreen key="first" />);
    await fireEvent.changeText(await screen.findByLabelText('Buscar na Popularia'), 'Linux');
    await debounce();
    await screen.findByText('Resultado exclusivo da busca');
    await fireEvent.press(await screen.findByRole('radio', { name: 'Pessoas' }));
    await screen.findByText('Ana Linux');
    await fireEvent.press(await screen.findByText('Carregar mais'));
    await screen.findByText('Bia Rural');
    const calls = search.mock.calls.length;

    await rerender(<ExploreScreen key="second" />);
    await fireEvent.changeText(await screen.findByLabelText('Buscar na Popularia'), 'Linux');
    await debounce();
    await screen.findByText('Resultado exclusivo da busca');
    await fireEvent.press(await screen.findByRole('radio', { name: 'Pessoas' }));
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Pessoas' }).props.accessibilityState.checked).toBe(true));
    expect(await screen.findByText('Ana Linux')).toBeTruthy();
    expect(screen.getByText('Bia Rural')).toBeTruthy();
    expect(search).toHaveBeenCalledTimes(calls);
  });

  it('abre descoberta, assunto e os destinos existentes de pessoa/comuna/publicação', async () => {
    await render(<ExploreScreen />);
    await fireEvent.press(await screen.findByLabelText('Abrir Biblioteca Pública'));
    await fireEvent.press(await screen.findByLabelText('Explorar Tecnologia'));
    expect(router.push).toHaveBeenCalledWith('/biblioteca');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/explorar/assunto/[id]', params: { id: 'tec' } });
    await fireEvent.press(screen.getByLabelText('Abrir pessoa Ana Linux'));
    await fireEvent.press(screen.getByLabelText('Linux Brasil, Software livre'));
    await fireEvent.press(screen.getByLabelText(/Abrir publicação de Ana/));
    expect(mockOpenProfile).toHaveBeenCalledWith('ana');
    expect(mockOpenComuna).toHaveBeenCalledWith('linux');
    expect(mockOpenPost).toHaveBeenCalledWith('post1');
    expect(getData).toHaveBeenCalledTimes(1);
    expect(search).not.toHaveBeenCalled();
  });

  it('aguarda o mínimo e debounce; alterna filtros e Ver todas mantendo o termo', async () => {
    await render(<ExploreScreen />);
    const input = await screen.findByLabelText('Buscar na Popularia');
    await fireEvent.changeText(input, 'Li');
    await debounce();
    expect(search).not.toHaveBeenCalled();
    expect(screen.getByText('Continue escrevendo')).toBeTruthy();
    await fireEvent.changeText(input, 'Linux');
    expect(search).not.toHaveBeenCalled();
    await debounce();
    expect(search).toHaveBeenLastCalledWith('me', 'Linux', 'all', undefined, null, expect.anything());
    await fireEvent.press(await screen.findByLabelText('Ver todas: Pessoas'));
    expect(search).toHaveBeenLastCalledWith('me', 'Linux', 'people', undefined, null, expect.anything());
    await fireEvent.press(screen.getByText('Publicações'));
    expect(search).toHaveBeenLastCalledWith('me', 'Linux', 'posts', undefined, null, expect.anything());
  });

  it('mantém as linhas estáveis enquanto o termo ainda aguarda o debounce', async () => {
    await render(<ExploreScreen />);
    const input = await screen.findByLabelText('Buscar na Popularia');
    await fireEvent.changeText(input, 'Linux');
    const loadingRows = screen.getByTestId('explore-list').props.data;
    expect(loadingRows).toEqual(expect.arrayContaining([expect.objectContaining({ key: 'search-loading' })]));

    await fireEvent.changeText(input, 'Linuxx');
    expect(screen.getByTestId('explore-list').props.data).toBe(loadingRows);
    await debounce();
  });

  it('não mostra resposta antiga como resultado de outro termo', async () => {
    let finish: (page: Page<DiscoveryEntry>) => void = () => {};
    search.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await render(<ExploreScreen />);
    const input = await screen.findByLabelText('Buscar na Popularia');
    await fireEvent.changeText(input, 'Linux');
    await debounce();
    search.mockResolvedValue({ items: [], nextCursor: null });
    await fireEvent.changeText(input, 'Livros');
    await debounce();
    expect(await screen.findByText('Nada por aqui ainda.')).toBeTruthy();
    await act(async () => finish({ items: entries, nextCursor: null }));
    expect(screen.queryByText('Linux nas escolas')).toBeNull();
    expect(screen.getByText('Nada por aqui ainda.')).toBeTruthy();
  });

  it('mostra loading, erro e retry da descoberta', async () => {
    let fail: (error: Error) => void = () => {};
    getData.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
    await render(<ExploreScreen />);
    expect(screen.getByTestId('trending-skeleton')).toBeTruthy();
    await act(async () => fail(new Error('offline')));
    await fireEvent.press(await screen.findByText('Tentar de novo'));
    expect(await screen.findByText('Comunas para conhecer')).toBeTruthy();
  });

  it('revalidação automática ao voltar não ativa o inset nativo de pull-to-refresh', async () => {
    await render(<ExploreScreen />);
    await screen.findByText('Comunas para conhecer');
    let finish: (value: DiscoveryData) => void = () => {};
    getData.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await act(async () => { mockFocusCallbacks.forEach((focus) => focus()); });
    const refreshControl = screen.container.queryAll((element) => element.type === 'RCTRefreshControl')[0];
    expect(refreshControl.props.refreshing).toBeFalsy();
    await act(async () => finish(data));
  });

  it('busca vazia, erro/retry e paginação de uma categoria', async () => {
    search.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ items: [], nextCursor: null });
    await render(<ExploreScreen />);
    await fireEvent.press(await screen.findByLabelText('Ver todas: Comunas para conhecer'));
    await fireEvent.press(await screen.findByText('Tentar de novo'));
    expect(await screen.findByText('Nada nesta categoria por enquanto.')).toBeTruthy();
    search.mockResolvedValueOnce({ items: [entries[0]], nextCursor: 'cursor1' }).mockResolvedValueOnce({ items: [], nextCursor: null });
    await fireEvent.press(screen.getByText('Tudo'));
    // A categoria já estava em cache fresco; invalide para exercitar a paginação.
    queryClient.removeQueries({ queryKey: discoveryKeys.search('me', '', 'comunas', null) });
    await fireEvent.press(await screen.findByLabelText('Ver todas: Comunas para conhecer'));
    await fireEvent.press(await screen.findByText('Carregar mais'));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith('me', '', 'comunas', undefined, 'cursor1', expect.anything()));
  });

  it('seleciona Eventos sem termo e lista a categoria completa', async () => {
    search.mockResolvedValue({ items: [{ id: 'ev1', kind: 'events', value: event }], nextCursor: null });
    await render(<ExploreScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Eventos' }));
    expect(await screen.findByText('Assembleia')).toBeTruthy();
    expect(search).toHaveBeenLastCalledWith('me', '', 'events', undefined, null, expect.anything());
    expect(screen.queryByText('Nada nesta categoria por enquanto.')).toBeNull();
  });

  it('distingue Eventos sem resultado de falha da API e permite tentar de novo', async () => {
    search.mockResolvedValueOnce({ items: [], nextCursor: null });
    await render(<ExploreScreen />);
    await fireEvent.press(await screen.findByRole('radio', { name: 'Eventos' }));
    expect(await screen.findByText('Nada nesta categoria por enquanto.')).toBeTruthy();
    expect(screen.queryByText('Tentar de novo')).toBeNull();

    search.mockRejectedValueOnce(new Error('HTTP 500')).mockResolvedValueOnce({ items: [{ id: 'ev1', kind: 'events', value: event }], nextCursor: null });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Tudo' }));
    // Sem remover o cache fresco, voltar para Eventos mostraria o vazio anterior.
    queryClient.removeQueries({ queryKey: discoveryKeys.search('me', '', 'events', null) });
    await fireEvent.press(await screen.findByRole('radio', { name: 'Eventos' }));
    expect(await screen.findByText('Não conseguimos buscar agora.')).toBeTruthy();
    expect(screen.queryByText('Nada nesta categoria por enquanto.')).toBeNull();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByText('Assembleia')).toBeTruthy();
    expect(screen.queryByText('Não conseguimos buscar agora.')).toBeNull();
    expect(search).toHaveBeenLastCalledWith('me', '', 'events', undefined, null, expect.anything());
  });

  it('não mostra resultados de outra categoria quando Eventos falha', async () => {
    await render(<ExploreScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Buscar na Popularia'), 'Linux');
    await debounce();
    expect(await screen.findByText('Linux nas escolas')).toBeTruthy();

    search.mockRejectedValueOnce(new Error('HTTP 500'));
    await fireEvent.press(await screen.findByRole('radio', { name: 'Eventos' }));
    expect(await screen.findByText('Não conseguimos buscar agora.')).toBeTruthy();
    expect(screen.queryByText('Linux nas escolas')).toBeNull();
    expect(screen.queryByText('Nada nesta categoria por enquanto.')).toBeNull();
  });
});

describe('página de Assunto', () => {
  it('contextualiza descoberta/busca, oculta Pessoas e Ver todas mantém o assunto', async () => {
    getData.mockResolvedValue({ ...data, people: [], recentPosts: [{ ...post, id: 'recent', text: 'Conversa recente' }] });
    await render(<TopicScreen />);
    expect(await screen.findByText('Tecnologia')).toBeTruthy();
    expect(screen.queryByText('Pessoas')).toBeNull();
    expect(screen.getByText('Em destaque')).toBeTruthy();
    expect(screen.getByText('Publicações recentes')).toBeTruthy();
    expect(getData).toHaveBeenCalledWith('me', 'tec', expect.anything());
    await fireEvent.changeText(screen.getByLabelText('Buscar em Tecnologia'), 'Linux');
    await debounce();
    expect(search).toHaveBeenLastCalledWith('me', 'Linux', 'all', 'tec', null, expect.anything());
    await fireEvent.press(await screen.findByLabelText('Ver todas: Comunas'));
    expect(search).toHaveBeenLastCalledWith('me', 'Linux', 'comunas', 'tec', null, expect.anything());
  });

  it('abre evento e documento e esconde grupo vazio', async () => {
    const document = { id: 'doc1', state: 'available' as const, title: 'Cartilha', description: 'Estudo', origin: null, collection: null, responsible: null, createdAt: null, byteSize: null, pageCount: null, topic: null, access: null, isPublic: true, saved: false, viewer: {}, distributions: null, message: null };
    search.mockResolvedValue({
      items: [
        { id: event.id, kind: 'events', value: event },
        { id: document.id, kind: 'documents', value: document },
      ],
      nextCursor: null,
    });
    await render(<ExploreScreen />);
    await fireEvent.changeText(await screen.findByLabelText('Buscar na Popularia'), 'assembleia');
    await debounce();
    expect(screen.queryByText('Linux nas escolas')).toBeNull();
    await fireEvent.press(await screen.findByLabelText(/Assembleia/));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/evento/[id]', params: { id: 'ev1' } });
    await fireEvent.press(screen.getByLabelText(/Cartilha/));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/biblioteca/documento/[id]', params: { id: 'doc1' } });
    await fireEvent.press(screen.getByLabelText('Ver todos: Eventos'));
    expect(search).toHaveBeenLastCalledWith('me', 'assembleia', 'events', undefined, null, expect.anything());
  });

  it('traz documentos do assunto escolhido e abre a categoria completa', async () => {
    const document = { id: 'doc-topic', state: 'available' as const, title: 'Cartilha de educação', description: 'Estudo do assunto', origin: null, collection: null, responsible: null, createdAt: null, byteSize: null, pageCount: null, topic: 'tec' as const, access: null, isPublic: true, saved: false, viewer: {}, distributions: null, message: null };
    search.mockImplementation(async (_me, _q, filter) => ({ items: filter === 'documents' ? [{ id: document.id, kind: 'documents' as const, value: document }] : entries.filter((entry) => entry.kind === filter), nextCursor: null }));
    await render(<TopicScreen />);
    expect(await screen.findByText('Cartilha de educação')).toBeTruthy();
    await fireEvent.press(await screen.findByLabelText('Ver todos: Documentos'));
    expect(search).toHaveBeenLastCalledWith('me', '', 'documents', 'tec', null, expect.anything());
  });

  it('base pequena oculta seções vazias e permite descobrir outros assuntos', async () => {
    getData.mockResolvedValue({ ...data, comunas: [], posts: [], people: [] });
    await render(<TopicScreen />);
    expect(await screen.findByText('Ainda não há muita coisa por aqui.')).toBeTruthy();
    expect(screen.queryByText('Em destaque')).toBeNull();
    await fireEvent.press(screen.getByText('Descobrir outros assuntos'));
    expect(router.navigate).toHaveBeenCalledWith('/explorar');
  });

  it('volta pelo chrome do assunto', async () => {
    await render(<TopicScreen />);
    await fireEvent.press(screen.getByLabelText('Voltar'));
    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
