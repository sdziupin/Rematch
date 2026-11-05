import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, IconButton } from '../src/components/Button';
import { showToast } from '../src/components/Dialogs';
import { ExerciseAnimation } from '../src/components/ExerciseAnimation';
import { Icon } from '../src/components/Icon';
import { StructurePreview } from '../src/components/StructurePreview';
import { Card, Chip, ChipRow, Screen, ScreenHeader, SearchField, SectionTitle, WorkoutMark } from '../src/components/ui';
import { getWorkoutById, listExercises, loadWorkoutPlan, parseJsonArray } from '../src/db/repository';
import type { ExerciseRow } from '../src/db/schema';
import type { Difficulty, WorkoutExerciseStep, WorkoutFormat } from '../src/domain/types';
import { titleCase } from '../src/domain/utils';
import { DEATH_BY_DEFAULTS, TABATA_DEFAULTS, estimateStructureMinutes, formatBlurb, formatLabel, isTimedIntervals } from '../src/engine/workoutEngine';
import { useLayout } from '../src/hooks/useLayout';
import { buildStructure, CUSTOM_COLORS, CUSTOM_SYMBOLS, saveCustomWorkout, validateStructure } from '../src/services/customWorkoutService';
import { useSettings } from '../src/store/settingsStore';
import { colors, fonts, radius, spacing, typography, makeStyles } from '../src/theme';

const FORMATS = ['fixed_rounds', 'chipper', 'ladder', 'amrap', 'emom', 'intervals', 'tabata', 'death_by'] as const;
const EMOM_WINDOWS = [1, 2, 3] as const;
const DIFFICULTIES: Difficulty[] = ['beginner', 'intermediate', 'advanced', 'elite'];
const CATEGORIES = ['all', 'push', 'pull', 'squat', 'lunge', 'hinge', 'core', 'cardio', 'conditioning', 'accessory', 'mobility'] as const;

interface Step extends WorkoutExerciseStep {
  key: number;
}

let stepKey = 0;

function Stepper({ value, onChange, min = 0, max = 999, step = 1, suffix = '', label }: { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; suffix?: string; label: string }) {
  const styles = useStyles();
  return (
    <View style={styles.stepper}>
      <IconButton icon="minus" label={`Decrease ${label}`} size={34} onPress={() => onChange(Math.max(min, value - step))} />
      <Text style={styles.stepperValue}>
        {value}
        {suffix}
      </Text>
      <IconButton icon="plus" label={`Increase ${label}`} size={34} onPress={() => onChange(Math.min(max, value + step))} />
    </View>
  );
}

