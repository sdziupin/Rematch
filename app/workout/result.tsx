import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { CheckpointBreakdown } from '../../src/components/RaceRails';
import { confirmAction, showToast } from '../../src/components/Dialogs';
import { Card, Chip, EmptyState, Pill, Screen, ScreenHeader, SectionTitle, Stat } from '../../src/components/ui';
import { compareScores } from '../../src/domain/rematch';
import { SCALING_LABELS } from '../../src/domain/scaling';
import type { ScalingCategory } from '../../src/domain/types';
import { formatDelta, formatDuration, formatRepDelta, formatScore, relativeDay } from '../../src/domain/utils';
import { useLayout } from '../../src/hooks/useLayout';
import { getActiveProgram } from '../../src/services/programService';
import { deleteSession, getResultSummary, saveFeedback, toScore, type ResultSummary } from '../../src/services/sessionService';
import { useSettings } from '../../src/store/settingsStore';
import { colors, spacing, typography, withAlpha } from '../../src/theme';

const INTENSITY = [
  { key: 'too_easy', label: 'Too easy' },
  { key: 'good', label: 'Just right' },
  { key: 'too_hard', label: 'Too hard' },
] as const;

export default function ResultScreen() {
  const { sessionId, fresh } = useLocalSearchParams<{ sessionId: string; fresh?: string }>();
  const router = useRouter();
  const { isWide } = useLayout();
  const [summary, setSummary] = useState<ResultSummary | null>(null);
  const [missing, setMissing] = useState(false);
  const [intensity, setIntensity] = useState<string | null>(null);
  const [pain, setPain] = useState(false);
  const [programNote, setProgramNote] = useState<string | null>(null);
  const scale = useRef(new Animated.Value(fresh ? 0.6 : 1)).current;
  const isFresh = fresh === '1';

  const load = useCallback(async () => {
    if (!sessionId) return;
    const s = await getResultSummary(sessionId);
    if (!s) {
      setMissing(true);
      return;
    }
    setSummary(s);
    setIntensity(s.feedback?.intensity ?? null);
    setPain(s.feedback?.painReported ?? false);
    if (isFresh && s.session.programEnrollmentId) {
      const active = await getActiveProgram();
      if (active?.progress.complete) setProgramNote(`Program complete: ${active.program.name}. Every session done.`);
      else if (active) setProgramNote(`${active.program.name}: ${active.progress.done}/${active.progress.total} sessions done.`);
    }
    useSettings.getState().touch();
  }, [sessionId, isFresh]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!isFresh) return;
    Animated.spring(scale, { toValue: 1, friction: 5, tension: 80, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [isFresh, scale]);

  if (missing) {
    return (
      <Screen narrow>
        <ScreenHeader title="Result" onBack={() => router.back()} />
        <EmptyState title="This result was deleted." action={<Button title="Back to today" onPress={() => router.replace('/today')} />} />
      </Screen>
    );
  }
  if (!summary) return <Screen>{null}</Screen>;

  const { result, workout, comparison, isPb, previousBest } = summary;
  const reps = result.scoreType === 'reps';
  const abandoned = result.isAbandoned;
  const capped = result.timeCapped;
  const first = summary.attempts <= 1 && !comparison;

  let headline = 'RESULT';
  let tone: string = colors.accent;
  if (abandoned) {
    headline = 'UNFINISHED';
    tone = colors.muted;
  } else if (capped) {
    headline = 'TIME CAPPED';
    tone = colors.behind;
  } else if (isPb && previousBest) {
    headline = 'NEW PERSONAL BEST';
    tone = colors.pb;
  } else if (first) {
    headline = 'FIRST RESULT';
  } else if (comparison?.won) {
    headline = 'YOU WON THE REMATCH';
    tone = colors.ahead;
  } else if (comparison?.tied) {
    headline = 'DEAD HEAT';
  } else if (comparison) {
    headline = 'PAST YOU WON THIS ONE';
    tone = colors.behind;
  }

  const scoreMain = reps ? `${result.scoreReps ?? 0}` : formatDuration(result.completionMs);
  const scoreUnit = reps ? 'REPS' : '';
  const versus = comparison
    ? reps
      ? `vs ${comparison.opponentReps ?? 0} reps · ${formatRepDelta((comparison.youReps ?? 0) - (comparison.opponentReps ?? 0))}`
      : `vs ${formatDuration(comparison.opponentMs)} · ${formatDelta(comparison.deltaMs)}`
    : null;
  const vsBest =
    previousBest && !abandoned
      ? reps
        ? formatRepDelta((result.scoreReps ?? 0) - (previousBest.scoreReps ?? 0))
        : formatDelta(result.completionMs - previousBest.completionMs)
      : null;
  const improved = previousBest ? compareScores(toScore(result), toScore(previousBest)) > 0 : false;

  const submitFeedback = async (key: string, painReported = pain) => {
    setIntensity(key);
    await saveFeedback(result.sessionId, key, undefined, painReported);
  };

  const onDelete = async () => {
    const ok = await confirmAction({
      title: 'Delete this result?',
      message: 'Its splits are removed too. If it was your personal best, the next best attempt takes over.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    await deleteSession(result.sessionId);
    useSettings.getState().touch();
    showToast('Result deleted');
    if (router.canGoBack()) router.back();
    else router.replace('/progress');
  };

  const rematchNow = () => {
    if (!workout) return;
    router.replace({ pathname: '/workout/[id]', params: { id: workout.id, variant: summary.session.workoutVariantId.split('-').pop() } });
  };

  const score = (
    <Animated.View style={[styles.scoreCard, { borderColor: withAlpha(tone, 0.6), transform: [{ scale }] }]}>
      <Text style={[styles.headline, { color: tone }]} accessibilityRole="header">
        {headline}
      </Text>
      <Text style={styles.workoutName}>{workout?.name ?? 'Workout'}</Text>
      <View style={styles.scoreRow}>
        <Text style={styles.score}>{scoreMain}</Text>
        {scoreUnit ? <Text style={styles.scoreUnit}>{scoreUnit}</Text> : null}
      </View>
      {reps && <Text style={styles.sub}>in {formatDuration(result.completionMs)}</Text>}
      {versus && <Text style={styles.versus}>{versus}</Text>}
      <View style={styles.pills}>
        <Pill label={SCALING_LABELS[result.scalingCategory as ScalingCategory]?.toUpperCase() ?? result.scalingCategory} color={result.scalingCategory === 'rx' ? colors.accent : colors.accentWarm} />
        {isPb && <Pill label="PB" color={colors.pb} />}
        {vsBest && <Pill label={`${vsBest} vs previous best`} color={improved ? colors.pb : colors.behind} />}
      </View>
      {isPb && !abandoned && <Text style={styles.note}>This attempt is now your opponent to beat.</Text>}
      {programNote && <Text style={styles.note}>{programNote}</Text>}
    </Animated.View>
  );

  const splits =
    comparison && comparison.checkpoints.length > 0 ? (
      <Card>
        <SectionTitle style={styles.noTop}>Where you {comparison.won ? 'won' : 'lost'} it</SectionTitle>
        <CheckpointBreakdown
          unit={reps && summary.result.scoreType === 'reps' && comparison.checkpoints.some((c) => c.youReps != null) && workout?.format !== 'amrap' ? 'reps' : 'time'}
          items={comparison.checkpoints.map((c) => ({ label: c.label, deltaMs: c.deltaMs, repDelta: (c.youReps ?? 0) - (c.opponentReps ?? 0) }))}
        />
      </Card>
    ) : summary.checkpoints.filter((c) => c.checkpointKey.startsWith('round-')).length > 0 ? (
      <Card>
        <SectionTitle style={styles.noTop}>Your splits</SectionTitle>
        {summary.checkpoints
          .filter((c) => c.checkpointKey.startsWith('round-'))
          .map((c, i, all) => (
            <View key={c.checkpointKey} style={styles.splitRow}>
              <Text style={styles.splitLabel}>{c.label}</Text>
              <Text style={styles.splitValue}>
                {formatDuration(c.elapsedActiveMs - (i > 0 ? all[i - 1].elapsedActiveMs : 0))}
                <Text style={styles.splitTotal}>  {formatDuration(c.elapsedActiveMs)}</Text>
              </Text>
            </View>
          ))}
      </Card>
    ) : null;

  const feedback = !abandoned && (
    <Card>
      <SectionTitle style={styles.noTop}>How did it feel?</SectionTitle>
      <View style={styles.pills}>
        {INTENSITY.map((i) => (
          <Chip key={i.key} label={i.label} selected={intensity === i.key} onPress={() => submitFeedback(i.key)} />
        ))}
        <Chip
          label="Something hurt"
          icon="info"
          color={colors.danger}
          selected={pain}
          onPress={() => {
            const next = !pain;
            setPain(next);
            void submitFeedback(intensity ?? 'good', next);
          }}
        />
      </View>
      {pain && <Text style={styles.note}>We'll suggest low-impact sessions for the next few days. Stop if anything feels sharp, and talk to a professional if pain persists.</Text>}
    </Card>
  );

  const stats = (
    <Card>
      <View style={styles.statsRow}>
        <Stat label="Attempts" value={String(summary.attempts)} small />
        <Stat label="PB" value={summary.pb ? formatScore(summary.pb) : '—'} color={colors.pb} small />
        <Stat label="When" value={relativeDay(result.createdAt)} small />
      </View>
    </Card>
  );

  const actions = (
    <View style={styles.actions}>
      {isFresh ? (
        <>
          <Button title="DONE" icon="check" size="lg" onPress={() => router.replace('/today')} />
          {workout && <Button title="Rematch again" icon="bolt" variant="secondary" onPress={rematchNow} />}
        </>
      ) : (
        workout && <Button title="Open workout" icon="forward" variant="secondary" onPress={() => router.push(`/workout/${workout.id}`)} />
      )}
      <Button title="Delete result" icon="trash" variant="ghost" onPress={onDelete} />
    </View>
  );

  return (
    <Screen narrow={!isWide}>
      {!isFresh && <ScreenHeader title="" onBack={() => (router.canGoBack() ? router.back() : router.replace('/progress'))} />}
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.flex}>
            {score}
            {splits}
          </View>
          <View style={styles.side}>
            {stats}
            {feedback}
            {actions}
          </View>
        </View>
      ) : (
        <View style={styles.stack}>
          {score}
          {splits}
          {stats}
          {feedback}
          {actions}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: spacing.md },
  stack: { gap: spacing.md, paddingTop: spacing.md },
  columns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start', paddingTop: spacing.md },
  side: { width: 380, gap: spacing.md },
  scoreCard: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, padding: spacing.lg, alignItems: 'center', gap: 6 },
  headline: { ...typography.label, fontSize: 14, letterSpacing: 2 },
  workoutName: { ...typography.displayMD, color: colors.primary },
  scoreRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  score: { ...typography.displayXL, fontSize: 88, lineHeight: 92, color: colors.primary, fontVariant: ['tabular-nums'] },
  scoreUnit: { ...typography.displayMD, color: colors.secondary },
  sub: { ...typography.body, color: colors.secondary },
  versus: { ...typography.subheading, color: colors.secondary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center', marginTop: 6 },
  note: { ...typography.body, color: colors.secondary, textAlign: 'center', marginTop: 6 },
  noTop: { marginTop: 0 },
  splitRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.border },
  splitLabel: { ...typography.body, color: colors.primary },
  splitValue: { ...typography.bodyBold, color: colors.primary, fontVariant: ['tabular-nums'] },
  splitTotal: { ...typography.caption, color: colors.muted },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actions: { gap: spacing.sm },
});
