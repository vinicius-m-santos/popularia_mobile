import { describe, expect, it, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { LicensesScreen } from '../licenses-screen';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 20, bottom: 0, left: 0, right: 0 }) };
});
jest.mock('@/lib/routes', () => ({ goBack: jest.fn() }));

describe('licenças', () => {
  it('lista fontes e bibliotecas geradas a partir das dependências', async () => {
    await render(<LicensesScreen />);
    expect(screen.getByText('Anton')).toBeTruthy();
    expect(screen.getAllByText(/SIL OFL 1\.1/).length).toBeGreaterThanOrEqual(4);
    expect(screen.getByText('@expo-google-fonts/anton')).toBeTruthy();
  });
});
