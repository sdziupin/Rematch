import type { ProgramSeed, ProgramSession } from '../content/types';

export function programSessionKey(s: Pick<ProgramSession, 'week' | 'day'>): string {
  return `w${s.week}d${s.day}`;
}

export interface ProgramProgress {
  done: number;
  total: number;
  fraction: number;
  next: ProgramSession | null;
  /** Current week (the week of the next session, or the last week when finished). */
  week: number;
  complete: boolean;
  weeks: { week: number; sessions: (ProgramSession & { key: string; done: boolean })[] }[];
}

export function orderedSessions(program: ProgramSeed): ProgramSession[] {
  return [...program.sessions].sort((a, b) => a.week - b.week || a.day - b.day);
}

/** Progress through a program given the keys of completed program sessions. */
export function programProgress(program: ProgramSeed, completedKeys: Set<string>): ProgramProgress {
  const sessions = orderedSessions(program);
  const next = sessions.find((s) => !completedKeys.has(programSessionKey(s))) ?? null;
  const done = sessions.filter((s) => completedKeys.has(programSessionKey(s))).length;
  const weeks: ProgramProgress['weeks'] = [];
  for (const s of sessions) {
    let w = weeks.find((x) => x.week === s.week);
    if (!w) {
      w = { week: s.week, sessions: [] };
      weeks.push(w);
    }
    const key = programSessionKey(s);
    w.sessions.push({ ...s, key, done: completedKeys.has(key) });
  }
  return {
    done,
    total: sessions.length,
    fraction: sessions.length ? done / sessions.length : 0,
    next,
    week: next?.week ?? sessions[sessions.length - 1]?.week ?? 1,
    complete: sessions.length > 0 && !next,
    weeks,
  };
}
