import React, { useCallback, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { getWorkoutImage } from '../../src/assets/imageRegistry';
import { Button } from '../../src/components/Button';
import { TrendChart } from '../../src/components/charts';
import { confirmAction, showToast } from '../../src/components/Dialogs';
import { ExerciseAnimation } from '../../src/components/ExerciseAnimation';
import { StructurePreview } from '../../src/components/StructurePreview';
import { Card, Chip, ChipRow, EmptyState, Pill, Screen, ScreenHeader, SectionTitle, Stat } from '../../src/components/ui';
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
import { colors, readable, spacing, typography, withAlpha } from '../../src/theme';

const VARIANTS: PartialKey[] = ['full', 'three_quarter', 'half', 'quarter'];
const VARIANT_LABEL: Record<PartialKey, string> = { full: 'Full', three_quarter: '¾', half: '½', quarter: '¼' };

type Plan = NonNullable<Awaited<ReturnType<typeof loadWorkoutPlan>>>;

export default function WorkoutDetailScreen() {
  const params = useLocalSearchParams<{ id: string; variant?: string; program?: string; key?: string }>();
  const router = useRouter();
  const { isWide } = useLayout();
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
  const scaling: ScalingCategory = useMemo(() => categoryForSwaps(swaps, chainOf), [swaps, chainOf]);

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
  const artwork = getWorkoutImage(w.slug);
  const uniqueMoves = [...new Set(plan.fullStructure.rounds.flatMap((r) => r.steps.map((s) => s.exerciseId)))];
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
      await beginWorkout({ workoutId: w.id, partialKey, scalingCategory: scaling, swaps, opponentSessionId, ...program });
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

  const headerBlock = (
    <View style={styles.hero}>
      <View style={[styles.symbolWrap, { backgroundColor: withAlpha(w.identityColor, 0.16), borderColor: withAlpha(w.identityColor, 0.5) }]}>
        {artwork ? (
          <Image source={artwork} style={styles.artwork} accessibilityIgnoresInvertColors accessibilityLabel={`${w.name} artwork`} />
        ) : (
          <Text style={[styles.symbol, { color: w.identityColor }]}>{w.symbol}</Text>
        )}
      </View>
      <View style={styles.flex}>
        <Text style={styles.name} accessibilityRole="header">
          {w.name}
        </Text>
        <View style={styles.pills}>
          <Pill label={formatLabel(w.format as WorkoutStructure['format']).toUpperCase()} color={w.identityColor} />
          <Pill label={difficultyLabel(w.difficulty).toUpperCase()} />
          <Pill label={titleCase(w.focus).toUpperCase()} />
          {w.source === 'custom' && <Pill label="CUSTOM" color={colors.accentWarm} />}
          {!isBenchmark && <Pill label={w.kind === 'warmup' ? 'WARM-UP' : 'COOL-DOWN'} color={colors.rest} />}
        </View>
        <Text style={styles.duration}>
          ≈ {w.estimatedMinutesMin}–{w.estimatedMinutesMax} min{equipment.length ? ` · ${equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(', ')}` : ' · No equipment'}
        </Text>
      </View>
    </View>
  );

  const actions = (
    <View style={styles.actions}>
      {isBenchmark && pb && <Button title="REMATCH YOUR PB" icon="trophy" size="lg" loading={starting} onPress={() => start(pb.sessionId)} />}
      {isBenchmark && last && last.sessionId !== pb?.sessionId && (
        <Button title="REMATCH LAST ATTEMPT" icon="bolt" variant={pb ? 'secondary' : 'primary'} size={pb ? 'md' : 'lg'} onPress={() => start(last.sessionId)} />
      )}
      {isBenchmark && results.length > 1 && (
        <Button
          title="CHOOSE OPPONENT"
          icon="list"
          variant="outline"
          onPress={() =>
            router.push({ pathname: '/opponent/[workoutId]', params: { workoutId: w.id, variant: partialKey, scaling, swaps: JSON.stringify(swaps), ...(params.program ? { program: params.program, key: params.key } : {}) } })
          }
        />
      )}
      <Button
        title={results.length === 0 ? (isBenchmark ? 'START FIRST ATTEMPT' : 'START') : 'JUST TRAIN (NO RACE)'}
        icon="play"
        variant={results.length === 0 ? 'primary' : 'ghost'}
        size={results.length === 0 ? 'lg' : 'md'}
        loading={starting && results.length === 0}
        onPress={() => start(null)}
      />
      {results.length === 0 && isBenchmark && <Text style={styles.hint}>Your first attempt becomes the opponent for every rematch after it.</Text>}
    </View>
  );

  const stats = isBenchmark && (
    <Card>
      <View style={styles.statsRow}>
        <Stat label="PB" value={pb ? formatScore(pb) : '—'} color={colors.pb} />
        <Stat label="Last" value={last ? formatScore(last) : '—'} />
        <Stat label="Attempts" value={String(results.length)} />
      </View>
      <Text style={styles.statsNote}>
        {VARIANT_LABEL[partialKey]} · {SCALING_LABELS[scaling]} — scores only compare within the same version, size and scaling.
      </Text>
      {trendValues.length >= 2 && (
        <View style={{ marginTop: spacing.md }}>
          <TrendChart values={trendValues} lowerIsBetter={scoreType === 'time'} width={isWide ? 420 : 300} format={(v) => (scoreType === 'reps' ? `${v}` : formatDuration(v))} />
        </View>
      )}
    </Card>
  );

  const options = (
    <>
      <SectionTitle>Size</SectionTitle>
      <ChipRow options={VARIANTS} value={partialKey} onChange={setPartialKey} format={(v) => (v === 'full' ? 'Full workout' : `${VARIANT_LABEL[v]} workout`)} />
      {isBenchmark && scalable.length > 0 && (
        <>
          <SectionTitle right={<Pill label={SCALING_LABELS[scaling].toUpperCase()} color={scaling === 'rx' ? colors.accent : colors.accentWarm} />}>Scaling</SectionTitle>
          <View style={styles.pills}>
            <Chip label="All RX" selected={scaling === 'rx'} onPress={() => setSwaps({})} />
            <Chip label="All scaled" onPress={() => setSwaps(presetSwaps(scalable, chainOf, 1))} />
            <Chip label="All modified" onPress={() => setSwaps(presetSwaps(scalable, chainOf, 2))} />
          </View>
          <View style={styles.swapList}>
            {scalable.map((rx) => {
              const chosen = swaps[rx] ?? rx;
              const level = chainOf(rx).indexOf(chosen);
              return (
                <Card key={rx} onPress={() => cycleSwap(rx)} style={styles.swapRow} accessibilityLabel={`${exercises.get(rx)?.name}: doing ${exercises.get(chosen)?.name}. Tap to change.`}>
                  <ExerciseAnimation exerciseId={chosen} category={exercises.get(chosen)?.category} size={44} playing={false} color={level === 0 ? colors.accent : colors.accentWarm} />
                  <View style={styles.flex}>
                    <Text style={styles.swapName}>{exercises.get(chosen)?.name ?? chosen}</Text>
                    <Text style={styles.swapSub}>{level === 0 ? 'As prescribed' : `Instead of ${exercises.get(rx)?.name ?? rx}`}</Text>
                  </View>
                  <Pill label={level === 0 ? 'RX' : level === 1 ? 'SCALED' : 'MODIFIED'} color={level === 0 ? colors.accent : colors.accentWarm} />
                </Card>
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
    <Screen>
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
      {headerBlock}
      {w.description ? <Text style={styles.description}>{w.description}</Text> : null}
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.flex}>{workoutBlock}</View>
          <View style={styles.side}>
            {stats}
            {options}
            <View style={{ marginTop: spacing.lg }}>{actions}</View>
          </View>
        </View>
      ) : (
        <>
          {stats}
          {options}
          {workoutBlock}
          <View style={{ marginTop: spacing.xl }}>{actions}</View>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: 4 },
  hero: { flexDirection: 'row', gap: spacing.md, alignItems: 'center', marginBottom: spacing.md },
  symbolWrap: { width: 84, height: 84, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, overflow: 'hidden' },
  symbol: { fontSize: 44 },
  artwork: { width: 84, height: 84, borderRadius: 24 },
  name: { ...typography.displayLG, color: colors.primary },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 4 },
  duration: { ...typography.body, color: colors.secondary },
  description: { ...typography.body, color: colors.primary, marginBottom: spacing.md, maxWidth: 680 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  statsNote: { ...typography.caption, color: colors.muted, marginTop: spacing.sm },
  actions: { gap: spacing.sm },
  hint: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  swapList: { gap: 8, marginTop: spacing.sm },
  swapRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm },
  swapName: { ...typography.bodyBold, color: colors.primary },
  swapSub: { ...typography.caption, color: colors.secondary },
  columns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  side: { width: 380 },
});
