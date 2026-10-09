import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { TrendChart } from '../../src/components/charts';
import { confirmAction, showToast } from '../../src/components/Dialogs';
import { ExerciseAnimation } from '../../src/components/ExerciseAnimation';
import { StructurePreview } from '../../src/components/StructurePreview';
import { Icon } from '../../src/components/Icon';
import { Card, Chip, EmptyState, Pill, Screen, ScreenHeader, SectionTitle, Segmented, Stat, WorkoutMark } from '../../src/components/ui';
import { EQUIPMENT_LABELS, type EquipmentId } from '../../src/content/types';
import { getExercisesByIds, loadWorkoutPlan, parseJsonArray } from '../../src/db/repository';
import type { ExerciseRow, PersonalBestRow, ResultRow } from '../../src/db/schema';
import { categoryForSwaps, easierChain, presetSwaps, SCALING_LABELS } from '../../src/domain/scaling';
import type { PartialKey, ScalingCategory, WorkoutStructure } from '../../src/domain/types';
import { formatDuration, formatScore, titleCase } from '../../src/domain/utils';
import { formatLabel } from '../../src/engine/workoutEngine';
import { useLayout } from '../../src/hooks/useLayout';
import { archiveCustomWorkout } from '../../src/services/customWorkoutService';
import { difficultyLabel } from '../../src/services/recommendationService';
import { getPb, listResults } from '../../src/services/sessionService';
import { getWorkoutTrend, type TrendPoint } from '../../src/services/statsService';
import { beginWorkout, resolveDanglingSession } from '../../src/services/startWorkout';
import { colors, fonts, radius, readable, spacing, typography } from '../../src/theme';

const VARIANTS: PartialKey[] = ['full', 'three_quarter', 'half', 'quarter'];
const VARIANT_LABEL: Record<PartialKey, string> = { full: 'Full', three_quarter: '¾', half: '½', quarter: '¼' };

type Plan = NonNullable<Awaited<ReturnType<typeof loadWorkoutPlan>>>;

