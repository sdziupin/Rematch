import type { ProgramSeed, ProgramSession } from './types';

/**
 * Multi-week plans. Every plan re-tests at least one benchmark in its final week with the
 * same variant as week 1, so the last session is a rematch against the first.
 * Partial variants (`partialKey`) build volume on the sessions in between.
 */

type Day = Omit<ProgramSession, 'week' | 'day'>;

/** Turns a list of weeks (each a list of days, in order) into numbered sessions. */
function schedule(weeks: Day[][]): ProgramSession[] {
  return weeks.flatMap((days, w) => days.map((d, i) => ({ week: w + 1, day: i + 1, ...d })));
}

export const PROGRAM_SEEDS: ProgramSeed[] = [
  {
    id: 'p-first-rematch',
    slug: 'first-rematch',
    name: 'FIRST REMATCH',
    symbol: '◎',
    identityColor: '#A3E635',
    tagline: 'Three weeks to beat the person who started.',
    description:
      'Three short bodyweight sessions a week. Week 1 sets two baselines, week 2 builds volume, and week 3 puts you back on the start line against your week-1 self.',
    level: 'beginner',
    goal: 'consistency',
    weeks: 3,
    daysPerWeek: 3,
    equipment: [],
    sessions: schedule([
      [
        { workoutId: 'w-ridge', partialKey: 'full', note: 'Baseline: steady pace, clean reps. This is the opponent you race in week 3.' },
        { workoutId: 'w-zephyr', partialKey: 'half', note: 'Two rounds only. Learn the movements before you chase the clock.' },
        { workoutId: 'w-dune', partialKey: 'full', note: 'Second baseline. Remember where the wall sit started to hurt.' },
      ],
      [
        { workoutId: 'w-squall', partialKey: 'full', note: 'Finish each minute fast and keep the rest you earn.' },
        { workoutId: 'w-zephyr', partialKey: 'three_quarter', note: 'Three rounds now, same quality.' },
        { workoutId: 'w-sandbar', partialKey: 'full', note: 'Break the big sets early so you never fully stop.' },
      ],
      [
        { workoutId: 'w-ridge', partialKey: 'full', note: 'Rematch. Find the round where you pull ahead of week 1.' },
        { workoutId: 'w-zephyr', partialKey: 'full', note: 'All four rounds, at the pace you built over the last two weeks.' },
        { workoutId: 'w-dune', partialKey: 'full', note: 'Final rematch. Beat your week-1 checkpoints and the plan is yours.' },
      ],
    ]),
  },
  {
    id: 'p-engine',
    slug: 'engine',
    name: 'ENGINE',
    symbol: '⟿',
    identityColor: '#22D3EE',
    tagline: 'Four weeks of intervals, chippers and long AMRAPs.',
    description:
      'A conditioning block that stretches GALE from 10 to 20 minutes while short, sharp intervals raise your ceiling. Week 4 rematches the opening tests.',
    level: 'intermediate',
    goal: 'conditioning',
    weeks: 4,
    daysPerWeek: 3,
    equipment: ['jump-rope'],
    sessions: schedule([
      [
        { workoutId: 'w-scorch', partialKey: 'full', note: 'Baseline: match interval 8 to interval 1 if you can.' },
        { workoutId: 'w-riptide', partialKey: 'full', note: 'Baseline chipper. Pace the jacks so the burpees do not bury you.' },
        { workoutId: 'w-gale', partialKey: 'half', note: 'Ten minutes. Find a pace you could hold for twenty.' },
      ],
      [
        { workoutId: 'w-drift', partialKey: 'full', note: 'Easy aerobic day: smooth movement, steady breathing.' },
        { workoutId: 'w-spindrift', partialKey: 'full', note: 'Keep the rope turning; recover on the climbers, not by stopping.' },
        { workoutId: 'w-gale', partialKey: 'three_quarter', note: 'Fifteen minutes at the pace you held last week.' },
      ],
      [
        { workoutId: 'w-surge', partialKey: 'full', note: 'Hard intervals: aim for the same burpee count every time it comes round.' },
        { workoutId: 'w-current', partialKey: 'full', note: 'Rope and jacks at a steady rhythm: no trips, no stops.' },
        { workoutId: 'w-gale', partialKey: 'full', note: 'The full twenty. This is the score you rematch next week.' },
      ],
      [
        { workoutId: 'w-scorch', partialKey: 'full', note: 'Rematch week 1. The last two intervals decide it.' },
        { workoutId: 'w-riptide', partialKey: 'full', note: 'Rematch. Attack the checkpoint where you lost time in week 1.' },
        { workoutId: 'w-gale', partialKey: 'full', note: 'Rematch last week: same twenty minutes, and one more round is a win.' },
      ],
    ]),
  },
  {
    id: 'p-midline',
    slug: 'midline',
    name: 'MIDLINE',
    symbol: '◈',
    identityColor: '#0F766E',
    tagline: 'Three weeks to a core that holds under fatigue.',
    description:
      'Planks, hollow work and rotation, three days a week. TRENCH grows from six to twelve intervals, and FROST is raced in week 1 and again in week 3.',
    level: 'intermediate',
    goal: 'general_fitness',
    weeks: 3,
    daysPerWeek: 3,
    equipment: [],
    sessions: schedule([
      [
        { workoutId: 'w-frost', partialKey: 'full', note: 'Baseline. Hold the plank honestly: every second is on the clock.' },
        { workoutId: 'w-mirage', partialKey: 'full', note: 'Slow and controlled; quality beats speed today.' },
        { workoutId: 'w-trench', partialKey: 'half', note: 'Six intervals. Learn the hollow rock before you race it.' },
      ],
      [
        { workoutId: 'w-ember', partialKey: 'full', note: 'Keep the plank strong at the end of every round.' },
        { workoutId: 'w-cinder', partialKey: 'three_quarter', note: 'Four rounds. Bend the knees in the hollow hold if your back lifts.' },
        { workoutId: 'w-trench', partialKey: 'three_quarter', note: 'Nine intervals, same reps per interval as last week.' },
      ],
      [
        { workoutId: 'w-frost', partialKey: 'full', note: 'Rematch. Beat your week-1 time without letting the plank slip.' },
        { workoutId: 'w-cinder', partialKey: 'full', note: 'All five rounds.' },
        { workoutId: 'w-trench', partialKey: 'full', note: 'All twelve intervals: the full benchmark.' },
      ],
    ]),
  },
  {
    id: 'p-loaded',
    slug: 'loaded',
    name: 'LOADED',
    symbol: '⬣',
    identityColor: '#D97706',
    tagline: 'Four weeks of dumbbell strength endurance.',
    description:
      'Squat, hinge, press and row under fatigue. FORGE and KILN grow from half to full volume, then everything is rematched in week 4 with the same dumbbells.',
    level: 'intermediate',
    goal: 'strength_endurance',
    weeks: 4,
    daysPerWeek: 3,
    equipment: ['dumbbells'],
    sessions: schedule([
      [
        { workoutId: 'w-basalt', partialKey: 'full', note: 'Baseline. Pick dumbbells you can press 8 times fresh, and keep them for all four weeks.' },
        { workoutId: 'w-forge', partialKey: 'half', note: 'Five intervals to groove the snatch and the squat.' },
        { workoutId: 'w-kiln', partialKey: 'half', note: 'Nine minutes. Smooth reps, no rushing the deadlift.' },
      ],
      [
        { workoutId: 'w-pebble', partialKey: 'full', note: 'Technique day: perfect positions on the four basics.' },
        { workoutId: 'w-forge', partialKey: 'three_quarter', note: 'Eight intervals. Match the reps per interval you hit last week.' },
        { workoutId: 'w-kiln', partialKey: 'three_quarter', note: 'Same weights, more minutes.' },
      ],
      [
        { workoutId: 'w-meteor', partialKey: 'full', note: 'If a minute runs out, keep the partial reps and reset for the next one.' },
        { workoutId: 'w-forge', partialKey: 'full', note: 'All ten intervals. Set the score for next week.' },
        { workoutId: 'w-kiln', partialKey: 'full', note: 'The full eighteen minutes. Set the score for next week.' },
      ],
      [
        { workoutId: 'w-basalt', partialKey: 'full', note: 'Rematch week 1 with the same dumbbells.' },
        { workoutId: 'w-forge', partialKey: 'full', note: 'Rematch. Beat last week one interval at a time.' },
        { workoutId: 'w-kiln', partialKey: 'full', note: 'Rematch. One more round than last week is the goal.' },
      ],
    ]),
  },
  {
    id: 'p-ascent',
    slug: 'ascent',
    name: 'ASCENT',
    symbol: '⟁',
    identityColor: '#84CC16',
    tagline: 'Four weeks from dead hangs to pull-ups under fatigue.',
    description:
      'Grip, negatives and chin-ups, building to pull-ups inside AMRAPs and EMOMs. OVERHANG opens and closes the plan so you can see exactly how far you climbed.',
    level: 'intermediate',
    goal: 'strength_endurance',
    weeks: 4,
    daysPerWeek: 3,
    equipment: ['pull-up-bar'],
    sessions: schedule([
      [
        { workoutId: 'w-overhang', partialKey: 'full', note: 'Baseline. Take at least three seconds on every negative.' },
        { workoutId: 'w-mirage', partialKey: 'full', note: 'Core control for the hollow position you use on the bar.' },
        { workoutId: 'w-crag', partialKey: 'half', note: 'Three rounds. Swap chin-ups for negatives if you need to; it logs as scaled.' },
      ],
      [
        { workoutId: 'w-overhang', partialKey: 'full', note: 'Same hangs, slower negatives than last week.' },
        { workoutId: 'w-torrent', partialKey: 'half', note: 'Seven minutes. Keep pull-up sets small and steady.' },
        { workoutId: 'w-crag', partialKey: 'three_quarter', note: 'Four rounds of chin-ups and knee raises.' },
      ],
      [
        { workoutId: 'w-granite', partialKey: 'full', note: 'Pull-ups on the minute; use the rest of the minute to recover.' },
        { workoutId: 'w-torrent', partialKey: 'three_quarter', note: 'Longer AMRAP, same strict reps: no swinging.' },
        { workoutId: 'w-crag', partialKey: 'full', note: 'All five rounds. This is the score you rematch next week.' },
      ],
      [
        { workoutId: 'w-overhang', partialKey: 'full', note: 'Rematch week 1. Your hangs and negatives should feel like a different athlete.' },
        { workoutId: 'w-torrent', partialKey: 'full', note: 'The full fourteen minutes.' },
        { workoutId: 'w-crag', partialKey: 'full', note: 'Rematch last week, and win it on the chin-ups.' },
      ],
    ]),
  },
  {
    id: 'p-gauntlet',
    slug: 'gauntlet',
    name: 'GAUNTLET',
    symbol: '▲',
    identityColor: '#EF4444',
    tagline: 'Four weeks. The hardest benchmarks in the library. Twice.',
    description:
      'Four sessions a week built from the elite tier. Week 1 sets the marks, PINNACLE climbs from five rungs to ten, and week 4 rematches every opening benchmark.',
    level: 'elite',
    goal: 'conditioning',
    weeks: 4,
    daysPerWeek: 4,
    equipment: ['bench', 'pull-up-bar', 'dumbbells'],
    sessions: schedule([
      [
        { workoutId: 'w-apex', partialKey: 'full', note: 'Baseline. Start the burpees at a pace you can hold for all 40.' },
        { workoutId: 'w-inferno', partialKey: 'full', note: 'Baseline. Count every rep; the 10-second rests are not optional.' },
        { workoutId: 'w-bastion', partialKey: 'full', note: 'Baseline. The decline push-ups decide your time.' },
        { workoutId: 'w-pinnacle', partialKey: 'half', note: 'Five rungs. Groove fast transitions between bar and floor.' },
      ],
      [
        { workoutId: 'w-quake', partialKey: 'full', note: 'Land quietly every rep; sloppy landings cost more than time.' },
        { workoutId: 'w-meteor', partialKey: 'full', note: 'Hold every minute. Missing one is a checkpoint you give away.' },
        { workoutId: 'w-summit', partialKey: 'full', note: 'Bank the early rungs fast, then survive the top.' },
        { workoutId: 'w-pinnacle', partialKey: 'three_quarter', note: 'Eight rungs.' },
      ],
      [
        { workoutId: 'w-magma', partialKey: 'full', note: 'Break the devil presses into small sets from the very first rep.' },
        { workoutId: 'w-scorch', partialKey: 'full', note: 'Four minutes all out, then recover hard before tomorrow.' },
        { workoutId: 'w-thunder', partialKey: 'full', note: 'Quality landings over raw speed.' },
        { workoutId: 'w-pinnacle', partialKey: 'full', note: 'The full ladder. Set the score for next week.' },
      ],
      [
        { workoutId: 'w-apex', partialKey: 'full', note: 'Rematch week 1. Win the 40-burpee checkpoint first.' },
        { workoutId: 'w-inferno', partialKey: 'full', note: 'Rematch. More reps than week 1 in every interval.' },
        { workoutId: 'w-bastion', partialKey: 'full', note: 'Rematch. Fewer pauses, same strict reps.' },
        { workoutId: 'w-pinnacle', partialKey: 'full', note: 'Rematch the full ladder from last week and finish the gauntlet.' },
      ],
    ]),
  },
];
