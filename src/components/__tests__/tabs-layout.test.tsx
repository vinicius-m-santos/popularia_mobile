import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import TabsLayout from '@/app/(tabs)/_layout';

const mockScreens: { name: string; options: { title?: string; popToTopOnBlur?: boolean } }[] = [];

jest.mock('expo-router', () => ({
  Redirect: () => null,
}));
jest.mock('expo-router/js-tabs', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Tabs = Object.assign(
    ({ children }: { children: ReactNode }) => React.createElement(React.Fragment, null, children),
    {
      Screen: (props: { name: string; options: { title?: string; popToTopOnBlur?: boolean } }) => {
        mockScreens.push(props);
        return null;
      },
    },
  );
  return { Tabs };
});
jest.mock('@/components/tab-bar', () => ({ TabBar: () => null }));
jest.mock('@/features/account/account-context', () => ({ useAccount: () => ({ onboarded: true }) }));

beforeEach(() => {
  mockScreens.length = 0;
});

describe('configuração intencional das abas', () => {
  it('cada aba volta ao topo ao perder o foco', async () => {
    await render(<TabsLayout />);

    expect(mockScreens.map((screen) => screen.name)).toEqual(['(inicio)', 'explorar', 'pracas', 'perfil']);
    expect(mockScreens.map((screen) => screen.options.title)).toEqual(['Início', 'Explorar', 'Praças', 'Perfil']);
    for (const screen of mockScreens) {
      expect(screen.options.popToTopOnBlur).toBe(true);
    }
  });
});
