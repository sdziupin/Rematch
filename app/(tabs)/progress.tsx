import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { BodyMap, Heatmap, WeeklyBars } from '../../src/components/charts';
import { Card, ChipRow, EmptyState, Grid, Pill, Screen, SectionTitle, Stat } from '../../src/components/ui';
import { compareScores } from '../../src/domain/rematch';
import { formatDelta, formatMinutes, formatRepDelta, formatScore, relativeDay } from '../../src/domain/utils';
import { useLayout } from '../../src/hooks/useLayout';
import { listHistory, toScore, type HistoryItem } from '../../src/services/sessionService';
import { getBenchmarkProgress, getTrainingStats, type BenchmarkProgress, type TrainingStats } from '../../src/services/statsService';
import { useSettings } from '../../src/store/settingsStore';
import { colors, readable, spacing, typography } from '../../src/theme';

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
      <Grid columns={isWide ? 4 : 2}>
        <Card>
          <Stat label="Sessions" value={String(stats.totalSessions)} />
        </Card>
        <Card>
          <Stat label="Active time" value={formatMinutes(stats.totalActiveMs)} />
        </Card>
        <Card>
          <Stat label="Personal bests" value={String(stats.pbCount)} color={colors.pb} />
        </Card>
        <Card>
          <Stat label="Week streak" value={`${stats.weekStreak}`} color={colors.accentWarm} />
        </Card>
      </Grid>
      <Grid columns={isWide ? 2 : 1}>
        <Card>
          <SectionTitle style={styles.noTop}>Sessions per week</SectionTitle>
          <WeeklyBars weeks={stats.weekly} goal={weeklyGoal} />
          <Text style={styles.caption}>Dashed line: your goal of {weeklyGoal} per week. Change it in Profile.</Text>
        </Card>
        <Card>
          <SectionTitle style={styles.noTop}>Last 18 weeks</SectionTitle>
          <Heatmap columns={stats.heatmap} />
          <Text style={styles.caption}>{stats.dayStreak > 0 ? `${stats.dayStreak} day streak — keep it going.` : 'Train today to start a streak.'}</Text>
        </Card>
      </Grid>
      <Card>
        <SectionTitle style={styles.noTop}>Muscles worked · last 30 days</SectionTitle>
        <View style={styles.bodyRow}>
          <BodyMap load={stats.muscleLoad} height={isWide ? 260 : 220} />
          <View style={styles.flex}>
            {Object.entries(stats.muscleLoad)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([m, v]) => (
                <View key={m} style={styles.loadRow}>
                  <Text style={styles.loadLabel}>{m.replace(/_/g, ' ')}</Text>
                  <View style={styles.loadTrack}>
                    <View style={[styles.loadFill, { width: `${Math.round(v * 100)}%` }]} />
                  </View>
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
                <Text style={[styles.symbol, { color: readable(b.workout.identityColor) }]}>{b.workout.symbol}</Text>
                <View style={styles.flex}>
                  <Text style={styles.benchName}>{b.workout.name}</Text>
                  <Text style={styles.caption}>
                    {b.attempts} attempt{b.attempts === 1 ? '' : 's'} · {b.first.workoutVariantId.split('-').pop()?.replace('_', ' ')} · {b.first.scalingCategory.toUpperCase()}
                  </Text>
                </View>
                {b.attempts > 1 && <Pill label={delta} color={improved > 0 ? colors.pb : improved < 0 ? colors.behind : colors.secondary} />}
              </View>
              <View style={styles.benchStats}>
                <Stat label="First" value={formatScore(b.first)} small />
                <Stat label="Latest" value={formatScore(b.latest)} small />
                <Stat label="Best" value={b.best ? formatScore(b.best) : '—'} color={colors.pb} small />
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
        {history.map(({ result, workout, isPb }) => (
          <Card key={result.id} style={styles.historyRow} onPress={() => router.push({ pathname: '/workout/result', params: { sessionId: result.sessionId } })}>
            <Text style={[styles.symbol, { color: readable(workout?.identityColor ?? colors.accent) }]}>{workout?.symbol ?? '•'}</Text>
            <View style={styles.flex}>
              <Text style={styles.benchName} numberOfLines={1}>
                {workout?.name ?? 'Workout'}
              </Text>
              <Text style={styles.caption}>
                {relativeDay(result.createdAt)} · {result.scalingCategory.toUpperCase()}
                {result.isAbandoned ? ' · unfinished' : result.timeCapped ? ' · capped' : ''}
              </Text>
            </View>
            {isPb && <Pill label="PB" color={colors.pb} />}
            <Text style={styles.historyScore}>{formatScore(result)}</Text>
          </Card>
        ))}
      </View>
    );

  return (
    <Screen>
      <Text style={styles.title} accessibilityRole="header">
        Progress
      </Text>
      {empty ? (
        <EmptyState
          icon="progress"
          title="Your progress lives here"
          body="Streaks, weekly goals, a training calendar, the muscles you've worked and how every benchmark is trending."
          action={<Button title="Start a workout" icon="play" onPress={() => router.push('/today')} />}
        />
      ) : (
        <>
          <ChipRow options={VIEWS} value={view} onChange={setView} format={(v) => VIEW_LABEL[v]} />
          <View style={{ marginTop: spacing.md }}>{view === 'overview' ? overview : view === 'benchmarks' ? benchmarkList : historyList}</View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: { ...typography.displayLG, color: colors.primary, marginBottom: spacing.md },
  stack: { gap: spacing.md },
  noTop: { marginTop: 0 },
  caption: { ...typography.caption, color: colors.muted, marginTop: 6 },
  bodyRow: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center', flexWrap: 'wrap' },
  loadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: 8 },
  loadLabel: { ...typography.caption, color: colors.primary, width: 92, textTransform: 'capitalize' },
  loadTrack: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden', minWidth: 80 },
  loadFill: { height: 8, backgroundColor: colors.accent, borderRadius: 4 },
  bench: { gap: spacing.md },
  benchTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  symbol: { fontSize: 24, width: 32, textAlign: 'center' },
  benchName: { ...typography.subheading, color: colors.primary },
  benchStats: { flexDirection: 'row', justifyContent: 'space-between' },
  historyList: { gap: 8 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 12 },
  historyScore: { ...typography.subheading, color: colors.primary, fontVariant: ['tabular-nums'] },
});
