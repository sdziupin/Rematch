import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { BodyMap } from '../../src/components/charts';
import { ExerciseAnimation } from '../../src/components/ExerciseAnimation';
import { Icon } from '../../src/components/Icon';
import { WorkoutTile } from '../../src/components/WorkoutCard';
import { Card, ChipRow, EmptyState, Grid, Pill, Screen, ScreenHeader, SectionTitle } from '../../src/components/ui';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, type EquipmentId, type MuscleId } from '../../src/content/types';
import { findWorkoutsUsingExercise, getExercise, getExercisesByIds, parseJsonArray } from '../../src/db/repository';
import type { ExerciseRow, WorkoutRow } from '../../src/db/schema';
import type { WorkoutStructure } from '../../src/domain/types';
import { titleCase } from '../../src/domain/utils';
import { formatLabel } from '../../src/engine/workoutEngine';
import { useLayout } from '../../src/hooks/useLayout';
import { colors, spacing, typography } from '../../src/theme';

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
  const size = isWide ? 380 : 280;

  const demo = (
    <Card style={styles.demo}>
      <ExerciseAnimation exerciseId={ex.id} category={ex.category} size={size} speed={speed} playing={playing} background={null} accessibilityLabel={`${ex.name} demonstration`} />
      <View style={styles.demoControls}>
        <Button title={playing ? 'Pause' : 'Play'} icon={playing ? 'pause' : 'play'} variant="secondary" size="sm" onPress={() => setPlaying((p) => !p)} />
        <ChipRow options={SPEEDS} value={speed} onChange={setSpeed} format={(s) => `${s}×`} />
      </View>
    </Card>
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
      {cues.length > 0 && (
        <>
          <SectionTitle>Coaching cues</SectionTitle>
          {cues.map((c) => (
            <View key={c} style={styles.bullet}>
              <Icon name="check" size={16} color={colors.accent} />
              <Text style={styles.bulletText}>{c}</Text>
            </View>
          ))}
        </>
      )}
      {mistakes.length > 0 && (
        <>
          <SectionTitle>Common mistakes</SectionTitle>
          {mistakes.map((m) => (
            <View key={m} style={styles.bullet}>
              <Icon name="close" size={16} color={colors.behind} />
              <Text style={styles.bulletText}>{m}</Text>
            </View>
          ))}
        </>
      )}
      <SectionTitle>Muscles</SectionTitle>
      <View style={styles.muscles}>
        <BodyMap load={load} height={200} />
        <View style={styles.flex}>
          <Text style={styles.label}>PRIMARY</Text>
          <Text style={styles.bulletText}>{primary.map((m) => MUSCLE_LABELS[m] ?? m).join(', ') || '—'}</Text>
          <Text style={[styles.label, { marginTop: spacing.sm }]}>SECONDARY</Text>
          <Text style={styles.bulletText}>{secondary.map((m) => MUSCLE_LABELS[m] ?? m).join(', ') || '—'}</Text>
        </View>
      </View>
      {(easier || harder) && (
        <>
          <SectionTitle>Progressions</SectionTitle>
          <View style={styles.progressions}>
            {easier && <VariantCard label="Easier" ex={easier} onPress={() => router.push(`/exercise/${easier.id}`)} />}
            {harder && <VariantCard label="Harder" ex={harder} onPress={() => router.push(`/exercise/${harder.id}`)} />}
          </View>
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
                symbol={w.symbol}
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
      <ScreenHeader title={ex.name} subtitle={`${titleCase(ex.category)} · ${titleCase(ex.impactLevel)} impact`} onBack={() => (router.canGoBack() ? router.back() : router.replace('/exercises'))} />
      <View style={styles.pills}>
        {equipment.length === 0 ? <Pill label="NO EQUIPMENT" /> : equipment.map((e) => <Pill key={e} label={(EQUIPMENT_LABELS[e] ?? e).toUpperCase()} />)}
      </View>
      {isWide ? (
        <View style={styles.columns}>
          <View>{demo}</View>
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
      <Text style={styles.stepN}>{n}</Text>
      <View style={styles.flex}>
        <Text style={styles.label}>{title.toUpperCase()}</Text>
        <Text style={styles.bulletText}>{body}</Text>
      </View>
    </View>
  );
}

function VariantCard({ label, ex, onPress }: { label: string; ex: ExerciseRow; onPress: () => void }) {
  return (
    <Card onPress={onPress} style={styles.variant} accessibilityLabel={`${label}: ${ex.name}`}>
      <ExerciseAnimation exerciseId={ex.id} category={ex.category} size={64} playing={false} />
      <View style={styles.flex}>
        <Text style={styles.label}>{label.toUpperCase()}</Text>
        <Text style={styles.variantName}>{ex.name}</Text>
      </View>
      <Icon name="forward" color={colors.muted} />
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  pills: { flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: spacing.md },
  columns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  demo: { alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  demoControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap', justifyContent: 'center' },
  info: { gap: 6, marginTop: spacing.md },
  description: { ...typography.subheading, color: colors.primary },
  steps: { gap: spacing.md },
  step: { flexDirection: 'row', gap: spacing.md },
  stepN: { ...typography.displayMD, color: colors.accent, width: 24 },
  label: { ...typography.label, color: colors.muted },
  bullet: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', paddingVertical: 2 },
  bulletText: { ...typography.body, color: colors.primary, flex: 1 },
  muscles: { flexDirection: 'row', gap: spacing.lg, alignItems: 'center' },
  progressions: { gap: spacing.sm },
  variant: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.sm },
  variantName: { ...typography.bodyBold, color: colors.primary },
});
