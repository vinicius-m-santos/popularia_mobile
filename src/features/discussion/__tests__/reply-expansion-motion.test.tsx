import { afterAll, afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { LayoutAnimation, Pressable, Text } from 'react-native';

import { Motion } from '@/constants/motion';

import {
  REPLY_EXPANSION_ANIMATION,
  REPLY_EXPANSION_LIMITS,
  shouldAnimateReplyExpansion,
  useReplyExpansionMotion,
} from '../reply-expansion-motion';

let mockReducedMotion = false;
let mockFontScale = 1;

jest.mock('@/hooks/use-reduced-motion', () => ({
  useReducedMotion: () => mockReducedMotion,
}));

jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 390, height: 844, scale: 2, fontScale: mockFontScale }),
}));

function Harness({
  replyCount,
  rowCount,
  collapsed,
}: {
  replyCount: number;
  rowCount: number;
  collapsed: boolean;
}) {
  const animate = useReplyExpansionMotion();
  return (
    <Pressable accessibilityLabel="Alternar respostas" onPress={() => animate({ replyCount, rowCount, collapsed })}>
      <Text>Alternar</Text>
    </Pressable>
  );
}

describe('motion da expansão de respostas', () => {
  const configure = jest.spyOn(LayoutAnimation, 'configureNext').mockImplementation(() => {});

  beforeEach(() => {
    mockReducedMotion = false;
    mockFontScale = 1;
    configure.mockClear();
  });

  afterEach(() => {
    configure.mockClear();
  });

  afterAll(() => {
    configure.mockRestore();
  });

  it('anima só a posição e mantém o texto opaco durante a expansão', () => {
    expect(REPLY_EXPANSION_ANIMATION.duration).toBe(Motion.duration.normal);
    expect(REPLY_EXPANSION_ANIMATION.create).toEqual({
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
      duration: 0,
    });
    expect(REPLY_EXPANSION_ANIMATION.update).toEqual({ type: LayoutAnimation.Types.easeInEaseOut });
    expect(REPLY_EXPANSION_ANIMATION.delete).toEqual({
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
      duration: 0,
    });
  });

  it('pula a animação com movimento reduzido ou quando a expansão é grande demais', () => {
    const base = { replyCount: 2, rowCount: 10, collapsed: true };
    expect(shouldAnimateReplyExpansion({ ...base, reducedMotion: false })).toBe(true);
    expect(shouldAnimateReplyExpansion({ ...base, reducedMotion: true })).toBe(false);
    expect(shouldAnimateReplyExpansion({ ...base, replyCount: REPLY_EXPANSION_LIMITS.maxReplies + 1, reducedMotion: false })).toBe(false);
    expect(shouldAnimateReplyExpansion({ ...base, rowCount: REPLY_EXPANSION_LIMITS.maxRows, reducedMotion: false })).toBe(false);
    expect(shouldAnimateReplyExpansion({ ...base, fontScale: REPLY_EXPANSION_LIMITS.maxFontScale + 0.1, reducedMotion: false })).toBe(false);
  });

  it('agenda a animação da próxima troca quando a lista é curta', async () => {
    await render(<Harness replyCount={2} rowCount={10} collapsed />);
    await fireEvent.press(screen.getByLabelText('Alternar respostas'));
    expect(configure).toHaveBeenCalledWith(REPLY_EXPANSION_ANIMATION);
  });

  it('não agenda nada com movimento reduzido', async () => {
    mockReducedMotion = true;
    await render(<Harness replyCount={2} rowCount={10} collapsed />);
    await fireEvent.press(screen.getByLabelText('Alternar respostas'));
    expect(configure).not.toHaveBeenCalled();
  });

  it('não agenda nada em uma lista longa', async () => {
    await render(<Harness replyCount={2} rowCount={REPLY_EXPANSION_LIMITS.maxRows} collapsed />);
    await fireEvent.press(screen.getByLabelText('Alternar respostas'));
    expect(configure).not.toHaveBeenCalled();
  });

  it('não agenda nada com fonte ampliada', async () => {
    mockFontScale = REPLY_EXPANSION_LIMITS.maxFontScale + 0.1;
    await render(<Harness replyCount={2} rowCount={10} collapsed />);
    await fireEvent.press(screen.getByLabelText('Alternar respostas'));
    expect(configure).not.toHaveBeenCalled();
  });
});
