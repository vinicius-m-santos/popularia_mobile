import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { settleQueryClient } from '@/features/events/query-test-utils';
import { queryClient } from '@/lib/query/client';

import { searchDiscovery, getDiscoveryData, type DiscoveryData, type DiscoveryEntry } from '../api';
import ExploreScreen, { TopicScreen } from '../explore-screen';
import type { Page } from '@/lib/pagination';

const mockFocusCallbacks = new Set<() => void>();
const mockOpenProfile = jest.fn();
const mockOpenComuna = jest.fn();
const mockOpenPost = jest.fn();
let mockTopicId = 'tec';
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), navigate: jest.fn() },
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
jest.mock('@/features/account/account-context', () => ({ useMe: () => ({ id: 'me' }), useAccount: () => ({ interests: ['tec'] }) }));
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
const post = { id: 'post1', authorId: 'ana', author: person, comunaId: null, comuna: null, text: 'Linux nas escolas', createdAt: '2026-10-26T00:00:00Z', supportCount: 0, commentCount: 2, echoCount: 0, event: null, topCommentAuthor: null };
const comuna = { id: 'linux', name: 'Linux Brasil', handle: 'linux', initials: 'LB', tone: 'red' as const, description: 'Software livre', memberCount: 3, topics: ['tec' as const], place: '', foundedYear: '2026', coverAlt: '', stats: [], rules: [], moderationNote: '', pinned: null, moderatorIds: [], founderRole: '', featuredMemberIds: [], visibility: 'public' as const };
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
  jest.clearAllMocks();
  getData.mockResolvedValue(data);
  search.mockImplementation(async (_me, _q, filter) => ({ items: filter === 'all' ? entries : entries.filter((e) => e.kind === filter), nextCursor: null }));
  mockTopicId = 'tec';
});

async function debounce() {
  await act(async () => { await new Promise((resolve) => setTimeout(resolve, 400)); });
}

describe('Explorar', () => {
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

  it('abre descoberta, assunto e os destinos existentes de pessoa/comuna/publicação', async () => {
    await render(<ExploreScreen />);
    await fireEvent.press(await screen.findByLabelText('Abrir Biblioteca Pública'));
    await fireEvent.press(await screen.findByLabelText('Explorar Tecnologia'));
    expect(router.push).toHaveBeenCalledWith('/biblioteca');
    expect(router.push).toHaveBeenCalledWith({ pathname: '/explorar/assunto/[id]', params: { id: 'tec' } });
    await fireEvent.press(screen.getByLabelText('Abrir pessoa Ana Linux'));
    await fireEvent.press(screen.getByLabelText(/Linux Brasil, Pública/));
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
    expect(screen.getByText('Carregando descoberta')).toBeTruthy();
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
    await fireEvent.press(await screen.findByLabelText('Ver todas: Comunas para conhecer'));
    await fireEvent.press(await screen.findByText('Carregar mais'));
    await waitFor(() => expect(search).toHaveBeenLastCalledWith('me', '', 'comunas', undefined, 'cursor1', expect.anything()));
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
    expect(getData).toHaveBeenCalledWith('me', 'tec');
    await fireEvent.changeText(screen.getByLabelText('Buscar em Tecnologia'), 'Linux');
    await debounce();
    expect(search).toHaveBeenLastCalledWith('me', 'Linux', 'all', 'tec', null, expect.anything());
    await fireEvent.press(await screen.findByLabelText('Ver todas: Comunas'));
    expect(search).toHaveBeenLastCalledWith('me', 'Linux', 'comunas', 'tec', null, expect.anything());
  });

  it('abre evento e documento e esconde grupo vazio', async () => {
    const event = {
      id: 'ev1', title: 'Assembleia', description: 'Pauta do mês', format: 'in_person' as const, status: 'scheduled' as const,
      timeZone: 'America/Manaus', startsAt: '2026-11-05T19:00:00-04:00', endsAt: null, placeName: 'Sindicato', address: null, onlineUrl: null,
      comuna: { id: 'c', slug: 'hortas', name: 'Hortas', visibility: 'public', status: 'active' }, organizer: null,
      goingCount: 2, maybeCount: 0, viewerAttendance: null, canManage: false, canRespond: true, past: false,
      createdAt: '2026-11-01T15:00:00Z', updatedAt: '2026-11-01T15:00:00Z', cancelledAt: null,
    };
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

  it('base pequena oculta seções vazias e permite descobrir outros assuntos', async () => {
    getData.mockResolvedValue({ ...data, comunas: [], posts: [], people: [] });
    await render(<TopicScreen />);
    expect(await screen.findByText('Ainda não há muita coisa por aqui.')).toBeTruthy();
    expect(screen.queryByText('Em destaque')).toBeNull();
    await fireEvent.press(screen.getByText('Descobrir outros assuntos'));
    expect(router.navigate).toHaveBeenCalledWith('/explorar');
  });
});
