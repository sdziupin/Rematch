import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { BodyMap, Heatmap, WeeklyBars } from '../../src/components/charts';
import { Card, EmptyState, Grid, Pill, ProgressBar, Screen, ScreenHeader, Segmented, Stat, WorkoutMark } from '../../src/components/ui';
import { MUSCLE_LABELS, type MuscleId } from '../../src/content/types';
import { SCALING_LABELS } from '../../src/domain/scaling';
import type { ScalingCategory } from '../../src/domain/types';
import { compareScores } from '../../src/domain/rematch';
import { formatDelta, formatMinutes, formatRepDelta, formatScore, relativeDay } from '../../src/domain/utils';
import { useLayout } from '../../src/hooks/useLayout';
import { listHistory, toScore, type HistoryItem } from '../../src/services/sessionService';
import { getBenchmarkProgress, getTrainingStats, type BenchmarkProgress, type TrainingStats } from '../../src/services/statsService';
import { useSettings } from '../../src/store/settingsStore';
import { colors, fonts, radius, spacing, typography } from '../../src/theme';

const VARIANT_LABEL: Record<string, string> = { full: 'Full', three_quarter: '¾', half: '½', quarter: '¼' };

const VIEWS = ['overview', 'benchmarks', 'history'] as const;
type ViewKey = (typeof VIEWS)[number];
const VIEW_LABEL: Record<ViewKey, string> = { overview: 'Overview', benchmarks: 'Benchmarks', history: 'History' };

export default function ProgressScreen() {
  const router = useRouter();
  const { isWide, columns } = useLayout();
  const revision = useSettings((s) => s.revision);
  const weeklyGoal = useSettings((s) => s.weeklyGoal);
  const weekStartsOn = useSettings((s) => s.weekStartsOn);
  const [view, setView] = useState<ViewKey>('overview');
  const [stats, setStats] = useState<TrainingStats | null>(null);
  const [benchmarks, setBenchmarks] = useState<BenchmarkProgress[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        const [s, b, h] = await Promise.all([getTrainingStats({ weeklyGoal, weekStartsOn }), getBenchmarkProgress(), listHistory(300)]);
        setStats(s);
        setBenchmarks(b);
        setHistory(h);
      })();
    }, [revision, weeklyGoal, weekStartsOn]),
  );

  if (!stats) return <Screen>{null}</Screen>;

  const empty = stats.totalSessions === 0;

  const overview = (
    <View style={styles.stack}>
      <Card style={[styles.totals, !isWide && styles.totalsWrap]}>
        <Total label="Sessions" value={String(stats.totalSessions)} half={!isWide} />
        <Total label="Active time" value={formatMinutes(stats.totalActiveMs)} half={!isWide} />
        <Total label="Personal bests" value={String(stats.pbCount)} color={colors.pb} half={!isWide} />
        <Total label="Week streak" value={String(stats.weekStreak)} half={!isWide} />
      </Card>
      <Grid columns={isWide ? 2 : 1}>
        <Card style={styles.chartCard}>
          <ChartHeader title="Sessions per week" note={`Goal ${weeklyGoal}`} />
          <WeeklyBars weeks={stats.weekly} goal={weeklyGoal} />
        </Card>
        <Card style={styles.chartCard}>
          <ChartHeader title="Last 18 weeks" note={stats.dayStreak > 0 ? `${stats.dayStreak}-day streak` : 'Train today to start a streak'} />
          <Heatmap columns={stats.heatmap} />
        </Card>
      </Grid>
      <Card style={styles.chartCard}>
        <ChartHeader title="Muscles worked" note="Last 30 days" />
        <View style={styles.bodyRow}>
          <BodyMap load={stats.muscleLoad} height={isWide ? 240 : 200} />
          <View style={[styles.flex, { minWidth: 180 }]}>
            {Object.entries(stats.muscleLoad)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([m, v]) => (
                <View key={m} style={styles.loadRow}>
                  <Text style={styles.loadLabel}>{MUSCLE_LABELS[m as MuscleId] ?? m.replace(/_/g, ' ')}</Text>
                  <ProgressBar progress={v} style={styles.flex} />
                </View>
              ))}
            {Object.keys(stats.muscleLoad).length === 0 && <Text style={styles.caption}>Finish a workout to light up the map.</Text>}
          </View>
        </View>
      </Card>
    </View>
  );

  const benchmarkList =
    benchmarks.length === 0 ? (
      <EmptyState icon="trophy" title="No benchmarks yet" body="Finish a workout to set your first mark. Every attempt after it is a rematch." />
    ) : (
      <Grid columns={Math.min(columns, 2)}>
        {benchmarks.map((b) => {
          const improved = b.attempts > 1 ? compareScores(toScore(b.latest), toScore(b.first)) : 0;
          const delta =
            b.scoreType === 'reps' ? formatRepDelta((b.latest.scoreReps ?? 0) - (b.first.scoreReps ?? 0)) : formatDelta(b.latest.completionMs - b.first.completionMs);
          return (
            <Card key={`${b.workout.id}-${b.first.workoutVariantId}-${b.first.scalingCategory}`} onPress={() => router.push(`/workout/${b.workout.id}`)} style={styles.bench}>
              <View style={styles.benchTop}>
                <WorkoutMark name={b.workout.name} color={b.workout.identityColor} size={36} />
                <View style={styles.flex}>
                  <Text style={styles.benchName}>{b.workout.name}</Text>
                  <Text style={styles.caption}>
                    {b.attempts} attempt{b.attempts === 1 ? '' : 's'} · {VARIANT_LABEL[b.first.workoutVariantId.split('-').pop() ?? ''] ?? 'Full'} · {SCALING_LABELS[b.first.scalingCategory as ScalingCategory] ?? b.first.scalingCategory}
                  </Text>
                </View>
                {b.attempts > 1 && <Pill label={delta} color={improved > 0 ? colors.ahead : improved < 0 ? colors.behind : undefined} />}
              </View>
              <View style={styles.benchStats}>
                <Stat label="First" value={formatScore(b.first)} small style={styles.flex} />
                <Stat label="Latest" value={formatScore(b.latest)} small style={styles.flex} />
                <Stat label="Best" value={b.best ? formatScore(b.best) : '—'} color={colors.pb} small style={styles.flex} />
              </View>
            </Card>
          );
        })}
      </Grid>
    );

  const historyList =
    history.length === 0 ? (
      <EmptyState icon="list" title="No sessions yet" />
    ) : (
      <View style={styles.historyList}>
        {history.map(({ result, workout, isPb }, i) => (
          <Pressable
            key={result.id}
            onPress={() => router.push({ pathname: '/workout/result', params: { sessionId: result.sessionId } })}
            accessibilityRole="button"
            style={(st) => [styles.historyRow, i > 0 && styles.historyDivider, (st as { hovered?: boolean }).hovered && styles.historyHover]}
          >
            <WorkoutMark name={workout?.name ?? '?'} color={workout?.identityColor ?? colors.accent} size={36} />
            <View style={styles.flex}>
              <Text style={styles.historyName} numberOfLines={1}>
                {workout?.name ?? 'Workout'}
              </Text>
              <Text style={styles.caption}>
                {relativeDay(result.createdAt)} · {SCALING_LABELS[result.scalingCategory as ScalingCategory] ?? result.scalingCategory}
                {result.isAbandoned ? ' · Unfinished' : result.timeCapped ? ' · Capped' : ''}
              </Text>
            </View>
            {isPb && <Pill label="PB" color={colors.pb} />}
            <Text style={[styles.historyScore, result.isAbandoned && { color: colors.textMuted }]}>{formatScore(result)}</Text>
          </Pressable>
        ))}
      </View>
    );

  return (
    <Screen>
      <ScreenHeader title="Progress" subtitle={empty ? undefined : `${stats.totalSessions} session${stats.totalSessions === 1 ? '' : 's'} logged. Every one of them is a past you to beat.`} />
      {empty ? (
        <EmptyState
          icon="progress"
          title="Your progress lives here"
          body="Streaks, weekly goals, a training calendar, the muscles you've worked and how every benchmark is trending."
          action={<Button title="Start a workout" icon="play" onPress={() => router.push('/today')} />}
        />
      ) : (
        <>
          <Segmented options={VIEWS.map((v) => ({ key: v, label: VIEW_LABEL[v] }))} value={view} onChange={setView} fill={!isWide} />
          <View style={{ marginTop: spacing.lg }}>{view === 'overview' ? overview : view === 'benchmarks' ? benchmarkList : historyList}</View>
        </>
      )}
    </Screen>
  );
}

