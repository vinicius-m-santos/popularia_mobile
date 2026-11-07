import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { withSequence, withSpring } from 'react-native-reanimated';

import { Motion } from '@/constants/theme';

import { REACTION_FEEDBACK_SPRING, useReactionFeedback } from '../use-reaction-feedback';

jest.mock('react-native-reanimated', () => ({
  ReduceMotion: { System: 'system' },
  useSharedValue: (value: number) => ({ value }),
  useAnimatedStyle: () => ({}),
  withSequence: jest.fn((...values: unknown[]) => values[values.length - 1]),
  withSpring: jest.fn((value: number, config: unknown) => ({ value, config })),
}));

function Feedback({ signal, label }: { signal: boolean | string; label: string }) {
  useReactionFeedback(signal);
  return <View><Text>{label}</Text></View>;
}

function Pair({ first, second }: { first: boolean; second: boolean }) {
  return (
    <>
      <Feedback signal={first} label="A" />
      <Feedback signal={second} label="B" />
    </>
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('feedback local de reação', () => {
  it('usa a mola da casa e respeita o movimento reduzido do sistema', () => {
    expect(REACTION_FEEDBACK_SPRING).toEqual({
      ...Motion.spring.reaction,
      reduceMotion: 'system',
    });
  });

  it('pula só o item cujo sinal otimista mudou e pulsa de novo no rollback', async () => {
    const view = await render(<Pair first={false} second={false} />);

    // Montar a lista não dispara animação em cascata.
    expect(withSpring).not.toHaveBeenCalled();

    await view.rerender(<Pair first second={false} />);

    // Ida e volta no item A; o B, intocado, não recebe mola.
    expect(withSpring).toHaveBeenCalledTimes(2);
    const [value, config] = jest.mocked(withSpring).mock.calls[0];
    expect(value).toBe(Motion.scale.reaction);
    expect(config).toMatchObject({
      ...Motion.spring.reaction,
      reduceMotion: 'system',
    });
    expect(withSequence).toHaveBeenCalledTimes(1);

    // Um render repetido com o mesmo estado não reinicia o pulso.
    await view.rerender(<Pair first second={false} />);
    expect(withSpring).toHaveBeenCalledTimes(2);

    // Rollback volta o sinal e o item pulsa na volta, sem acordar o restante.
    await view.rerender(<Pair first={false} second={false} />);
    expect(withSpring).toHaveBeenCalledTimes(4);
    expect(withSequence).toHaveBeenCalledTimes(2);
  });
});
