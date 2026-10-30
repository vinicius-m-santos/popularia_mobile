import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';

import { queryClient } from '@/lib/query/client';

import { getGamification } from '../api';
import { DEMO_GAMIFICATION } from '../demo';
import { acknowledgeGamification, missionFeedback } from '../feedback';
import { HomeProgress, HomeProgressCard, ProfileProgressLink, ProgressBody } from '../progress-screen';
import ProgressScreen from '../progress-screen';
import { gamificationQueryKey, levelFraction, streakLabel, type GamificationState } from '../types';

jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn() },
  useSegments: () => [],
}));
jest.mock('@/constants/config', () => ({ DEMO_MODE: false }));
jest.mock('@/features/account/account-context', () => ({
  useAccount: () => ({ account: { id: 'conta-1' } }),
  useMe: () => ({ id: 'conta-1', initials: 'A', tone: 'red', name: 'Ana', handle: 'ana' }),
}));
jest.mock('../api', () => ({ getGamification: jest.fn() }));
jest.mock('@/lib/routes', () => ({ goBack: jest.fn(), useNav: () => ({}) }));

const sample: GamificationState = {
  id: 'conta-1',
  level: 2,
  xp: 140,
  currentLevelXp: 100,
  nextLevelXp: 250,
  streak: 3,
  missionBonusXp: 4,
  dayBonusXp: 6,
  missions: [
    { action: 'poll_participated', label: 'Participe de uma enquete', completed: true },
    { action: 'post_saved', label: 'Salve uma publicação', completed: false },
    { action: 'event_rsvp_positive', label: 'Confirme interesse em um evento', completed: false },
  ],
  achievements: [
    { code: 'primeiro_passo', title: 'Primeiro passo', detail: 'Participou da primeira enquete.', unlocked: true, unlockedAt: '2026-06-01T15:00:00-03:00' },
    { code: 'para_depois', title: 'Para depois', detail: 'Salvou a primeira publicação.', unlocked: false, unlockedAt: null },
  ],
};

function host(children: ReactNode) {
  return (
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </SafeAreaProvider>
  );
}

beforeEach(async () => {
  await queryClient.cancelQueries();
  queryClient.clear();
  jest.mocked(getGamification).mockReset();
});

afterEach(async () => {
  cleanup();
  await queryClient.cancelQueries();
  queryClient.clear();
});

describe('progresso', () => {
  it('mostra nível, sequência, missão concluída e conquista', async () => {
    await render(<ProgressBody state={sample} />);
    expect(screen.getByText('Nível 2')).toBeTruthy();
    expect(screen.getByText('40 de 150 para o próximo nível')).toBeTruthy();
    expect(screen.getByText('3 dias seguidos')).toBeTruthy();
    expect(screen.getByText('Participe de uma enquete')).toBeTruthy();
    expect(screen.getByText('Salve uma publicação')).toBeTruthy();
    expect(screen.getByText('Primeiro passo')).toBeTruthy();
    expect(screen.getByText('Ainda não')).toBeTruthy();
    expect(levelFraction(sample)).toBeCloseTo(40 / 150);
    expect(streakLabel(0)).toBe('Nenhum dia seguido');
  });

  it('abre o progresso a partir do resumo e do perfil', async () => {
    const open = jest.fn();
    await render(<><HomeProgressCard state={sample} onPress={open} /><ProfileProgressLink level={2} streak={3} onPress={open} /></>);
    await fireEvent.press(screen.getByLabelText('3 dias seguidos. Ver progresso'));
    await fireEvent.press(screen.getByLabelText('Nível 2, 3 dias seguidos. Ver progresso'));
    expect(open).toHaveBeenCalledTimes(2);
  });

  it('mostra carregamento e depois o progresso', async () => {
    let resolve: (state: GamificationState) => void = () => {};
    jest.mocked(getGamification).mockReturnValue(new Promise((done) => { resolve = done; }));
    await render(host(<ProgressScreen />));
    expect(screen.getByText('Abrindo seu progresso')).toBeTruthy();
    await act(async () => { resolve(sample); });
    expect(await screen.findByText('Nível 2')).toBeTruthy();
  });

  it('permite tentar de novo quando a leitura falha', async () => {
    jest.mocked(getGamification).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(sample);
    await render(host(<ProgressScreen />));
    expect(await screen.findByText('Não foi possível abrir seu progresso.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(await screen.findByText('Nível 2')).toBeTruthy();
    expect(getGamification).toHaveBeenCalledTimes(2);
  });

  it('mostra o erro compacto na home e tenta de novo', async () => {
    jest.mocked(getGamification).mockRejectedValueOnce(new Error('rede')).mockResolvedValueOnce(sample);
    await render(host(<HomeProgress />));
    expect(await screen.findByText('Progresso indisponível. Toque para tentar de novo.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Progresso indisponível. Toque para tentar de novo.'));
    expect(await screen.findByText('Ver progresso')).toBeTruthy();
  });
});

describe('modo demonstração', () => {
  it('traz nível, sequência, três missões e conquistas sem livro', () => {
    expect(DEMO_GAMIFICATION.level).toBe(2);
    expect(DEMO_GAMIFICATION.streak).toBe(3);
    expect(DEMO_GAMIFICATION.missions).toHaveLength(3);
    expect(DEMO_GAMIFICATION.achievements.some((item) => item.unlocked)).toBe(true);
    expect(DEMO_GAMIFICATION.achievements.some((item) => !item.unlocked)).toBe(true);
    expect(DEMO_GAMIFICATION).not.toHaveProperty('entries');
  });
});

describe('aviso de missão', () => {
  it('só avisa a missão que acabou de fechar, com o bônus do trio', async () => {
    const before: GamificationState = {
      ...sample,
      missions: sample.missions.map((mission, index) => ({ ...mission, completed: index === 0 })),
    };
    const after: GamificationState = {
      ...sample,
      missions: sample.missions.map((mission) => ({ ...mission, completed: true })),
    };
    expect(missionFeedback(undefined, after)).toBeNull();
    expect(missionFeedback(before, before)).toBeNull();
    expect(missionFeedback({ ...before, missions: [{ ...before.missions[1], completed: false }] }, { ...after, missions: [{ ...after.missions[1], completed: true }] })).toBe('Missão concluída · +4 XP');
    expect(missionFeedback(before, after)).toBe('Missões concluídas · +14 XP');

    queryClient.setQueryData(gamificationQueryKey('conta-1'), before);
    jest.mocked(getGamification).mockResolvedValue(after);
    const notify = jest.fn();
    acknowledgeGamification('conta-1', notify);
    await waitFor(() => expect(notify).toHaveBeenCalledWith('Missões concluídas · +14 XP'));
  });

  it('não avisa se a leitura falhar ou não houver conta', async () => {
    const notify = jest.fn();
    jest.mocked(getGamification).mockRejectedValue(new Error('rede'));
    acknowledgeGamification('conta-1', notify);
    acknowledgeGamification(undefined, notify);
    await act(async () => { await Promise.resolve(); });
    expect(notify).not.toHaveBeenCalled();
    expect(getGamification).toHaveBeenCalledTimes(1);
  });
});
