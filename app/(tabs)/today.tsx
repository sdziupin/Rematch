import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { ProgressRing } from '../../src/components/charts';
import { Icon } from '../../src/components/Icon';
import { WorkoutHeroCard, WorkoutTile } from '../../src/components/WorkoutCard';
import { Card, Grid, Pill, Screen, SectionTitle } from '../../src/components/ui';
import { WORKOUT_SEEDS } from '../../src/content/seed';
import { getProfile, listWorkouts, profileEquipment } from '../../src/db/repository';
import type { WorkoutRow } from '../../src/db/schema';
import type { WorkoutStructure } from '../../src/domain/types';
import { formatScore } from '../../src/domain/utils';
import { formatLabel } from '../../src/engine/workoutEngine';
import { useLayout } from '../../src/hooks/useLayout';
import { getActiveProgram, type ActiveProgram } from '../../src/services/programService';
import { difficultyLabel, focusLabel, recommendTodayWorkout } from '../../src/services/recommendationService';
import { getRecentWorkoutIds, getWorkoutStatsMap, hadPainRecently } from '../../src/services/sessionService';
import { getRecentPbs, getTrainingStats, type TrainingStats } from '../../src/services/statsService';
import { useSettings } from '../../src/store/settingsStore';
import { colors, readable, spacing, typography, withAlpha } from '../../src/theme';

type Stats = Awaited<ReturnType<typeof getWorkoutStatsMap>>;

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? 'Late session?' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
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

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        const [profile, workouts, statsMap, recent, pain, active, recentPbs, t] = await Promise.all([
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
        setProgram(active && !active.progress.complete ? active : null);
        setProgramWorkout(active?.progress.next ? byId.get(active.progress.next.workoutId) ?? null : null);
      })();
      return () => {
        cancelled = true;
      };
    }, [revision, weeklyGoal, weekStartsOn]),
  );

  const thisWeek = training?.thisWeek ?? 0;
  const tile = (w: WorkoutRow) => (
    <WorkoutTile
      key={w.id}
      name={w.name}
      symbol={w.symbol}
      color={w.identityColor}
      format={formatLabel(w.format as WorkoutStructure['format'])}
      meta={`${w.estimatedMinutesMin}–${w.estimatedMinutesMax} min`}
      pb={stats[w.id]?.pb ?? null}
      attempts={stats[w.id]?.attempts}
      onPress={() => router.push(`/workout/${w.id}`)}
    />
  );

  const weekCard = (
    <Card style={styles.weekCard}>
      <ProgressRing progress={thisWeek / Math.max(1, weeklyGoal)} size={84} stroke={8} color={thisWeek >= weeklyGoal ? colors.pb : colors.accent}>
        <Text style={styles.ringText}>
          {thisWeek}/{weeklyGoal}
        </Text>
      </ProgressRing>
      <View style={styles.flex}>
        <Text style={styles.label}>THIS WEEK</Text>
        <Text style={styles.weekTitle}>{thisWeek >= weeklyGoal ? 'Weekly goal done.' : `${weeklyGoal - thisWeek} more to hit your goal`}</Text>
        <View style={styles.row}>
          <Icon name="flame" size={16} color={colors.accentWarm} />
          <Text style={styles.secondary}>
            {training?.weekStreak ?? 0} week streak · {training?.dayStreak ?? 0} day streak
          </Text>
        </View>
      </View>
    </Card>
  );

  const programCard =
    program && programWorkout && program.progress.next ? (
      <View>
        <SectionTitle right={<Button title="Plan" variant="ghost" size="sm" onPress={() => router.push(`/program/${program.program.id}`)} />}>Your program</SectionTitle>
        <WorkoutHeroCard
          name={programWorkout.name}
          symbol={programWorkout.symbol}
          color={program.program.identityColor}
          badge={`${program.program.name} · WEEK ${program.progress.next.week} · DAY ${program.progress.next.day}`}
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
        <View style={styles.programBar}>
          <View style={[styles.programFill, { width: `${Math.round(program.progress.fraction * 100)}%`, backgroundColor: program.program.identityColor }]} />
        </View>
        <Text style={styles.secondary}>
          {program.progress.done} of {program.progress.total} sessions done
        </Text>
      </View>
    ) : null;

  const pickCard = pick && (
    <View>
      <SectionTitle>{program ? 'Or try today’s pick' : 'Today’s challenge'}</SectionTitle>
      <WorkoutHeroCard
        name={pick.name}
        symbol={pick.symbol}
        color={pick.identityColor}
        badge={stats[pick.id]?.pb ? 'REMATCH READY' : 'NEW OPPONENT'}
        format={formatLabel(pick.format as WorkoutStructure['format'])}
        meta={`${focusLabel(pick.focus)} · ${difficultyLabel(pick.difficulty)}`}
        duration={`${pick.estimatedMinutesMin}–${pick.estimatedMinutesMax} min`}
        description={pick.description}
        pb={stats[pick.id]?.pb ?? null}
        last={stats[pick.id]?.last ?? null}
        onPress={() => router.push(`/workout/${pick.id}`)}
      />
      <View style={[styles.row, { marginTop: spacing.md }]}>
        <Button title="CHALLENGE ME" icon="bolt" variant="secondary" onPress={() => router.push('/challenge')} style={styles.flex} />
        <Button title="BROWSE" icon="library" variant="ghost" onPress={() => router.push('/library')} style={styles.flex} />
      </View>
    </View>
  );

  const prepCard = (warmup || cooldown) && (
    <View>
      <SectionTitle>Warm up · cool down</SectionTitle>
      <Grid columns={1}>
        {[warmup, cooldown].filter((w): w is WorkoutRow => !!w).map(tile)}
      </Grid>
    </View>
  );

  const pbStrip = pbs.length > 0 && (
    <View>
      <SectionTitle>Recent personal bests</SectionTitle>
      <View style={styles.pbList}>
        {pbs.map(({ pb, workout }) => (
          <Card key={pb.id} style={styles.pbRow} onPress={() => router.push({ pathname: '/workout/result', params: { sessionId: pb.sessionId } })}>
            <Text style={[styles.pbSymbol, { color: readable(workout?.identityColor ?? colors.accent) }]}>{workout?.symbol}</Text>
            <Text style={styles.pbName} numberOfLines={1}>
              {workout?.name}
            </Text>
            <Pill label={formatScore(pb)} color={colors.pb} />
          </Card>
        ))}
      </View>
    </View>
  );

  const nextUp = alternatives.length > 0 && (
    <View>
      <SectionTitle>Also a good fit</SectionTitle>
      <Grid columns={columns}>{alternatives.map(tile)}</Grid>
    </View>
  );

  return (
    <Screen>
      <View style={styles.header}>
        <View style={styles.flex}>
          {!isWide && <Text style={styles.brand}>REMATCH</Text>}
          <Text style={styles.greeting}>{greeting()}. You vs. you.</Text>
        </View>
      </View>
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.main}>
            {programCard}
            {pickCard}
            {nextUp}
          </View>
          <View style={styles.side}>
            {weekCard}
            {prepCard}
            {pbStrip}
            {!program && <ProgramTeaser onPress={() => router.push({ pathname: '/library', params: { tab: 'programs' } })} />}
          </View>
        </View>
      ) : (
        <View style={styles.stack}>
          {weekCard}
          {programCard}
          {pickCard}
          {!program && <ProgramTeaser onPress={() => router.push({ pathname: '/library', params: { tab: 'programs' } })} />}
          {prepCard}
          {pbStrip}
          {nextUp}
        </View>
      )}
    </Screen>
  );
}

