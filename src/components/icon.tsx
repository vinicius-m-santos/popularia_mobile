import MaterialIcons from '@expo/vector-icons/MaterialIcons';
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
  heart: { strokeWidth: 2.2, body: <Path d="M20.5 8.8c0 5.2-8.5 10.7-8.5 10.7S3.5 14 3.5 8.8A4.8 4.8 0 0 1 12 6a4.8 4.8 0 0 1 8.5 2.8z" /> },
  pin: { strokeWidth: 2.2, body: <><Path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z" /><Circle cx={12} cy={10} r={2.2} /></> },
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
  library: { strokeWidth: 2.2, body: <><Path d="M4 4.5h6a3 3 0 0 1 3 3v12a3 3 0 0 0-3-3H4z" /><Path d="M20 4.5h-4a3 3 0 0 0-3 3v12a3 3 0 0 1 3-3h4z" /><Path d="M7 8h3M7 11h3M16 8h1M16 11h1" /></> },
  folder: { strokeWidth: 2.2, body: <Path d="M3.5 6.5h6l2 2h9v11h-17z" /> },
  institution: { strokeWidth: 1.9, body: <><Path d="M2.5 9 12 3l9.5 6zM4 20.5h16M5.5 9v9M10 9v9M14 9v9M18.5 9v9" /></> },
  document: { strokeWidth: 2, body: <><Path d="M5 2.5h9l5 5v14H5zM14 2.5v5h5" /><Path d="M8.5 12h7M8.5 16h7" /></> },
  edit: { strokeWidth: 2, body: <><Path d="m4 20 1-5L16.5 3.5a2.1 2.1 0 0 1 3 3L8 18zM14.5 5.5l4 4" /><Path d="M4 20h16" /></> },
  trash: { strokeWidth: 2, body: <><Path d="M4 6.5h16M9 3.5h6l1 3H8zM6.5 6.5l1 14h9l1-14M10 10v7M14 10v7" /></> },
  pie: { strokeWidth: 2, body: <><Path d="M11 2.5a9.5 9.5 0 1 0 9.5 9.5H11z" /><Path d="M14 2.8v6.3h6.3A9.5 9.5 0 0 0 14 2.8z" /></> },
  share: { strokeWidth: 2.2, body: <><Path d="M12 16V3M7 8l5-5 5 5" /><Path d="M6 12H4v9h16v-9h-2" /></> },
  shareNodes: { strokeWidth: 2.2, body: <><Circle cx={18} cy={5} r={2.2} /><Circle cx={6} cy={12} r={2.2} /><Circle cx={18} cy={19} r={2.2} /><Path d="m8 11 7.8-5M8 13l7.8 5" /></> },
  globe: { strokeWidth: 1.9, body: <><Circle cx={12} cy={12} r={9.5} /><Path d="M2.8 12h18.4M12 2.5c3 2.7 4.5 5.9 4.5 9.5S15 18.8 12 21.5M12 2.5C9 5.2 7.5 8.4 7.5 12S9 18.8 12 21.5" /></> },
  play: { strokeWidth: 0, solid: true, body: <Polygon points="8,5.5 19,12 8,18.5" /> },
  replay: {
    strokeWidth: 2.2,
    body: (
      <>
        <Path d="M20.5 12a8.5 8.5 0 1 1-2.8-6.3" />
        <Path d="M20.5 3.5V9h-5.5" />
      </>
    ),
  },
  soundOn: {
    strokeWidth: 2,
    body: (
      <>
        <Path d="M4 9.5h3.5L12 5.2v13.6L7.5 14.5H4z" />
        <Path d="M15.5 9.2a4.4 4.4 0 0 1 0 5.6M18.2 6.4a8.4 8.4 0 0 1 0 11.2" />
      </>
    ),
  },
  soundOff: {
    strokeWidth: 2,
    body: (
      <>
        <Path d="M4 9.5h3.5L12 5.2v13.6L7.5 14.5H4z" />
        <Path d="m15.6 9.6 4.8 4.8M20.4 9.6l-4.8 4.8" />
      </>
    ),
  },
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
  chevronDown: { strokeWidth: 2.4, body: <Path d="m4.5 9 7.5 7.5L19.5 9" /> },
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

export type IconName = keyof typeof ICONS | 'settings';

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  /** Preenche a forma (por exemplo, "Apoiar" ativo). */
  filled?: boolean;
};

/** Ícones são decorativos: o rótulo acessível fica no botão que os contém. */
export function Icon({ name, size = 24, color = Colors.ink, filled = false }: IconProps) {
  if (name === 'settings') {
    return (
      <View accessible={false} importantForAccessibility="no-hide-descendants">
        <MaterialIcons name="settings" size={size} color={color} />
      </View>
    );
  }
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
