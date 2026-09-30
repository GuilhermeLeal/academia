import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrateWorkouts(db: Pick<SQLiteDatabase, 'execAsync'>): Promise<void> {
  const uuid = `lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
    substr(hex(randomblob(2)), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) ||
    substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))`;
  await db.execAsync(`
    CREATE TABLE workouts (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (${uuid}),
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
      description TEXT CHECK(description IS NULL OR length(description) <= 1000),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE workout_exercises (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (${uuid}),
      workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE RESTRICT,
      position INTEGER NOT NULL CHECK(typeof(position) = 'integer' AND position >= 0),
      sets INTEGER NOT NULL CHECK(typeof(sets) = 'integer' AND sets > 0),
      reps_min INTEGER NOT NULL CHECK(typeof(reps_min) = 'integer' AND reps_min > 0),
      reps_max INTEGER NOT NULL CHECK(typeof(reps_max) = 'integer' AND reps_max >= reps_min),
      rest_seconds INTEGER NOT NULL CHECK(typeof(rest_seconds) = 'integer' AND rest_seconds >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(workout_id, exercise_id),
      UNIQUE(workout_id, position)
    );
    CREATE INDEX workout_exercises_exercise ON workout_exercises(exercise_id);
    CREATE INDEX workouts_creation ON workouts(created_at, id);
  `);
}
