import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { EditorialAction } from '../editorial-action';
import { IconButton } from '../icon-button';
import { PillButton } from '../pill-button';

describe('ações comuns com feedback de toque', () => {
  it('mantém o tap da ação editorial e bloqueia quando indisponível', async () => {
    const onPress = jest.fn();
    const view = await render(<EditorialAction label="Salvar" icon="check" onPress={onPress} />);
    const button = screen.getByLabelText('Salvar');
    await fireEvent(button, 'pressIn');
    await fireEvent(button, 'pressOut');
    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);

    await view.rerender(<EditorialAction label="Salvar" icon="check" onPress={onPress} disabled />);
    const disabled = screen.getByLabelText('Salvar');
    expect(StyleSheet.flatten(disabled.props.style)).toMatchObject({ opacity: 0.68 });
    await fireEvent.press(disabled);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('mantém o tap do botão de ícone', async () => {
    const onPress = jest.fn();
    await render(<IconButton icon="back" accessibilityLabel="Voltar" onPress={onPress} />);
    await fireEvent(screen.getByLabelText('Voltar'), 'pressIn');
    await fireEvent(screen.getByLabelText('Voltar'), 'pressOut');
    await fireEvent.press(screen.getByLabelText('Voltar'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('mantém o tap do botão compacto e anuncia o estado ocupado', async () => {
    const onPress = jest.fn();
    const view = await render(<PillButton label="Seguir" accessibilityLabel="Seguir" onPress={onPress} />);
    await fireEvent(screen.getByLabelText('Seguir'), 'pressIn');
    await fireEvent(screen.getByLabelText('Seguir'), 'pressOut');
    await fireEvent.press(screen.getByLabelText('Seguir'));
    expect(onPress).toHaveBeenCalledTimes(1);

    await view.rerender(<PillButton label="Seguindo" accessibilityLabel="Seguindo" onPress={onPress} busy />);
    const busy = screen.getByLabelText('Seguindo');
    expect(busy.props.accessibilityState).toMatchObject({ disabled: true, busy: true });
    expect(StyleSheet.flatten(busy.props.style)).toMatchObject({ opacity: 0.75 });
    await fireEvent.press(busy);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