export default function BuilderScreen() {
  const styles = useStyles();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { isWide } = useLayout();
  const [exercises, setExercises] = useState<ExerciseRow[]>([]);
  const [name, setName] = useState('');
  const [symbol, setSymbol] = useState(CUSTOM_SYMBOLS[0]);
  const [color, setColor] = useState(CUSTOM_COLORS[0]);
  const [difficulty, setDifficulty] = useState<Difficulty>('intermediate');
  const [format, setFormat] = useState<(typeof FORMATS)[number]>('fixed_rounds');
  const [rounds, setRounds] = useState(3);
  const [restSec, setRestSec] = useState(0);
  const [capMin, setCapMin] = useState(12);
  const [emomMin, setEmomMin] = useState(10);
  const [workSec, setWorkSec] = useState(40);
  const [intervalRest, setIntervalRest] = useState(20);
  const [intervalCount, setIntervalCount] = useState(8);
  const [windowMin, setWindowMin] = useState<(typeof EMOM_WINDOWS)[number]>(1);
  const [rungs, setRungs] = useState(5);
  const [pyramid, setPyramid] = useState(false);
  const [tabataIntervals, setTabataIntervals] = useState<number>(TABATA_DEFAULTS.intervals);
  const [tabataWork, setTabataWork] = useState<number>(TABATA_DEFAULTS.workSec);
  const [tabataRest, setTabataRest] = useState<number>(TABATA_DEFAULTS.restSec);
  const [blockRest, setBlockRest] = useState<number>(TABATA_DEFAULTS.blockRestSec);
  const [deathMax, setDeathMax] = useState<number>(DEATH_BY_DEFAULTS.maxWindows);
  const [steps, setSteps] = useState<Step[]>([]);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    void listExercises().then(setExercises);
    if (!id) return;
    (async () => {
      const w = await getWorkoutById(id);
      const plan = await loadWorkoutPlan(id);
      if (!w || !plan) return;
      const s = plan.fullStructure;
      setName(w.name);
      setSymbol(w.symbol);
      setColor(w.identityColor);
      setDifficulty(w.difficulty as Difficulty);
      const f = (FORMATS as readonly string[]).includes(s.format) ? (s.format as (typeof FORMATS)[number]) : 'fixed_rounds';
      setFormat(f);
      setRounds(s.rounds.length);
      setRestSec(s.restBetweenRoundsSec ?? 0);
      if (s.timeCapSec) setCapMin(Math.round(s.timeCapSec / 60));
      if (s.intervalRounds) {
        setEmomMin(s.intervalRounds);
        setIntervalCount(s.intervalRounds);
      }
      if (s.intervalWorkSec) setWorkSec(s.intervalWorkSec);
      if (s.intervalRestSec !== undefined) setIntervalRest(s.intervalRestSec);
      if (s.format === 'emom' && s.intervalWorkSec && [60, 120, 180].includes(s.intervalWorkSec)) setWindowMin((s.intervalWorkSec / 60) as (typeof EMOM_WINDOWS)[number]);
      if (s.format === 'tabata') {
        setTabataIntervals(s.intervalRounds ?? TABATA_DEFAULTS.intervals);
        setTabataWork(s.intervalWorkSec ?? TABATA_DEFAULTS.workSec);
        setTabataRest(s.intervalRestSec ?? TABATA_DEFAULTS.restSec);
        setBlockRest(s.restBetweenRoundsSec ?? TABATA_DEFAULTS.blockRestSec);
      }
      if (s.format === 'death_by') setDeathMax(s.intervalRounds ?? DEATH_BY_DEFAULTS.maxWindows);
      if (s.format === 'ladder') {
        // A pyramid ends on the rung it started on.
        const isPyramid = s.rounds.length >= 3 && JSON.stringify(s.rounds[0].steps) === JSON.stringify(s.rounds[s.rounds.length - 1].steps);
        setPyramid(isPyramid);
        setRungs(isPyramid ? (s.rounds.length + 1) / 2 : s.rounds.length);
      }
      setSteps((s.rounds[0]?.steps ?? []).map((st) => ({ ...st, key: ++stepKey })));
    })();
  }, [id]);

  const byId = useMemo(() => new Map(exercises.map((e) => [e.id, e])), [exercises]);

  const structure = useMemo(
    () =>
      buildStructure(format as WorkoutFormat, steps, {
        rounds: format === 'ladder' ? rungs : rounds,
        pyramid,
        restBetweenRoundsSec: format === 'tabata' ? blockRest : restSec,
        timeCapSec: format === 'amrap' ? capMin * 60 : undefined,
        intervalRounds: format === 'emom' ? emomMin : format === 'tabata' ? tabataIntervals : format === 'death_by' ? deathMax : intervalCount,
        intervalWorkSec: format === 'emom' ? windowMin * 60 : format === 'tabata' ? tabataWork : format === 'death_by' ? 60 : workSec,
        intervalRestSec: format === 'tabata' ? tabataRest : intervalRest,
      }),
    [format, steps, rounds, rungs, pyramid, restSec, capMin, emomMin, windowMin, intervalCount, workSec, intervalRest, tabataIntervals, tabataWork, tabataRest, blockRest, deathMax],
  );

  const addExercise = (e: ExerciseRow) => {
    const timedByDefault = e.category === 'mobility' || e.category === 'recovery' || /hold|plank|sit|hang|carry/.test(e.id);
    // Death by grows every minute, so it starts small.
    const reps = format === 'death_by' ? 2 : 10;
    setSteps((s) => [...s, { key: ++stepKey, exerciseId: e.id, ...(timedByDefault && format !== 'death_by' ? { durationSec: 30 } : { reps }) }]);
    setPicking(false);
  };

  const update = (key: number, patch: Partial<Step>) => setSteps((s) => s.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const move = (key: number, dir: -1 | 1) =>
    setSteps((s) => {
      const i = s.findIndex((x) => x.key === key);
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const copy = [...s];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const save = async () => {
    const problems = validateStructure(structure, name);
    setErrors(problems);
    if (problems.length) return;
    setSaving(true);
    try {
      const equipment = [...new Set(steps.flatMap((s) => parseJsonArray(byId.get(s.exerciseId)?.equipmentJson)))].filter((e) => e !== 'bodyweight');
      const savedId = await saveCustomWorkout({ id, name, symbol, identityColor: color, difficulty, structure }, equipment.length ? equipment : ['bodyweight']);
      useSettings.getState().touch();
      showToast(id ? 'Workout updated' : 'Workout created — go set the first mark', { tone: 'success' });
      router.replace(`/workout/${savedId}`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Could not save', { tone: 'error' });
      setSaving(false);
    }
  };

  const editor = (
    <View style={styles.stack}>
      <Card style={styles.stack}>
        <Text style={styles.fieldLabel}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="NAME IT"
          placeholderTextColor={colors.textMuted}
          style={styles.nameInput}
          maxLength={24}
          autoCapitalize="characters"
          accessibilityLabel="Workout name"
        />
        <Text style={styles.fieldLabel}>Colour</Text>
        <View style={styles.wrap}>
          {CUSTOM_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotOn]} accessibilityRole="button" accessibilityLabel={`Colour ${c}`} />
          ))}
        </View>
        <Text style={styles.fieldLabel}>Level</Text>
        <ChipRow options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} format={titleCase} />
      </Card>

      <SectionTitle>Format</SectionTitle>
      <ChipRow options={FORMATS} value={format} onChange={setFormat} format={(f) => formatLabel(f as WorkoutFormat)} />
      <Text style={styles.hint}>{formatBlurb(format)}</Text>
      <Card style={styles.stack}>
        {format === 'fixed_rounds' && (
          <>
            <Row label="Rounds">
              <Stepper label="rounds" value={rounds} onChange={setRounds} min={1} max={30} />
            </Row>
            <Row label="Rest between rounds">
              <Stepper label="rest" value={restSec} onChange={setRestSec} min={0} max={300} step={15} suffix="s" />
            </Row>
          </>
        )}
        {format === 'chipper' && <Text style={styles.hint}>One pass through the list, for time.</Text>}
        {format === 'ladder' && (
          <>
            <Row label="Rungs">
              <Stepper label="rungs" value={rungs} onChange={setRungs} min={2} max={15} />
            </Row>
            <Row label="Shape">
              <View style={styles.wrap}>
                <Chip label="Ladder" selected={!pyramid} onPress={() => setPyramid(false)} />
                <Chip label="Pyramid" selected={pyramid} onPress={() => setPyramid(true)} />
              </View>
            </Row>
            <Row label="Rest between rungs">
              <Stepper label="rest" value={restSec} onChange={setRestSec} min={0} max={300} step={15} suffix="s" />
            </Row>
            <Text style={styles.hint}>Set the reps for rung 1; rung n asks for n times as many{pyramid ? ', then the pyramid comes back down' : ''}. Timed movements keep their seconds.</Text>
          </>
        )}
        {format === 'amrap' && (
          <Row label="Time">
            <Stepper label="minutes" value={capMin} onChange={setCapMin} min={1} max={60} suffix=" min" />
          </Row>
        )}
        {format === 'emom' && (
          <>
            <Row label="Every">
              <ChipRow options={EMOM_WINDOWS} value={windowMin} onChange={setWindowMin} format={(m) => (m === 1 ? 'Minute' : `${m} min`)} />
            </Row>
            <Row label={windowMin === 1 ? 'Minutes' : 'Sets'}>
              <Stepper label={windowMin === 1 ? 'minutes' : 'sets'} value={emomMin} onChange={setEmomMin} min={1} max={60} />
            </Row>
          </>
        )}
        {format === 'tabata' && (
          <>
            <Row label="Intervals per movement">
              <Stepper label="intervals" value={tabataIntervals} onChange={setTabataIntervals} min={4} max={12} />
            </Row>
            <Row label="Work">
              <Stepper label="work seconds" value={tabataWork} onChange={setTabataWork} min={10} max={60} step={5} suffix="s" />
            </Row>
            <Row label="Rest">
              <Stepper label="rest seconds" value={tabataRest} onChange={setTabataRest} min={5} max={60} step={5} suffix="s" />
            </Row>
            <Row label="Between movements">
              <Stepper label="rest between movements" value={blockRest} onChange={setBlockRest} min={0} max={180} step={15} suffix="s" />
            </Row>
            <Text style={styles.hint}>Each movement gets its own block. Count every rep: your score is the total.</Text>
          </>
        )}
        {format === 'death_by' && (
          <>
            <Row label="Up to">
              <Stepper label="minutes" value={deathMax} onChange={setDeathMax} min={5} max={40} suffix=" min" />
            </Row>
            <Text style={styles.hint}>Set the reps for minute 1. Minute n asks for n times as many. Miss a minute and it's over; your score is every rep you banked.</Text>
          </>
        )}
        {format === 'intervals' && (
          <>
            <Row label="Intervals">
              <Stepper label="intervals" value={intervalCount} onChange={setIntervalCount} min={1} max={60} />
            </Row>
            <Row label="Work">
              <Stepper label="work seconds" value={workSec} onChange={setWorkSec} min={5} max={300} step={5} suffix="s" />
            </Row>
            <Row label="Rest">
              <Stepper label="rest seconds" value={intervalRest} onChange={setIntervalRest} min={0} max={300} step={5} suffix="s" />
            </Row>
            <Text style={styles.hint}>Movements rotate, one per interval. Count your reps during each one.</Text>
          </>
        )}
      </Card>

      <SectionTitle right={<Button title="Add movement" icon="plus" size="sm" variant="secondary" onPress={() => setPicking(true)} />}>Movements</SectionTitle>
      {steps.length === 0 && <Text style={styles.hint}>Add the movements in the order you'll do them.</Text>}
      {steps.map((s, i) => {
        const ex = byId.get(s.exerciseId);
        const timed = s.durationSec !== undefined;
        return (
          <Card key={s.key} style={styles.stepRow}>
            <ExerciseAnimation exerciseId={s.exerciseId} category={ex?.category} size={48} playing={false} />
            <View style={styles.flex}>
              <Text style={styles.stepName}>{ex?.name ?? s.exerciseId}</Text>
              {!isTimedIntervals(format) && format !== 'death_by' && (
                <View style={styles.wrap}>
                  <Chip label="Reps" selected={!timed} onPress={() => update(s.key, { reps: s.reps ?? 10, durationSec: undefined })} />
                  <Chip label="Seconds" selected={timed} onPress={() => update(s.key, { durationSec: s.durationSec ?? 30, reps: undefined })} />
                </View>
              )}
              {format === 'death_by' && <Text style={styles.hint}>Reps in minute 1</Text>}
            </View>
            {!isTimedIntervals(format) &&
              (timed && format !== 'death_by' ? (
                <Stepper label="seconds" value={s.durationSec ?? 30} onChange={(v) => update(s.key, { durationSec: v })} min={5} max={600} step={5} suffix="s" />
              ) : (
                <Stepper label="reps" value={s.reps ?? (format === 'death_by' ? 1 : 10)} onChange={(v) => update(s.key, { reps: v, durationSec: undefined })} min={1} max={500} />
              ))}
            <View style={styles.reorder}>
              <IconButton icon="back" label="Move up" size={32} onPress={() => move(s.key, -1)} disabled={i === 0} style={{ transform: [{ rotate: '90deg' }] }} />
              <IconButton icon="close" label="Remove" size={32} color={colors.textSecondary} onPress={() => setSteps((all) => all.filter((x) => x.key !== s.key))} />
            </View>
          </Card>
        );
      })}
      {errors.length > 0 && (
        <Card accent={colors.danger}>
          {errors.map((e) => (
            <Text key={e} style={styles.error}>
              {e}
            </Text>
          ))}
        </Card>
      )}
    </View>
  );

  const preview = (
    <Card style={styles.stack}>
      <View style={styles.previewHead}>
        <WorkoutMark name={name || '?'} color={color} size={40} />
        <View style={styles.flex}>
          <Text style={styles.previewName} numberOfLines={1}>
            {name || 'Untitled'}
          </Text>
          <Text style={styles.hint}>About {estimateStructureMinutes(structure)} min</Text>
        </View>
      </View>
      {steps.length ? <StructurePreview structure={structure} exercises={byId} /> : <Text style={styles.hint}>Your workout appears here.</Text>}
      <Button title={id ? 'Save changes' : 'Create workout'} icon="check" size="lg" onPress={save} loading={saving} />
      {id && <Text style={styles.hint}>Changing movements, reps or format starts a new version, so earlier results stay comparable.</Text>}
    </Card>
  );

  return (
    <Screen>
      <ScreenHeader title={id ? 'Edit workout' : 'Build a workout'} subtitle="Your own benchmark. Every attempt races the last." onBack={() => router.back()} />
      {isWide ? (
        <View style={styles.columns}>
          <View style={styles.flex}>{editor}</View>
          <View style={styles.side}>{preview}</View>
        </View>
      ) : (
        <View style={styles.stack}>
          {editor}
          {preview}
        </View>
      )}
      <ExercisePicker visible={picking} exercises={exercises} onPick={addExercise} onClose={() => setPicking(false)} accent={colors.accent} />
    </Screen>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.optionRow}>
      <Text style={styles.optionLabel}>{label}</Text>
      {children}
    </View>
  );
}

