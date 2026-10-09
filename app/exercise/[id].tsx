import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { IconButton } from '../../src/components/Button';
import { BodyMap } from '../../src/components/charts';
import { ExerciseAnimation } from '../../src/components/ExerciseAnimation';
import { Icon } from '../../src/components/Icon';
import { WorkoutTile } from '../../src/components/WorkoutCard';
import { Card, EmptyState, Grid, Screen, ScreenHeader, SectionTitle, Segmented } from '../../src/components/ui';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, type EquipmentId, type MuscleId } from '../../src/content/types';
import { findWorkoutsUsingExercise, getExercise, getExercisesByIds, parseJsonArray } from '../../src/db/repository';
import type { ExerciseRow, WorkoutRow } from '../../src/db/schema';
import type { WorkoutStructure } from '../../src/domain/types';
import { titleCase } from '../../src/domain/utils';
import { formatLabel } from '../../src/engine/workoutEngine';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, fonts, radius, spacing, typography } from '../../src/theme';

const SPEEDS = [0.5, 1, 1.5] as const;

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isWide, columns } = useLayout();
  const [ex, setEx] = useState<ExerciseRow | null | undefined>(undefined);
  const [related, setRelated] = useState<Map<string, ExerciseRow>>(new Map());
  const [usedIn, setUsedIn] = useState<WorkoutRow[]>([]);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    (async () => {
      const row = await getExercise(id);
      setEx(row);
      if (!row) return;
      setRelated(await getExercisesByIds([row.easierVariantId, row.harderVariantId].filter((x): x is string => !!x)));
      setUsedIn(await findWorkoutsUsingExercise(row.id, 6));
    })();
  }, [id]);

  if (ex === undefined) return <Screen>{null}</Screen>;
  if (ex === null) {
    return (
      <Screen narrow>
        <ScreenHeader title="Exercise" onBack={() => router.back()} />
        <EmptyState title="Exercise not found" />
      </Screen>
    );
  }

  const primary = parseJsonArray(ex.primaryMusclesJson) as MuscleId[];
  const secondary = parseJsonArray(ex.secondaryMusclesJson) as MuscleId[];
  const load: Record<string, number> = {};
  for (const m of secondary) load[m] = 0.45;
  for (const m of primary) load[m] = 1;
  const cues = parseJsonArray(ex.cuesJson);
  const mistakes = parseJsonArray(ex.mistakesJson);
  const equipment = parseJsonArray(ex.equipmentJson).filter((e) => e !== 'bodyweight') as EquipmentId[];
  const easier = ex.easierVariantId ? related.get(ex.easierVariantId) : undefined;
  const harder = ex.harderVariantId ? related.get(ex.harderVariantId) : undefined;
  const size = isWide ? 360 : 260;
  const equipmentText = equipment.length === 0 ? 'No equipment' : equipment.map((e) => EQUIPMENT_LABELS[e] ?? e).join(', ');

  const demo = (
    <View style={[styles.demo, isWide && styles.demoWide]}>
      <ExerciseAnimation exerciseId={ex.id} category={ex.category} size={size} speed={speed} playing={playing} background={null} accessibilityLabel={`${ex.name} demonstration`} />
      <View style={styles.demoControls}>
        <IconButton icon={playing ? 'pause' : 'play'} label={playing ? 'Pause' : 'Play'} size={36} background={colors.surfaceHover} onPress={() => setPlaying((p) => !p)} />
        <Segmented options={SPEEDS.map((v) => ({ key: String(v), label: `${v}×` }))} value={String(speed)} onChange={(v) => setSpeed(Number(v) as (typeof SPEEDS)[number])} />
      </View>
    </View>
  );

  const info = (
    <View style={styles.info}>
      <Text style={styles.description}>{ex.description}</Text>
      <SectionTitle>How to do it</SectionTitle>
      <Card style={styles.steps}>
        <Step n={1} title="Start" body={ex.startPosition} />
        <Step n={2} title="Move" body={ex.movementSequence} />
        {ex.instructions ? <Step n={3} title="Tip" body={ex.instructions} /> : null}
      </Card>
      {(cues.length > 0 || mistakes.length > 0) && (
        <View style={[styles.lists, isWide && styles.listsWide]}>
          {cues.length > 0 && (
            <View style={styles.flex}>
              <SectionTitle>Coaching cues</SectionTitle>
              <Card style={styles.bullets}>
                {cues.map((c) => (
                  <View key={c} style={styles.bullet}>
                    <Icon name="check" size={16} color={colors.accent} strokeWidth={2} />
                    <Text style={styles.bulletText}>{c}</Text>
                  </View>
                ))}
              </Card>
            </View>
          )}
          {mistakes.length > 0 && (
            <View style={styles.flex}>
              <SectionTitle>Common mistakes</SectionTitle>
              <Card style={styles.bullets}>
                {mistakes.map((m) => (
                  <View key={m} style={styles.bullet}>
                    <Icon name="close" size={16} color={colors.behind} strokeWidth={2} />
                    <Text style={styles.bulletText}>{m}</Text>
                  </View>
                ))}
              </Card>
            </View>
          )}
        </View>
      )}
      <SectionTitle>Muscles</SectionTitle>
      <Card style={styles.muscles}>
        <BodyMap load={load} height={190} />
        <View style={[styles.flex, { gap: spacing.md }]}>
          <View style={styles.muscleGroup}>
            <Text style={styles.label}>Primary</Text>
            <Text style={styles.bulletText}>{primary.map((m) => MUSCLE_LABELS[m] ?? m).join(', ') || '—'}</Text>
          </View>
          <View style={styles.muscleGroup}>
            <Text style={styles.label}>Secondary</Text>
            <Text style={styles.bulletTextMuted}>{secondary.map((m) => MUSCLE_LABELS[m] ?? m).join(', ') || '—'}</Text>
          </View>
        </View>
      </Card>
      {(easier || harder) && (
        <>
          <SectionTitle>Progressions</SectionTitle>
          <Grid columns={isWide && easier && harder ? 2 : 1}>
            {[easier && <VariantCard key="e" label="Easier" ex={easier} onPress={() => router.push(`/exercise/${easier.id}`)} />, harder && <VariantCard key="h" label="Harder" ex={harder} onPress={() => router.push(`/exercise/${harder.id}`)} />].filter(Boolean)}
          </Grid>
        </>
      )}
      {usedIn.length > 0 && (
        <>
          <SectionTitle>Featured in</SectionTitle>
          <Grid columns={Math.min(columns, 2)}>
            {usedIn.map((w) => (
              <WorkoutTile
                key={w.id}
                name={w.name}
                color={w.identityColor}
                format={formatLabel(w.format as WorkoutStructure['format'])}
                meta={`${w.estimatedMinutesMin}–${w.estimatedMinutesMax} min`}
                onPress={() => router.push(`/workout/${w.id}`)}
              />
            ))}
          </Grid>
        </>
      )}
    </View>
  );

  return (
    <Screen>
      <ScreenHeader
        eyebrow={`${titleCase(ex.category)} · ${titleCase(ex.impactLevel)} impact · ${equipmentText}`}
        title={ex.name}
        onBack={() => (router.canGoBack() ? router.back() : router.replace('/exercises'))}
      />
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.sticky}>{demo}</View>
          <View style={styles.flex}>{info}</View>
        </View>
      ) : (
        <>
          {demo}
          {info}
        </>
      )}
    </Screen>
  );
}

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <View style={styles.step}>
      <View style={styles.stepN}>
        <Text style={styles.stepNText}>{n}</Text>
      </View>
      <View style={[styles.flex, { gap: 2 }]}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.bulletTextMuted}>{body}</Text>
      </View>
    </View>
  );
}

