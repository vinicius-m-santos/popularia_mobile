import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';
import type { ComponentProps } from 'react';

import { TabBar } from '../tab-bar';

jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useSegments: () => ['(tabs)', '(inicio)'] }));
let mockUnread = 0;
jest.mock('@/features/notifications/use-unread-count', () => ({ useUnreadCount: () => mockUnread }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));

const routes = ['(inicio)', 'explorar', 'avisos', 'perfil'].map((name) => ({ key: name, name }));
const props = {
  state: { routes, index: 0 },
  descriptors: Object.fromEntries(routes.map((r) => [r.key, { options: { title: r.name } }])),
  emitter: { emit: () => ({ defaultPrevented: false }) },
  navigateToTab: jest.fn(),
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
} as unknown as ComponentProps<typeof TabBar>;

beforeEach(() => { jest.clearAllMocks(); mockUnread = 0; });

describe('badge de avisos', () => {
  it.each([0, 1, 99, 100, 250])('exibe corretamente %i não lidos', async (count) => {
    mockUnread = count;
    await render(<TabBar {...props} />);
    const avisos = screen.getByLabelText(count ? `avisos, ${count} não lidos` : 'avisos');
    expect(avisos).toBeTruthy();
    if (count > 0) expect(screen.getByText(count > 99 ? '99+' : String(count))).toBeTruthy();
    else expect(screen.queryByText('0')).toBeNull();
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
