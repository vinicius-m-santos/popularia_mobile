import { describe, expect, it } from '@jest/globals';

import {
  PROFILE_TAB_SWIPE_DISTANCE,
  PROFILE_TAB_SWIPE_VELOCITY,
  profileTabAfterSwipe,
  profileTabOptions,
} from '../profile-tabs';

const plain = profileTabOptions(false).map((tab) => tab.key);
const creator = profileTabOptions(true).map((tab) => tab.key);

describe('abas do perfil', () => {
  it('deriva as páginas da mesma lista, com Episódios só para criadora', () => {
    expect(plain).toEqual(['posts', 'media', 'comunas', 'biblioteca']);
    expect(creator).toEqual(['posts', 'media', 'episodios', 'comunas', 'biblioteca']);
    expect(profileTabOptions(false).map((tab) => tab.label)).not.toContain('Episódios');
  });
});

describe('swipe entre abas', () => {
  it('avança, volta e respeita as pontas', () => {
    expect(profileTabAfterSwipe(plain, 'posts', -PROFILE_TAB_SWIPE_DISTANCE, 0)).toBe('media');
    expect(profileTabAfterSwipe(plain, 'media', PROFILE_TAB_SWIPE_DISTANCE, 0)).toBe('posts');
    expect(profileTabAfterSwipe(plain, 'posts', PROFILE_TAB_SWIPE_DISTANCE, 0)).toBe('posts');
    expect(profileTabAfterSwipe(plain, 'biblioteca', -PROFILE_TAB_SWIPE_DISTANCE, 0)).toBe('biblioteca');
  });

  it('um flick troca de aba e a translação vence a velocidade contrária', () => {
    expect(profileTabAfterSwipe(plain, 'posts', -8, -PROFILE_TAB_SWIPE_VELOCITY)).toBe('media');
    expect(profileTabAfterSwipe(plain, 'media', 8, PROFILE_TAB_SWIPE_VELOCITY)).toBe('posts');
    expect(profileTabAfterSwipe(plain, 'media', -PROFILE_TAB_SWIPE_DISTANCE, PROFILE_TAB_SWIPE_VELOCITY)).toBe('comunas');
    expect(profileTabAfterSwipe(plain, 'comunas', -4, -40)).toBe('comunas');
  });

  it('usa o índice da lista visível quando Episódios existe', () => {
    expect(profileTabAfterSwipe(plain, 'media', -80, 0)).toBe('comunas');
    expect(profileTabAfterSwipe(creator, 'media', -80, 0)).toBe('episodios');
    expect(profileTabAfterSwipe(creator, 'episodios', -80, 0)).toBe('comunas');
    expect(profileTabAfterSwipe(creator, 'episodios', 80, 0)).toBe('media');
  });
});
