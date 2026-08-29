import React, { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Button } from '../../src/components/Button';
import { ExerciseVisual } from '../../src/components/ExerciseVisual';
import { RematchBar, TimerDisplay } from '../../src/components/RematchBar';
import { RaceRails } from '../../src/components/RaceRails';
import { getExercise, getProfile, getWorkoutById } from '../../src/db/seed';
import { advanceRep, getCurrentExercise, nextStep } from '../../src/engine/workoutEngine';
import { getLiveDelta, getOpponentProgress } from '../../src/domain/rematch';
import { getElapsedActiveMs, pauseTimer, resumeTimer, startTimer } from '../../src/domain/timer';
import { useWorkoutTimer } from '../../src/hooks/useWorkoutTimer';
import {
  addCheckpoint,
  appendEvent,
  completeSession,
  getCheckpoints,
  getSession,
  saveSessionState,
} from '../../src/services/sessionService';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { colors, spacing, typography, touchTarget } from '../../src/theme';
import { getCheckpointKey } from '../../src/engine/workoutEngine';

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { sessionId, state, timer, opponentSessionId, setState, setTimer, clear } = useWorkoutStore();
  const elapsed = useWorkoutTimer(timer, async (ms) => {
    if (!sessionId || !state || state.phase !== 'active') return;
    await saveSessionState(sessionId, state, {
      elapsedActiveMs: ms,
      pausedAccumulatedMs: timer.pausedAccumulatedMs,
      lastPausedAt: timer.lastPausedAt,
      status: 'active',
      startedAt: timer.startedAt,
    });
  });
  const opponentCheckpoints = useRef<{ checkpointKey: string; label: string; elapsedActiveMs: number }[]>([]);
  const opponentFinalMs = useRef(0);
  const [exerciseMeta, setExerciseMeta] = React.useState<any>(null);
  const [workoutName, setWorkoutName] = React.useState('');

  useEffect(() => {
    (async () => {
      const profile = await getProfile();
      if (profile?.keepAwakeEnabled) activateKeepAwakeAsync('rematch-workout');
      if (opponentSessionId) {
        const cps = await getCheckpoints(opponentSessionId);
        opponentCheckpoints.current = cps.map((c) => ({ checkpointKey: c.checkpointKey, label: c.label, elapsedActiveMs: c.elapsedActiveMs }));
        const session = await getSession(opponentSessionId);
        opponentFinalMs.current = session?.elapsedActiveMs ?? cps[cps.length - 1]?.elapsedActiveMs ?? 0;
      }
      if (state?.workoutId) {
        const w = await getWorkoutById(state.workoutId);
        setWorkoutName(w?.name ?? '');
      }
    })();
    return () => { deactivateKeepAwake('rematch-workout'); };
  }, []);

  useEffect(() => {
    (async () => {
      if (!state) return;
      const ex = getCurrentExercise(state);
      if (!ex) return;
      const meta = await getExercise(ex.scaledExerciseId);
      setExerciseMeta(meta);
    })();
  }, [state?.currentRoundIndex, state?.currentExerciseIndex]);

  useEffect(() => {
    if (!state || state.phase !== 'countdown') return;
    const t = setInterval(() => {
      if (state.countdownRemaining <= 0) {
        const started = startTimer(timer);
        setTimer(started);
        setState({ ...state, phase: 'active', countdownRemaining: 0 });
        if (sessionId) {
          appendEvent(sessionId, 'WorkoutStarted', {}, 0);
          saveSessionState(sessionId, { ...state, phase: 'active' }, { elapsedActiveMs: 0, pausedAccumulatedMs: 0, lastPausedAt: null, status: 'active', startedAt: Date.now() });
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      }
      setState({ ...state, countdownRemaining: state.countdownRemaining - 1 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 1000);
    return () => clearInterval(t);
  }, [state?.phase, state?.countdownRemaining]);

  if (!state || !sessionId) {
    router.replace('/');
    return null;
  }

  if (state.phase === 'countdown') {
    const display = state.countdownRemaining > 0 ? state.countdownRemaining : 'GO';
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.countdownWrap}>
          <Text style={styles.countdown}>{display}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (state.phase === 'paused') {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.pauseWrap}>
          <Text style={styles.pauseTitle}>PAUSED</Text>
          <TimerDisplay ms={elapsed} large />
          <Button title="Resume" onPress={async () => {
            const resumed = resumeTimer(timer);
            setTimer(resumed);
            const next = { ...state, phase: 'active' as const };
            setState(next);
            await appendEvent(sessionId, 'WorkoutResumed', {}, getElapsedActiveMs(resumed));
            await saveSessionState(sessionId, next, { elapsedActiveMs: getElapsedActiveMs(resumed), pausedAccumulatedMs: resumed.pausedAccumulatedMs, lastPausedAt: null, status: 'active', startedAt: resumed.startedAt });
          }} style={{ marginTop: spacing.lg }} />
          <Button title="End Workout" variant="danger" onPress={async () => {
            await completeSession(sessionId, elapsed, false, true);
            clear();
            router.replace('/(tabs)/today');
          }} style={{ marginTop: spacing.md }} />
        </View>
      </SafeAreaView>
    );
  }

  const current = getCurrentExercise(state);
  const round = state.rounds[state.currentRoundIndex];
  const delta = opponentSessionId
    ? getLiveDelta(elapsed, opponentCheckpoints.current, getCheckpointKey(state))
    : null;
  const youProgress = state.rounds.filter((r) => r.completed).length / state.rounds.length;
  const oppProgress = opponentSessionId
    ? getOpponentProgress(opponentCheckpoints.current, opponentFinalMs.current, elapsed)
    : 0;

  const handleNext = async () => {
    const { state: nextState, checkpoint } = nextStep(state);
    if (checkpoint) {
      await addCheckpoint(sessionId, checkpoint.key, checkpoint.label, elapsed);
      await appendEvent(sessionId, 'RoundCompleted', checkpoint, elapsed);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      await appendEvent(sessionId, 'ExerciseCompleted', { exerciseId: current?.scaledExerciseId }, elapsed);
    }
    if (nextState.phase === 'completed') {
      await appendEvent(sessionId, 'WorkoutCompleted', {}, elapsed);
      await completeSession(sessionId, elapsed, true);
      clear();
      router.replace({ pathname: '/workout/result', params: { sessionId, opponentSessionId: opponentSessionId ?? '' } });
      return;
    }
    setState(nextState);
    await saveSessionState(sessionId, nextState, { elapsedActiveMs: elapsed, pausedAccumulatedMs: timer.pausedAccumulatedMs, lastPausedAt: timer.lastPausedAt, status: 'active', startedAt: timer.startedAt });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.top}>
          <Text style={styles.workoutName}>{workoutName}</Text>
          <Pressable onPress={async () => {
            const paused = pauseTimer(timer);
            setTimer(paused);
            const next = { ...state, phase: 'paused' as const };
            setState(next);
            await appendEvent(sessionId, 'WorkoutPaused', {}, getElapsedActiveMs(paused));
            await saveSessionState(sessionId, next, { elapsedActiveMs: getElapsedActiveMs(paused), pausedAccumulatedMs: paused.pausedAccumulatedMs, lastPausedAt: paused.lastPausedAt, status: 'paused', startedAt: paused.startedAt });
          }} style={styles.pauseBtn} accessibilityLabel="Pause workout">
            <Text style={styles.pauseText}>PAUSE</Text>
          </Pressable>
        </View>

        <Text style={styles.round}>ROUND {round.roundNumber} / {state.rounds.length}</Text>
        <Text style={styles.exerciseName}>{exerciseMeta?.name ?? 'Exercise'}</Text>
        <Text style={styles.reps}>
          {current?.durationSec
            ? `${current.completedReps > 0 ? 'DONE' : `${current.durationSec}s`}`
            : `${current?.completedReps ?? 0} / ${current?.targetReps ?? 0}`}
        </Text>

        <View style={styles.visual}>
          <ExerciseVisual exerciseId={current?.scaledExerciseId ?? 'push-up'} category={exerciseMeta?.category} size={180} />
        </View>

        {!current?.durationSec && (
          <View style={styles.repControls}>
            <Pressable style={styles.repBtn} onPress={() => setState(advanceRep(state, -1))} accessibilityLabel="Decrease reps">
              <Text style={styles.repBtnText}>−</Text>
            </Pressable>
            <Text style={styles.repCount}>{current?.completedReps ?? 0}</Text>
            <Pressable style={styles.repBtn} onPress={() => setState(advanceRep(state, 1))} accessibilityLabel="Increase reps">
              <Text style={styles.repBtnText}>+</Text>
            </Pressable>
          </View>
        )}

        <View style={styles.bottom}>
          <TimerDisplay ms={elapsed} large />
          {opponentSessionId && <RematchBar deltaMs={delta} />}
          {opponentSessionId && <RaceRails youProgress={youProgress} opponentProgress={oppProgress} />}
          <Button title="NEXT" onPress={handleNext} style={styles.nextBtn} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.md },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  workoutName: { ...typography.subheading, color: colors.muted },
  pauseBtn: { padding: spacing.sm },
  pauseText: { ...typography.label, color: colors.muted },
  round: { ...typography.label, color: colors.accent, marginTop: spacing.sm },
  exerciseName: { ...typography.displayLG, color: colors.primary, marginTop: spacing.xs },
  reps: { ...typography.displayMD, color: colors.primary },
  visual: { alignItems: 'center', marginVertical: spacing.md },
  repControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: spacing.lg },
  repBtn: { width: touchTarget + 16, height: touchTarget + 16, borderRadius: 999, backgroundColor: colors.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  repBtnText: { fontSize: 36, color: colors.primary, fontFamily: 'BebasNeue' },
  repCount: { ...typography.displayMD, color: colors.primary, minWidth: 60, textAlign: 'center' },
  bottom: { marginTop: 'auto', gap: spacing.md, paddingBottom: spacing.md },
  nextBtn: { minHeight: 60 },
  countdownWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  countdown: { ...typography.displayXL, fontSize: 120, color: colors.accent },
  pauseWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  pauseTitle: { ...typography.displayMD, color: colors.primary, marginBottom: spacing.lg },
});
