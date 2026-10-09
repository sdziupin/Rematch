import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button } from '../../src/components/Button';
import { confirmAction } from '../../src/components/Dialogs';
import { Card, Screen } from '../../src/components/ui';
import { getWorkoutById } from '../../src/db/repository';
import { restoreTimerFromElapsed } from '../../src/domain/timer';
import type { ActiveWorkoutState } from '../../src/domain/types';
import { formatDuration, relativeDay } from '../../src/domain/utils';
import { normalizeState } from '../../src/engine/workoutEngine';
import { abandonSession, finishSession, getActiveSession, getCheckpoints } from '../../src/services/sessionService';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { colors, spacing, typography } from '../../src/theme';

interface Pending {
  sessionId: string;
  name: string;
  updatedAt: number;
  elapsed: number;
  state: ActiveWorkoutState;
  opponentSessionId: string | null;
}

export default function RecoveryScreen() {
  const router = useRouter();
  const [info, setInfo] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const session = await getActiveSession();
      if (!session) {
        router.replace('/today');
        return;
      }
      const w = await getWorkoutById(session.workoutId);
      setInfo({
        sessionId: session.id,
        name: w?.name ?? 'Workout',
        updatedAt: session.updatedAt,
        elapsed: session.elapsedActiveMs,
        state: normalizeState(JSON.parse(session.currentStateJson) as ActiveWorkoutState),
        opponentSessionId: session.opponentSessionId,
      });
    })().catch(() => router.replace('/today'));
  }, [router]);

  if (!info) return <Screen>{null}</Screen>;

  const resume = async () => {
    setBusy(true);
    let state = info.state;
    if (state.phase === 'completed') {
      // The app closed between the last movement and saving the result.
      await finishSession(info.sessionId, state, info.elapsed);
      router.replace({ pathname: '/workout/result', params: { sessionId: info.sessionId, fresh: '1' } });
      return;
    }
    // Resume paused: the athlete decides when the clock runs again.
    if (state.phase === 'active' || state.phase === 'rest') state = { ...state, phase: 'paused', resumePhase: state.phase };
    const paused = state.phase === 'paused';
    const checkpoints = await getCheckpoints(info.sessionId);
    const timer = state.phase === 'countdown' ? undefined : restoreTimerFromElapsed(info.elapsed, paused);
    useWorkoutStore.getState().setSession(info.sessionId, state, info.opponentSessionId, timer, checkpoints);
    router.replace('/workout/active');
  };

  const end = async () => {
    const ok = await confirmAction({ title: 'End this workout?', message: 'It will be saved as unfinished.', confirmLabel: 'End workout', destructive: true });
    if (!ok) return;
    setBusy(true);
    await abandonSession(info.sessionId, info.state, info.elapsed);
    router.replace('/today');
  };

  return (
    <Screen narrow scroll={false} contentStyle={styles.center}>
      <Card style={styles.card}>
        <Text style={styles.kicker}>WORKOUT IN PROGRESS</Text>
        <Text style={styles.name}>{info.name}</Text>
        <Text style={styles.sub}>
          {formatDuration(info.elapsed)} done · last active {relativeDay(info.updatedAt).toLowerCase()}
          {info.opponentSessionId ? ' · rematch' : ''}
        </Text>
        <View style={styles.actions}>
          <Button title="RESUME" icon="play" size="lg" onPress={resume} loading={busy} />
          <Button title="End workout" variant="ghost" icon="flag" onPress={end} disabled={busy} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { justifyContent: 'center' },
  card: { padding: spacing.xl, gap: spacing.sm },
  kicker: { ...typography.label, color: colors.accent },
  name: { ...typography.displayLG, color: colors.primary },
  sub: { ...typography.body, color: colors.secondary },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
});
