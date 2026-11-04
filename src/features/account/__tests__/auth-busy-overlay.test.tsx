import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { AuthBusyOverlay } from '../auth-busy-overlay';

describe('AuthBusyOverlay', () => {
  it('mostra o rótulo da operação e fica acima da navegação', async () => {
    await render(<AuthBusyOverlay label="Entrando…" />);
    expect(screen.getByText('Entrando…')).toBeTruthy();
    expect(screen.getByLabelText('Entrando…')).toBeTruthy();
  });
});
