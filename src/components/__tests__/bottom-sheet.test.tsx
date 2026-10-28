import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { AppText } from '@/components/app-text';
import { BottomSheet } from '@/components/bottom-sheet';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));
jest.mock('@/hooks/use-keyboard-visible', () => ({ useKeyboardVisible: () => false }));

describe('BottomSheet', () => {
  it('captura o gesto desde o título para permitir arrastar a folha', async () => {
    await render(<BottomSheet visible onClose={jest.fn()} title="Escolher assunto"><AppText>Conteúdo</AppText></BottomSheet>);

    expect(screen.getByText('Escolher assunto')).toBeTruthy();
    const dragHeader = screen.getByTestId('bottom-sheet-drag-header');
    expect(dragHeader.props.onStartShouldSetResponder({})).toBe(true);
    expect(typeof dragHeader.props.onStartShouldSetResponderCapture).toBe('function');
  });
});
