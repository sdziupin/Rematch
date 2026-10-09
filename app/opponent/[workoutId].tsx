import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { confirmAction, showToast } from '../../src/components/Dialogs';
import { EmptyState, Pill, Screen, ScreenHeader } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { loadWorkoutPlan } from '../../src/db/repository';
import type { PartialKey, ScalingCategory } from '../../src/domain/types';
import { formatScore, relativeDay } from '../../src/domain/utils';
import { listOpponents } from '../../src/services/sessionService';
import { beginWorkout, resolveDanglingSession } from '../../src/services/startWorkout';
import { colors, fonts, radius, spacing, typography } from '../../src/theme';

type Opponent = Awaited<ReturnType<typeof listOpponents>>[number];

export default function OpponentScreen() {
  const params = useLocalSearchParams<{ workoutId: string; variant?: string; scaling?: string; swaps?: string; program?: string; key?: string }>();
  const router = useRouter();
  const partialKey = (params.variant ?? 'full') as PartialKey;
  const scaling = (params.scaling ?? 'rx') as ScalingCategory;
  const [name, setName] = useState('');
  const [attempts, setAttempts] = useState<Opponent[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const plan = await loadWorkoutPlan(params.workoutId, partialKey);
      if (!plan) return setAttempts([]);
      setName(plan.workout.name);
      setAttempts(await listOpponents({ workoutId: plan.workout.id, workoutVersionId: plan.version.id, workoutVariantId: plan.variant.id, scalingCategory: scaling }));
    })();
  }, [params.workoutId, partialKey, scaling]);

  const rematch = async (opponentSessionId: string) => {
    if (busy) return;
    setBusy(true);
    try {
      const proceed = await resolveDanglingSession((name) =>
        confirmAction({
          title: `${name} is still in progress`,
          message: 'Starting a new workout ends it. What you did is kept as an unfinished result.',
          confirmLabel: 'Start new',
        }),
      );
      if (!proceed) {
        setBusy(false);
        return;
      }
      let swaps: Record<string, string> = {};
      try {
        swaps = params.swaps ? (JSON.parse(params.swaps) as Record<string, string>) : {};
      } catch {
        swaps = {};
      }
      await beginWorkout({
        workoutId: params.workoutId,
        partialKey,
        scalingCategory: scaling,
        swaps,
        opponentSessionId,
        programEnrollmentId: params.program ?? null,
        programSessionKey: params.key ?? null,
      });
      router.replace('/workout/active');
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not start.', { tone: 'error' });
      setBusy(false);
    }
  };

  return (
    <Screen narrow>
      <ScreenHeader title="Choose your opponent" subtitle={`${name} · every attempt you've finished can race you`} onBack={() => router.back()} />
      {attempts && attempts.length === 0 && <EmptyState icon="trophy" title="No finished attempts yet" body="Finish this workout once and it becomes your first opponent." />}
      <View style={attempts?.length ? styles.list : null}>
        {attempts?.map((a, i) => (
          <Pressable
            key={a.id}
            onPress={() => rematch(a.sessionId)}
            style={(st) => [styles.row, i > 0 && styles.divider, (st as { hovered?: boolean }).hovered && styles.hover]}
            accessibilityRole="button"
            accessibilityLabel={`Rematch attempt ${a.attemptNumber}, ${formatScore(a)}`}
          >
            <View style={styles.flex}>
              <View style={styles.titleRow}>
                <Text style={styles.score}>{formatScore(a)}</Text>
                {a.isPb && <Pill label="PB" color={colors.pb} />}
                {a.timeCapped && <Pill label="Capped" color={colors.behind} />}
              </View>
              <Text style={styles.meta}>
                Attempt {a.attemptNumber} · {relativeDay(a.createdAt)}
              </Text>
            </View>
            <Text style={styles.action}>Race</Text>
            <Icon name="forward" size={16} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, paddingVertical: 14, paddingHorizontal: spacing.md + 2 },
  divider: { borderTopWidth: 1, borderTopColor: colors.border },
  hover: { backgroundColor: colors.surfaceRaised },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  score: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.5, color: colors.text, fontVariant: ['tabular-nums'] },
  meta: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  action: { ...typography.callout, fontFamily: fonts.semibold, color: colors.accent },
});
