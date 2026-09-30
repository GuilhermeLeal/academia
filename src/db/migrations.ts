import { migrateExercises } from './migrations/002-exercises.ts';
import { migrateWorkouts } from './migrations/003-workouts.ts';
import { migrateWorkoutSessions } from './migrations/004-workout-sessions.ts';

import type { SQLiteDatabase } from 'expo-sqlite';

// This subset also lets the migration run against SQLite in local checks.
export type MigrationDatabase = Pick<SQLiteDatabase, 'execAsync' | 'getFirstAsync' | 'runAsync' | 'withTransactionAsync'>;
export const DATABASE_VERSION = 4;

export async function initializeDatabase(db: MigrationDatabase): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  if (!version) throw new Error('Não foi possível ler a versão do banco local.');
  if (version.user_version > DATABASE_VERSION) {
    throw new Error('O banco local requer uma versão mais recente do aplicativo.');
  }

  // Runs before children mount, so no application queries can join this transaction.
  if (version.user_version < 1) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        CREATE TABLE app_metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );
        INSERT INTO app_metadata (key, value) VALUES ('foundation', 'ready');
        PRAGMA user_version = 1;
      `);
    });
  }

  const marker = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM app_metadata WHERE key = 'foundation';",
  );
  if (marker?.value !== 'ready') throw new Error('A verificação do banco local falhou.');

  if (version.user_version < 2) {
    await db.withTransactionAsync(async () => {
      await migrateExercises(db);
      await db.execAsync('PRAGMA user_version = 2;');
    });
  }
  if (version.user_version < 3) {
    await db.withTransactionAsync(async () => {
      await migrateWorkouts(db);
      await db.execAsync('PRAGMA user_version = 3;');
    });
  }
  if (version.user_version < 4) {
    await db.withTransactionAsync(async () => {
      await migrateWorkoutSessions(db);
      await db.execAsync('PRAGMA user_version = 4;');
    });
  }
}
