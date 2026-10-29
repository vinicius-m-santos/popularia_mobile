import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));

describe('BottomSheet', () => {
  it('apresenta o título no handle e fecha por ação acessível', async () => {
    const close = jest.fn();
    await render(<BottomSheet visible onClose={close} title="Escolher assunto"><AppText>Conteúdo</AppText></BottomSheet>);
    expect(screen.getByText('Escolher assunto')).toBeTruthy();
    await fireEvent(screen.getByTestId('bottom-sheet-drag-header'), 'accessibilityEscape');
    expect(close).toHaveBeenCalledTimes(1);
  });
  it('não monta conteúdo de uma folha fechada', async () => {
    await render(<BottomSheet visible={false} onClose={jest.fn()}><AppText>Conteúdo</AppText></BottomSheet>);
    expect(screen.queryByText('Conteúdo')).toBeNull();
  });
  it('bloqueia dismiss durante envio e habilita a integração oficial de teclado', async () => {
    const close = jest.fn();
    await render(<BottomSheet visible dismissible={false} onClose={close}><AppText>Enviando</AppText></BottomSheet>);
    await fireEvent(screen.getByTestId('bottom-sheet-drag-header'), 'accessibilityEscape');
    expect(close).not.toHaveBeenCalled();
    expect(screen.getByTestId('gorhom-sheet').props.keyboardBlurBehavior).toBe('restore');
  });
});
