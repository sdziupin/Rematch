import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { confirmAction, showToast } from '../../src/components/Dialogs';
import { Card, EmptyState, Pill, Screen, ScreenHeader } from '../../src/components/ui';
import { Icon } from '../../src/components/Icon';
import { loadWorkoutPlan } from '../../src/db/repository';
import type { PartialKey, ScalingCategory } from '../../src/domain/types';
import { formatScore, relativeDay } from '../../src/domain/utils';
import { listOpponents } from '../../src/services/sessionService';
import { beginWorkout, resolveDanglingSession } from '../../src/services/startWorkout';
import { colors, spacing, typography } from '../../src/theme';

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
      <View style={styles.list}>
        {attempts?.map((a) => (
          <Card key={a.id} onPress={() => rematch(a.sessionId)} style={styles.row} accessibilityLabel={`Rematch attempt ${a.attemptNumber}, ${formatScore(a)}`}>
            <View style={styles.flex}>
              <View style={styles.titleRow}>
                <Text style={styles.score}>{formatScore(a)}</Text>
                {a.isPb && <Pill label="PB" color={colors.pb} />}
                {a.timeCapped && <Pill label="CAPPED" color={colors.behind} />}
              </View>
              <Text style={styles.meta}>
                Attempt {a.attemptNumber} · {relativeDay(a.createdAt)}
              </Text>
            </View>
            <Text style={styles.action}>RACE</Text>
            <Icon name="forward" color={colors.accent} />
          </Card>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  list: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  score: { ...typography.heading, color: colors.primary, fontVariant: ['tabular-nums'] },
  meta: { ...typography.caption, color: colors.secondary },
  action: { ...typography.label, color: colors.accent },
});