function ExercisePicker({ visible, exercises, onPick, onClose, accent }: { visible: boolean; exercises: ExerciseRow[]; onPick: (e: ExerciseRow) => void; onClose: () => void; accent: string }) {
  const styles = useStyles();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all');
  const list = exercises.filter((e) => (category === 'all' || e.category === category) && e.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} transparent>
      <View style={styles.modalBackdrop}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Add a movement</Text>
            <IconButton icon="close" label="Close" onPress={onClose} />
          </View>
          <View style={styles.searchRow}>
            <SearchField value={query} onChange={setQuery} label="Search movements" />
          </View>
          <ChipRow options={CATEGORIES} value={category} onChange={setCategory} format={(c) => (c === 'all' ? 'All' : titleCase(c))} scroll />
          <ScrollView contentContainerStyle={styles.pickList}>
            {list.map((e) => (
              <Pressable key={e.id} onPress={() => onPick(e)} style={(s) => [styles.pickRow, (s as { hovered?: boolean }).hovered && { backgroundColor: colors.surfaceRaised }]} accessibilityRole="button" accessibilityLabel={`Add ${e.name}`}>
                <ExerciseAnimation exerciseId={e.id} category={e.category} size={44} playing={false} />
                <View style={styles.flex}>
                  <Text style={styles.stepName}>{e.name}</Text>
                  <Text style={styles.hint}>{titleCase(e.category)}</Text>
                </View>
                <Icon name="plus" size={18} color={accent} />
              </Pressable>
            ))}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles(() => ({
  flex: { flex: 1 },
  stack: { gap: spacing.sm + 2 },
  columns: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  side: { width: 400 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  fieldLabel: { ...typography.overline, color: colors.textMuted, marginTop: spacing.xs },
  nameInput: { ...typography.title, letterSpacing: 0.5, color: colors.text, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, marginBottom: spacing.xs },
  colorDot: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: colors.surface },
  colorDotOn: { borderColor: colors.text },
  optionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionLabel: { ...typography.callout, fontFamily: fonts.semibold, color: colors.text },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepperValue: { ...typography.figure, fontSize: 17, color: colors.text, minWidth: 52, textAlign: 'center' },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 2, padding: 10, flexWrap: 'wrap' },
  stepName: { ...typography.callout, fontFamily: fonts.semibold, color: colors.text, marginBottom: 4 },
  reorder: { flexDirection: 'row', gap: 4 },
  hint: { ...typography.caption, color: colors.textMuted },
  error: { ...typography.body, color: colors.danger },
  previewHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm + 4, marginBottom: spacing.xs },
  previewName: { ...typography.heading, letterSpacing: 0.3, color: colors.text },
  modalBackdrop: { flex: 1, backgroundColor: colors.overlay, alignItems: 'center', justifyContent: 'flex-end' },
  modal: { width: '100%', maxWidth: 640, height: '86%', backgroundColor: colors.surface, borderTopLeftRadius: radius.xl + 6, borderTopRightRadius: radius.xl + 6, borderWidth: 1, borderColor: colors.border, padding: spacing.md, gap: spacing.sm + 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  modalTitle: { ...typography.heading, color: colors.text },
  searchRow: { flexDirection: 'row' },
  pickList: { gap: 2, paddingBottom: spacing.xl },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: 8, borderRadius: radius.md },
}));
