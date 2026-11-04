import { describe, expect, it } from '@jest/globals';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { SingleLineText } from '../single-line-text';

describe('SingleLineText', () => {
  it('força uma linha com reticências e permite encolher no layout', async () => {
    await render(<SingleLineText numberOfLines={3} ellipsizeMode="head" style={{ textAlign: 'center' }}>Vinicius Santos</SingleLineText>);
    const text = screen.getByText('Vinicius Santos');
    expect(text.props.numberOfLines).toBe(1);
    expect(text.props.ellipsizeMode).toBe('tail');
    const style = StyleSheet.flatten(text.props.style);
    expect(style.flexShrink).toBe(1);
    expect(style.minWidth).toBe(0);
    expect(style.textAlign).toBe('center');
  });
});
