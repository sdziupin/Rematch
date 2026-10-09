import test from 'node:test';
import assert from 'node:assert/strict';
import type { PartialKey, WorkoutStructure } from '../domain/types';
import { estimateStructureMinutes } from '../engine/workoutEngine';
import legacyStructures from './__fixtures__/legacy-structures.json';
import { EXERCISE_SEEDS, PARTIAL_FRACTIONS, PROGRAM_SEEDS, WORKOUT_SEEDS, scaleStructure } from './seed';
import { EQUIPMENT, EXERCISE_CATEGORIES, MUSCLES, type EquipmentId } from './types';

const FOCUSES = [
  'full_body',
  'core',
  'cardio',
  'lower',
  'upper',
  'conditioning',
  'mixed',
  'strength_endurance',
  'explosive',
  'low_impact',
  'mobility',
];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced', 'elite'];
const TIERS = ['foundation', 'standard', 'advanced', 'elite'];
const KINDS = ['benchmark', 'warmup', 'cooldown'];
const PARTIAL_KEYS: PartialKey[] = ['full', 'three_quarter', 'half', 'quarter'];
const FREE_EQUIPMENT = new Set<EquipmentId>(['bodyweight', 'mat']);

const exercises = new Map(EXERCISE_SEEDS.map((e) => [e.id, e]));
const workouts = new Map(WORKOUT_SEEDS.map((w) => [w.id, w]));
const kindOf = (w: (typeof WORKOUT_SEEDS)[number]) => w.kind ?? 'benchmark';

function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((v) => (seen.has(v) ? true : (seen.add(v), false)));
}

function allSteps(structure: WorkoutStructure) {
  return structure.rounds.flatMap((r) => r.steps);
}

