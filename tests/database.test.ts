import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { adapt } from './helpers/sqlite.ts';
import { DATABASE_VERSION, initializeDatabase } from '../src/db/migrations.ts';

import type { MigrationDatabase } from '../src/db/migrations.ts';

test('creates the technical schema and preserves it across reopen and repeated initialization', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'academia-test-'));
  const path = join(directory, 'local.db');
  let database = new DatabaseSync(path);
  try {
    await initializeDatabase(adapt(database));
    database.exec("INSERT INTO app_metadata VALUES ('preserve', 'yes')");
    database.close();
    database = new DatabaseSync(path);
    const db = adapt(database);
    await initializeDatabase(db);
    await initializeDatabase(db);
    assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION);
    assert.equal((await db.getFirstAsync<{ value: string }>("SELECT value FROM app_metadata WHERE key = 'preserve'"))?.value, 'yes');
    assert.equal((await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM app_metadata'))?.total, 2);
    assert.equal((await db.getFirstAsync<{ journal_mode: string }>('PRAGMA journal_mode'))?.journal_mode, 'wal');
  } finally {
    database.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.match(basename(directory), /^academia-test-/);
    rmSync(directory, { recursive: true });
  }
});

test('rolls back partial migration and version on failure, then allows a clean retry', async () => {
  const database = new DatabaseSync(':memory:');
  const db = adapt(database);
  let injectFailure = true;
  const failing: MigrationDatabase = {
    ...db,
    async execAsync(sql) {
      await db.execAsync(sql);
      if (injectFailure && sql.includes('CREATE TABLE')) {
        injectFailure = false;
        throw new Error('Simulated storage failure');
      }
    },
  };
  try {
    await assert.rejects(initializeDatabase(failing), /Simulated/);
    assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 0);
    assert.equal(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'app_metadata'"), null);
    await initializeDatabase(failing);
    assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION);
  } finally { database.close(); }
});

test('rejects a newer database without downgrading or deleting its data', async () => {
  const database = new DatabaseSync(':memory:');
  const db = adapt(database);
  try {
    await initializeDatabase(db);
    await db.execAsync('PRAGMA user_version = 99');
    await assert.rejects(initializeDatabase(db), /mais recente/);
    assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 99);
    assert.equal((await db.getFirstAsync<{ value: string }>("SELECT value FROM app_metadata WHERE key = 'foundation'"))?.value, 'ready');
  } finally { database.close(); }
});

test('fails visibly if the technical verification record is missing', async () => {
  const database = new DatabaseSync(':memory:');
  const db = adapt(database);
  try {
    await initializeDatabase(db);
    await db.execAsync('DELETE FROM app_metadata');
    await assert.rejects(initializeDatabase(db), /verificação/);
  } finally { database.close(); }
});
