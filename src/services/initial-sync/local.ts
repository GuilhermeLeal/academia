import { syncTables } from './model.ts';

import type { SyncRow, SyncSnapshot, SyncTable } from './model.ts';
import type { WorkoutTransaction } from '../../features/workouts/repository.ts';

// Fixed column allowlists shared by export and import; no application data is SQL.
const columns = {
  exercises: ['id', 'user_id', 'name', 'normalized_name', 'muscle_group', 'equipment', 'image_uri', 'is_custom', 'created_at', 'updated_at'],
  workouts: ['id', 'user_id', 'name', 'description', 'created_at', 'updated_at'],
  workout_exercises: ['id', 'user_id', 'workout_id', 'exercise_id', 'position', 'sets', 'reps_min', 'reps_max', 'rest_seconds', 'created_at', 'updated_at'],
  workout_sessions: ['id', 'user_id', 'workout_id', 'workout_name', 'started_at', 'finished_at', 'status'],
  session_exercises: ['id', 'user_id', 'session_id', 'exercise_id', 'exercise_name', 'position', 'planned_sets', 'planned_reps_min', 'planned_reps_max', 'planned_rest_seconds'],
  session_sets: ['id', 'user_id', 'session_exercise_id', 'set_number', 'weight', 'reps', 'completed'],
} as const satisfies { [T in SyncTable]: readonly (keyof SyncRow<T>)[] };

export async function readLocalSnapshot(db: WorkoutTransaction): Promise<SyncSnapshot> {
  const exercises = await db.getAllAsync<Omit<SyncRow<'exercises'>, 'is_custom'> & { is_custom: number }>(
    `SELECT ${columns.exercises.join(', ')}, NULL AS deleted_at FROM exercises WHERE user_id = ? AND is_custom = 1 ORDER BY id`, db.userId,
  );
  const workouts = await db.getAllAsync<SyncRow<'workouts'>>(
    `SELECT ${columns.workouts.join(', ')}, NULL AS deleted_at FROM workouts WHERE user_id = ? ORDER BY id`, db.userId,
  );
  const workoutExercises = await db.getAllAsync<SyncRow<'workout_exercises'>>(
    `SELECT ${columns.workout_exercises.join(', ')}, NULL AS deleted_at FROM workout_exercises WHERE user_id = ? ORDER BY id`, db.userId,
  );
  const sessions = await db.getAllAsync<SyncRow<'workout_sessions'>>(
    `SELECT ${columns.workout_sessions.join(', ')}, started_at AS created_at,
      coalesce(finished_at, started_at) AS updated_at, NULL AS deleted_at
     FROM workout_sessions WHERE user_id = ? ORDER BY id`, db.userId,
  );
  const sessionExercises = await db.getAllAsync<SyncRow<'session_exercises'>>(
    `SELECT ${columns.session_exercises.map((column) => `se.${column}`).join(', ')},
      ws.started_at AS created_at, coalesce(ws.finished_at, ws.started_at) AS updated_at, NULL AS deleted_at
     FROM session_exercises se JOIN workout_sessions ws ON ws.id = se.session_id AND ws.user_id = se.user_id
     WHERE se.user_id = ? ORDER BY se.id`, db.userId,
  );
  const sets = await db.getAllAsync<Omit<SyncRow<'session_sets'>, 'completed'> & { completed: number }>(
    `SELECT ${columns.session_sets.map((column) => `ss.${column}`).join(', ')},
      ws.started_at AS created_at, coalesce(ws.finished_at, ws.started_at) AS updated_at, NULL AS deleted_at
     FROM session_sets ss JOIN session_exercises se ON se.id = ss.session_exercise_id AND se.user_id = ss.user_id
     JOIN workout_sessions ws ON ws.id = se.session_id AND ws.user_id = se.user_id
     WHERE ss.user_id = ? ORDER BY ss.id`, db.userId,
  );
  return {
    exercises: exercises.map((row) => ({ ...row, is_custom: row.is_custom === 1 })), workouts,
    workout_exercises: workoutExercises, workout_sessions: sessions, session_exercises: sessionExercises,
    session_sets: sets.map((row) => ({ ...row, completed: row.completed === 1 })),
  };
}

export async function standardExerciseIds(db: WorkoutTransaction): Promise<Set<string>> {
  return new Set((await db.getAllAsync<{ id: string }>(
    'SELECT id FROM exercises WHERE is_custom = 0 AND user_id IS NULL',
  )).map((row) => row.id));
}

/** Caller must hold the local transaction and have checked per-user emptiness. */
export async function insertLocalSnapshot(db: WorkoutTransaction, snapshot: SyncSnapshot): Promise<void> {
  await db.runAsync('INSERT INTO local_users (id, authenticated_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING', db.userId, new Date().toISOString());
  await db.runAsync('INSERT OR IGNORE INTO sync_suppression(user_id) VALUES (?)', db.userId);
  for (const table of syncTables) {
    const names: readonly string[] = columns[table];
    for (const row of snapshot[table]) {
      const values = names.map((column) => {
        const value = (row as Record<string, unknown>)[column];
        if (typeof value === 'boolean') return Number(value);
        if (column.endsWith('_at') && typeof value === 'string') return new Date(value).toISOString();
        if (value === null || typeof value === 'string' || typeof value === 'number') return value;
        throw new Error('Campo inválido no snapshot remoto.');
      });
      // Deliberately INSERT, not REPLACE/upsert: a collision rolls back, never steals another account's UUID.
      await db.runAsync(`INSERT INTO ${table} (${names.join(', ')}) VALUES (${names.map(() => '?').join(', ')})`, values);
    }
  }
  await db.runAsync('DELETE FROM sync_suppression WHERE user_id = ?', db.userId);
}
