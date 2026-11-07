import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Profiler } from 'react';
import { Text } from 'react-native';

import { AnimatedPressable } from '@/components/animated-pressable';
import { Motion } from '@/constants/motion';

import { PRESS_FEEDBACK_SPRING, PRESS_FEEDBACK_TIMING, usePressFeedback } from '../use-press-feedback';

function Harness({ onPress }: { onPress: () => void }) {
  const press = usePressFeedback();
  return (
    <AnimatedPressable
      accessibilityLabel="Confirmar"
      onPress={onPress}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      style={press.style}>
      <Text>Confirmar</Text>
    </AnimatedPressable>
  );
}

describe('feedback de toque das ações', () => {
  it('usa os tokens da casa e a preferência de movimento reduzido do sistema', () => {
    expect(PRESS_FEEDBACK_TIMING).toEqual({
      duration: Motion.duration.fast,
      easing: Motion.easing.standard,
      reduceMotion: 'system',
    });
    expect(PRESS_FEEDBACK_SPRING).toEqual({
      ...Motion.spring.press,
      reduceMotion: 'system',
    });
  });

  it('anima o pressed sem re-renderizar a tela e preserva o tap', async () => {
    const onPress = jest.fn();
    const onRender = jest.fn();

    await render(
      <Profiler id="feedback" onRender={onRender}>
        <Harness onPress={onPress} />
      </Profiler>,
    );
    const button = screen.getByLabelText('Confirmar');
    expect(onRender).toHaveBeenCalledTimes(1);

    await fireEvent(button, 'pressIn');
    await fireEvent(button, 'pressOut');
    expect(onRender).toHaveBeenCalledTimes(1);

    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
