import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

import { settleQueryClient } from '../query-test-utils';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { openDestination } from '@/features/links/destinations';
import { queryClient } from '@/lib/query/client';
import type { LinkedEvent } from '@/types/models';

import { listEvents } from '../api';
import { LinkedEventCallout } from '../linked-event';
import { NextEvent } from '../next-event';
import type { ComunaEvent } from '../types';

jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
jest.mock('@/features/links/destinations', () => ({ openDestination: jest.fn() }));
jest.mock('../api', () => ({ listEvents: jest.fn() }));

const event = {
  id: '019abcde-0000-7000-8000-000000000010', title: 'Assembleia mensal', description: '', format: 'in_person', status: 'scheduled',
  timeZone: 'America/Manaus', startsAt: '2026-11-05T19:00:00-04:00', endsAt: null, placeName: 'Sindicato', address: null, onlineUrl: null,
  comuna: { id: 'c', slug: 'londrina', name: 'Londrina', visibility: 'public', status: 'active' }, organizer: null,
  goingCount: 32, maybeCount: 8, viewerAttendance: null, canManage: false, canRespond: true, past: false,
  createdAt: '', updatedAt: '', cancelledAt: null,
} satisfies ComunaEvent;

beforeEach(async () => {
  settleQueryClient();
  await queryClient.cancelQueries();
  queryClient.clear();
  jest.clearAllMocks();
});

afterEach(async () => {
  cleanup();
  await queryClient.cancelQueries();
  queryClient.clear();
});

describe('descoberta', () => {
  it('mostra o próximo evento e leva à lista e ao detalhe', async () => {
    jest.mocked(listEvents).mockResolvedValue({ items: [{ ...event, status: 'cancelled', title: 'Velho' }, event], nextCursor: null });
    await render(<NextEvent slug="londrina" />);
    expect(await screen.findByText('Assembleia mensal')).toBeTruthy();
    expect(screen.queryByText('Velho')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Ver atividades'));
    expect(router.push).toHaveBeenCalledWith({ pathname: '/eventos/[slug]', params: { slug: 'londrina' } });
    await fireEvent.press(screen.getByLabelText('Assembleia mensal. 05 NOV 19:00'));
    expect(openDestination).toHaveBeenCalledWith({ kind: 'event', id: event.id });
  });

  it('a publicação abre o mesmo destino do aviso', async () => {
    const linked: LinkedEvent = { id: event.id, title: event.title, format: 'in_person', status: 'scheduled', startsAt: event.startsAt, timeZone: event.timeZone, placeName: 'Sindicato', goingCount: 32, maybeCount: 8, past: false };
    await render(<LinkedEventCallout event={linked} />);
    fireEvent.press(screen.getByLabelText('Atividade Assembleia mensal'));
    expect(openDestination).toHaveBeenCalledWith({ kind: 'event', id: event.id });
  });

  it('some quando não há atividade e tenta de novo se a carga falha', async () => {
    jest.mocked(listEvents).mockResolvedValueOnce({ items: [], nextCursor: null });
    const first = await render(<NextEvent slug="londrina" />);
    await waitFor(() => expect(listEvents).toHaveBeenCalled());
    expect(screen.queryByText('Próximo evento')).toBeNull();
    first.unmount();
    jest.mocked(listEvents).mockRejectedValue(new Error('rede'));
    const failed = await render(<NextEvent slug="vazia" />);
    const retry = await screen.findByText('Não foi possível carregar. Toque para tentar de novo.');
    jest.mocked(listEvents).mockResolvedValue({ items: [event], nextCursor: null });
    await fireEvent.press(retry);
    expect(await screen.findByText('Assembleia mensal')).toBeTruthy();
    failed.unmount();
  });
});
