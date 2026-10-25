import Svg, { Circle, Path, Polygon } from 'react-native-svg';

import { Colors } from '@/constants/theme';

/** Ícones traçados do design (viewBox 24×24). */
const ICONS = {
  home: { strokeWidth: 2.2, body: <Path d="M3.5 10.5 12 3.5l8.5 7v10h-6v-6h-5v6h-6z" /> },
  search: {
    strokeWidth: 2.2,
    body: (
      <>
        <Circle cx={10.5} cy={10.5} r={6.5} />
        <Path d="M15.5 15.5l5 5" />
      </>
    ),
  },
  plus: { strokeWidth: 2.8, body: <Path d="M12 5v14M5 12h14" /> },
  bell: { strokeWidth: 2.2, body: <Path d="M5.5 17V11a6.5 6.5 0 0 1 13 0v6zM3.5 17h17M10 20.5h4" /> },
  user: {
    strokeWidth: 2.2,
    body: (
      <>
        <Circle cx={12} cy={8} r={4} />
        <Path d="M4 21c.6-4.4 3.8-7 8-7s7.4 2.6 8 7" />
      </>
    ),
  },
  support: {
    strokeWidth: 2,
    body: <Polygon points="12,2.8 14.7,9 21.2,9.3 16.1,13.4 17.9,20 12,16.3 6.1,20 7.9,13.4 2.8,9.3 9.3,9" />,
  },
  comment: { strokeWidth: 2.2, body: <Path d="M3.5 4.5h17v11.5h-9l-5 4v-4h-3z" /> },
  echo: {
    strokeWidth: 2.2,
    body: (
      <>
        <Path d="M3.5 9.5v5h3l8.5 4.5v-14l-8.5 4.5z" />
        <Path d="M18.5 8.5c1.3 1 2 2.2 2 3.5s-.7 2.5-2 3.5" />
      </>
    ),
  },
  bookmark: { strokeWidth: 2.2, body: <Path d="M6 3.5h12v17l-6-4-6 4z" /> },
  play: { strokeWidth: 0, body: <Polygon points="8,5.5 19,12 8,18.5" /> },
  close: { strokeWidth: 2.4, body: <Path d="M6 6l12 12M18 6 6 18" /> },
} as const;

export type IconName = keyof typeof ICONS;

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  /** Preenche a forma (por exemplo, "Apoiar" ativo). */
  filled?: boolean;
};

/** Ícones são decorativos: o rótulo acessível fica no botão que os contém. */
export function Icon({ name, size = 24, color = Colors.ink, filled = false }: IconProps) {
  const icon = ICONS[name];
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : 'none'}
      stroke={color}
      strokeWidth={icon.strokeWidth}
      strokeLinejoin="miter"
      strokeLinecap="square"
      accessible={false}
      importantForAccessibility="no-hide-descendants">
      {icon.body}
    </Svg>
  );
}
