import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { AppText } from '@/components/app-text';
import { BottomSheet, PopulariaBottomSheetFlatList } from '@/components/bottom-sheet';
import { MinTouchTarget } from '@/constants/theme';
import { resetReducedMotionCache } from '@/hooks/use-reduced-motion';

jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }) }));

const gorhom = jest.requireMock('@gorhom/bottom-sheet') as unknown as {
  __snapToIndex: ReturnType<typeof jest.fn>;
  __close: ReturnType<typeof jest.fn>;
};

beforeEach(() => {
  gorhom.__snapToIndex.mockClear();
  gorhom.__close.mockClear();
});

afterEach(() => {
  resetReducedMotionCache();
  jest.restoreAllMocks();
});

describe('BottomSheet', () => {
  it('apresenta o título no handle e fecha por ação acessível', async () => {
    const close = jest.fn();
    await render(<BottomSheet visible onClose={close} title="Escolher assunto"><AppText>Conteúdo</AppText></BottomSheet>);
    expect(screen.getByText('Escolher assunto')).toBeTruthy();
    await fireEvent(screen.getByTestId('bottom-sheet-drag-header'), 'accessibilityEscape');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('prende o foco no modal e zera a animação com movimento reduzido', async () => {
    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    const close = jest.fn();
    await render(<BottomSheet visible onClose={close} title="Escolher assunto"><AppText>Conteúdo</AppText></BottomSheet>);

    const root = screen.getByTestId('bottom-sheet-root');
    expect(root.props.accessibilityViewIsModal).toBe(true);
    await waitFor(() => expect(screen.getByTestId('gorhom-sheet').props.animationConfigs).toEqual({ duration: 0 }));
    await fireEvent(root, 'accessibilityEscape');
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

  it.each(['paper', 'creation', 'report'] as const)('mantém a alça visível pequena com área de arraste de pelo menos 44 (%s)', async (appearance) => {
    await render(<BottomSheet visible appearance={appearance} onClose={jest.fn()}><AppText>Conteúdo</AppText></BottomSheet>);
    const headerStyle = StyleSheet.flatten(screen.getByTestId('bottom-sheet-drag-header').props.style);
    const handleStyle = StyleSheet.flatten(screen.getByTestId('bottom-sheet-handle').props.style);
    expect(headerStyle.minHeight).toBeGreaterThanOrEqual(MinTouchTarget);
    expect(handleStyle.height).toBeLessThanOrEqual(5);
  });

  it('só abre depois que o conteúdo reporta layout', async () => {
    const view = await render(<BottomSheet visible={false} onClose={jest.fn()}><AppText>Conteúdo</AppText></BottomSheet>);
    expect(gorhom.__snapToIndex).not.toHaveBeenCalled();
    await view.rerender(<BottomSheet visible onClose={jest.fn()}><AppText>Conteúdo</AppText></BottomSheet>);
    expect(gorhom.__snapToIndex).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId('bottom-sheet-scroll'), 'contentSizeChange', 320, 240);
    await waitFor(() => expect(gorhom.__snapToIndex).toHaveBeenCalledWith(0));
  });

  it('monta fechado e não abre antes da medição, evitando salto na primeira abertura', async () => {
    await render(<BottomSheet visible onClose={jest.fn()}><AppText>Conteúdo</AppText></BottomSheet>);
    const sheet = screen.getByTestId('gorhom-sheet');
    expect(sheet.props.index).toBe(-1);
    expect(sheet.props.animateOnMount).toBe(false);
    expect(gorhom.__snapToIndex).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId('bottom-sheet-scroll'), 'contentSizeChange', 320, 240);
    await waitFor(() => expect(gorhom.__snapToIndex).toHaveBeenCalledWith(0));
  });

  it('desliga o pan do conteúdo por padrão em folha rolável e virtualizada', async () => {
    const view = await render(<BottomSheet visible onClose={jest.fn()} scrollable><AppText>Lista longa</AppText></BottomSheet>);
    expect(screen.getByTestId('gorhom-sheet').props.enableContentPanningGesture).toBe(false);
    await view.rerender(<BottomSheet visible virtualized onClose={jest.fn()}><AppText>Lista longa</AppText></BottomSheet>);
    expect(screen.getByTestId('gorhom-sheet').props.enableContentPanningGesture).toBe(false);
  });

  it('mantém o pan do conteúdo em folha curta e permite reativar explicitamente em lista', async () => {
    const short = await render(<BottomSheet visible scrollable={false} onClose={jest.fn()}><AppText>Curta</AppText></BottomSheet>);
    expect(screen.getByTestId('gorhom-sheet').props.enableContentPanningGesture).toBe(true);
    await short.rerender(<BottomSheet visible onClose={jest.fn()} contentPanningGesture><AppText>Lista</AppText></BottomSheet>);
    expect(screen.getByTestId('gorhom-sheet').props.enableContentPanningGesture).toBe(true);
  });

  it('reabre medindo de novo depois de fechar', async () => {
    const close = jest.fn();
    const view = await render(<BottomSheet visible onClose={close}><AppText>Conteúdo</AppText></BottomSheet>);
    await fireEvent(screen.getByTestId('bottom-sheet-scroll'), 'contentSizeChange', 320, 240);
    await waitFor(() => expect(gorhom.__snapToIndex).toHaveBeenCalledTimes(1));
    await view.rerender(<BottomSheet visible={false} onClose={close}><AppText>Conteúdo</AppText></BottomSheet>);
    expect(screen.queryByText('Conteúdo')).toBeNull();
    await view.rerender(<BottomSheet visible onClose={close}><AppText>Conteúdo</AppText></BottomSheet>);
    await fireEvent(screen.getByTestId('bottom-sheet-scroll'), 'contentSizeChange', 320, 240);
    await waitFor(() => expect(gorhom.__snapToIndex).toHaveBeenCalledTimes(2));
  });

  it('preserva listas internas em folhas virtualizadas', async () => {
    await render(<BottomSheet visible virtualized onClose={jest.fn()}>
      <PopulariaBottomSheetFlatList
        data={[{ id: '1', label: 'Comuna A' }, { id: '2', label: 'Comuna B' }]}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <AppText>{item.label}</AppText>}
      />
    </BottomSheet>);
    expect(screen.getByText('Comuna A')).toBeTruthy();
    expect(screen.getByText('Comuna B')).toBeTruthy();
  });

  it('não fecha por pan nem pelo voltar do Android quando não está dismissível', async () => {
    const close = jest.fn();
    await render(<BottomSheet visible dismissible={false} onClose={close}><AppText>Enviando</AppText></BottomSheet>);
    const sheet = screen.getByTestId('gorhom-sheet');
    expect(sheet.props.enablePanDownToClose).toBe(false);
    expect(sheet.props.enableHandlePanningGesture).toBe(false);
    expect(sheet.props.enableContentPanningGesture).toBe(false);
    const modal = screen.getByTestId('bottom-sheet-modal');
    await fireEvent(modal, 'requestClose');
    expect(close).not.toHaveBeenCalled();
  });

  it('fecha a folha montada quando visible vira false', async () => {
    const close = jest.fn();
    const view = await render(<BottomSheet visible onClose={close}><AppText>Conteúdo</AppText></BottomSheet>);
    await view.rerender(<BottomSheet visible={false} onClose={close}><AppText>Conteúdo</AppText></BottomSheet>);
    expect(gorhom.__close).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Conteúdo')).toBeNull();
    expect(close).not.toHaveBeenCalled();
  });
});
