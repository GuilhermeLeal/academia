import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrateWorkoutSessions(db: Pick<SQLiteDatabase, 'execAsync'>): Promise<void> {
  const uuid = `lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))`;
  await db.execAsync(`
    CREATE TABLE workout_sessions (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (${uuid}),
      workout_id TEXT REFERENCES workouts(id) ON DELETE SET NULL,
      workout_name TEXT NOT NULL CHECK(length(trim(workout_name)) BETWEEN 1 AND 100),
      started_at TEXT NOT NULL,
      finished_at TEXT,
      status TEXT NOT NULL CHECK(status IN ('active', 'completed')),
      CHECK(
        (status = 'active' AND finished_at IS NULL) OR
        (status = 'completed' AND finished_at IS NOT NULL)
      )
    );
    CREATE TABLE session_exercises (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (${uuid}),
      session_id TEXT NOT NULL REFERENCES workout_sessions(id) ON DELETE CASCADE,
      exercise_id TEXT REFERENCES exercises(id) ON DELETE SET NULL,
      exercise_name TEXT NOT NULL CHECK(length(trim(exercise_name)) > 0),
      position INTEGER NOT NULL CHECK(typeof(position) = 'integer' AND position >= 0),
      planned_sets INTEGER NOT NULL CHECK(typeof(planned_sets) = 'integer' AND planned_sets > 0),
      planned_reps_min INTEGER NOT NULL CHECK(typeof(planned_reps_min) = 'integer' AND planned_reps_min > 0),
      planned_reps_max INTEGER NOT NULL CHECK(typeof(planned_reps_max) = 'integer' AND planned_reps_max >= planned_reps_min),
      planned_rest_seconds INTEGER NOT NULL CHECK(typeof(planned_rest_seconds) = 'integer' AND planned_rest_seconds >= 0),
      UNIQUE(session_id, position)
    );
    CREATE TABLE session_sets (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (${uuid}),
      session_exercise_id TEXT NOT NULL REFERENCES session_exercises(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL CHECK(typeof(set_number) = 'integer' AND set_number > 0),
      weight REAL CHECK(weight IS NULL OR (typeof(weight) IN ('integer', 'real') AND weight >= 0)),
      reps INTEGER CHECK(reps IS NULL OR (typeof(reps) = 'integer' AND reps >= 0)),
      completed INTEGER NOT NULL DEFAULT 0 CHECK(completed IN (0, 1)),
      UNIQUE(session_exercise_id, set_number)
    );
    CREATE UNIQUE INDEX one_active_workout_session
      ON workout_sessions(status) WHERE status = 'active';
    CREATE INDEX session_exercises_session ON session_exercises(session_id, position);
    CREATE INDEX session_sets_exercise ON session_sets(session_exercise_id, set_number);
    CREATE INDEX workout_sessions_workout ON workout_sessions(workout_id, started_at);
  `);
}
