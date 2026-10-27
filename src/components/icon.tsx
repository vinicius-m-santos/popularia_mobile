import { View } from 'react-native';
import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

import { Colors } from '@/constants/theme';

type IconDef = {
  body: React.ReactNode;
  strokeWidth: number;
  /** Ícones sólidos (sem traço), como os três pontos de "mais opções". */
  solid?: boolean;
};

/** Ícones do design (viewBox 24×24). */
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
  reply: { strokeWidth: 2.2, body: <Path d="M9 5 3 11l6 6M3 11h10c5 0 7 3 7 8" /> },
  sticker: { strokeWidth: 1.8, body: <><Rect x={3} y={3} width={18} height={18} rx={4} /><Path d="M8 10h.01M16 10h.01M8 15c2 2 6 2 8 0" /></> },
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
  play: { strokeWidth: 0, solid: true, body: <Polygon points="8,5.5 19,12 8,18.5" /> },
  close: { strokeWidth: 2.4, body: <Path d="M6 6l12 12M18 6 6 18" /> },
  back: { strokeWidth: 2.4, body: <Path d="M15 4.5 7.5 12l7.5 7.5" /> },
  more: {
    strokeWidth: 0,
    solid: true,
    body: (
      <>
        <Circle cx={5} cy={12} r={1.7} />
        <Circle cx={12} cy={12} r={1.7} />
        <Circle cx={19} cy={12} r={1.7} />
      </>
    ),
  },
  check: { strokeWidth: 2.6, body: <Path d="M5 12.5l4.5 4.5L19 7.5" /> },
  send: { strokeWidth: 2.2, body: <Path d="M3.5 11.5 20.5 4l-7.5 17-2.5-7z" /> },
  shield: { strokeWidth: 2.2, body: <Path d="M12 3l7.5 3v5.5c0 4.6-3.2 8-7.5 9.5-4.3-1.5-7.5-4.9-7.5-9.5V6z" /> },
  phone: {
    strokeWidth: 2.2,
    body: (
      <>
        <Rect x={6.5} y={2.5} width={11} height={19} rx={2} />
        <Path d="M10.5 18.5h3" />
      </>
    ),
  },
  flag: { strokeWidth: 2.2, body: <Path d="M5 21V4h11l-2 4 2 4H5" /> },
  mute: {
    strokeWidth: 2.2,
    body: (
      <>
        <Path d="M3.5 9.5v5h3l5.5 4v-13l-5.5 4z" />
        <Path d="M16 9.5l5 5M21 9.5l-5 5" />
      </>
    ),
  },
  link: {
    strokeWidth: 2.2,
    body: (
      <>
        <Path d="M10 14l4-4" />
        <Path d="M8.5 11.5l-2 2a3 3 0 0 0 4 4l2-2" />
        <Path d="M15.5 12.5l2-2a3 3 0 0 0-4-4l-2 2" />
      </>
    ),
  },
  chevronRight: { strokeWidth: 2.4, body: <Path d="M9 4.5 16.5 12 9 19.5" /> },
  settings: {
    strokeWidth: 2.2,
    body: (
      <>
        <Circle cx={12} cy={12} r={3.2} />
        <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" />
      </>
    ),
  },
  calendar: {
    strokeWidth: 2.2,
    body: (
      <>
        <Rect x={3.5} y={5} width={17} height={15} />
        <Path d="M3.5 10h17M8 3v4M16 3v4" />
      </>
    ),
  },
  poll: { strokeWidth: 2.4, body: <Path d="M5 20V11M12 20V5M19 20v-6" /> },
  arrowRight: { strokeWidth: 2.6, body: <Path d="M5 12h13M13 6l6 6-6 6" /> },
  camera: {
    strokeWidth: 2,
    body: (
      <>
        <Path d="M3.5 7.5h4l1.5-2.5h6l1.5 2.5h4v12h-17z" />
        <Circle cx={12} cy={13} r={3.5} />
      </>
    ),
  },
  image: {
    strokeWidth: 2.2,
    body: (
      <>
        <Rect x={3.5} y={4.5} width={17} height={15} />
        <Circle cx={9} cy={10} r={1.8} />
        <Path d="M3.5 17l5-4.5 4 3.5 3-2.5 5 4" />
      </>
    ),
  },
} satisfies Record<string, IconDef>;

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
  const icon: IconDef = ICONS[name];
  // A ocultação fica num View: o Svg repassa essas props cruas ao DOM na web e quebra o SSR.
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants">
      <Svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill={icon.solid || filled ? color : 'none'}
        stroke={icon.solid ? 'none' : color}
        strokeWidth={icon.strokeWidth}
        strokeLinejoin="miter"
        strokeLinecap="square">
        {icon.body}
      </Svg>
    </View>
  );
}
