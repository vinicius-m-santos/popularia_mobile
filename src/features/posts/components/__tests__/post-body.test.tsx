import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { PostBody } from '../post-body';

jest.mock('expo-router', () => ({ router: { push: jest.fn(), navigate: jest.fn() }, useSegments: () => [] }));

describe('links no corpo da publicação', () => {
  beforeEach(() => { jest.spyOn(Linking, 'openURL').mockResolvedValue(); });

  it('abre URL HTTP externamente sem levar a pontuação final', async () => {
    await render(<PostBody text="Leia https://popularia.com.br/agora." />);
    fireEvent.press(screen.getByRole('link'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://popularia.com.br/agora');
  });

  it('desenha a menção sem buscar a pessoa e abre o perfil pelo id', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    const onMentionPress = jest.fn();
    const text = 'Primeira linha\nValeu @ana agora';
    await render(<PostBody text={text} onMentionPress={onMentionPress} mentions={[{
      userId: 'user-ana', handle: 'ana', displayName: 'Ana Souza', avatarUrl: null, start: 21, end: 25,
    }]} />);
    expect(screen.getByText(/Primeira linha/)).toBeTruthy();
    fireEvent.press(screen.getByRole('link', { name: 'Menção a Ana Souza, @ana' }));
    expect(onMentionPress).toHaveBeenCalledWith('user-ana');
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('normaliza www e não transforma esquemas inseguros', async () => {
    await render(<PostBody text="Visite www.popularia.com.br e ignore javascript:alert(1)" />);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    fireEvent.press(screen.getByRole('link'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://www.popularia.com.br');
  });
});
