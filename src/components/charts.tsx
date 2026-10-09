import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import type { HeatmapCell, WeekBucket } from '../domain/stats';
import { colors, typography, withAlpha } from '../theme';

// ---------------------------------------------------------------------------
// Progress ring
// ---------------------------------------------------------------------------

export function ProgressRing({
  progress,
  size = 200,
  stroke = 12,
  color = colors.accent,
  track = colors.surfaceHover,
  children,
}: {
  progress: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, progress));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - p)}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Activity heatmap
// ---------------------------------------------------------------------------

export function Heatmap({ columns, cell = 13, gap = 3, color = colors.accent }: { columns: HeatmapCell[][]; cell?: number; gap?: number; color?: string }) {
  const width = columns.length * (cell + gap);
  const height = 7 * (cell + gap);
  const fill = (count: number, future: boolean) => {
    if (future) return 'transparent';
    if (count === 0) return colors.surfaceRaised;
    return withAlpha(color, count >= 3 ? 1 : count === 2 ? 0.75 : 0.5);
  };
  const total = columns.flat().reduce((s, c) => s + c.count, 0);
  return (
    <View accessible accessibilityLabel={`Training calendar: ${total} sessions in the last ${columns.length} weeks`}>
      <Svg width={width} height={height}>
        {columns.map((col, x) =>
          col.map((c, y) => <Rect key={`${x}-${y}`} x={x * (cell + gap)} y={y * (cell + gap)} width={cell} height={cell} rx={cell * 0.28} fill={fill(c.count, c.future)} />),
        )}
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Weekly bars
// ---------------------------------------------------------------------------

export function WeeklyBars({ weeks, goal, height = 110, color = colors.accent }: { weeks: WeekBucket[]; goal: number; height?: number; color?: string }) {
  const max = Math.max(goal, ...weeks.map((w) => w.count), 1);
  const barW = 16;
  const gap = 10;
  const width = weeks.length * (barW + gap);
  const chartH = height - 18;
  const goalY = chartH - (goal / max) * chartH;
  return (
    <View accessible accessibilityLabel={`Sessions per week, last ${weeks.length} weeks. Goal ${goal} per week.`}>
      <Svg width={width} height={height}>
        {weeks.map((w, i) => {
          const h = (w.count / max) * chartH;
          const met = w.count >= goal;
          return (
            <G key={w.weekStart}>
              <Rect x={i * (barW + gap)} y={0} width={barW} height={chartH} rx={4} fill={colors.surfaceRaised} />
              {h > 0 && <Rect x={i * (barW + gap)} y={chartH - h} width={barW} height={h} rx={4} fill={met ? color : withAlpha(color, 0.55)} />}
              <SvgText x={i * (barW + gap) + barW / 2} y={height - 2} fontSize={10} fill={colors.textMuted} fontFamily="Inter_500Medium" textAnchor="middle">
                {w.count}
              </SvgText>
            </G>
          );
        })}
        <Line x1={0} y1={goalY} x2={width - gap} y2={goalY} stroke={colors.textSecondary} strokeWidth={1} strokeDasharray="3 4" />
      </Svg>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Trend line
// ---------------------------------------------------------------------------

/**
 * Score history. For time scores the axis is flipped so "up" always means better.
 */
export function TrendChart({ values, lowerIsBetter, width = 300, height = 120, color = colors.accent, format }: { values: number[]; lowerIsBetter: boolean; width?: number; height?: number; color?: string; format: (v: number) => string }) {
  if (values.length === 0) return null;
  const pad = 14;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (values.length === 1 ? width / 2 : pad + (i / (values.length - 1)) * (width - pad * 2));
  const y = (v: number) => {
    const norm = (v - min) / span;
    return pad + (lowerIsBetter ? norm : 1 - norm) * (height - pad * 2);
  };
  const bestIdx = values.indexOf(lowerIsBetter ? min : max);
  const points = values.map((v, i) => `${x(i)},${y(v)}`).join(' ');
  return (
    <View>
      <Svg width={width} height={height}>
        <Line x1={pad} y1={pad} x2={width - pad} y2={pad} stroke={colors.borderStrong} strokeDasharray="2 6" />
        <Line x1={pad} y1={height - pad} x2={width - pad} y2={height - pad} stroke={colors.borderStrong} strokeDasharray="2 6" />
        {values.length > 1 && <Polyline points={points} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />}
        {values.map((v, i) => (
          <Circle key={i} cx={x(i)} cy={y(v)} r={i === bestIdx ? 5 : 3} fill={i === bestIdx ? colors.pb : colors.background} stroke={i === bestIdx ? colors.pb : color} strokeWidth={2} />
        ))}
      </Svg>
      <View style={chartStyles.legend}>
        <Text style={chartStyles.legendText}>First {format(values[0])}</Text>
        <Text style={[chartStyles.legendText, { color: colors.pb }]}>Best {format(values[bestIdx])}</Text>
        <Text style={chartStyles.legendText}>Latest {format(values[values.length - 1])}</Text>
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Body map
// ---------------------------------------------------------------------------

type Shape = { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number } | { kind: 'rect'; x: number; y: number; w: number; h: number; r: number };

const pair = (cx: number, cy: number, rx: number, ry: number): Shape[] => [
  { kind: 'ellipse', cx: 50 - cx, cy, rx, ry },
  { kind: 'ellipse', cx: 50 + cx, cy, rx, ry },
];

const FRONT: Record<string, Shape[]> = {
  shoulders: pair(19, 45, 6.5, 6),
  chest: pair(8.5, 54, 8, 6.5),
  biceps: pair(25, 66, 4.2, 8),
  forearms: pair(28.5, 87, 3.6, 9),
  abs: [{ kind: 'rect', x: 44, y: 62, w: 12, h: 30, r: 4 }],
  obliques: pair(11, 78, 3.6, 10),
  hip_flexors: pair(7, 98, 4, 4),
  quads: pair(8.5, 122, 6.5, 16),
  adductors: pair(2.6, 114, 2.4, 9),
  calves: pair(8.5, 160, 4.5, 12),
};

const BACK: Record<string, Shape[]> = {
  upper_back: [{ kind: 'rect', x: 40, y: 38, w: 20, h: 16, r: 6 }],
  shoulders: pair(19, 45, 6.5, 6),
  triceps: pair(25, 66, 4.2, 8),
  forearms: pair(28.5, 87, 3.6, 9),
  lats: pair(10, 66, 6, 11),
  lower_back: [{ kind: 'rect', x: 44, y: 78, w: 12, h: 14, r: 4 }],
  glutes: pair(7, 104, 7, 7.5),
  hamstrings: pair(8.5, 128, 6, 14),
  calves: pair(8.5, 160, 5, 12),
};

function Silhouette() {
  const body = colors.surfaceRaised;
  return (
    <G>
      <Circle cx={50} cy={17} r={10} fill={body} />
      <Rect x={46} y={26} width={8} height={8} fill={body} />
      <Rect x={30} y={36} width={40} height={60} rx={14} fill={body} />
      <Rect x={18} y={40} width={11} height={56} rx={5.5} fill={body} transform="rotate(6 23 40)" />
      <Rect x={71} y={40} width={11} height={56} rx={5.5} fill={body} transform="rotate(-6 77 40)" />
      <Rect x={34} y={92} width={14} height={86} rx={7} fill={body} />
      <Rect x={52} y={92} width={14} height={86} rx={7} fill={body} />
    </G>
  );
}

function MuscleShapes({ map, load, color }: { map: Record<string, Shape[]>; load: Record<string, number>; color: string }) {
  return (
    <G>
      {Object.entries(map).flatMap(([muscle, shapes]) =>
        shapes.map((s, i) => {
          const v = load[muscle] ?? 0;
          const fill = v > 0 ? withAlpha(color, 0.25 + 0.75 * v) : withAlpha(colors.textMuted, 0.16);
          return s.kind === 'ellipse' ? (
            <Ellipse key={`${muscle}${i}`} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill} />
          ) : (
            <Rect key={`${muscle}${i}`} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.r} fill={fill} />
          );
        }),
      )}
    </G>
  );
}

/** Front and back muscle map. `load` maps muscle ids to 0–1. */
export function BodyMap({ load, height = 220, color = colors.accent, labels = true }: { load: Record<string, number>; height?: number; color?: string; labels?: boolean }) {
  const width = height / 2;
  const trained = Object.entries(load)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m.replace(/_/g, ' '));
  return (
    <View style={chartStyles.bodyRow} accessible accessibilityLabel={trained.length ? `Muscles worked: ${trained.join(', ')}` : 'No muscles worked yet'}>
      {(['front', 'back'] as const).map((side) => (
        <View key={side} style={chartStyles.bodyCol}>
          <Svg width={width} height={height} viewBox="0 0 100 200">
            <Silhouette />
            <MuscleShapes map={side === 'front' ? FRONT : BACK} load={load} color={color} />
          </Svg>
          {labels && <Text style={chartStyles.legendText}>{side === 'front' ? 'Front' : 'Back'}</Text>}
        </View>
      ))}
    </View>
  );
}

const chartStyles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  legendText: { ...typography.caption, color: colors.textMuted },
  bodyRow: { flexDirection: 'row', gap: 12, justifyContent: 'center' },
  bodyCol: { alignItems: 'center', gap: 4 },
});
