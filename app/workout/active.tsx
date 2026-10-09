import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { Redirect, useNavigation, useRouter, type Href } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { SafeAreaView } from 'react-native-safe-area-context';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Button, IconButton } from '../../src/components/Button';
import { ExerciseAnimation } from '../../src/components/ExerciseAnimation';
import { RematchBar, TimerDisplay } from '../../src/components/RematchBar';
import { RaceRails } from '../../src/components/RaceRails';
import { ProgressRing } from '../../src/components/charts';
import { confirmAction, isConfirmOpen } from '../../src/components/Dialogs';
import { Icon } from '../../src/components/Icon';
import { getExercisesByIds, getWorkoutById } from '../../src/db/repository';
import type { ExerciseRow } from '../../src/db/schema';
import { getLiveRace, getOpponentProgress, opponentRepsAt, type OpponentCheckpoint } from '../../src/domain/rematch';
import { getElapsedActiveMs, pauseTimer, resumeTimer, startTimer } from '../../src/domain/timer';
import type { ActiveWorkoutState } from '../../src/domain/types';
import { formatCountdown, formatDuration, formatRoundsAndReps } from '../../src/domain/utils';
import {
  advanceRep,
  canCompleteManually,
  capRemainingMs,
  completeStep,
  completedStepCount,
  extendRest,
  formatLabel,
  getCheckpointKey,
  getCurrentExercise,
  getCurrentRound,
  liveReps,
  pauseState,
  restRemainingMs,
  resumeState,
  skipRest,
  startWorkout,
  stepRemainingMs,
  stepsPerPass,
  swapExercise,
  tick,
  windowRemainingMs,
  type EngineEvent,
  type EngineResult,
} from '../../src/engine/workoutEngine';
import { useLayout } from '../../src/hooks/useLayout';
import { haptic, playSound, prepareAudio, speak, stopSpeaking } from '../../src/services/cues';
import {
  abandonSession,
  appendEvent,
  finishSession,
  getCheckpoints,
  getResultBySession,
  recordEngineEvents,
  saveSessionState,
} from '../../src/services/sessionService';
import { useSettings } from '../../src/store/settingsStore';
import { useWorkoutStore } from '../../src/store/workoutStore';
import { colors, spacing, typography, withAlpha } from '../../src/theme';

const TICK_MS = 200;
const SAVE_EVERY_MS = 5000;

type Meta = Map<string, ExerciseRow>;

function describeTarget(ex: ActiveWorkoutState['rounds'][number]['exercises'][number] | undefined, scoring: string | undefined): string {
  if (!ex) return '';
  if (ex.durationSec) return scoring === 'reps' && !ex.targetReps ? `${ex.durationSec}s · max reps` : `${ex.durationSec} seconds`;
  return `${ex.targetReps} reps`;
}

function spokenStep(ex: ActiveWorkoutState['rounds'][number]['exercises'][number] | undefined, meta: Meta): string {
  if (!ex) return '';
  const name = meta.get(ex.scaledExerciseId)?.name ?? ex.scaledExerciseId.replace(/-/g, ' ');
  return ex.durationSec ? `${name}, ${ex.durationSec} seconds` : `${ex.targetReps} ${name}`;
}