function Total({ label, value, color, half }: { label: string; value: string; color?: string; half?: boolean }) {
  return (
    <View style={[styles.total, half && styles.totalHalf]}>
      <Text style={styles.totalLabel}>{label}</Text>
      <Text style={[styles.totalValue, color ? { color } : null]}>{value}</Text>
    </View>
  );
}

function ChartHeader({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.chartHeader}>
      <Text style={styles.chartTitle}>{title}</Text>
      {note ? <Text style={styles.caption}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  stack: { gap: spacing.sm + 4 },
  caption: { ...typography.caption, color: colors.textMuted },
  totals: { flexDirection: 'row', paddingVertical: spacing.lg - 4 },
  totalsWrap: { flexWrap: 'wrap', rowGap: spacing.lg },
  total: { flex: 1, gap: 6, paddingHorizontal: 4 },
  totalHalf: { flexBasis: '45%', flexGrow: 1, flexShrink: 0 },
  totalLabel: { ...typography.overline, color: colors.textMuted },
  totalValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -1, color: colors.text, fontVariant: ['tabular-nums'] },
  chartCard: { gap: spacing.md + 4, padding: spacing.lg - 4 },
  chartHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: spacing.sm },
  chartTitle: { ...typography.subheading, color: colors.text },
  bodyRow: { flexDirection: 'row', gap: spacing.xl, alignItems: 'center', flexWrap: 'wrap' },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, marginBottom: 12 },
  loadLabel: { ...typography.caption, color: colors.textSecondary, width: 96 },
  bench: { gap: spacing.md + 4 },
  benchTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  benchName: { ...typography.subheading, fontFamily: fonts.display, letterSpacing: 0.2, color: colors.text },
  benchStats: { flexDirection: 'row', paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border },
  historyList: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingVertical: 12, paddingHorizontal: spacing.md },
  historyDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  historyHover: { backgroundColor: colors.surfaceRaised },
  historyName: { ...typography.callout, fontFamily: fonts.semibold, color: colors.text },
  historyScore: { ...typography.figure, color: colors.text, minWidth: 56, textAlign: 'right' },
});
