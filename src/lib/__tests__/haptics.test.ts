import { describe, expect, it, jest } from '@jest/globals';
import * as Haptics from 'expo-haptics';

import { createHapticsService } from '../haptics';

function fakeClient() {
  return {
    selectionAsync: jest.fn<() => Promise<void>>(async () => undefined),
    impactAsync: jest.fn<(style?: Haptics.ImpactFeedbackStyle) => Promise<void>>(async () => undefined),
    notificationAsync: jest.fn<(type?: Haptics.NotificationFeedbackType) => Promise<void>>(async () => undefined),
    performAndroidHapticsAsync: jest.fn<(type: Haptics.AndroidHaptics) => Promise<void>>(async () => undefined),
  };
}

describe('serviço de haptics', () => {
  it('mapeia seleção, impacto leve e sucesso para os geradores do iOS', () => {
    const client = fakeClient();
    let clock = 0;
    const service = createHapticsService({ client, platform: 'ios', now: () => clock });

    service.fire('selection');
    clock = 100;
    service.fire('light');
    clock = 200;
    service.fire('success');

    expect(client.selectionAsync).toHaveBeenCalledTimes(1);
    expect(client.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
    expect(client.notificationAsync).toHaveBeenCalledWith(Haptics.NotificationFeedbackType.Success);
    expect(client.performAndroidHapticsAsync).not.toHaveBeenCalled();
  });

  it('no Android usa performAndroidHapticsAsync, que respeita o ajuste do sistema', () => {
    const client = fakeClient();
    let clock = 0;
    const service = createHapticsService({ client, platform: 'android', now: () => clock });

    service.fire('selection');
    clock = 100;
    service.fire('light');
    clock = 200;
    service.fire('success');

    expect(client.performAndroidHapticsAsync.mock.calls.map(([type]) => type)).toEqual([
      Haptics.AndroidHaptics.Segment_Tick,
      Haptics.AndroidHaptics.Virtual_Key,
      Haptics.AndroidHaptics.Confirm,
    ]);
    expect(client.selectionAsync).not.toHaveBeenCalled();
    expect(client.impactAsync).not.toHaveBeenCalled();
    expect(client.notificationAsync).not.toHaveBeenCalled();
  });

  it('não vibra na web', () => {
    const client = fakeClient();
    const service = createHapticsService({ client, platform: 'web' });

    expect(service.fire('success')).toBe(false);
    expect(client.selectionAsync).not.toHaveBeenCalled();
    expect(client.impactAsync).not.toHaveBeenCalled();
    expect(client.notificationAsync).not.toHaveBeenCalled();
  });

  it('limita repetições do mesmo estímulo e do conjunto', () => {
    const client = fakeClient();
    let clock = 0;
    const service = createHapticsService({ client, platform: 'ios', now: () => clock });

    expect(service.fire('light')).toBe(true);
    clock = 20;
    expect(service.fire('light')).toBe(false);
    clock = 79;
    expect(service.fire('light')).toBe(false);
    clock = 80;
    expect(service.fire('light')).toBe(true);
    expect(client.impactAsync).toHaveBeenCalledTimes(2);
  });

  it('protege o sucesso contra repetição em sequência', () => {
    const client = fakeClient();
    let clock = 0;
    const service = createHapticsService({ client, platform: 'ios', now: () => clock });

    expect(service.fire('success')).toBe(true);
    clock = 100;
    expect(service.fire('success')).toBe(false);
    clock = 500;
    expect(service.fire('success')).toBe(true);
    expect(client.notificationAsync).toHaveBeenCalledTimes(2);
  });

  it('devolve na hora mesmo com o nativo pendente', () => {
    const client = fakeClient();
    let finish!: () => void;
    client.selectionAsync.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const service = createHapticsService({ client, platform: 'ios' });

    expect(service.fire('selection')).toBe(true);
    expect(client.selectionAsync).toHaveBeenCalledTimes(1);
    finish();
  });

  it('falha em silêncio quando o módulo nativo não existe ou rejeita', async () => {
    const client = fakeClient();
    client.selectionAsync.mockImplementation(() => { throw new Error('sem motor'); });
    client.impactAsync.mockImplementation(() => Promise.reject(new Error('sem motor')));
    let clock = 0;
    const service = createHapticsService({ client, platform: 'ios', now: () => clock });

    expect(() => service.fire('selection')).not.toThrow();
    clock = 100;
    expect(service.fire('light')).toBe(true);
    await Promise.resolve();
  });
});