function VariantCard({ label, ex, onPress }: { label: string; ex: ExerciseRow; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.variant} accessibilityLabel={`${label}: ${ex.name}`}>
      <ExerciseAnimation exerciseId={ex.id} category={ex.category} size={56} playing={false} />
      <View style={styles.flex}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.variantName}>{ex.name}</Text>
      </View>
      <Icon name="forward" size={16} color={colors.textMuted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  columns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  sticky: { width: 400 },
  demo: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg, paddingHorizontal: spacing.md, backgroundColor: colors.surfaceRaised, borderRadius: radius.xl + 4 },
  demoWide: { paddingVertical: spacing.xl },
  demoControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4 },
  info: { marginTop: spacing.lg },
  description: { ...typography.subheading, fontFamily: fonts.medium, fontSize: 18, lineHeight: 26, color: colors.text },
  steps: { gap: spacing.md + 2 },
  step: { flexDirection: 'row', gap: 14 },
  stepN: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  stepNText: { ...typography.caption, fontFamily: fonts.semibold, color: colors.text },
  stepTitle: { ...typography.bodyStrong, color: colors.text },
  label: { ...typography.overline, color: colors.textMuted },
  lists: { gap: 0 },
  listsWide: { flexDirection: 'row', gap: spacing.md },
  bullets: { gap: spacing.sm + 4 },
  bullet: { flexDirection: 'row', gap: spacing.sm + 4, alignItems: 'flex-start' },
  bulletText: { ...typography.body, color: colors.text, flex: 1 },
  bulletTextMuted: { ...typography.body, color: colors.textSecondary, flex: 1 },
  muscles: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  muscleGroup: { gap: 4 },
  variant: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 10 },
  variantName: { ...typography.bodyStrong, color: colors.text, marginTop: 2 },
});
