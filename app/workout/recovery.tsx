import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { getActiveSession } from '../../src/services/sessionService';
import { getWorkoutById } from '../../src/db/seed';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { colors, spacing, typography } from '../../src/theme';
import type { ActiveWorkoutState } from '../../src/domain/types';
import { restoreTimerFromElapsed } from '../../src/domain/timer';

export default function RecoveryScreen() {
  const router = useRouter();
  const { setSession, setTimer } = useWorkoutStore();
  const [info, setInfo] = React.useState<{ name: string; startedAgo: string; sessionId: string; state: ActiveWorkoutState; elapsed: number; status: string } | null>(null);

  useEffect(() => {
    (async () => {
      const session = await getActiveSession();
      if (!session) {
        router.replace('/');
        return;
      }
      const w = await getWorkoutById(session.workoutId);
      const state = JSON.parse(session.currentStateJson) as ActiveWorkoutState;
      const mins = session.startedAt ? Math.round((Date.now() - session.startedAt) / 60000) : 0;
      setInfo({
        name: w?.name ?? 'Workout',
        startedAgo: `${mins} min ago`,
        sessionId: session.id,
        state,
        elapsed: session.elapsedActiveMs,
        status: session.status,
      });
    })();
  }, []);

  if (!info) return <SafeAreaView style={styles.safe} />;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>WORKOUT IN PROGRESS</Text>
        <Text style={styles.name}>{info.name}</Text>
        <Text style={styles.sub}>Started {info.startedAgo}</Text>
        <Button title="RESUME" onPress={() => {
          setSession(info.sessionId, info.state, null);
          setTimer(restoreTimerFromElapsed(info.elapsed, info.status === 'paused'));
          router.replace('/workout/active');
        }} style={{ marginTop: spacing.xl }} />
        <Button title="END WORKOUT" variant="danger" onPress={async () => {
          const { completeSession } = await import('../../src/services/sessionService');
          await completeSession(info.sessionId, info.elapsed, false, true);
          router.replace('/(tabs)/today');
        }} style={{ marginTop: spacing.md }} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  title: { ...typography.label, color: colors.accent },
  name: { ...typography.displayLG, color: colors.primary, marginTop: spacing.md },
  sub: { ...typography.body, color: colors.muted, marginTop: spacing.sm },
});
