import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { act, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { resetReducedMotionCache, useReducedMotion } from '../use-reduced-motion';

function Harness() {
  return <Text>{useReducedMotion() ? 'reduzido' : 'normal'}</Text>;
}

afterEach(() => {
  resetReducedMotionCache();
  jest.restoreAllMocks();
});

describe('preferência de movimento reduzido', () => {
  it('reaproveita a última leitura no primeiro render do próximo visualizador', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const first = await render(<Harness />);
    await waitFor(() => expect(screen.getByText('reduzido')).toBeTruthy());
    await first.unmount();

    let resolvePreference: ((enabled: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockImplementation(
      () => new Promise<boolean>((resolve) => { resolvePreference = resolve; }),
    );
    const second = await render(<Harness />);
    // A promise ainda está pendente: o primeiro render usa a última leitura.
    expect(screen.getByText('reduzido')).toBeTruthy();

    await act(async () => { resolvePreference?.(false); await Promise.resolve(); });
    await waitFor(() => expect(screen.getByText('normal')).toBeTruthy());
    await second.unmount();
  });

  it('acompanha a mudança de preferência do sistema', async () => {
    let listener: ((enabled: boolean) => void) | undefined;
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
    jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_event, callback) => {
      listener = callback;
      return { remove: jest.fn() };
    });

    const view = await render(<Harness />);
    await waitFor(() => expect(screen.getByText('normal')).toBeTruthy());
    await act(async () => { listener?.(true); });
    expect(screen.getByText('reduzido')).toBeTruthy();
    await view.unmount();
  });
});