export default function ActiveWorkoutScreen() {
  const router = useRouter();
  const { isWide, gutter } = useLayout();
  const sessionId = useWorkoutStore((s) => s.sessionId);
  const state = useWorkoutStore((s) => s.state);
  const timer = useWorkoutStore((s) => s.timer);
  const opponentSessionId = useWorkoutStore((s) => s.opponentSessionId);
  const yourCheckpoints = useWorkoutStore((s) => s.yourCheckpoints);
  const keepAwake = useSettings((s) => s.keepAwake);

  const [now, setNow] = useState(Date.now());
  const [meta, setMeta] = useState<Meta>(new Map());
  const [workoutName, setWorkoutName] = useState('');
  const [opponent, setOpponent] = useState<{ checkpoints: OpponentCheckpoint[]; finalMs: number; finalReps: number } | null>(null);
  const navigation = useNavigation();
  const finishing = useRef(false);
  const lastSave = useRef(0);
  const lastBeep = useRef<string>('');
  const flash = useRef(new Animated.Value(0)).current;
  /** Set when the screen leaves on purpose; navigation happens in an effect so the leave guard is already off. */
  const [exitTo, setExitTo] = useState<Href | null>(null);

  const elapsed = getElapsedActiveMs(timer, now);

  // ---------------------------------------------------------------- setup
  useEffect(() => {
    void prepareAudio();
    let awake = false;
    let disposed = false;
    const release = () => deactivateKeepAwake('rematch-workout').catch(() => undefined);
    if (keepAwake) {
      activateKeepAwakeAsync('rematch-workout')
        .then(() => {
          awake = true;
          // The screen went away before the lock arrived: give it straight back.
          if (disposed) void release();
        })
        .catch(() => undefined);
    }
    return () => {
      disposed = true;
      stopSpeaking();
      // Only release a lock we actually hold (the web API rejects otherwise).
      if (awake) void release();
    };
  }, [keepAwake]);

  useEffect(() => {
    const s = useWorkoutStore.getState().state;
    if (!s) return;
    const ids = new Set<string>();
    for (const r of s.rounds) for (const e of r.exercises) ids.add(e.scaledExerciseId).add(e.exerciseId);
    getExercisesByIds([...ids]).then((m) => {
      // Easier variants, for the "make it easier" option.
      const easier = [...m.values()].map((e) => e.easierVariantId).filter((x): x is string => !!x && !m.has(x));
      return easier.length ? getExercisesByIds(easier).then((extra) => setMeta(new Map([...m, ...extra]))) : setMeta(m);
    });
    getWorkoutById(s.workoutId).then((w) => setWorkoutName(w?.name ?? ''));
  }, [sessionId]);

  useEffect(() => {
    if (!opponentSessionId) {
      setOpponent(null);
      return;
    }
    Promise.all([getCheckpoints(opponentSessionId), getResultBySession(opponentSessionId)]).then(([checkpoints, result]) =>
      setOpponent({ checkpoints, finalMs: result?.completionMs ?? checkpoints[checkpoints.length - 1]?.elapsedActiveMs ?? 0, finalReps: result?.scoreReps ?? result?.totalReps ?? 0 }),
    );
  }, [opponentSessionId]);

  // ---------------------------------------------------------------- persistence + cues
  const persist = useCallback((s: ActiveWorkoutState, force = false) => {
    const { sessionId: id, timer: t } = useWorkoutStore.getState();
    // Once finishing starts, the result transaction owns the session row.
    if (!id || finishing.current || s.phase === 'completed') return;
    const at = Date.now();
    if (!force && at - lastSave.current < SAVE_EVERY_MS) return;
    lastSave.current = at;
    void saveSessionState(id, s, {
      elapsedActiveMs: getElapsedActiveMs(t, at),
      pausedAccumulatedMs: t.pausedAccumulatedMs,
      lastPausedAt: t.lastPausedAt,
      status: s.phase === 'paused' ? 'paused' : s.phase === 'countdown' ? 'countdown' : 'active',
      startedAt: t.startedAt,
    }).catch(() => undefined);
  }, []);

  const finish = useCallback(
    async (s: ActiveWorkoutState, atMs: number) => {
      if (finishing.current) return;
      finishing.current = true;
      const id = useWorkoutStore.getState().sessionId;
      if (!id) return;
      try {
        const outcome = await finishSession(id, s, atMs);
        playSound(outcome.isNewPb ? 'pb' : 'finish');
        haptic('success');
        speak(outcome.isNewPb ? 'New personal best!' : 'Workout complete.');
      } catch (error) {
        console.error('[rematch] finish failed', error);
      }
      setExitTo({ pathname: '/workout/result', params: { sessionId: id, fresh: '1' } });
    },
    [],
  );

  const pulse = useCallback(() => {
    // A visual cue for loud gyms and muted phones.
    flash.setValue(0.35);
    Animated.timing(flash, { toValue: 0, duration: 450, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [flash]);

  const cues = useCallback(
    (events: EngineEvent[], s: ActiveWorkoutState) => {
      if (events.some((e) => e.type === 'RestEnded' || e.type === 'RestStarted' || (e.type === 'Checkpoint' && e.kind === 'round'))) pulse();
      for (const e of events) {
        if (e.type === 'Checkpoint' && e.kind === 'round') {
          playSound('done');
          haptic('success');
        } else if (e.type === 'Checkpoint' && e.kind === 'step') {
          haptic('medium');
        } else if (e.type === 'RestStarted') {
          playSound('rest');
          const next = s.rounds[Math.min(s.currentRoundIndex + 1, s.rounds.length - 1)]?.exercises[0];
          speak(`Rest. Next, ${spokenStep(next, meta)}`);
        } else if (e.type === 'RestEnded') {
          playSound('go');
        } else if (e.type === 'StepStarted' && s.phase === 'active') {
          speak(spokenStep(getCurrentExercise(s), meta));
        } else if (e.type === 'TimeCapReached') {
          haptic('warning');
        }
      }
    },
    [meta, pulse],
  );

  const apply = useCallback(
    (r: EngineResult) => {
      const id = useWorkoutStore.getState().sessionId;
      if (!id || finishing.current) return;
      useWorkoutStore.getState().setState(r.state);
      if (r.events.length) {
        const cps = r.events.flatMap((e) =>
          e.type === 'Checkpoint' && e.kind !== 'cap' ? [{ checkpointKey: e.key, label: e.label, elapsedActiveMs: e.atMs, reps: e.reps }] : [],
        );
        if (cps.length) useWorkoutStore.getState().addCheckpoints(cps);
        void recordEngineEvents(id, r.events).catch((err) => console.error('[rematch] telemetry write failed', err));
        cues(r.events, r.state);
      }
      const done = r.events.find((e) => e.type === 'WorkoutCompleted');
      if (r.state.phase === 'completed' && done) {
        void finish(r.state, done.atMs);
        return;
      }
      persist(r.state, r.events.length > 0);
    },
    [cues, finish, persist],
  );

  const applyRef = useRef(apply);
  applyRef.current = apply;
  const persistRef = useRef(persist);
  persistRef.current = persist;

  // ---------------------------------------------------------------- clock
  useEffect(() => {
    const id = setInterval(() => {
      const at = Date.now();
      setNow(at);
      const { state: s, timer: t } = useWorkoutStore.getState();
      if (!s || finishing.current) return;
      if (s.phase === 'active' || s.phase === 'rest') {
        const el = getElapsedActiveMs(t, at);
        const r = tick(s, el);
        if (r.state !== s) applyRef.current(r);
        if (finishing.current) return;
        // 3-2-1 beeps before a timed step, rest or window ends.
        const remaining = r.state.phase === 'rest' ? restRemainingMs(r.state, el) : stepRemainingMs(r.state, el) ?? windowRemainingMs(r.state, el);
        if (remaining !== null && remaining > 0 && remaining <= 3000) {
          const key = `${r.state.phase}-${r.state.currentRoundIndex}-${r.state.currentExerciseIndex}-${Math.ceil(remaining / 1000)}`;
          if (key !== lastBeep.current) {
            lastBeep.current = key;
            playSound('tick');
            haptic('light');
          }
        }
        persistRef.current(r.state);
      }
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // Countdown: one step per second, then GO.
  useEffect(() => {
    if (!state || state.phase !== 'countdown' || !sessionId) return;
    const t = setInterval(() => {
      const current = useWorkoutStore.getState().state;
      if (!current || current.phase !== 'countdown') return;
      if (current.countdownRemaining <= 1) {
        const started = startTimer(useWorkoutStore.getState().timer);
        useWorkoutStore.getState().setTimer(started);
        playSound('go');
        haptic('heavy');
        void appendEvent(sessionId, 'WorkoutStarted', {}, 0);
        applyRef.current(startWorkout(current, 0));
        return;
      }
      useWorkoutStore.getState().setState({ ...current, countdownRemaining: current.countdownRemaining - 1 });
      playSound('tick');
      haptic('light');
    }, 1000);
    playSound('tick');
    return () => clearInterval(t);
  }, [state?.phase, sessionId]);

  // ---------------------------------------------------------------- actions
  const onDone = useCallback(() => {
    const { state: s, timer: t } = useWorkoutStore.getState();
    if (!s || finishing.current || !canCompleteManually(s)) return;
    apply(completeStep(s, getElapsedActiveMs(t)));
  }, [apply]);

  const onRep = useCallback((delta: number) => {
    const s = useWorkoutStore.getState().state;
    if (!s || finishing.current || (s.phase !== 'active' && s.phase !== 'rest')) return;
    const next = advanceRep(s, delta);
    if (next !== s) {
      useWorkoutStore.getState().setState(next);
      haptic('light');
    }
  }, []);

  const onSkipRest = useCallback(() => {
    const { state: s, timer: t } = useWorkoutStore.getState();
    if (!s || finishing.current || s.phase !== 'rest') return;
    apply(skipRest(s, getElapsedActiveMs(t)));
  }, [apply]);

  const onExtendRest = useCallback(() => {
    const { state: s, timer: t } = useWorkoutStore.getState();
    if (!s || finishing.current) return;
    // If the rest already ran out, that boundary wins over the tap.
    const due = tick(s, getElapsedActiveMs(t));
    if (due.events.length > 0) {
      apply(due);
      return;
    }
    const next = extendRest(s, 15);
    useWorkoutStore.getState().setState(next);
    persist(next, true);
  }, [apply, persist]);

  const onPause = useCallback(() => {
    const { state: s, timer: t, sessionId: id } = useWorkoutStore.getState();
    if (!s || !id || finishing.current || (s.phase !== 'active' && s.phase !== 'rest')) return;
    const paused = pauseTimer(t);
    useWorkoutStore.getState().setTimer(paused);
    const next = pauseState(s);
    useWorkoutStore.getState().setState(next);
    stopSpeaking();
    void appendEvent(id, 'WorkoutPaused', {}, getElapsedActiveMs(paused));
    persist(next, true);
  }, [persist]);

  const onResume = useCallback(() => {
    const { state: s, timer: t, sessionId: id } = useWorkoutStore.getState();
    if (!s || !id || finishing.current || s.phase !== 'paused') return;
    const resumed = resumeTimer(t);
    useWorkoutStore.getState().setTimer(resumed);
    const next = resumeState(s);
    useWorkoutStore.getState().setState(next);
    playSound('go');
    void appendEvent(id, 'WorkoutResumed', {}, getElapsedActiveMs(resumed));
    persist(next, true);
  }, [persist]);

  const onEnd = useCallback(async () => {
    const ok = await confirmAction({
      title: 'End this workout?',
      message: 'It will be saved as unfinished and won’t count as a personal best.',
      confirmLabel: 'End workout',
      destructive: true,
    });
    if (!ok) return;
    const { state: s, timer: t, sessionId: id } = useWorkoutStore.getState();
    finishing.current = true;
    if (id) await abandonSession(id, s, getElapsedActiveMs(t)).catch(() => undefined);
    setExitTo('/today');
  }, []);

  const onEasier = useCallback(() => {
    const { state: s, sessionId: id, timer: t } = useWorkoutStore.getState();
    const ex = s ? getCurrentExercise(s) : undefined;
    if (!s || !ex || !id || ex.done || finishing.current) return;
    const current = meta.get(ex.scaledExerciseId);
    const easierId = current?.easierVariantId;
    if (!easierId) return;
    const category = ex.scaledExerciseId === ex.exerciseId ? 'scaled' : 'modified';
    const next = swapExercise(s, ex.exerciseId, easierId, category);
    useWorkoutStore.getState().setState(next);
    void appendEvent(id, 'ExerciseScaled', { from: ex.scaledExerciseId, to: easierId, category }, getElapsedActiveMs(t));
    persist(next, true);
  }, [meta, persist]);

  // Guard against leaving mid-workout (Android back, browser back, swipe).
  const live = !!state && state.phase !== 'completed';
  usePreventRemove(live && !exitTo, ({ data }) => {
    onPause();
    void confirmAction({
      title: 'Leave the workout?',
      message: 'It stays paused and you can resume it from the home screen.',
      confirmLabel: 'Leave',
      cancelLabel: 'Stay',
    }).then((ok) => {
      if (ok) navigation.dispatch(data.action);
    });
  });

  useEffect(() => {
    if (!exitTo) return;
    router.replace(exitTo);
    // With exitTo set this screen renders a blank view, so clearing now can't trigger its redirect.
    useWorkoutStore.getState().clear();
  }, [exitTo, router]);

  // Keyboard shortcuts on the web.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const handler = (e: KeyboardEvent) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
      // Dialogs own the keyboard while open; holding a key must not fire repeatedly.
      if (isConfirmOpen() || e.repeat) return;
      const s = useWorkoutStore.getState().state;
      if (!s) return;
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (s.phase === 'rest') onSkipRest();
        else if (s.phase === 'paused') onResume();
        else onDone();
      } else if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') {
        e.preventDefault();
        onRep(1);
      } else if (e.key === 'ArrowDown' || e.key === '-') {
        e.preventDefault();
        onRep(-1);
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (s.phase === 'paused') onResume();
        else onPause();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onDone, onRep, onSkipRest, onPause, onResume]);

  // ---------------------------------------------------------------- derived view data
  const race = useMemo(() => {
    if (!opponent || !state) return null;
    return getLiveRace(state.raceMode ?? 'pace', elapsed, yourCheckpoints, opponent.checkpoints, getCheckpointKey(state));
  }, [opponent, state, elapsed, yourCheckpoints]);

  if (!state || !sessionId) return exitTo ? <View style={styles.safe} /> : <Redirect href="/today" />;

  const ex = getCurrentExercise(state);
  const exMeta = ex ? meta.get(ex.scaledExerciseId) : undefined;
  const round = getCurrentRound(state);
  const isAmrap = state.structure.format === 'amrap';
  const totalSteps = stepsPerPass(state);
  const doneSteps = completedStepCount(state);
  const reps = liveReps(state);
  const lastRoundReps = [...yourCheckpoints].reverse().find((c) => c.checkpointKey.startsWith('round-'))?.reps ?? 0;

  let youProgress = 0;
  let oppProgress = 0;
  if (opponent) {
    if (state.raceMode === 'volume' || isAmrap) {
      const target = Math.max(opponent.finalReps, reps, 1);
      youProgress = reps / target;
      oppProgress = opponentRepsAt(opponent.checkpoints, elapsed) / target;
    } else {
      youProgress = doneSteps / Math.max(1, totalSteps);
      oppProgress = getOpponentProgress(opponent.checkpoints, opponent.finalMs, elapsed, totalSteps, state.rounds.length);
    }
  }

  // ---------------------------------------------------------------- countdown
  if (state.phase === 'countdown') {
    const first = state.rounds[0]?.exercises[0];
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.countdownWrap}>
          <Text style={styles.kicker}>{workoutName}</Text>
          <ProgressRing progress={state.countdownRemaining / Math.max(1, useSettings.getState().countdownSec)} size={220} stroke={10}>
            <Text style={styles.countdown}>{state.countdownRemaining > 0 ? state.countdownRemaining : 'GO'}</Text>
          </ProgressRing>
          {first && (
            <View style={styles.upFirst}>
              <ExerciseAnimation exerciseId={first.scaledExerciseId} category={meta.get(first.scaledExerciseId)?.category} size={96} />
              <View>
                <Text style={styles.label}>UP FIRST</Text>
                <Text style={styles.upFirstName}>{meta.get(first.scaledExerciseId)?.name ?? first.scaledExerciseId}</Text>
                <Text style={styles.secondary}>{describeTarget(first, state.scoring)}</Text>
              </View>
            </View>
          )}
          {opponentSessionId ? <Text style={styles.secondary}>Racing your past self. Splits are recorded at every movement.</Text> : null}
        </View>
      </SafeAreaView>
    );
  }

  // ---------------------------------------------------------------- shared pieces
  const capLeft = capRemainingMs(state, elapsed);
  const windowLeft = windowRemainingMs(state, elapsed);
  const stepLeft = stepRemainingMs(state, elapsed);
  const restLeft = restRemainingMs(state, elapsed);
  const nextEx =
    state.currentExerciseIndex < (round?.exercises.length ?? 0) - 1
      ? round?.exercises[state.currentExerciseIndex + 1]
      : state.rounds[(state.currentRoundIndex + 1) % Math.max(1, state.rounds.length)]?.exercises[0];
  const hasNext = isAmrap || state.currentRoundIndex < state.rounds.length - 1 || state.currentExerciseIndex < (round?.exercises.length ?? 0) - 1;

  const header = (
    <View style={styles.top}>
      <View style={styles.flex}>
        <Text style={styles.workoutName} numberOfLines={1}>
          {workoutName}
        </Text>
        <Text style={styles.progressLabel}>
          {formatLabel(state.structure.format).toUpperCase()} ·{' '}
          {isAmrap
            ? formatRoundsAndReps(state.roundsCompleted ?? 0, Math.max(0, reps - lastRoundReps)).toUpperCase()
            : state.structure.format === 'intervals'
              ? `INTERVAL ${state.currentRoundIndex + 1}/${state.rounds.length}`
              : state.structure.format === 'emom'
                ? `MINUTE ${state.currentRoundIndex + 1}/${state.rounds.length}`
                : `ROUND ${round?.roundNumber ?? 1}/${state.rounds.length} · MOVE ${state.currentExerciseIndex + 1}/${round?.exercises.length ?? 1}`}
        </Text>
      </View>
      {state.phase !== 'paused' && <IconButton icon="pause" label="Pause workout" onPress={onPause} />}
    </View>
  );

  const progressBar = !isAmrap && (
    <View style={styles.segments} accessibilityLabel={`${doneSteps} of ${totalSteps} movements done`}>
      {Array.from({ length: Math.min(totalSteps, 60) }, (_, i) => (
        <View key={i} style={[styles.segment, { backgroundColor: i < Math.round((doneSteps / totalSteps) * Math.min(totalSteps, 60)) ? colors.accent : colors.border }]} />
      ))}
    </View>
  );

  const clock = (
    <View style={styles.clockRow}>
      <TimerDisplay ms={elapsed} large />
      <View style={styles.clockSide}>
        {capLeft !== null && (
          <Text style={styles.capText}>
            {formatDuration(capLeft)} <Text style={styles.capLabel}>LEFT</Text>
          </Text>
        )}
        {state.scoring === 'reps' && (
          <Text style={styles.capText}>
            {reps} <Text style={styles.capLabel}>REPS</Text>
          </Text>
        )}
      </View>
    </View>
  );

  const raceBlock = opponent && (
    <View style={styles.race}>
      <RematchBar race={race} />
      <RaceRails youProgress={youProgress} opponentProgress={oppProgress} />
    </View>
  );

  // ---------------------------------------------------------------- stage
  let stage: React.ReactNode;
  let controls: React.ReactNode;

  if (state.phase === 'rest' || (state.phase === 'paused' && state.resumePhase === 'rest')) {
    const total = Math.max(1, (state.restEndsAtMs ?? 0) - (state.restStartedAtMs ?? elapsed));
    const upcoming = state.rounds[state.currentRoundIndex + 1]?.exercises[0];
    stage = (
      <View style={styles.stage}>
        <Text style={[styles.kicker, { color: colors.rest }]}>{state.structure.format === 'emom' ? 'REST UNTIL THE MINUTE' : 'REST'}</Text>
        <ProgressRing progress={(restLeft ?? 0) / total} size={isWide ? 260 : 210} color={colors.rest}>
          <Text style={styles.ringNumber}>{formatCountdown(restLeft ?? 0)}</Text>
        </ProgressRing>
        {upcoming && (
          <View style={styles.upFirst}>
            <ExerciseAnimation exerciseId={upcoming.scaledExerciseId} category={meta.get(upcoming.scaledExerciseId)?.category} size={88} color={colors.rest} />
            <View style={styles.flex}>
              <Text style={styles.label}>NEXT</Text>
              <Text style={styles.upFirstName}>{meta.get(upcoming.scaledExerciseId)?.name ?? upcoming.scaledExerciseId}</Text>
              <Text style={styles.secondary}>{describeTarget(upcoming, state.scoring)}</Text>
            </View>
          </View>
        )}
      </View>
    );
    controls =
      state.structure.format !== 'emom' && state.phase === 'rest' ? (
        <View style={styles.row}>
          <Button title="15 S" variant="secondary" icon="plus" onPress={onExtendRest} style={styles.flex} accessibilityLabel="Add 15 seconds of rest" />
          <Button title="SKIP REST" icon="skip" onPress={onSkipRest} style={styles.flex} />
        </View>
      ) : null;
  } else {
    const timed = !!ex?.durationSec;
    const countReps = timed ? state.scoring === 'reps' : true;
    const animSize = isWide ? 300 : 190;
    stage = (
      <View style={styles.stage}>
        <Text style={styles.exerciseName} numberOfLines={2} adjustsFontSizeToFit accessibilityRole="header">
          {exMeta?.name ?? ex?.scaledExerciseId ?? ''}
        </Text>
        <Text style={styles.target}>{describeTarget(ex, state.scoring)}</Text>
        {timed && stepLeft !== null ? (
          <>
            <ProgressRing progress={stepLeft / ((ex?.durationSec ?? 1) * 1000)} size={animSize + 24} stroke={8}>
              <ExerciseAnimation exerciseId={ex!.scaledExerciseId} category={exMeta?.category} size={animSize - 48} background={null} playing={state.phase === 'active'} />
            </ProgressRing>
            <Text style={styles.stepCountdown} accessibilityLabel={`${Math.ceil(stepLeft / 1000)} seconds left`}>
              {formatCountdown(stepLeft)}
            </Text>
          </>
        ) : (
          ex && <ExerciseAnimation exerciseId={ex.scaledExerciseId} category={exMeta?.category} size={animSize} playing={state.phase === 'active'} />
        )}
        {windowLeft !== null && (
          <Text style={styles.windowText}>
            {formatCountdown(windowLeft)}s <Text style={styles.capLabel}>LEFT IN THIS MINUTE</Text>
          </Text>
        )}
        {nextEx && hasNext && (
          <Text style={styles.nextUp} numberOfLines={1}>
            Next: {describeTarget(nextEx, state.scoring)} · {meta.get(nextEx.scaledExerciseId)?.name ?? nextEx.scaledExerciseId}
          </Text>
        )}
      </View>
    );
    controls = (
      <View style={styles.controls}>
        {countReps && ex && (
          <View style={styles.repControls}>
            <IconButton icon="minus" label="One rep less" size={56} onPress={() => onRep(-1)} />
            <View style={styles.repCountWrap}>
              <Text style={styles.repCount}>{ex.completedReps}</Text>
              <Text style={styles.capLabel}>{ex.targetReps ? `OF ${ex.targetReps}` : 'COUNTED'}</Text>
            </View>
            <IconButton icon="plus" label="One more rep" size={56} onPress={() => onRep(1)} />
          </View>
        )}
        {canCompleteManually(state) ? (
          <Button title={hasNext ? 'DONE · NEXT' : 'FINISH'} size="lg" icon="check" onPress={onDone} accessibilityHint="Marks this movement complete" />
        ) : timed ? (
          <Text style={styles.autoNote}>Moves on automatically when the timer ends</Text>
        ) : null}
      </View>
    );
  }

  const paused = state.phase === 'paused';
  const easier = ex && !ex.done ? meta.get(ex.scaledExerciseId)?.easierVariantId : undefined;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.container, { paddingHorizontal: gutter }]}>
        {header}
        {progressBar}
        {isWide ? (
          <View style={styles.wide}>
            <View style={[styles.flex, styles.wideStage]}>{stage}</View>
            <View style={styles.wideSide}>
              {clock}
              {raceBlock}
              <UpNext state={state} meta={meta} />
              <View style={styles.flex} />
              {controls}
              <Text style={styles.shortcuts}>Space: done / skip rest · ↑↓: reps · P: pause</Text>
            </View>
          </View>
        ) : (
          <>
            <View style={styles.flex}>{stage}</View>
            <View style={styles.bottom}>
              {clock}
              {raceBlock}
              {controls}
            </View>
          </>
        )}
      </View>

      <Animated.View pointerEvents="none" style={[styles.flash, { opacity: flash }]} />
      {paused && (
        <View style={styles.pauseOverlay} accessibilityViewIsModal>
          <View style={styles.pauseCard}>
            <Text style={styles.pauseTitle}>PAUSED</Text>
            <Text style={styles.secondary}>The clock is stopped. Paused time never counts.</Text>
            <TimerDisplay ms={elapsed} large />
            <Button title="RESUME" icon="play" size="lg" onPress={onResume} />
            {easier && (
              <Button
                title={`Make it easier: ${meta.get(easier)?.name ?? easier}`}
                variant="secondary"
                icon="swap"
                onPress={onEasier}
                accessibilityHint="Swaps this movement for the rest of the workout. The result is saved as scaled."
              />
            )}
            <Button title="End workout" variant="ghost" icon="flag" onPress={onEnd} />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

/** The next few movements (wide layouts). */
function UpNext({ state, meta }: { state: ActiveWorkoutState; meta: Meta }) {
  const upcoming: { key: string; ex: ActiveWorkoutState['rounds'][number]['exercises'][number]; round: number }[] = [];
  const isAmrap = state.structure.format === 'amrap';
  for (let r = state.currentRoundIndex, guard = 0; upcoming.length < 4 && guard < 40; guard++) {
    const round = state.rounds[r % Math.max(1, state.rounds.length)];
    if (!round || (!isAmrap && r >= state.rounds.length)) break;
    round.exercises.forEach((e, i) => {
      if (upcoming.length >= 4) return;
      if (r === state.currentRoundIndex && i <= state.currentExerciseIndex) return;
      upcoming.push({ key: `${r}-${i}`, ex: e, round: r + 1 });
    });
    r += 1;
  }
  if (upcoming.length === 0) return null;
  return (
    <View style={styles.upNext}>
      <Text style={styles.label}>UP NEXT</Text>
      {upcoming.map(({ key, ex, round }) => (
        <View key={key} style={styles.upNextRow}>
          <ExerciseAnimation exerciseId={ex.scaledExerciseId} category={meta.get(ex.scaledExerciseId)?.category} size={40} playing={false} />
          <Text style={styles.upNextText} numberOfLines={1}>
            {describeTarget(ex, state.scoring)} · {meta.get(ex.scaledExerciseId)?.name ?? ex.scaledExerciseId}
          </Text>
          {round !== state.currentRoundIndex + 1 && (
            <Text style={styles.capLabel}>
              {state.structure.format === 'emom' ? 'M' : state.structure.format === 'intervals' ? 'I' : 'R'}
              {round}
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  upNext: { gap: 6, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  upNextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  upNextText: { ...typography.body, color: colors.primary, flex: 1 },
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  container: { flex: 1, paddingTop: spacing.sm, paddingBottom: spacing.md, width: '100%', maxWidth: 1180, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  workoutName: { ...typography.displayMD, fontSize: 30, lineHeight: 34, color: colors.primary },
  progressLabel: { ...typography.label, color: colors.accent },
  segments: { flexDirection: 'row', gap: 3, marginTop: spacing.sm },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
  exerciseName: { ...typography.displayLG, color: colors.primary, textAlign: 'center' },
  target: { ...typography.subheading, color: colors.accent, textTransform: 'uppercase', letterSpacing: 1 },
  ringNumber: { ...typography.displayXL, fontSize: 72, lineHeight: 76, color: colors.primary },
  stepCountdown: { ...typography.displayXL, fontSize: 64, lineHeight: 68, color: colors.primary, fontVariant: ['tabular-nums'] },
  windowText: { ...typography.subheading, color: colors.accentWarm },
  nextUp: { ...typography.body, color: colors.secondary },
  bottom: { gap: spacing.md },
  clockRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clockSide: { alignItems: 'flex-end' },
  capText: { ...typography.displayMD, fontSize: 26, lineHeight: 30, color: colors.primary },
  capLabel: { ...typography.label, color: colors.muted },
  race: { gap: spacing.sm },
  controls: { gap: spacing.md },
  repControls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  repCountWrap: { alignItems: 'center', minWidth: 72 },
  repCount: { ...typography.displayLG, color: colors.primary, fontVariant: ['tabular-nums'] },
  autoNote: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  row: { flexDirection: 'row', gap: spacing.sm },
  countdownWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  countdown: { ...typography.displayXL, fontSize: 110, lineHeight: 116, color: colors.accent },
  kicker: { ...typography.label, color: colors.accent, letterSpacing: 2 },
  upFirst: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: 16, padding: spacing.sm, paddingRight: spacing.lg, maxWidth: 420 },
  upFirstName: { ...typography.subheading, color: colors.primary },
  label: { ...typography.label, color: colors.muted },
  secondary: { ...typography.body, color: colors.secondary, textAlign: 'center' },
  wide: { flex: 1, flexDirection: 'row', gap: spacing.xl, marginTop: spacing.md },
  wideStage: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: 1, borderColor: colors.border },
  wideSide: { width: 400, gap: spacing.lg, paddingVertical: spacing.md },
  shortcuts: { ...typography.caption, color: colors.muted, textAlign: 'center' },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: colors.accent },
  pauseOverlay: { ...StyleSheet.absoluteFill, backgroundColor: withAlpha(colors.background, 0.92), alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  pauseCard: { width: '100%', maxWidth: 420, gap: spacing.md, alignItems: 'stretch' },
  pauseTitle: { ...typography.displayLG, color: colors.primary, textAlign: 'center' },
});
