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
    if (!state || state.phase !== 'countdown' || !sessionId) return;
    const t = setInterval(() => {
      const current = useWorkoutStore.getState().state;
      const currentTimer = useWorkoutStore.getState().timer;
      if (!current || current.phase !== 'countdown') return;
      if (current.countdownRemaining <= 0) {
        const started = startTimer(currentTimer);
        setTimer(started);
        const next = { ...current, phase: 'active' as const, countdownRemaining: 0 };
        setState(next);
        appendEvent(sessionId, 'WorkoutStarted', {}, 0);
        saveSessionState(sessionId, next, { elapsedActiveMs: 0, pausedAccumulatedMs: 0, lastPausedAt: null, status: 'active', startedAt: Date.now() });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        return;
      }
      setState({ ...current, countdownRemaining: current.countdownRemaining - 1 });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }, 1000);
    return () => clearInterval(t);
  }, [state?.phase, sessionId]);

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
