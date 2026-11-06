import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';

import { FeedHeader } from '@/features/feed/components/feed-header';
import { TabBar, isTabBarHidden } from '../tab-bar';

let mockSegments = ['(tabs)', '(inicio)'];
jest.mock('expo-router', () => ({ router: { push: jest.fn(), dismissAll: jest.fn() }, useSegments: () => mockSegments }));
let mockUnread = 0;
jest.mock('@/features/notifications/use-unread-count', () => ({ useUnreadCount: () => mockUnread }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const routes = ['(inicio)', 'explorar', 'pracas', 'perfil'].map((name) => ({ key: name, name }));
const props = {
  state: { routes, index: 0 },
  descriptors: Object.fromEntries(routes.map((r) => [r.key, { options: { title: r.name } }])),
  emitter: { emit: () => ({ defaultPrevented: false }) },
  navigateToTab: jest.fn(),
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
} as unknown as ComponentProps<typeof TabBar>;

beforeEach(() => { jest.clearAllMocks(); mockUnread = 0; mockSegments = ['(tabs)', '(inicio)']; });

describe('badge de avisos', () => {
  it.each([0, 1, 99, 100, 250])('exibe corretamente %i não lidos', async (count) => {
    mockUnread = count;
    await render(<FeedHeader tab="para-voce" onTabChange={jest.fn()} />);
    const avisos = screen.getByLabelText(count ? `Avisos, ${count} não lidos` : 'Avisos');
    expect(avisos).toBeTruthy();
    await fireEvent.press(avisos);
    expect(router.push).toHaveBeenCalledWith('/avisos');
    if (count > 0) expect(screen.getByText(count > 99 ? '99+' : String(count))).toBeTruthy();
    else expect(screen.queryByText('0')).toBeNull();
  });
});

describe('navegação das abas', () => {
  it('tocar na aba ativa não dispara POP_TO_TOP', async () => {
    await render(<TabBar {...props} />);
    await fireEvent.press(screen.getByLabelText('(inicio)'));
    expect(router.dismissAll).not.toHaveBeenCalled();
    expect(props.navigateToTab).not.toHaveBeenCalled();
  });

  it('trocar de aba usa navigateToTab sem empilhar a aba atual', async () => {
    await render(<TabBar {...props} />);
    await fireEvent.press(screen.getByLabelText('explorar'));
    expect(props.navigateToTab).toHaveBeenCalledWith('explorar');
  });
});

describe('rotas de post e a barra', () => {
  it.each([
    ['(inicio)', ['(tabs)', '(inicio)', 'post', '[id]']],
    ['explorar', ['(tabs)', 'explorar', 'post', '[id]']],
    ['perfil', ['(tabs)', 'perfil', 'post', '[id]']],
    ['avisos', ['avisos', 'post', '[id]']],
  ] as const)('oculta a barra na rota de post de %s', async (_tab, segments) => {
    mockSegments = [...segments];
    await render(<TabBar {...props} />);
    const host = screen.getByTestId('tab-bar-host', { includeHiddenElements: true });
    expect(host.props['aria-hidden']).toBe(true);
    expect(host.props.accessibilityElementsHidden).toBe(true);
    expect(host.props.pointerEvents).toBe('none');
  });

  it('mantém a barra em detalhes que não são post, preservando a pilha até o blur', async () => {
    mockSegments = ['(tabs)', '(inicio)', 'pessoa', '[id]'];
    await render(<TabBar {...props} />);
    const host = screen.getByTestId('tab-bar-host', { includeHiddenElements: true });
    expect(host.props['aria-hidden']).toBe(false);
    expect(screen.getByLabelText('explorar')).toBeTruthy();
  });

  it('detecta post em qualquer profundidade de segmento', () => {
    expect(isTabBarHidden(['(tabs)', '(inicio)'])).toBe(false);
    expect(isTabBarHidden(['(tabs)', '(inicio)', 'post', '1'])).toBe(true);
    expect(isTabBarHidden(['(tabs)', 'explorar', 'post', '1'])).toBe(true);
    expect(isTabBarHidden(['avisos', 'post', '1'])).toBe(true);
    expect(isTabBarHidden(['(tabs)', '(inicio)', 'pessoa', '1'])).toBe(false);
  });
});

describe('menu central de criação', () => {
  it('abre somente Publicação e Comuna; fechar e voltar não navegam', async () => {
    await render(<TabBar {...props} />);
    await fireEvent.press(screen.getByLabelText('Criar'));
    expect(screen.getByLabelText('Publicação')).toBeTruthy();
    expect(screen.getByLabelText('Comuna')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Fechar', { includeHiddenElements: true }));
    expect(screen.queryByLabelText('Publicação')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Criar'));
    const modal = screen.container.queryAll((element) => element.type === 'Modal')[0];
    await fireEvent(modal, 'requestClose');
    expect(screen.queryByLabelText('Comuna')).toBeNull();
    expect(router.push).not.toHaveBeenCalled();
  });

  it.each([['Publicação', '/criar'], ['Comuna', '/criar-comuna']] as const)('selecionar %s uma vez fecha o menu e ignora toques repetidos', async (label, route) => {
    await render(<TabBar {...props} />);
    await fireEvent.press(screen.getByLabelText('Criar'));
    const option = screen.getByLabelText(label);
    await act(async () => { await fireEvent.press(option); await fireEvent.press(option); });
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith(route);
    expect(screen.queryByLabelText(label)).toBeNull();
    // Depois de retornar à barra, uma nova abertura funciona imediatamente.
    await fireEvent.press(screen.getByLabelText('Criar'));
    await fireEvent.press(screen.getByLabelText(label));
    expect(router.push).toHaveBeenCalledTimes(2);
  });
});
