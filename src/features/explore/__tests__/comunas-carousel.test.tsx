import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { InteractionsProvider } from '@/features/interactions/interactions-context';
import { joinComuna } from '@/features/comunas/api';
import type { Comuna } from '@/types/models';

import { ComunasToKnowSection, suggestedComunas } from '../comunas-carousel';

const mockShow = jest.fn();
const mockAcknowledge = jest.fn();
jest.mock('@/constants/config', () => ({ DEMO_MODE: false, API_BASE_URL: 'http://api.test/api/v1' }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: mockShow }) }));
jest.mock('@/features/account/account-context', () => ({ useAccount: () => ({ account: { id: 'me' } }) }));
jest.mock('@/features/gamification/feedback', () => ({ acknowledgeGamification: (...args: unknown[]) => mockAcknowledge(...args) }));
jest.mock('@/features/comunas/api', () => ({ joinComuna: jest.fn(), leaveComuna: jest.fn() }));

const join = jest.mocked(joinComuna);

function comuna(patch: Partial<Comuna> & { id: string }): Comuna {
  return {
    name: 'Comilança BH',
    handle: 'comilanca',
    initials: 'CB',
    tone: 'cream',
    place: 'Belo Horizonte · MG',
    foundedYear: '2024',
    description: 'Receitas, botecos e feiras da cidade.',
    memberCount: 120,
    coverAlt: '',
    topics: ['cult'],
    stats: [],
    rules: [],
    moderationNote: '',
    pinned: null,
    moderatorIds: [],
    founderRole: '',
    featuredMemberIds: [],
    visibility: 'public',
    status: 'active',
    viewerIsMember: false,
    ...patch,
  };
}

function wrapper({ children }: { children: ReactNode }) {
  return <InteractionsProvider>{children}</InteractionsProvider>;
}

beforeEach(() => {
  join.mockReset();
  mockShow.mockReset();
  mockAcknowledge.mockReset();
});

describe('Comunas para conhecer', () => {
  it('filtra quem já participa, privadas e arquivadas e prioriza cidade e interesses', () => {
    const list = [
      comuna({ id: 'fora', place: 'Recife · PE', topics: ['saude'] }),
      comuna({ id: 'cidade', place: 'São Paulo · SP', topics: ['saude'] }),
      comuna({ id: 'interesse', place: 'Recife · PE', topics: ['tec'] }),
      comuna({ id: 'membro', viewerIsMember: true }),
      comuna({ id: 'privada', visibility: 'private' }),
      comuna({ id: 'arquivada', status: 'archived' }),
    ];

    expect(suggestedComunas(list, ['tec'], 'São Paulo · SP').map((item) => item.id)).toEqual(['cidade', 'interesse', 'fora']);
  });

  it('renderiza o carrossel horizontal com snap e o rótulo acessível do card', async () => {
    const onOpen = jest.fn();
    await render(
      <ComunasToKnowSection
        comunas={[comuna({ id: 'comilanca' })]}
        interests={['cult']}
        city="Belo Horizonte · MG"
        onOpenComuna={onOpen}
        onSeeAll={jest.fn()}
      />,
      { wrapper },
    );

    const carousel = screen.getByLabelText('Comunas para conhecer');
    expect(carousel.props.horizontal).toBe(true);
    expect(carousel.props.snapToInterval).toBe(210);
    expect(carousel.props.showsHorizontalScrollIndicator).toBe(false);

    await fireEvent.press(screen.getByLabelText('Comilança BH, Receitas, botecos e feiras da cidade.'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'comilanca' }));
  });

  it('participa de forma otimista e mantém o card na lista', async () => {
    let finish: () => void = () => {};
    join.mockReturnValue(new Promise((resolve) => {
      finish = () => resolve({ slug: 'comilanca', isMember: true, role: 'member', memberCount: 121 });
    }));
    await render(
      <ComunasToKnowSection
        comunas={[comuna({ id: 'comilanca' })]}
        interests={['cult']}
        city="Belo Horizonte · MG"
        onOpenComuna={jest.fn()}
        onSeeAll={jest.fn()}
      />,
      { wrapper },
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Participar de Comilança BH' }));

    // A resposta otimista aparece antes da API e o card não some da sugestão.
    expect(screen.getByRole('button', { name: 'Participando de Comilança BH' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Comilança BH')).toBeTruthy();
    expect(join).toHaveBeenCalledWith('comilanca');

    await waitFor(() => finish());
    expect(mockAcknowledge).toHaveBeenCalledWith('me', mockShow);
  });

  it('faz rollback e avisa quando entrar falha', async () => {
    join.mockRejectedValue(new Error('offline'));
    await render(
      <ComunasToKnowSection
        comunas={[comuna({ id: 'comilanca' })]}
        interests={['cult']}
        city="Belo Horizonte · MG"
        onOpenComuna={jest.fn()}
        onSeeAll={jest.fn()}
      />,
      { wrapper },
    );

    await fireEvent.press(screen.getByRole('button', { name: 'Participar de Comilança BH' }));

    await waitFor(() => expect(mockShow).toHaveBeenCalledWith('Não deu pra entrar agora.'));
    expect(screen.getByRole('button', { name: 'Participar de Comilança BH' }).props.accessibilityState.selected).toBe(false);
    expect(screen.getByText('Comilança BH')).toBeTruthy();
  });
});
