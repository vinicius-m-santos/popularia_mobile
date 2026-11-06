import { describe, expect, it } from '@jest/globals';

import {
  FEED_SWIPE_DISTANCE,
  FEED_SWIPE_VERTICAL_RATIO,
  feedSwipeDirection,
  feedTabAfterSwipe,
} from '../feed-swipe';

const tabs = ['para-voce', 'seguindo', 'minhas', 'perto'] as const;

describe('swipe do feed', () => {
  it('avança, volta e respeita as pontas', () => {
    expect(feedTabAfterSwipe(tabs, 'para-voce', -FEED_SWIPE_DISTANCE, 0)).toBe('seguindo');
    expect(feedTabAfterSwipe(tabs, 'seguindo', FEED_SWIPE_DISTANCE, 0)).toBe('para-voce');
    expect(feedTabAfterSwipe(tabs, 'para-voce', FEED_SWIPE_DISTANCE, 0)).toBe('para-voce');
    expect(feedTabAfterSwipe(tabs, 'perto', -FEED_SWIPE_DISTANCE, 0)).toBe('perto');
  });

  it('ignora um arrasto abaixo da distância mínima', () => {
    expect(feedSwipeDirection(-(FEED_SWIPE_DISTANCE - 1), 0)).toBe(0);
    expect(feedTabAfterSwipe(tabs, 'para-voce', -(FEED_SWIPE_DISTANCE - 1), 0)).toBe('para-voce');
  });

  it('não troca de aba quando o eixo vertical domina o gesto', () => {
    const vertical = FEED_SWIPE_DISTANCE / FEED_SWIPE_VERTICAL_RATIO + 1;
    expect(feedSwipeDirection(-FEED_SWIPE_DISTANCE, vertical)).toBe(0);
    expect(feedTabAfterSwipe(tabs, 'seguindo', -FEED_SWIPE_DISTANCE, vertical)).toBe('seguindo');
  });

  it('troca quando o deslocamento horizontal vence a dominância vertical', () => {
    const vertical = FEED_SWIPE_DISTANCE / FEED_SWIPE_VERTICAL_RATIO - 1;
    expect(feedSwipeDirection(-FEED_SWIPE_DISTANCE, vertical)).toBe(1);
    expect(feedSwipeDirection(FEED_SWIPE_DISTANCE, vertical)).toBe(-1);
  });

  it('mantém a aba atual quando ela não pertence à lista', () => {
    expect(feedTabAfterSwipe(tabs, 'desconhecida', -FEED_SWIPE_DISTANCE, 0)).toBe('desconhecida');
  });
});
