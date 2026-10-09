import React, { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { ProgressRing } from '../../src/components/charts';
import { Icon } from '../../src/components/Icon';
import { WorkoutHeroCard, WorkoutTile } from '../../src/components/WorkoutCard';
import { Wordmark } from '../../src/components/Wordmark';
import { Card, Grid, ProgressBar, Screen, SectionTitle, WorkoutMark } from '../../src/components/ui';
import { WORKOUT_SEEDS } from '../../src/content/seed';
import { getProfile, listWorkouts, profileEquipment } from '../../src/db/repository';
import type { WorkoutRow } from '../../src/db/schema';
import type { WorkoutStructure } from '../../src/domain/types';
import { formatScore } from '../../src/domain/utils';
import { formatLabel } from '../../src/engine/workoutEngine';
import { useLayout } from '../../src/hooks/useLayout';
import { getActiveProgram, type ActiveProgram } from '../../src/services/programService';
import { difficultyLabel, focusLabel, recommendTodayWorkout } from '../../src/services/recommendationService';
import { getActiveSession, getRecentWorkoutIds, getWorkoutStatsMap, hadPainRecently } from '../../src/services/sessionService';
import { getRecentPbs, getTrainingStats, type TrainingStats } from '../../src/services/statsService';
import { useSettings } from '../../src/store/settingsStore';
import { colors, fonts, radius, spacing, typography } from '../../src/theme';

type Stats = Awaited<ReturnType<typeof getWorkoutStatsMap>>;

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late one tonight' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function TodayScreen() {
  const router = useRouter();
  const { isWide, columns } = useLayout();
  const revision = useSettings((s) => s.revision);
  const weeklyGoal = useSettings((s) => s.weeklyGoal);
  const weekStartsOn = useSettings((s) => s.weekStartsOn);
  const [pick, setPick] = useState<WorkoutRow | null>(null);
  const [alternatives, setAlternatives] = useState<WorkoutRow[]>([]);
  const [warmup, setWarmup] = useState<WorkoutRow | null>(null);
  const [cooldown, setCooldown] = useState<WorkoutRow | null>(null);
  const [stats, setStats] = useState<Stats>({});
  const [training, setTraining] = useState<TrainingStats | null>(null);
  const [program, setProgram] = useState<ActiveProgram | null>(null);
  const [programWorkout, setProgramWorkout] = useState<WorkoutRow | null>(null);
  const [pbs, setPbs] = useState<Awaited<ReturnType<typeof getRecentPbs>>>([]);
  const [inProgress, setInProgress] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [profile, workouts, statsMap, recent, pain, activeProgram, recentPbs, t] = await Promise.all([
          getProfile(),
          listWorkouts(),
          getWorkoutStatsMap(),
          getRecentWorkoutIds(),
          hadPainRecently(),
          getActiveProgram(),
          getRecentPbs(4),
          getTrainingStats({ weeklyGoal, weekStartsOn, muscleDays: 7 }),
        ]);
        if (cancelled) return;
        const byId = new Map(workouts.map((w) => [w.id, w]));
        const active = await getActiveSession();
        setInProgress(active ? byId.get(active.workoutId)?.name ?? 'Workout' : null);
        const rec = recommendTodayWorkout({
          minutes: profile?.typicalMinutes ?? 15,
          level: profile?.level ?? 'intermediate',
          goal: profile?.goal ?? 'conditioning',
          equipment: profileEquipment(profile),
          recentWorkoutIds: recent,
          painRecent: pain,
          pool: WORKOUT_SEEDS.filter((w) => byId.has(w.id)),
        });
        setPick(byId.get(rec.workoutId) ?? null);
        setAlternatives(rec.alternatives.map((id) => byId.get(id)).filter((w): w is WorkoutRow => !!w));
        const day = new Date().getDate();
        const warmups = workouts.filter((w) => w.kind === 'warmup');
        const cooldowns = workouts.filter((w) => w.kind === 'cooldown');
        setWarmup(warmups[day % Math.max(1, warmups.length)] ?? null);
        setCooldown(cooldowns[day % Math.max(1, cooldowns.length)] ?? null);
        setStats(statsMap);
        setTraining(t);
        setPbs(recentPbs);
        setProgram(activeProgram && !activeProgram.progress.complete ? activeProgram : null);
        setProgramWorkout(activeProgram?.progress.next ? byId.get(activeProgram.progress.next.workoutId) ?? null : null);
      })();
      return () => {
        cancelled = true;
      };
    }, [revision, weeklyGoal, weekStartsOn]),
  );

  const thisWeek = training?.thisWeek ?? 0;
  const goalDone = thisWeek >= weeklyGoal;
  const tile = (w: WorkoutRow) => (
    <WorkoutTile
      key={w.id}
      name={w.name}
      color={w.identityColor}
      format={formatLabel(w.format as WorkoutStructure['format'])}
      meta={`${w.estimatedMinutesMin}–${w.estimatedMinutesMax} min`}
      pb={stats[w.id]?.pb ?? null}
      attempts={stats[w.id]?.attempts}
      onPress={() => router.push(`/workout/${w.id}`)}
    />
  );

  const resumeCard = inProgress && (
    <Card onPress={() => router.push('/workout/recovery')} accent={colors.accent} style={styles.resume} accessibilityLabel={`${inProgress} is in progress. Resume.`}>
      <View style={styles.liveDot} />
      <View style={styles.flex}>
        <Text style={styles.label}>In progress</Text>
        <Text style={styles.cardTitle}>{inProgress}</Text>
      </View>
      <View style={styles.resumePill}>
        <Icon name="play" size={12} color={colors.onAccent} />
        <Text style={styles.resumeText}>Resume</Text>
      </View>
    </Card>
  );

  const weekCard = (
    <Card style={styles.weekCard}>
      <ProgressRing progress={thisWeek / Math.max(1, weeklyGoal)} size={72} stroke={6} color={goalDone ? colors.pb : colors.accent}>
        <Text style={styles.ringText}>
          {thisWeek}
          <Text style={styles.ringOf}>/{weeklyGoal}</Text>
        </Text>
      </ProgressRing>
      <View style={styles.flex}>
        <Text style={styles.label}>This week</Text>
        <Text style={styles.cardTitle}>{goalDone ? 'Weekly goal complete' : `${weeklyGoal - thisWeek} to go`}</Text>
        <Text style={styles.secondary}>
          {training?.dayStreak ?? 0}-day streak · {training?.weekStreak ?? 0}-week streak
        </Text>
      </View>
    </Card>
  );

  const programCard =
    program && programWorkout && program.progress.next ? (
      <View>
        <SectionTitle right={<Button title="View plan" variant="ghost" size="sm" onPress={() => router.push(`/program/${program.program.id}`)} />}>
          {program.program.name} · Week {program.progress.next.week}, day {program.progress.next.day}
        </SectionTitle>
        <WorkoutHeroCard
          name={programWorkout.name}
          color={programWorkout.identityColor}
          badge="Program"
          format={formatLabel(programWorkout.format as WorkoutStructure['format'])}
          meta={`${focusLabel(programWorkout.focus)} · ${difficultyLabel(programWorkout.difficulty)}`}
          duration={`${programWorkout.estimatedMinutesMin}–${programWorkout.estimatedMinutesMax} min`}
          description={program.progress.next.note}
          pb={stats[programWorkout.id]?.pb ?? null}
          last={stats[programWorkout.id]?.last ?? null}
          onPress={() =>
            router.push({
              pathname: '/workout/[id]',
              params: { id: programWorkout.id, variant: program.progress.next?.partialKey ?? 'full', program: program.enrollment.id, key: `w${program.progress.next?.week}d${program.progress.next?.day}` },
            })
          }
        />
        <View style={styles.programMeta}>
          <ProgressBar progress={program.progress.fraction} style={styles.flex} />
          <Text style={styles.secondary}>
            {program.progress.done}/{program.progress.total} sessions
          </Text>
        </View>
      </View>
    ) : null;

  const pickCard = pick && (
    <View>
      <SectionTitle>{program ? 'Or take today’s pick' : 'Today’s pick'}</SectionTitle>
      <WorkoutHeroCard
        name={pick.name}
        color={pick.identityColor}
        badge={stats[pick.id]?.pb ? 'Rematch ready' : 'New opponent'}
        format={formatLabel(pick.format as WorkoutStructure['format'])}
        meta={`${focusLabel(pick.focus)} · ${difficultyLabel(pick.difficulty)}`}
        duration={`${pick.estimatedMinutesMin}–${pick.estimatedMinutesMax} min`}
        description={pick.description}
        pb={stats[pick.id]?.pb ?? null}
        last={stats[pick.id]?.last ?? null}
        onPress={() => router.push(`/workout/${pick.id}`)}
      />
      <View style={[styles.row, { marginTop: spacing.sm + 4 }]}>
        <Button title="Challenge me" icon="bolt" variant="secondary" onPress={() => router.push('/challenge')} style={styles.flex} />
        <Button title="Browse all" variant="secondary" onPress={() => router.push('/library')} style={styles.flex} />
      </View>
    </View>
  );

  const prepCard = (warmup || cooldown) && (
    <View>
      <SectionTitle>Warm up and cool down</SectionTitle>
      <Grid columns={1}>{[warmup, cooldown].filter((w): w is WorkoutRow => !!w).map(tile)}</Grid>
    </View>
  );

  const pbStrip = pbs.length > 0 && (
    <View>
      <SectionTitle>Recent personal bests</SectionTitle>
      <View style={styles.list}>
        {pbs.map(({ pb, workout }, i) => (
          <Pressable
            key={pb.id}
            onPress={() => router.push({ pathname: '/workout/result', params: { sessionId: pb.sessionId } })}
            accessibilityRole="button"
            style={(st) => [styles.listRow, i > 0 && styles.listDivider, (st as { hovered?: boolean }).hovered && styles.listHover]}
          >
            <WorkoutMark name={workout?.name ?? '?'} color={workout?.identityColor ?? colors.accent} size={32} />
            <Text style={styles.pbName} numberOfLines={1}>
              {workout?.name}
            </Text>
            <Text style={styles.pbValue}>{formatScore(pb)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  const nextUp = alternatives.length > 0 && (
    <View>
      <SectionTitle>Also a good fit</SectionTitle>
      <Grid columns={isWide ? Math.min(columns, 2) : 1}>{alternatives.map(tile)}</Grid>
    </View>
  );

  const teaser = !program && <ProgramTeaser onPress={() => router.push({ pathname: '/library', params: { tab: 'programs' } })} />;

  return (
    <Screen>
      <View style={styles.header}>
        {!isWide && <Wordmark size={15} />}
        <Text style={styles.date}>{today()}</Text>
        <Text style={styles.greeting}>{greeting()}</Text>
      </View>
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.main}>
            {resumeCard}
            {programCard}
            {pickCard}
            {nextUp}
          </View>
          <View style={styles.side}>
            {weekCard}
            {teaser}
            {pbStrip}
            {prepCard}
          </View>
        </View>
      ) : (
        <View style={styles.stack}>
          {resumeCard}
          {weekCard}
          {programCard}
          {pickCard}
          {teaser}
          {pbStrip}
          {prepCard}
          {nextUp}
        </View>
      )}
    </Screen>
  );
}

function today() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

function ProgramTeaser({ onPress }: { onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.teaser} accessibilityLabel="Browse training programs">
      <View style={styles.teaserIcon}>
        <Icon name="calendar" size={18} color={colors.text} />
      </View>
      <View style={styles.flex}>
        <Text style={styles.cardTitle}>Follow a program</Text>
        <Text style={styles.secondary}>Multi-week plans that re-test your benchmarks.</Text>
      </View>
      <Icon name="forward" size={16} color={colors.textMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  header: { marginBottom: spacing.lg, gap: 4 },
  date: { ...typography.overline, color: colors.textMuted, marginTop: spacing.lg },
  greeting: { ...typography.display, color: colors.text },
  stack: { gap: spacing.sm + 4 },
  columns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  main: { flex: 1, gap: spacing.sm },
  side: { width: 340, gap: spacing.sm + 4, paddingTop: spacing.xl + spacing.sm + 2 },
  weekCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md + 2 },
  ringText: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, letterSpacing: -0.5, color: colors.text, fontVariant: ['tabular-nums'] },
  ringOf: { color: colors.textMuted, fontSize: 14 },
  label: { ...typography.overline, color: colors.textMuted, marginBottom: 3 },
  cardTitle: { ...typography.subheading, color: colors.text },
  secondary: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  programMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm + 4 },
  list: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingVertical: 12, paddingHorizontal: 14 },
  listDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  listHover: { backgroundColor: colors.surfaceRaised },
  pbName: { ...typography.callout, color: colors.text, flex: 1 },
  pbValue: { ...typography.figure, color: colors.pb },
  resume: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
  resumePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.accent, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8 },
  resumeText: { ...typography.callout, fontFamily: fonts.semibold, color: colors.onAccent },
  teaser: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  teaserIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
});
