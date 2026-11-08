import { describe, expect, it, jest } from '@jest/globals';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Pressable, StyleSheet, Text } from 'react-native';

import { FilterChipRow, FilterSegments } from '../filter-chips';
import { ChipRow } from '../chip';

const originOptions = [
  { key: 'all' as const, label: 'Tudo' },
  { key: 'people' as const, label: 'De pessoas' },
  { key: 'comunas' as const, label: 'De comunas' },
];

describe('filtros compartilhados', () => {
  it('seleciona por radiogroup e mantém o alvo de toque dos chips compactos', async () => {
    const onChange = jest.fn();
    await render(
      <FilterChipRow
        options={originOptions}
        value="people"
        onChange={onChange}
        accessibilityLabel="Origem dos documentos"
      />,
    );

    expect(screen.getByLabelText('Origem dos documentos').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByRole('radio', { name: 'De pessoas' }).props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.getByRole('radio', { name: 'Tudo' }).props.accessibilityState).toMatchObject({ checked: false });
    // 36 visuais + 4 de hitSlop em cada lado = alvo de 44.
    expect(screen.getByRole('radio', { name: 'Tudo' }).props.hitSlop).toEqual({ top: 4, bottom: 4 });

    await fireEvent.press(screen.getByRole('radio', { name: 'De comunas' }));
    expect(onChange).toHaveBeenCalledWith('comunas');
  });

  it('usa a variante sem contorno do Explorar com altura de toque completa', async () => {
    await render(
      <FilterChipRow
        options={originOptions}
        value="all"
        onChange={jest.fn()}
        accessibilityLabel="Filtrar resultados"
        appearance="soft"
      />,
    );

    const chip = screen.getByRole('radio', { name: 'Tudo' });
    expect(chip.props.hitSlop).toBeUndefined();
    expect(StyleSheet.flatten(chip.props.style)).toMatchObject({ minHeight: 44, backgroundColor: '#16120F' });
  });

  it('aceita a ação extra no fim do trilho sem quebrar a semântica de seleção', async () => {
    const onMore = jest.fn();
    await render(
      <FilterChipRow
        options={originOptions}
        value="all"
        onChange={jest.fn()}
        accessibilityLabel="Filtrar por assunto"
        trailing={<FilterAction label="Mais assuntos" onPress={onMore} />}
      />,
    );

    await fireEvent.press(screen.getByLabelText('Mais assuntos'));
    expect(onMore).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('radio', { name: 'Tudo' }).props.accessibilityState).toMatchObject({ checked: true });
  });

  it('segmenta a origem com seleção em tinta e mantém as opções acessíveis', async () => {
    const onChange = jest.fn();
    await render(
      <FilterSegments
        options={originOptions}
        value="people"
        onChange={onChange}
        accessibilityLabel="Origem dos documentos"
      />,
    );

    expect(screen.getByLabelText('Origem dos documentos').props.accessibilityRole).toBe('radiogroup');
    expect(screen.getByRole('radio', { name: 'De pessoas' }).props.accessibilityState).toMatchObject({ checked: true });

    await fireEvent.press(screen.getByRole('radio', { name: 'De comunas' }));
    expect(onChange).toHaveBeenCalledWith('comunas');
  });

  it('mantém o chip compacto existente com o rótulo ativo em creme', async () => {
    const onChange = jest.fn();
    await render(<ChipRow options={originOptions} value="all" onChange={onChange} accessibilityLabel="Filtrar avisos" />);

    expect(StyleSheet.flatten(screen.getByRole('radio', { name: 'Tudo' }).props.style)).toMatchObject({
      minHeight: 36,
      backgroundColor: '#16120F',
    });
    expect(StyleSheet.flatten(screen.getByText('Tudo').props.style)).toMatchObject({ color: '#F4ECDD' });

    await fireEvent.press(screen.getByRole('radio', { name: 'De pessoas' }));
    expect(onChange).toHaveBeenCalledWith('people');
  });
});

function FilterAction({ label, onPress }: { label: string; onPress: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}><Text>{label}</Text></Pressable>;
}
