import { seedExercises } from '../../features/exercises/seed.ts';

import type { SQLiteDatabase } from 'expo-sqlite';

export async function migrateExercises(db: Pick<SQLiteDatabase, 'execAsync' | 'runAsync'>): Promise<void> {
  await db.execAsync(`
    CREATE TABLE exercises (
      id TEXT PRIMARY KEY NOT NULL DEFAULT (
        lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-4' ||
        substr(hex(randomblob(2)), 2) || '-' || substr('89ab', (random() & 3) + 1, 1) ||
        substr(hex(randomblob(2)), 2) || '-' || hex(randomblob(6)))
      ),
      name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 2 AND 80),
      normalized_name TEXT NOT NULL CHECK(length(normalized_name) > 0),
      muscle_group TEXT NOT NULL CHECK(length(trim(muscle_group)) BETWEEN 2 AND 60),
      equipment TEXT CHECK(equipment IS NULL OR length(equipment) <= 60),
      image_uri TEXT,
      is_custom INTEGER NOT NULL DEFAULT 0 CHECK(is_custom IN (0, 1)),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX exercises_name_order ON exercises(normalized_name, id);
    CREATE TABLE exercise_aliases (
      exercise_id TEXT NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
      alias TEXT NOT NULL,
      normalized_alias TEXT NOT NULL,
      PRIMARY KEY (exercise_id, normalized_alias)
    );
  `);
  await seedExercises(db);
}
