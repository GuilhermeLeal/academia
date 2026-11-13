import { exerciseCatalog } from '../../features/exercises/catalog.ts';
import { normalizeExerciseText } from '../../features/exercises/normalize.ts';

import type { SQLiteDatabase } from 'expo-sqlite';

/** Additive, transaction-owned by initializeDatabase. Never replaces a row or FK. */
export async function migrateExerciseCatalog(db: Pick<SQLiteDatabase, 'runAsync'>): Promise<void> {
  for (const exercise of exerciseCatalog) {
    const timestamp = '2026-11-13T00:00:00.000Z';
    const image = `repdb://${exercise.source}/thumb.webp`;
    await db.runAsync(`INSERT INTO exercises
      (id, name, normalized_name, muscle_group, equipment, image_uri, is_custom, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?) ON CONFLICT(id) DO NOTHING`,
    exercise.id, exercise.name, normalizeExerciseText(exercise.name), exercise.muscleGroup,
    exercise.equipment, image, timestamp, timestamp);
    // Retain the original names, IDs, dates and ownership; only attach media metadata.
    await db.runAsync(`UPDATE exercises SET image_uri = ?
      WHERE id = ? AND is_custom = 0 AND user_id IS NULL`, image, exercise.id);
    for (const alias of exercise.aliases) {
      await db.runAsync(`INSERT INTO exercise_aliases (exercise_id, alias, normalized_alias)
        VALUES (?, ?, ?) ON CONFLICT(exercise_id, normalized_alias) DO NOTHING`,
      exercise.id, alias, normalizeExerciseText(alias));
    }
  }
}
