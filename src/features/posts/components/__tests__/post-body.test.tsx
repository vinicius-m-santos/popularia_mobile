import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { PostBody } from '../post-body';

describe('links no corpo da publicação', () => {
  beforeEach(() => { jest.spyOn(Linking, 'openURL').mockResolvedValue(); });

  it('abre URL HTTP externamente sem levar a pontuação final', async () => {
    await render(<PostBody text="Leia https://popularia.com.br/agora." />);
    fireEvent.press(screen.getByRole('link'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://popularia.com.br/agora');
  });

  it('normaliza www e não transforma esquemas inseguros', async () => {
    await render(<PostBody text="Visite www.popularia.com.br e ignore javascript:alert(1)" />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    fireEvent.press(screen.getByRole('link'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.popularia.com.br');
  });
});
