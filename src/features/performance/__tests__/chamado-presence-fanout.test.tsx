import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, render } from '@testing-library/react-native';
import { memo, useEffect, type ReactNode } from 'react';
import { ScrollView } from 'react-native';

import { InteractionsProvider, useInteractions } from '@/features/interactions/interactions-context';
import { getPerformanceSnapshot, resetPerformanceSession, setPerformanceInstrumentationOverride } from '@/lib/performance';
import { withPerformanceProfiler } from '@/lib/performance/profiler';

import { ChamadoCard, type ChamadoCardData } from '@/features/events/chamado-card';

jest.mock('@/features/account/account-context', () => ({
  useMe: () => ({ id: 'me', name: 'Camila Rocha', handle: 'camilarocha', initials: 'CR', tone: 'red', avatarUrl: null }),
  useAccount: () => ({ account: { emailVerified: true }, reloadAccount: jest.fn() }),
}));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));

const ProfiledCard = memo(withPerformanceProfiler('ChamadoCard', ChamadoCard));

const ids = Array.from({ length: 12 }, (_, index) => `chamado-${index + 1}`);

function chamado(id: string): ChamadoCardData {
  const startsAt = new Date();
  startsAt.setDate(startsAt.getDate() + 3);
  startsAt.setHours(19, 0, 0, 0);
  return {
    id,
    title: `Chamado ${id}`,
    description: 'Concentração na Praça Sete.',
    startsAt: startsAt.toISOString(),
    timeZone: 'America/Sao_Paulo',
    placeName: 'Praça Sete de Setembro, Centro',
    address: 'Rua X, 123',
    cover: null,
    coverFit: 'cover',
    capacityMode: null,
    capacity: null,
    goingCount: 12,
    maybeCount: 0,
    goingUsers: [],
    // A resposta já chegou no resumo do feed: o estado local deve nascer correto.
    viewerAttendance: 'going',
    past: false,
    cancelled: false,
  };
}

const cards = ids.map(chamado);

function SeedPresence() {
  const { setOn } = useInteractions();
  useEffect(() => {
    for (const id of ids) setOn('goingEvents', [id], true);
  }, [setOn]);
  return null;
}

function List({ visible }: { visible: number }) {
  return (
    <ScrollView>
      <SeedPresence />
      {cards.slice(0, visible).map((card) => <ProfiledCard key={card.id} data={card} />)}
    </ScrollView>
  );
}

const wrapper = ({ children }: { children: ReactNode }) => <InteractionsProvider>{children}</InteractionsProvider>;

function chamadoCommits() {
  return getPerformanceSnapshot().commits.filter((commit) => commit.component === 'ChamadoCard');
}

beforeEach(() => {
  jest.clearAllMocks();
  setPerformanceInstrumentationOverride(true);
});

describe('presença de chamado na rolagem', () => {
  it('não atualiza os cartões já montados quando novos chamados entram na lista', async () => {
    const { rerender } = await render(<List visible={6} />, { wrapper });
    // Deixa o efeito de semeadura e os mounts assentarem antes de medir.
    await act(async () => {});
    expect(chamadoCommits()).toHaveLength(6);
    expect(chamadoCommits().every((commit) => commit.mountCommits >= 1)).toBe(true);

    resetPerformanceSession();

    await act(async () => {
      rerender(<List visible={12} />);
    });

    const commits = chamadoCommits();
    // Os seis novos montam; os seis antigos não recebem update global por causa
    // do mount dos chamados que já têm presença correta.
    expect(commits).toHaveLength(6);
    expect(commits.every((commit) => commit.mountCommits === 1)).toBe(true);
    expect(commits.every((commit) => commit.updateCommits === 0)).toBe(true);
  });
});