/** Equipment the workout's exercises need, minus what every athlete has. */
function neededEquipment(structure: WorkoutStructure): Set<EquipmentId> {
  const out = new Set<EquipmentId>();
  for (const step of allSteps(structure)) {
    for (const eq of exercises.get(step.exerciseId)?.equipment ?? []) out.add(eq);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Exercises
// ---------------------------------------------------------------------------

test('exercise ids and names are unique', () => {
  assert.deepEqual(duplicates(EXERCISE_SEEDS.map((e) => e.id)), []);
  assert.deepEqual(duplicates(EXERCISE_SEEDS.map((e) => e.name.toLowerCase())), []);
});

test('exercise metadata is canonical and complete', () => {
  for (const e of EXERCISE_SEEDS) {
    const where = `exercise ${e.id}`;
    assert.match(e.id, /^[a-z0-9]+(-[a-z0-9]+)*$/, where);
    assert.equal(e.visualAsset, `exercises/${e.id}`, where);
    for (const field of ['name', 'description', 'instructions', 'startPosition', 'movementSequence'] as const) {
      assert.ok(e[field].trim().length > 0, `${where}: empty ${field}`);
    }
    assert.ok(e.cues.length >= 2 && e.cues.length <= 4, `${where}: needs 2-4 cues`);
    assert.ok(e.mistakes.length >= 1 && e.mistakes.length <= 3, `${where}: needs 1-3 mistakes`);
    assert.ok(e.primaryMuscles.length > 0, `${where}: no primary muscle`);
    for (const m of [...e.primaryMuscles, ...e.secondaryMuscles]) {
      assert.ok((MUSCLES as readonly string[]).includes(m), `${where}: unknown muscle "${m}"`);
    }
    assert.deepEqual(duplicates([...e.primaryMuscles, ...e.secondaryMuscles]), [], `${where}: muscle listed twice`);
    assert.ok((EXERCISE_CATEGORIES as readonly string[]).includes(e.category), `${where}: unknown category "${e.category}"`);
    assert.ok(e.equipment.length > 0, `${where}: no equipment`);
    for (const eq of e.equipment) {
      assert.ok((EQUIPMENT as readonly string[]).includes(eq), `${where}: unknown equipment "${eq}"`);
    }
    assert.ok(['low', 'medium', 'high'].includes(e.impactLevel), where);
  }
});

test('easier/harder links exist and form acyclic progressions', () => {
  // Edge easier -> harder, from both directions of linking.
  const harderOf = new Map<string, Set<string>>();
  const addEdge = (easy: string, hard: string) => {
    if (!harderOf.has(easy)) harderOf.set(easy, new Set());
    harderOf.get(easy)!.add(hard);
  };
  for (const e of EXERCISE_SEEDS) {
    for (const link of [e.easierVariantId, e.harderVariantId]) {
      if (link === undefined) continue;
      assert.ok(exercises.has(link), `${e.id}: links to unknown exercise "${link}"`);
      assert.notEqual(link, e.id, `${e.id}: links to itself`);
    }
    assert.ok(!e.easierVariantId || e.easierVariantId !== e.harderVariantId, `${e.id}: same easier and harder variant`);
    if (e.easierVariantId) addEdge(e.easierVariantId, e.id);
    if (e.harderVariantId) addEdge(e.id, e.harderVariantId);
  }

  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string, path: string[]) => {
    if (state.get(id) === 'done') return;
    assert.notEqual(state.get(id), 'visiting', `progression cycle: ${[...path, id].join(' -> ')}`);
    state.set(id, 'visiting');
    for (const next of harderOf.get(id) ?? []) visit(next, [...path, id]);
    state.set(id, 'done');
  };
  for (const e of EXERCISE_SEEDS) visit(e.id, []);
});

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

test('workout ids, slugs and names are unique and consistent', () => {
  assert.deepEqual(duplicates(WORKOUT_SEEDS.map((w) => w.id)), []);
  assert.deepEqual(duplicates(WORKOUT_SEEDS.map((w) => w.slug)), []);
  assert.deepEqual(duplicates(WORKOUT_SEEDS.map((w) => w.name)), []);
  for (const w of WORKOUT_SEEDS) {
    assert.equal(w.id, `w-${w.slug}`, w.id);
    assert.match(w.slug, /^[a-z]+(-[a-z]+)*$/, w.id);
    assert.equal(w.name, w.name.toUpperCase(), `${w.id}: name should be uppercase`);
  }
});

test('workout metadata is canonical', () => {
  for (const w of WORKOUT_SEEDS) {
    const where = `workout ${w.id}`;
    assert.ok(FOCUSES.includes(w.focus), `${where}: unknown focus "${w.focus}"`);
    assert.ok(DIFFICULTIES.includes(w.difficulty), where);
    assert.ok(TIERS.includes(w.progressionTier), `${where}: unknown tier "${w.progressionTier}"`);
    assert.ok(KINDS.includes(kindOf(w)), where);
    assert.match(w.identityColor, /^#[0-9A-Fa-f]{6}$/, where);
    assert.equal([...w.symbol].length, 1, `${where}: symbol should be a single glyph`);
    assert.ok(w.description && w.description.trim().length > 0, `${where}: missing description`);
    assert.equal(w.format, w.structure.format, `${where}: format differs from structure.format`);
    assert.ok(w.equipment.length > 0, `${where}: no equipment`);
    for (const eq of w.equipment) assert.ok((EQUIPMENT as readonly string[]).includes(eq), `${where}: unknown equipment "${eq}"`);
    assert.deepEqual(duplicates(w.equipment), [], where);
    if (kindOf(w) !== 'benchmark') assert.equal(w.focus, 'mobility', `${where}: warm-ups and cool-downs focus on mobility`);
  }
});

test('every referenced exercise exists', () => {
  for (const w of WORKOUT_SEEDS) {
    for (const step of allSteps(w.structure)) {
      assert.ok(exercises.has(step.exerciseId), `${w.id}: unknown exercise "${step.exerciseId}"`);
    }
  }
});

test('workout equipment covers what its exercises need', () => {
  for (const w of WORKOUT_SEEDS) {
    const needed = neededEquipment(w.structure);
    for (const eq of needed) {
      if (FREE_EQUIPMENT.has(eq)) continue;
      assert.ok(w.equipment.includes(eq), `${w.id}: needs "${eq}" but lists [${w.equipment.join(', ')}]`);
    }
    for (const eq of w.equipment) {
      if (eq === 'bodyweight') continue;
      assert.ok(needed.has(eq), `${w.id}: lists "${eq}" but no exercise uses it`);
    }
    if (w.equipment.includes('bodyweight')) assert.equal(w.equipment.length, 1, `${w.id}: "bodyweight" means no equipment`);
  }
});

test('structures satisfy their format requirements', () => {
  for (const w of WORKOUT_SEEDS) {
    const s = w.structure;
    const where = `workout ${w.id}`;
    assert.ok(s.rounds.length > 0, `${where}: no rounds`);
    s.rounds.forEach((round, i) => {
      assert.ok(round.steps.length > 0, `${where}: round ${i + 1} is empty`);
      if (s.format !== 'intervals' && s.format !== 'emom') assert.equal(round.roundNumber, i + 1, `${where}: round numbers out of order`);
    });

    for (const step of allSteps(s)) {
      const hasReps = (step.reps ?? 0) > 0;
      const hasDuration = (step.durationSec ?? 0) > 0;
      if (s.format === 'intervals') {
        assert.ok(hasDuration || (s.intervalWorkSec ?? 0) > 0, `${where}: interval step "${step.exerciseId}" has no duration`);
        if (step.durationSec !== undefined && s.intervalWorkSec !== undefined) {
          assert.equal(step.durationSec, s.intervalWorkSec, `${where}: step duration differs from intervalWorkSec`);
        }
      } else {
        assert.ok(hasReps || hasDuration, `${where}: step "${step.exerciseId}" needs reps or durationSec`);
      }
      if (s.format === 'emom') assert.ok(hasReps, `${where}: EMOM steps need reps`);
    }

    switch (s.format) {
      case 'amrap':
        assert.ok((s.timeCapSec ?? 0) > 0, `${where}: AMRAP needs timeCapSec`);
        break;
      case 'intervals':
        assert.ok((s.intervalRounds ?? 0) > 0, `${where}: intervals need intervalRounds`);
        assert.ok((s.intervalWorkSec ?? 0) > 0, `${where}: intervals need intervalWorkSec`);
        assert.ok(s.intervalRounds! >= allSteps(s).length, `${where}: some interval steps never run`);
        break;
      case 'emom': {
        assert.ok((s.intervalRounds ?? 0) > 0, `${where}: EMOM needs intervalRounds`);
        const windowSec = s.intervalWorkSec ?? 60;
        for (const round of s.rounds) {
          const workSec = round.steps.reduce((sum, st) => sum + (st.reps ?? 0) * 3 + (st.durationSec ?? 0), 0);
          assert.ok(workSec < windowSec, `${where}: EMOM minute ${round.roundNumber} leaves no rest (${workSec}s of work)`);
        }
        break;
      }
      default:
        if (s.restBetweenRoundsSec !== undefined) assert.ok(s.restBetweenRoundsSec > 0, where);
    }
  }
});

test('estimated minutes are plausible', () => {
  for (const w of WORKOUT_SEEDS) {
    const where = `workout ${w.id}`;
    const est = estimateStructureMinutes(w.structure);
    assert.ok(w.estimatedMinutesMin > 0 && w.estimatedMinutesMin <= w.estimatedMinutesMax, `${where}: bad range`);
    assert.ok(
      est >= w.estimatedMinutesMin * 0.5 && est <= w.estimatedMinutesMax * 1.6,
      `${where}: engine estimates ${est} min, listed ${w.estimatedMinutesMin}-${w.estimatedMinutesMax}`,
    );
    if (kindOf(w) === 'warmup') {
      assert.ok(est >= 4 && est <= 8 && w.estimatedMinutesMin >= 4 && w.estimatedMinutesMax <= 8, `${where}: warm-ups run 4-8 min`);
    }
    if (kindOf(w) === 'cooldown') {
      assert.ok(est >= 5 && est <= 10 && w.estimatedMinutesMin >= 5 && w.estimatedMinutesMax <= 10, `${where}: cool-downs run 5-10 min`);
    }
  }
});

test('legacy benchmark structures never change', () => {
  const legacy = legacyStructures as Record<string, string>;
  assert.equal(Object.keys(legacy).length, 31);
  for (const [id, json] of Object.entries(legacy)) {
    const w = workouts.get(id);
    assert.ok(w, `legacy workout ${id} is missing`);
    assert.equal(JSON.stringify(w?.structure), json, `${id}: structure changed; personal bests depend on it`);
  }
});

// ---------------------------------------------------------------------------
// Programs
// ---------------------------------------------------------------------------

test('program ids are unique and consistent', () => {
  assert.deepEqual(duplicates(PROGRAM_SEEDS.map((p) => p.id)), []);
  assert.deepEqual(duplicates(PROGRAM_SEEDS.map((p) => p.slug)), []);
  for (const p of PROGRAM_SEEDS) {
    assert.equal(p.id, `p-${p.slug}`, p.id);
    assert.ok(DIFFICULTIES.includes(p.level), p.id);
    assert.match(p.identityColor, /^#[0-9A-Fa-f]{6}$/, p.id);
    assert.ok(p.tagline.trim() && p.description.trim(), `${p.id}: missing copy`);
  }
});

test('program sessions reference benchmarks and fill every week', () => {
  for (const p of PROGRAM_SEEDS) {
    const where = `program ${p.id}`;
    assert.ok(p.weeks > 0 && p.daysPerWeek > 0, where);
    for (const s of p.sessions) {
      const w = workouts.get(s.workoutId);
      assert.ok(w, `${where}: unknown workout "${s.workoutId}"`);
      assert.equal(w && kindOf(w), 'benchmark', `${where}: ${s.workoutId} is not a benchmark`);
      assert.ok(Number.isInteger(s.week) && s.week >= 1 && s.week <= p.weeks, `${where}: week ${s.week} out of range`);
      assert.ok(Number.isInteger(s.day) && s.day >= 1 && s.day <= p.daysPerWeek, `${where}: day ${s.day} out of range`);
      if (s.partialKey !== undefined) assert.ok(PARTIAL_KEYS.includes(s.partialKey), where);
      assert.ok(s.note && s.note.trim().length > 0, `${where}: week ${s.week} day ${s.day} has no note`);
    }
    for (let week = 1; week <= p.weeks; week++) {
      const days = p.sessions.filter((s) => s.week === week).map((s) => s.day).sort((a, b) => a - b);
      assert.deepEqual(days, Array.from({ length: p.daysPerWeek }, (_, i) => i + 1), `${where}: week ${week} days`);
    }
  }
});

test('partial sessions actually reduce volume', () => {
  for (const p of PROGRAM_SEEDS) {
    for (const s of p.sessions) {
      if (!s.partialKey || s.partialKey === 'full') continue;
      const w = workouts.get(s.workoutId)!;
      const fraction = PARTIAL_FRACTIONS.find((f) => f.key === s.partialKey)!.fraction;
      const scaled = scaleStructure(w.structure, fraction);
      assert.ok(
        estimateStructureMinutes(scaled) < estimateStructureMinutes(w.structure),
        `${p.id}: ${s.partialKey} ${s.workoutId} is not shorter than the full workout`,
      );
      // EMOM partials drop minute templates, which breaks the alternation.
      assert.ok(w.format !== 'emom' || w.structure.rounds.length === 1, `${p.id}: partial EMOM ${s.workoutId}`);
    }
  }
});

test('every program rematches a week-1 benchmark in its final week', () => {
  for (const p of PROGRAM_SEEDS) {
    const key = (s: (typeof p.sessions)[number]) => `${s.workoutId}:${s.partialKey ?? 'full'}`;
    const first = new Set(p.sessions.filter((s) => s.week === 1).map(key));
    const last = p.sessions.filter((s) => s.week === p.weeks).map(key);
    assert.ok(last.some((k) => first.has(k)), `${p.id}: nothing from week 1 is re-tested in week ${p.weeks}`);
  }
});

test('program equipment is exactly what its workouts need', () => {
  for (const p of PROGRAM_SEEDS) {
    const needed = new Set<string>();
    for (const s of p.sessions) {
      for (const eq of workouts.get(s.workoutId)!.equipment) if (!FREE_EQUIPMENT.has(eq)) needed.add(eq);
    }
    assert.deepEqual([...p.equipment].sort(), [...needed].sort(), p.id);
  }
});
