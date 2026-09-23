import assert from 'node:assert/strict';

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

export function adapt(database: DatabaseSync): Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'withTransactionAsync'> {
  return {
    async execAsync(sql) { database.exec(sql); },
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
  };
}
