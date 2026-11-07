import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';

import { AppText, withMinimumLineHeight } from '@/components/app-text';
import { Fonts } from '@/constants/theme';

describe('AppText line height rule', () => {
  it('dá respiro a títulos condensados e Anton', () => {
    expect(withMinimumLineHeight({ fontFamily: Fonts.anton, fontSize: 64, lineHeight: 56 }).lineHeight).toBe(72);
    expect(withMinimumLineHeight({ fontFamily: Fonts.condensed, fontSize: 22, lineHeight: 24 }).lineHeight).toBe(30);
  });

  it('não altera texto de leitura regular pequeno', () => {
    expect(withMinimumLineHeight({ fontFamily: Fonts.regular, fontSize: 15.5, lineHeight: 18 }).lineHeight).toBe(18);
  });

  it('também protege texto regular grande', () => {
    expect(withMinimumLineHeight({ fontFamily: Fonts.regular, fontSize: 18, lineHeight: 20 }).lineHeight).toBe(26);
  });

  it('aplica o piso em qualquer AppText com estilo customizado', async () => {
    await render(<AppText style={{ fontFamily: Fonts.extrabold, fontSize: 20, lineHeight: 20 }}>Teste</AppText>);
    expect(screen.getByText('Teste').props.style.lineHeight).toBe(28);
  });

  it('reaproveita o estilo resolvido da variante entre renders', async () => {
    const { rerender } = await render(<AppText variant="body">Primeiro</AppText>);
    const firstStyle = screen.getByText('Primeiro').props.style;
    await rerender(<AppText variant="body">Segundo</AppText>);
    expect(screen.getByText('Segundo').props.style).toBe(firstStyle);
  });

  it('não aloca um novo estilo quando o line-height já basta', () => {
    const style = { fontFamily: Fonts.anton, fontSize: 20, lineHeight: 30 };
    expect(withMinimumLineHeight(style)).toBe(style);
  });

  it('memoriza o ajuste de line-height por identidade do estilo', () => {
    const style = { fontFamily: Fonts.anton, fontSize: 20, lineHeight: 20 };
    expect(withMinimumLineHeight(style)).toBe(withMinimumLineHeight(style));
  });
});
