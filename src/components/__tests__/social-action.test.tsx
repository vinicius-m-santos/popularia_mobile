import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { haptic } from '@/lib/haptics';

import { SocialAction, type SocialActionVariant } from '../social-action';

jest.mock('@/lib/haptics', () => ({ haptic: jest.fn() }));

const VARIANTS: SocialActionVariant[] = ['feed', 'editorial', 'rail', 'comment'];

beforeEach(() => {
  jest.clearAllMocks();
});

describe('SocialAction', () => {
  it.each(VARIANTS)('mantém contador, toque inicial e callback na variante %s', async (variant) => {
    const onPress = jest.fn();
    const onPressIn = jest.fn();
    await render(
      <SocialAction
        variant={variant}
        icon="support"
        label="Apoiar"
        count={1200}
        active={false}
        onPress={onPress}
        onPressIn={onPressIn}
      />,
    );

    const button = screen.getByLabelText('Apoiar, 1,2 mil');
    expect(screen.getByText('1,2 mil')).toBeTruthy();

    // O prefetch do cartão continua acontecendo no início do toque.
    await fireEvent(button, 'pressIn');
    expect(onPressIn).toHaveBeenCalledTimes(1);

    await fireEvent.press(button);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('anuncia o estado selecionado em alternâncias e omite em navegação', async () => {
    const view = await render(<SocialAction icon="support" label="Apoiar" count={2} active onPress={jest.fn()} />);

    expect(screen.getByLabelText('Apoiar, 2').props.accessibilityState).toMatchObject({
      selected: true,
      disabled: false,
      busy: false,
    });

    await view.rerender(<SocialAction icon="comment" label="Comentar" count={2} onPress={jest.fn()} />);
    // Navegação não anuncia seleção; o Pressable ainda preenche os campos neutros do estado.
    expect(screen.getByLabelText('Comentar, 2').props.accessibilityState.selected).toBeUndefined();
  });

  it('acompanha mudanças rápidas de estado e contador sem perder o callback', async () => {
    const onPress = jest.fn();
    const view = await render(<SocialAction icon="support" label="Apoiar" count={0} active={false} onPress={onPress} />);

    expect(screen.getByLabelText('Apoiar, 0').props.accessibilityState.selected).toBe(false);

    // Ida e volta do otimista, como dois toques rápidos antes da confirmação.
    await view.rerender(<SocialAction icon="support" label="Apoiar" count={1} active onPress={onPress} />);
    expect(screen.getByLabelText('Apoiar, 1').props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('1')).toBeTruthy();

    await view.rerender(<SocialAction icon="support" label="Apoiar" count={0} active={false} onPress={onPress} />);
    expect(screen.getByLabelText('Apoiar, 0').props.accessibilityState.selected).toBe(false);

    await fireEvent.press(screen.getByLabelText('Apoiar, 0'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('bloqueia o toque e anuncia o carregamento sem perder o contador', async () => {
    const onPress = jest.fn();
    await render(<SocialAction icon="support" label="Apoiar" count={2} active={false} busy onPress={onPress} />);

    const button = screen.getByLabelText('Apoiar, 2');
    expect(button.props.accessibilityState).toMatchObject({ selected: false, disabled: true, busy: true });
    expect(screen.getByTestId('social-action-loading')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();

    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(haptic).not.toHaveBeenCalled();
  });

  it('esconde o contador visual e falado quando showCount é falso', async () => {
    await render(
      <SocialAction icon="bookmark" label="Salvar" count={7} showCount={false} active={false} hapticFeedback={null} onPress={jest.fn()} />,
    );

    expect(screen.getByLabelText('Salvar')).toBeTruthy();
    expect(screen.queryByText('7')).toBeNull();
  });

  it('tiqueia alternâncias, não navegação e respeita o override do handler', async () => {
    const view = await render(<SocialAction icon="support" label="Apoiar" count={0} active={false} onPress={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Apoiar, 0'));
    expect(haptic).toHaveBeenCalledWith('light');
    jest.mocked(haptic).mockClear();

    await view.rerender(<SocialAction icon="comment" label="Comentar" count={0} onPress={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Comentar, 0'));
    expect(haptic).not.toHaveBeenCalled();

    // Salvar tem o tique no handler compartilhado; o botão não repete o estímulo.
    await view.rerender(<SocialAction icon="bookmark" label="Salvar" active={false} hapticFeedback={null} onPress={jest.fn()} />);
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(haptic).not.toHaveBeenCalled();
  });

  it('preserva as dimensões e a superfície de cada variante', async () => {
    await render(
      <>
        <SocialAction variant="feed" icon="support" label="Feed" count={0} active={false} onPress={jest.fn()} />
        <SocialAction variant="editorial" icon="support" label="Editorial" count={0} active={false} onPress={jest.fn()} />
        <SocialAction variant="rail" icon="support" label="Rail" count={0} active={false} onPress={jest.fn()} />
        <SocialAction variant="comment" icon="support" label="Comentário" count={0} active={false} onPress={jest.fn()} />
      </>,
    );

    const styleOf = (label: string) => StyleSheet.flatten(screen.getByLabelText(label).props.style) ?? {};

    expect(styleOf('Feed, 0')).toMatchObject({
      minHeight: 44,
      minWidth: 44,
      borderWidth: 2,
      borderRadius: Radius.md,
    });
    expect(styleOf('Editorial, 0')).toMatchObject({ minHeight: 44, minWidth: 54, paddingHorizontal: Spacing.two });
    expect(styleOf('Editorial, 0').borderWidth).toBeUndefined();
    expect(styleOf('Rail, 0')).toMatchObject({ minHeight: 44 });
    expect(styleOf('Rail, 0').borderWidth).toBeUndefined();
    expect(styleOf('Comentário, 0')).toMatchObject({ minHeight: 44, paddingHorizontal: Spacing.two });
    expect(styleOf('Comentário, 0').borderWidth).toBeUndefined();

    // O rail usa hitSlop para completar a área de toque vertical sobre o vídeo.
    expect(screen.getByLabelText('Rail, 0').props.hitSlop).toEqual({ top: 4, bottom: 4, left: 8, right: 8 });
  });
});
