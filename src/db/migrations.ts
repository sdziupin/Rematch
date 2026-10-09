import type { SqlDriver } from './driver';

/**
 * Schema migrations, tracked with `PRAGMA user_version`.
 * Version 1 is the original schema (installs created before versioning report 0
 * and are brought forward safely because every v1 statement is idempotent).
 */

/** The original schema (exported for upgrade tests). */
export const V1 = `
CREATE TABLE IF NOT EXISTS user_profile (
  id TEXT PRIMARY KEY,
  goal TEXT NOT NULL,
  level TEXT NOT NULL,
  typical_minutes INTEGER NOT NULL,
  frequency_days INTEGER NOT NULL,
  restrictions TEXT,
  equipment_json TEXT NOT NULL,
  onboarding_complete INTEGER NOT NULL DEFAULT 0,
  haptics_enabled INTEGER NOT NULL DEFAULT 1,
  sound_enabled INTEGER NOT NULL DEFAULT 1,
  voice_enabled INTEGER NOT NULL DEFAULT 0,
  keep_awake_enabled INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS exercises (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  instructions TEXT NOT NULL,
  start_position TEXT NOT NULL,
  movement_sequence TEXT NOT NULL,
  cues_json TEXT NOT NULL,
  mistakes_json TEXT NOT NULL,
  primary_muscles_json TEXT NOT NULL,
  secondary_muscles_json TEXT NOT NULL,
  category TEXT NOT NULL,
  equipment_json TEXT NOT NULL,
  impact_level TEXT NOT NULL,
  easier_variant_id TEXT,
  harder_variant_id TEXT,
  visual_asset TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workouts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  focus TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  estimated_minutes_min INTEGER NOT NULL,
  estimated_minutes_max INTEGER NOT NULL,
  equipment_json TEXT NOT NULL,
  format TEXT NOT NULL,
  identity_color TEXT NOT NULL,
  visual_asset TEXT NOT NULL,
  progression_tier TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_versions (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL REFERENCES workouts(id),
  version INTEGER NOT NULL,
  structure_json TEXT NOT NULL,
  rules_json TEXT NOT NULL,
  is_current INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_variants (
  id TEXT PRIMARY KEY,
  workout_version_id TEXT NOT NULL REFERENCES workout_versions(id),
  partial_key TEXT NOT NULL,
  label TEXT NOT NULL,
  fraction REAL NOT NULL,
  structure_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_sessions (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL,
  workout_version_id TEXT NOT NULL,
  workout_variant_id TEXT NOT NULL,
  opponent_session_id TEXT,
  scaling_category TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  elapsed_active_ms INTEGER NOT NULL DEFAULT 0,
  paused_accumulated_ms INTEGER NOT NULL DEFAULT 0,
  last_paused_at INTEGER,
  current_state_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_session_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES workout_sessions(id),
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  elapsed_active_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_checkpoints (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES workout_sessions(id),
  checkpoint_key TEXT NOT NULL,
  label TEXT NOT NULL,
  elapsed_active_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workout_results (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES workout_sessions(id),
  workout_id TEXT NOT NULL,
  workout_version_id TEXT NOT NULL,
  workout_variant_id TEXT NOT NULL,
  scaling_category TEXT NOT NULL,
  completion_ms INTEGER NOT NULL,
  is_complete INTEGER NOT NULL,
  is_abandoned INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS personal_bests (
  id TEXT PRIMARY KEY,
  workout_id TEXT NOT NULL,
  workout_version_id TEXT NOT NULL,
  workout_variant_id TEXT NOT NULL,
  scaling_category TEXT NOT NULL,
  result_id TEXT NOT NULL REFERENCES workout_results(id),
  session_id TEXT NOT NULL,
  completion_ms INTEGER NOT NULL,
  achieved_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS post_workout_feedback (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE REFERENCES workout_sessions(id),
  intensity TEXT,
  technique TEXT,
  pain_reported INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON workout_sessions(status);
CREATE INDEX IF NOT EXISTS idx_results_workout ON workout_results(workout_id, workout_variant_id, scaling_category);
CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON workout_checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_events_session ON workout_session_events(session_id);
`;

/** Columns added in v2: [table, column, definition]. */
const V2_COLUMNS: [string, string, string][] = [
  ['user_profile', 'countdown_sec', 'INTEGER NOT NULL DEFAULT 3'],
  ['user_profile', 'week_starts_on', 'INTEGER NOT NULL DEFAULT 1'],
  ['user_profile', 'display_name', 'TEXT'],
  ['workouts', 'description', 'TEXT'],
  ['workouts', 'kind', "TEXT NOT NULL DEFAULT 'benchmark'"],
  ['workouts', 'source', "TEXT NOT NULL DEFAULT 'library'"],
  ['workouts', 'archived', 'INTEGER NOT NULL DEFAULT 0'],
  ['workout_versions', 'content_hash', 'TEXT'],
  ['workout_sessions', 'program_enrollment_id', 'TEXT'],
  ['workout_sessions', 'program_session_key', 'TEXT'],
  ['workout_checkpoints', 'reps', 'INTEGER'],
  ['workout_results', 'score_type', "TEXT NOT NULL DEFAULT 'time'"],
  ['workout_results', 'score_reps', 'INTEGER'],
  ['workout_results', 'rounds_completed', 'INTEGER'],
  ['workout_results', 'total_reps', 'INTEGER'],
  ['workout_results', 'time_capped', 'INTEGER NOT NULL DEFAULT 0'],
  ['personal_bests', 'score_type', "TEXT NOT NULL DEFAULT 'time'"],
  ['personal_bests', 'score_reps', 'INTEGER'],
  ['post_workout_feedback', 'note', 'TEXT'],
];

const V2_TABLES = `
CREATE TABLE IF NOT EXISTS program_enrollments (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS app_meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_results_created ON workout_results(created_at);
CREATE INDEX IF NOT EXISTS idx_results_session ON workout_results(session_id);
CREATE INDEX IF NOT EXISTS idx_pb_lookup ON personal_bests(workout_id, workout_version_id, workout_variant_id, scaling_category);
CREATE INDEX IF NOT EXISTS idx_versions_workout ON workout_versions(workout_id);
CREATE INDEX IF NOT EXISTS idx_variants_version ON workout_variants(workout_version_id);
CREATE INDEX IF NOT EXISTS idx_sessions_enrollment ON workout_sessions(program_enrollment_id);
`;

export const SCHEMA_VERSION = 2;

async function columnNames(driver: SqlDriver, table: string): Promise<Set<string>> {
  const rows = (await driver.query(`PRAGMA table_info(${table})`, [], 'all')) as unknown[][];
  // table_info columns: cid, name, type, notnull, dflt_value, pk
  return new Set(rows.map((r) => String(r[1])));
}

export async function getSchemaVersion(driver: SqlDriver): Promise<number> {
  const row = (await driver.query('PRAGMA user_version', [], 'get')) as unknown[] | undefined;
  return Number(row?.[0] ?? 0);
}

export async function migrate(driver: SqlDriver): Promise<void> {
  const version = await getSchemaVersion(driver);
  if (version < 1) {
    await driver.exec(V1);
  }
  if (version < 2) {
    for (const [table, column, definition] of V2_COLUMNS) {
      const existing = await columnNames(driver, table);
      if (!existing.has(column)) {
        await driver.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
      }
    }
    await driver.exec(V2_TABLES);
  }
  if (version < SCHEMA_VERSION) {
    await driver.exec(`PRAGMA user_version = ${SCHEMA_VERSION};`);
  }
}
