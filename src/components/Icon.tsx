import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';
import { colors } from '../theme';

export type IconName =
  | 'today'
  | 'library'
  | 'exercises'
  | 'progress'
  | 'profile'
  | 'play'
  | 'pause'
  | 'plus'
  | 'minus'
  | 'check'
  | 'close'
  | 'back'
  | 'forward'
  | 'search'
  | 'timer'
  | 'trophy'
  | 'flame'
  | 'settings'
  | 'skip'
  | 'trash'
  | 'edit'
  | 'download'
  | 'upload'
  | 'swap'
  | 'calendar'
  | 'target'
  | 'volume'
  | 'list'
  | 'bolt'
  | 'flag'
  | 'info'
  | 'keyboard';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

/** Original line icons on a 24-unit grid. */
export function Icon({ name, size = 22, color = colors.primary, strokeWidth = 2 }: IconProps) {
  const p = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no">
      {renderIcon(name, p, color)}
    </Svg>
  );
}

type StrokeProps = { stroke: string; strokeWidth: number; strokeLinecap: 'round'; strokeLinejoin: 'round'; fill: string };

function renderIcon(name: IconName, p: StrokeProps, color: string) {
  switch (name) {
    case 'today':
    case 'bolt':
      return <Path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" {...p} />;
    case 'library':
      return (
        <>
          <Rect x="3" y="3" width="7.5" height="7.5" rx="1.5" {...p} />
          <Rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" {...p} />
          <Rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" {...p} />
          <Rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" {...p} />
        </>
      );
    case 'exercises':
      return (
        <>
          <Circle cx="12" cy="4.5" r="2" {...p} />
          <Path d="M5 9.5h14M12 9.5v5.5M12 15l-4 6.5M12 15l4 6.5" {...p} />
        </>
      );
    case 'progress':
      return (
        <>
          <Polyline points="3 17 9 11 13 15 21 7" {...p} />
          <Polyline points="15 7 21 7 21 13" {...p} />
        </>
      );
    case 'profile':
      return (
        <>
          <Circle cx="12" cy="8" r="4" {...p} />
          <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" {...p} />
        </>
      );
    case 'play':
      return <Path d="M7 4.5v15l12-7.5z" {...p} fill={color} />;
    case 'pause':
      return (
        <>
          <Rect x="6" y="4.5" width="4" height="15" rx="1" {...p} fill={color} />
          <Rect x="14" y="4.5" width="4" height="15" rx="1" {...p} fill={color} />
        </>
      );
    case 'plus':
      return <Path d="M12 5v14M5 12h14" {...p} />;
    case 'minus':
      return <Path d="M5 12h14" {...p} />;
    case 'check':
      return <Polyline points="4.5 12.5 9.5 17.5 19.5 6.5" {...p} />;
    case 'close':
      return <Path d="M6 6l12 12M18 6 6 18" {...p} />;
    case 'back':
      return <Polyline points="15 5 8 12 15 19" {...p} />;
    case 'forward':
      return <Polyline points="9 5 16 12 9 19" {...p} />;
    case 'search':
      return (
        <>
          <Circle cx="11" cy="11" r="6.5" {...p} />
          <Line x1="16" y1="16" x2="20.5" y2="20.5" {...p} />
        </>
      );
    case 'timer':
      return (
        <>
          <Circle cx="12" cy="13" r="8" {...p} />
          <Path d="M12 9v4.5l3 2M9.5 2.5h5" {...p} />
        </>
      );
    case 'trophy':
      return <Path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H4.5a3 3 0 0 0 3.5 4M16 6h3.5a3 3 0 0 1-3.5 4M12 13v4M8 21h8M9.5 17h5" {...p} />;
    case 'flame':
      return <Path d="M12 21c-4 0-6.5-2.6-6.5-6 0-4 3.5-6 4-10 2.5 1.5 3.5 3.5 3.5 6 1-.5 1.8-1.6 2-3 2 1.8 3.5 4.3 3.5 7 0 3.4-2.5 6-6.5 6z" {...p} />;
    case 'settings':
      return (
        <>
          <Circle cx="12" cy="12" r="3" {...p} />
          <Path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1" {...p} />
        </>
      );
    case 'skip':
      return <Path d="M5 5l9 7-9 7V5zM18 5v14" {...p} />;
    case 'trash':
      return <Path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6" {...p} />;
    case 'edit':
      return <Path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" {...p} />;
    case 'download':
      return <Path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" {...p} />;
    case 'upload':
      return <Path d="M12 20V9M7 13.5l5-5 5 5M5 4h14" {...p} />;
    case 'swap':
      return <Path d="M4 8h13l-3.5-3.5M20 16H7l3.5 3.5" {...p} />;
    case 'calendar':
      return (
        <>
          <Rect x="3.5" y="5" width="17" height="15.5" rx="2" {...p} />
          <Path d="M3.5 10h17M8 3v4M16 3v4" {...p} />
        </>
      );
    case 'target':
      return (
        <>
          <Circle cx="12" cy="12" r="8.5" {...p} />
          <Circle cx="12" cy="12" r="4.5" {...p} />
          <Circle cx="12" cy="12" r="1" {...p} fill={color} />
        </>
      );
    case 'volume':
      return <Path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4v-5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" {...p} />;
    case 'list':
      return <Path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" {...p} />;
    case 'flag':
      return <Path d="M5 21V4M5 4h11l-2 4 2 4H5" {...p} />;
    case 'info':
      return (
        <>
          <Circle cx="12" cy="12" r="9" {...p} />
          <Path d="M12 11v5.5M12 7.5h.01" {...p} />
        </>
      );
    case 'keyboard':
      return (
        <>
          <Rect x="2.5" y="6" width="19" height="12" rx="2" {...p} />
          <Path d="M6.5 10h.01M10 10h.01M13.5 10h.01M17 10h.01M7.5 14h9" {...p} />
        </>
      );
  }
}
