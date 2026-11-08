import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { AppText } from '@/components/app-text';
import { EditorialBar } from '../editorial-bar';

describe('chrome editorial de voltar', () => {
  it('usa o botão de voltar como ação de 44 e mantém o slot de título', async () => {
    const onBack = jest.fn();
    await render(
      <EditorialBar
        testID="bar"
        onBack={onBack}
        title={<AppText testID="bar-title">Biblioteca</AppText>}
        divider
      />,
    );

    expect(screen.getByLabelText('Voltar').props.accessibilityRole).toBe('button');
    expect(StyleSheet.flatten(screen.getByTestId('bar').props.style)).toMatchObject({ minHeight: 58 });
    expect(screen.getByTestId('bar-title')).toBeTruthy();

    await fireEvent.press(screen.getByLabelText('Voltar'));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('respeita rótulo próprio e preserva o recuo quando não há voltar', async () => {
    await render(<EditorialBar backLabel="Fechar" onBack={jest.fn()} title={<AppText>Perfil</AppText>} />);
    expect(screen.getByLabelText('Fechar')).toBeTruthy();
  });

  it('sem voltar, mantém o espaço do botão em vez de deslocar o título', async () => {
    await render(<EditorialBar title={<AppText>Perfil</AppText>} reserveActionSpace />);
    expect(screen.queryByLabelText('Voltar')).toBeNull();
    expect(screen.getByText('Perfil')).toBeTruthy();
  });
});