function ProgramTeaser({ onPress }: { onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.teaser} accent={colors.accentWarm} accessibilityLabel="Browse training programs">
      <Icon name="calendar" color={colors.accentWarm} />
      <View style={styles.flex}>
        <Text style={styles.teaserTitle}>Follow a program</Text>
        <Text style={styles.secondary}>Multi-week plans that re-test your benchmarks so you can see the progress.</Text>
      </View>
      <Icon name="forward" color={colors.muted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  brand: { ...typography.displayLG, color: colors.primary },
  greeting: { ...typography.subheading, color: colors.secondary },
  stack: { gap: spacing.sm },
  columns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  main: { flex: 1, gap: spacing.sm },
  side: { width: 360, gap: spacing.md, paddingTop: spacing.lg },
  weekCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.sm },
  ringText: { ...typography.displayMD, fontSize: 24, lineHeight: 28, color: colors.primary },
  label: { ...typography.label, color: colors.muted },
  weekTitle: { ...typography.subheading, color: colors.primary },
  secondary: { ...typography.caption, color: colors.secondary },
  programBar: { height: 6, borderRadius: 3, backgroundColor: colors.border, marginTop: spacing.md, marginBottom: 6, overflow: 'hidden' },
  programFill: { height: 6, borderRadius: 3 },
  pbList: { gap: 8 },
  pbRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10 },
  pbSymbol: { fontSize: 20, width: 28, textAlign: 'center' },
  pbName: { ...typography.bodyBold, color: colors.primary, flex: 1 },
  teaser: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: withAlpha(colors.accentWarm, 0.06) },
  teaserTitle: { ...typography.subheading, color: colors.primary },
});
