import { describe, expect, it } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, Text } from 'react-native';

import { Motion } from '@/constants/motion';

import { ACTION_FEEDBACK_TIMING, useActionFeedback } from '../use-action-feedback';

function Harness() {
  const { pulse } = useActionFeedback();
  return (
    <Pressable accessibilityLabel="Confirmar" onPress={pulse}>
      <Text>Confirmar</Text>
    </Pressable>
  );
}

describe('unidade de feedback das ações', () => {
  it('usa os tokens da casa e respeita o movimento reduzido do sistema', async () => {
    expect(ACTION_FEEDBACK_TIMING.enter).toEqual({
      duration: Motion.duration.fast,
      easing: Motion.easing.standard,
      reduceMotion: 'system',
    });
    expect(ACTION_FEEDBACK_TIMING.settle).toEqual({
      duration: Motion.duration.normal,
      easing: Motion.easing.settle,
      reduceMotion: 'system',
    });
    await render(<Harness />);
    await fireEvent.press(screen.getByLabelText('Confirmar'));
  });
});
