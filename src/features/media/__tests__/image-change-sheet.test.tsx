import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ImageChangeSheet } from '../image-change-sheet';

jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));

describe('folha de troca de imagem', () => {
  it('fica aberta durante o salvamento', async () => {
    const close = jest.fn();
    await render(<ImageChangeSheet visible title="Foto de perfil" kind="cover" busy onClose={close} onConfirm={jest.fn()} />);

    await fireEvent(screen.getByTestId('bottom-sheet-drag-header'), 'accessibilityEscape');
    await fireEvent(screen.getByTestId('bottom-sheet-modal'), 'requestClose');
    await fireEvent.press(screen.getByLabelText('Fechar'));

    expect(close).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Cancelar').props.accessibilityState.disabled).toBe(true);
  });
});
