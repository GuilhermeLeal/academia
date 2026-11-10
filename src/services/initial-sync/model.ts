import type { Database } from '../supabase/database.types.ts';

export const syncTables = [
  'exercises', 'workouts', 'workout_exercises', 'workout_sessions', 'session_exercises', 'session_sets',
] as const;
export type SyncTable = typeof syncTables[number];
export type SyncRow<T extends SyncTable> = Database['public']['Tables'][T]['Row'];
export type SyncSnapshot = { [T in SyncTable]: SyncRow<T>[] };
export type SyncCounts = Record<SyncTable, number>;
export type SyncReceipt = { version: 1; userId: string; counts: SyncCounts; sha256: string };
export type SnapshotDigest = (value: string) => Promise<string>;
export interface InitialSyncRemote {
  assertIdentity(): Promise<void>;
  read(): Promise<SyncSnapshot>;
  insertMissing(snapshot: SyncSnapshot): Promise<void>;
}
export type InitialSyncResult =
  | { status: 'uploaded' | 'already-synced'; counts: SyncCounts; receipt: SyncReceipt }
  | { status: 'restored' | 'empty'; counts: SyncCounts }
  | { status: 'conflict'; reason: 'both-have-data' | 'local-not-empty' | 'legacy-data' | 'local-changed' | 'remote-changed' | 'receipt-required' | 'receipt-mismatch'; counts: SyncCounts };

export function emptySnapshot(): SyncSnapshot {
  return { exercises: [], workouts: [], workout_exercises: [], workout_sessions: [], session_exercises: [], session_sets: [] };
}

export function counts(snapshot: SyncSnapshot): SyncCounts {
  return Object.fromEntries(syncTables.map((table) => [table, snapshot[table].length])) as SyncCounts;
}

export function isEmpty(snapshot: SyncSnapshot): boolean {
  return syncTables.every((table) => snapshot[table].length === 0);
}

/** Ignore only metadata that cannot round-trip through SQLite v5/the server trigger. */
export function signature(snapshot: SyncSnapshot, domainOnly = false): string {
  const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
  return JSON.stringify(syncTables.map((table) => [table,
    [...snapshot[table]].sort((a, b) => compare(a.id, b.id)).map((row) =>
      Object.fromEntries(Object.entries(row).sort(([a], [b]) => compare(a, b)).filter(([key]) =>
        !domainOnly || (key !== 'updated_at' && !(key === 'created_at' &&
          ['workout_sessions', 'session_exercises', 'session_sets'].includes(table))),
      ).map(([key, value]) => [key, key.endsWith('_at') && typeof value === 'string'
        ? new Date(value).toISOString() : value])),
    ),
  ]));
}

export function validateSnapshot(snapshot: SyncSnapshot, userId: string, standardIds: Set<string>): void {
  const ids = Object.fromEntries(syncTables.map((table) => [table, new Set(snapshot[table].map((row) => row.id))])) as Record<SyncTable, Set<string>>;
  const require = (condition: boolean) => { if (!condition) throw new Error('Snapshot inválido ou incompatível; nenhuma restauração foi aplicada.'); };
  for (const table of syncTables) {
    require(ids[table].size === snapshot[table].length);
    for (const row of snapshot[table]) {
      require(row.user_id === userId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(row.id));
    }
  }
  for (const row of snapshot.exercises) require(row.is_custom && !standardIds.has(row.id));
  const exerciseExists = (id: string) => ids.exercises.has(id) || standardIds.has(id);
  for (const row of snapshot.workout_exercises) require(ids.workouts.has(row.workout_id) && exerciseExists(row.exercise_id));
  for (const row of snapshot.workout_sessions) require(row.workout_id === null || ids.workouts.has(row.workout_id));
  for (const row of snapshot.session_exercises) require(ids.workout_sessions.has(row.session_id) && (row.exercise_id === null || exerciseExists(row.exercise_id)));
  for (const row of snapshot.session_sets) require(ids.session_exercises.has(row.session_exercise_id));
}

/** Project tombstones onto SQLite's existing DELETE/SET NULL semantics. */
export function liveSnapshot(snapshot: SyncSnapshot): SyncSnapshot {
  const exercises = snapshot.exercises.filter((row) => row.deleted_at === null);
  const deletedExercises = new Set(snapshot.exercises.filter((row) => row.deleted_at !== null).map((row) => row.id));
  const workouts = snapshot.workouts.filter((row) => row.deleted_at === null);
  const workoutIds = new Set(workouts.map((row) => row.id));
  const sessions = snapshot.workout_sessions.filter((row) => row.deleted_at === null).map((row) => ({
    ...row, workout_id: row.workout_id && workoutIds.has(row.workout_id) ? row.workout_id : null,
  }));
  const sessionIds = new Set(sessions.map((row) => row.id));
  const sessionExercises = snapshot.session_exercises.filter((row) => row.deleted_at === null && sessionIds.has(row.session_id)).map((row) => ({
    ...row, exercise_id: row.exercise_id && deletedExercises.has(row.exercise_id) ? null : row.exercise_id,
  }));
  const sessionExerciseIds = new Set(sessionExercises.map((row) => row.id));
  return {
    exercises, workouts,
    workout_exercises: snapshot.workout_exercises.filter((row) => row.deleted_at === null && workoutIds.has(row.workout_id) && !deletedExercises.has(row.exercise_id)),
    workout_sessions: sessions, session_exercises: sessionExercises,
    session_sets: snapshot.session_sets.filter((row) => row.deleted_at === null && sessionExerciseIds.has(row.session_exercise_id)),
  };
}
