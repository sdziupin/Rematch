import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ExerciseRow } from '../db/schema';
import type { WorkoutExerciseStep, WorkoutStructure } from '../domain/types';
import { describeStructure } from '../engine/workoutEngine';
import { colors, fonts, radius, spacing, typography } from '../theme';
import { ExerciseAnimation } from './ExerciseAnimation';
import { Icon } from './Icon';

interface Props {
  structure: WorkoutStructure;
  exercises: Map<string, ExerciseRow>;
  swaps?: Record<string, string>;
  onExercisePress?: (exerciseId: string) => void;
}

function stepText(step: WorkoutExerciseStep, structure: WorkoutStructure): string {
  if (structure.format === 'intervals') return `${structure.intervalWorkSec ?? step.durationSec ?? 30}s`;
  if (step.durationSec) return `${step.durationSec}s`;
  return `${step.reps ?? 0}`;
}

function StepRow({ step, structure, exercises, swaps, onPress }: { step: WorkoutExerciseStep; structure: WorkoutStructure; exercises: Map<string, ExerciseRow>; swaps?: Record<string, string>; onPress?: (id: string) => void }) {
  const id = swaps?.[step.exerciseId] ?? step.exerciseId;
  const ex = exercises.get(id);
  const swapped = id !== step.exerciseId;
  return (
    <Pressable
      onPress={onPress ? () => onPress(id) : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${stepText(step, structure)} ${ex?.name ?? id}`}
      style={(s) => [styles.step, (s as { hovered?: boolean }).hovered && styles.stepHover]}
    >
      <ExerciseAnimation exerciseId={id} category={ex?.category} size={48} playing={false} />
      <Text style={styles.amount}>{stepText(step, structure)}</Text>
      <View style={styles.flex}>
        <Text style={styles.name} numberOfLines={1}>
          {ex?.name ?? id}
        </Text>
        {swapped && <Text style={styles.swapped}>scaled from {exercises.get(step.exerciseId)?.name ?? step.exerciseId}</Text>}
      </View>
      {onPress && <Icon name="forward" size={16} color={colors.textMuted} />}
    </Pressable>
  );
}

/** Readable breakdown of a workout's structure. */
export function StructurePreview({ structure, exercises, swaps, onExercisePress }: Props) {
  const rounds = structure.rounds;
  const identical = rounds.length > 1 && rounds.every((r) => JSON.stringify(r.steps) === JSON.stringify(rounds[0].steps));
  const row = (step: WorkoutExerciseStep, key: string) => (
    <StepRow key={key} step={step} structure={structure} exercises={exercises} swaps={swaps} onPress={onExercisePress} />
  );

  let body: React.ReactNode;
  if (structure.format === 'intervals') {
    const steps = rounds.flatMap((r) => r.steps);
    body = (
      <>
        <Text style={styles.groupTitle}>Cycle through, one movement per interval</Text>
        {steps.map((s, i) => row(s, `i${i}`))}
      </>
    );
  } else if (identical || rounds.length === 1) {
    body = (
      <>
        {rounds.length > 1 && <Text style={styles.groupTitle}>{rounds.length} rounds of</Text>}
        {structure.format === 'emom' && <Text style={styles.groupTitle}>Every minute</Text>}
        {structure.format === 'amrap' && <Text style={styles.groupTitle}>As many rounds as possible of</Text>}
        {rounds[0]?.steps.map((s, i) => row(s, `s${i}`))}
      </>
    );
  } else {
    body = rounds.map((r) => (
      <View key={r.roundNumber} style={styles.group}>
        <Text style={styles.groupTitle}>
          {structure.format === 'emom' ? `Minute ${r.roundNumber}` : structure.format === 'ladder' ? `Rung ${r.roundNumber}` : `Round ${r.roundNumber}`}
        </Text>
        {r.steps.map((s, i) => row(s, `${r.roundNumber}-${i}`))}
      </View>
    ));
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.summary}>{describeStructure(structure)}</Text>
      <View style={styles.list}>{body}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm + 4 },
  list: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, paddingVertical: 6, overflow: 'hidden' },
  flex: { flex: 1 },
  summary: { ...typography.callout, color: colors.textSecondary },
  group: { marginBottom: 2 },
  groupTitle: { ...typography.overline, color: colors.textMuted, paddingHorizontal: spacing.md, paddingTop: spacing.sm + 4, paddingBottom: 6 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 6, paddingHorizontal: 10 },
  stepHover: { backgroundColor: colors.surfaceRaised },
  amount: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22, letterSpacing: -0.3, color: colors.text, minWidth: 40, textAlign: 'right', fontVariant: ['tabular-nums'] },
  name: { ...typography.callout, color: colors.text },
  swapped: { ...typography.caption, color: colors.behind },
});
