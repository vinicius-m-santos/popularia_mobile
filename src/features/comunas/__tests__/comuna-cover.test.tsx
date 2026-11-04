import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ComunaCover } from '../components/comuna-cover';
import { uploadCover } from '@/features/media/upload-image';

jest.mock('expo-image', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  const Image = (props: Record<string, unknown>) => React.createElement(View, { testID: 'cover-image', ...props });
  Image.prefetch = jest.fn(async () => true);
  return { Image };
});
jest.mock('@/features/media/image-change-sheet', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    ImageChangeSheet: ({ visible, onConfirm }: { visible: boolean; onConfirm: (image: { uri: string; name: string; mimeType: 'image/jpeg'; size: number }) => void }) =>
      visible ? React.createElement(Pressable, { accessibilityLabel: 'Escolher imagem de teste', onPress: () => onConfirm({ uri: 'file:///capa.jpg', name: 'capa.jpg', mimeType: 'image/jpeg', size: 10 }) }, React.createElement(Text, null, 'sheet')) : null,
  };
});
jest.mock('@/features/media/upload-image', () => ({ uploadCover: jest.fn(async () => 'https://cdn.test/nova-capa.jpg') }));
jest.mock('@/features/media/image-cache', () => ({ publishCover: jest.fn() }));
jest.mock('@/components/toast', () => ({ useToast: () => ({ show: jest.fn() }) }));

describe('ComunaCover', () => {
  it('mostra a nova capa depois do upload', async () => {
    await render(<ComunaCover comuna={{ id: 'teste', serverId: 'uuid', name: 'Teste', coverAlt: 'capa', coverUrl: null }} canEdit />);
    await fireEvent.press(screen.getByLabelText('Alterar capa da comuna'));
    await fireEvent.press(await screen.findByLabelText('Escolher imagem de teste'));
    await waitFor(() => expect(screen.getByTestId('cover-image').props.source.uri).toBe('https://cdn.test/nova-capa.jpg'));
    expect(jest.mocked(uploadCover)).toHaveBeenCalledWith('teste', expect.objectContaining({ uri: 'file:///capa.jpg' }));
  });
});