export default function WorkoutDetailScreen() {
  const params = useLocalSearchParams<{ id: string; variant?: string; program?: string; key?: string }>();
  const router = useRouter();
  const { isWide } = useLayout();
  const insets = useSafeAreaInsets();
  const [partialKey, setPartialKey] = useState<PartialKey>((VARIANTS as string[]).includes(params.variant ?? '') ? (params.variant as PartialKey) : 'full');
  const [plan, setPlan] = useState<Plan | null>(null);
  const [missing, setMissing] = useState(false);
  const [exercises, setExercises] = useState<Map<string, ExerciseRow>>(new Map());
  const [swaps, setSwaps] = useState<Record<string, string>>({});
  const [pb, setPb] = useState<PersonalBestRow | null>(null);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [starting, setStarting] = useState(false);

  const chainOf = useCallback((id: string) => easierChain(id, (x) => exercises.get(x)?.easierVariantId), [exercises]);
  // Only swaps for movements in the chosen size count (a ¼ workout may not include them all).
  const activeSwaps = useMemo(() => {
    if (!plan) return swaps;
    const present = new Set(plan.structure.rounds.flatMap((r) => r.steps.map((st) => st.exerciseId)));
    return Object.fromEntries(Object.entries(swaps).filter(([rx]) => present.has(rx)));
  }, [plan, swaps]);
  const scaling: ScalingCategory = useMemo(() => categoryForSwaps(activeSwaps, chainOf), [activeSwaps, chainOf]);

  const load = useCallback(async () => {
    const p = await loadWorkoutPlan(params.id, partialKey);
    if (!p) {
      setMissing(true);
      return;
    }
    setPlan(p);
    const ids = p.fullStructure.rounds.flatMap((r) => r.steps.map((s) => s.exerciseId));
    let map = await getExercisesByIds(ids);
    // Pull in two levels of easier variants for the scaling picker.
    for (let depth = 0; depth < 2; depth++) {
      const more = [...map.values()].map((e) => e.easierVariantId).filter((x): x is string => !!x && !map.has(x));
      if (!more.length) break;
      map = new Map([...map, ...(await getExercisesByIds(more))]);
    }
    setExercises(map);
    setTrend(await getWorkoutTrend(p.workout.id, p.version.id));
  }, [params.id, partialKey]);

  const loadScores = useCallback(async () => {
    if (!plan) return;
    setPb(await getPb(plan.workout.id, plan.version.id, plan.variant.id, scaling));
    setResults(await listResults(plan.workout.id, plan.variant.id, scaling, plan.version.id));
  }, [plan, scaling]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );
  useFocusEffect(
    useCallback(() => {
      void loadScores();
    }, [loadScores]),
  );

  if (missing) {
    return (
      <Screen narrow>
        <ScreenHeader title="Not found" onBack={() => router.back()} />
        <EmptyState title="This workout doesn't exist anymore." action={<Button title="Browse workouts" onPress={() => router.replace('/library')} />} />
      </Screen>
    );
  }
  if (!plan) return <Screen>{null}</Screen>;

  const w = { ...plan.workout, identityColor: readable(plan.workout.identityColor) };
  const structure: WorkoutStructure = plan.structure;
  const isBenchmark = (w.kind ?? 'benchmark') === 'benchmark';
  const uniqueMoves = [...new Set(plan.structure.rounds.flatMap((r) => r.steps.map((s) => s.exerciseId)))];
  const scalable = uniqueMoves.filter((id) => chainOf(id).length > 1);
  const last = results[0] ?? null;
  const equipment = parseJsonArray(w.equipmentJson).filter((e) => e !== 'bodyweight') as EquipmentId[];
  const program = params.program ? { programEnrollmentId: params.program, programSessionKey: params.key ?? null } : {};

  const start = async (opponentSessionId: string | null) => {
    if (starting) return;
    setStarting(true);
    try {
      const proceed = await resolveDanglingSession((name) =>
        confirmAction({
          title: `${name} is still in progress`,
          message: 'Starting a new workout ends it. What you did is kept as an unfinished result.',
          confirmLabel: 'Start new',
        }),
      );
      if (!proceed) return;
      await beginWorkout({ workoutId: w.id, partialKey, scalingCategory: scaling, swaps: activeSwaps, opponentSessionId, ...program });
      router.push('/workout/active');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not start the workout.', { tone: 'error' });
    } finally {
      setStarting(false);
    }
  };

  const cycleSwap = (rx: string) => {
    const chain = chainOf(rx);
    const current = swaps[rx] ?? rx;
    const next = chain[(chain.indexOf(current) + 1) % chain.length];
    setSwaps((s) => {
      const copy = { ...s };
      if (next === rx) delete copy[rx];
      else copy[rx] = next;
      return copy;
    });
  };

  const onArchive = async () => {
    const ok = await confirmAction({ title: `Delete ${w.name}?`, message: 'It disappears from your library. Your results stay in your history.', confirmLabel: 'Delete', destructive: true });
    if (!ok) return;
    await archiveCustomWorkout(w.id);
    showToast('Workout deleted');
    router.back();
  };

  const trendValues = trend.filter((t) => t.variantId === plan.variant.id && t.scaling === scaling).map((t) => t.value);
  const scoreType = plan.version.rulesJson.includes('"reps"') ? 'reps' : 'time';

  const primary = isBenchmark && pb
    ? { title: 'Rematch your best', icon: 'trophy' as const, run: () => start(pb.sessionId) }
    : isBenchmark && last
      ? { title: 'Rematch last attempt', icon: 'bolt' as const, run: () => start(last.sessionId) }
      : { title: isBenchmark ? 'Start first attempt' : 'Start', icon: 'play' as const, run: () => start(null) };
  const secondary: { title: string; run: () => void }[] = [];
  if (isBenchmark && pb && last && last.sessionId !== pb.sessionId) secondary.push({ title: 'Race last attempt', run: () => start(last.sessionId) });
  if (isBenchmark && results.length > 1)
    secondary.push({
      title: 'Choose opponent',
      run: () =>
        router.push({
          pathname: '/opponent/[workoutId]',
          params: { workoutId: w.id, variant: partialKey, scaling, swaps: JSON.stringify(activeSwaps), ...(params.program ? { program: params.program, key: params.key } : {}) },
        }),
    });
  if (results.length > 0) secondary.push({ title: 'Just train', run: () => start(null) });

  const headerBlock = (
    <View style={styles.hero}>
      <WorkoutMark name={w.name} color={w.identityColor} size={52} />
      <Text style={styles.eyebrow}>
        {formatLabel(w.format as WorkoutStructure['format'])} · {difficultyLabel(w.difficulty)} · {titleCase(w.focus)}
        {w.source === 'custom' ? ' · Custom' : ''}
        {!isBenchmark ? (w.kind === 'warmup' ? ' · Warm-up' : ' · Cool-down') : ''}
      </Text>
      <Text style={styles.name} accessibilityRole="header">
        {w.name}
      </Text>
      <Text style={styles.duration}>
        {w.estimatedMinutesMin}–{w.estimatedMinutesMax} min · {equipment.length ? equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(', ') : 'No equipment'}
      </Text>
      {w.description ? <Text style={styles.description}>{w.description}</Text> : null}
    </View>
  );

  const actions = (
    <View style={styles.actions}>
      <Button title={primary.title} icon={primary.icon} size="lg" loading={starting} onPress={primary.run} />
      {secondary.length > 0 && (
        <View style={styles.secondaryRow}>
          {secondary.map((a) => (
            <Button key={a.title} title={a.title} variant="secondary" size="sm" onPress={a.run} style={styles.flex} />
          ))}
        </View>
      )}
      {results.length === 0 && isBenchmark && <Text style={styles.hint}>Your first attempt becomes the opponent for every rematch after it.</Text>}
    </View>
  );

  const stats = isBenchmark && (
    <Card style={styles.statsCard}>
      <View style={styles.statsRow}>
        <Stat label="Best" value={pb ? formatScore(pb) : '—'} color={pb ? colors.pb : undefined} style={styles.flex} />
        <Stat label="Last" value={last ? formatScore(last) : '—'} style={styles.flex} />
        <Stat label="Attempts" value={String(results.length)} style={styles.flex} />
      </View>
      {trendValues.length >= 2 && (
        <TrendChart values={trendValues} lowerIsBetter={scoreType === 'time'} width={isWide ? 340 : 300} format={(v) => (scoreType === 'reps' ? `${v}` : formatDuration(v))} />
      )}
      <Text style={styles.statsNote}>
        {VARIANT_LABEL[partialKey]} · {SCALING_LABELS[scaling]}. Scores only compare within the same version, size and scaling.
      </Text>
    </Card>
  );

  const options = (
    <>
      <SectionTitle>Size</SectionTitle>
      <Segmented options={VARIANTS.map((v) => ({ key: v, label: VARIANT_LABEL[v] }))} value={partialKey} onChange={setPartialKey} fill />
      {isBenchmark && scalable.length > 0 && (
        <>
          <SectionTitle right={<Pill label={SCALING_LABELS[scaling]} color={scaling === 'rx' ? colors.accent : colors.behind} />}>Scaling</SectionTitle>
          <View style={styles.presets}>
            <Chip label="All RX" selected={scaling === 'rx'} onPress={() => setSwaps({})} />
            <Chip label="All scaled" onPress={() => setSwaps(presetSwaps(scalable, chainOf, 1))} />
            <Chip label="All modified" onPress={() => setSwaps(presetSwaps(scalable, chainOf, 2))} />
          </View>
          <View style={styles.swapList}>
            {scalable.map((rx, i) => {
              const chosen = swaps[rx] ?? rx;
              const level = chainOf(rx).indexOf(chosen);
              return (
                <Pressable
                  key={rx}
                  onPress={() => cycleSwap(rx)}
                  accessibilityRole="button"
                  accessibilityLabel={`${exercises.get(rx)?.name}: doing ${exercises.get(chosen)?.name}. Tap to change.`}
                  style={(st) => [styles.swapRow, i > 0 && styles.swapDivider, (st as { hovered?: boolean }).hovered && styles.swapHover]}
                >
                  <ExerciseAnimation exerciseId={chosen} category={exercises.get(chosen)?.category} size={40} playing={false} />
                  <View style={styles.flex}>
                    <Text style={styles.swapName}>{exercises.get(chosen)?.name ?? chosen}</Text>
                    <Text style={styles.swapSub}>{level === 0 ? 'As prescribed' : `Instead of ${exercises.get(rx)?.name ?? rx}`}</Text>
                  </View>
                  <Pill label={level === 0 ? 'RX' : level === 1 ? 'Scaled' : 'Modified'} color={level === 0 ? undefined : colors.behind} />
                  <Icon name="swap" size={16} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        </>
      )}
    </>
  );

  const workoutBlock = (
    <>
      <SectionTitle>The workout</SectionTitle>
      <StructurePreview structure={structure} exercises={exercises} swaps={swaps} onExercisePress={(id) => router.push(`/exercise/${id}`)} />
    </>
  );

  return (
    <Screen
      footer={
        isWide ? undefined : (
          <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, spacing.md) }]}>
            <View style={styles.footerInner}>{actions}</View>
          </View>
        )
      }
    >
      <ScreenHeader
        title=""
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/library'))}
        right={
          w.source === 'custom' ? (
            <View style={styles.row}>
              <Button title="Edit" icon="edit" variant="ghost" size="sm" onPress={() => router.push({ pathname: '/builder', params: { id: w.id } })} />
              <Button title="Delete" icon="trash" variant="ghost" size="sm" onPress={onArchive} />
            </View>
          ) : undefined
        }
      />
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.flex}>
            {headerBlock}
            {workoutBlock}
          </View>
          <View style={styles.side}>
            {stats}
            {options}
            <View style={{ marginTop: spacing.xl }}>{actions}</View>
          </View>
        </View>
      ) : (
        <>
          {headerBlock}
          {stats}
          {options}
          {workoutBlock}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 4 },
  hero: { gap: 6, marginBottom: spacing.lg },
  eyebrow: { ...typography.overline, color: colors.textMuted, marginTop: spacing.md },
  name: { ...typography.display, fontSize: 44, lineHeight: 48, color: colors.text },
  duration: { ...typography.callout, color: colors.textSecondary },
  description: { ...typography.body, color: colors.textSecondary, marginTop: spacing.sm, maxWidth: 620 },
  statsCard: { gap: spacing.md + 4 },
  statsRow: { flexDirection: 'row', gap: spacing.md },
  statsNote: { ...typography.caption, color: colors.textMuted },
  actions: { gap: spacing.sm + 2 },
  secondaryRow: { flexDirection: 'row', gap: spacing.sm },
  hint: { ...typography.caption, color: colors.textMuted, textAlign: 'center' },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing.sm + 4 },
  swapList: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingVertical: 10, paddingHorizontal: 12 },
  swapDivider: { borderTopWidth: 1, borderTopColor: colors.border },
  swapHover: { backgroundColor: colors.surfaceRaised },
  swapName: { ...typography.callout, fontFamily: fonts.semibold, color: colors.text },
  swapSub: { ...typography.caption, color: colors.textMuted },
  columns: { flexDirection: 'row', gap: spacing.xxl, alignItems: 'flex-start' },
  side: { width: 380 },
  footer: { borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, paddingHorizontal: spacing.md + 4, paddingTop: spacing.sm + 4 },
  footerInner: { width: '100%', maxWidth: 720, alignSelf: 'center' },
});
