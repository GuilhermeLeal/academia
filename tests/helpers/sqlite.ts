import assert from 'node:assert/strict';

import type { WorkoutDatabase } from '../../src/features/workouts/repository.ts';
import type { UserId } from '../../src/types/identity.ts';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { DatabaseSync, SQLInputValue } from 'node:sqlite';

// The app uses positional parameters only. Keep the real SQL engine in all tests.
function bindings(params: unknown[]): SQLInputValue[] {
  const values: unknown[] = Array.isArray(params[0]) ? params[0] : params;
  return values.map((value) => {
    if (typeof value === 'boolean') return Number(value);
    assert(value === null || typeof value === 'string' || typeof value === 'number' || value instanceof Uint8Array);
    return value;
  });
}

export const TEST_USER_ID = '00000000-0000-4000-8000-000000000001' as UserId;

export function adapt(
  database: DatabaseSync,
  userId: UserId = TEST_USER_ID,
): Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'withTransactionAsync'> & WorkoutDatabase {
  const ensureLocalUser = () => {
    const table = database.prepare(
      "SELECT 1 AS found FROM sqlite_master WHERE type = 'table' AND name = 'local_users'",
    ).get();
    if (table) {
      database.prepare(
        'INSERT OR IGNORE INTO local_users (id, phone, authenticated_at) VALUES (?, ?, ?)',
      ).run(userId, '+5511999999999', '2026-01-01T00:00:00.000Z');
    }
  };
  const adapter: ReturnType<typeof adapt> = {
    userId,
    async execAsync(sql) { database.exec(sql); ensureLocalUser(); },
    async runAsync(sql: string, ...params: unknown[]) {
      const result = database.prepare(sql).run(...bindings(params));
      return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
    },
    async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
      return (database.prepare(sql).get(...bindings(params)) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
      return database.prepare(sql).all(...bindings(params)) as T[];
    },
    async withTransactionAsync(task) {
      database.exec('BEGIN');
      try { await task(); database.exec('COMMIT'); }
      catch (error) { database.exec('ROLLBACK'); throw error; }
    },
    async transaction(task) { await adapter.withTransactionAsync(() => task(adapter)); },
  };
  return adapter;
}
