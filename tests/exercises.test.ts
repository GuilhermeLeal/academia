import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { adapt } from './helpers/sqlite.ts';
import { DATABASE_VERSION, initializeDatabase } from '../src/db/migrations.ts';
import { normalizeExerciseText } from '../src/features/exercises/normalize.ts';
import { createCustomExercise, getExercise, searchExercises, updateCustomExercise } from '../src/features/exercises/repository.ts';
import { CATALOG_SIZE, seedExercises } from '../src/features/exercises/seed.ts';

async function withDatabase(task: (db: ReturnType<typeof adapt>) => Promise<void>) {
  const database = new DatabaseSync(':memory:');
  try {
    const db = adapt(database);
    await initializeDatabase(db);
    await task(db);
  } finally { database.close(); }
}

test('normalizes accents, case, decomposed Unicode and extra whitespace consistently', () => {
  assert.equal(normalizeExerciseText('  ELEVAÇÃO\tLateral  '), 'elevacao lateral');
  assert.equal(normalizeExerciseText('TRI\u0301CEPS  FRANCÊS'), 'triceps frances');
  assert.equal(normalizeExerciseText(' \n '), '');
  assert.equal(normalizeExerciseText('Barra 100%_'), 'barra 100%_');
});

test('upgrades a populated version 1 database without altering its metadata', async () => {
  const database = new DatabaseSync(':memory:');
  const db = adapt(database);
  try {
    await db.execAsync(`
      CREATE TABLE app_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      INSERT INTO app_metadata VALUES ('foundation', 'ready'), ('existing', 'preserved');
      PRAGMA user_version = 1;
    `);
    await initializeDatabase(db);
    assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION);
    assert.equal((await db.getFirstAsync<{ value: string }>("SELECT value FROM app_metadata WHERE key = 'existing'"))?.value, 'preserved');
    assert.equal((await searchExercises(db, '')).length, CATALOG_SIZE);
  } finally { database.close(); }
});

test('rolls back all of migration 2, including a partially written seed, then retries successfully', async () => {
  const database = new DatabaseSync(':memory:');
  const db = adapt(database);
  try {
    await db.execAsync(`CREATE TABLE app_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      INSERT INTO app_metadata VALUES ('foundation', 'ready'); PRAGMA user_version = 1;`);
    let writes = 0;
    await assert.rejects(initializeDatabase({
      ...db,
      async runAsync(sql: string, ...params: unknown[]) {
        writes += 1;
        if (writes === 3) throw new Error('Seed failure');
        // Preserve the actual prepared statement behavior of the shared adapter.
        return db.runAsync(sql, params as string[]);
      },
    }), /Seed failure/);
    assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 1);
    assert.equal(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'exercises'"), null);
    await initializeDatabase(db);
    assert.equal((await searchExercises(db, '')).length, CATALOG_SIZE);
  } finally { database.close(); }
});

test('seed is idempotent for exercises and aliases and preserves custom exercises', async () => {
  await withDatabase(async (db) => {
    const custom = await createCustomExercise(db, { name: 'Remada familiar', muscleGroup: 'Costas', equipment: 'Elástico' });
    const aliases = await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM exercise_aliases');
    await seedExercises(db);
    await seedExercises(db);
    await initializeDatabase(db);
    assert.equal((await searchExercises(db, '')).length, CATALOG_SIZE + 1);
    assert.equal((await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM exercise_aliases'))?.total, aliases?.total);
    assert.deepEqual(await getExercise(db, custom.id), custom);
  });
});

test('search finds supino variants, accent-insensitive names, aliases and unordered terms without duplicates', async () => {
  await withDatabase(async (db) => {
    const supinos = await searchExercises(db, 'SUPINO');
    assert.deepEqual(supinos.map((row) => row.name).sort(), ['Supino Articulado', 'Supino Inclinado', 'Supino Máquina', 'Supino Reto'].sort());
    assert.equal((await searchExercises(db, 'elevacao'))[0]?.name, 'Elevação Lateral');
    assert.equal((await searchExercises(db, 'triceps frances'))[0]?.name, 'Tríceps Francês');
    assert.equal((await searchExercises(db, 'voador'))[0]?.name, 'Crucifixo Máquina');
    assert.equal((await searchExercises(db, 'barra SUPINO'))[0]?.name, 'Supino Reto');
    assert.equal((await searchExercises(db, 'supino reto')).length, 1);
    assert.equal((await searchExercises(db, 'bench press')).length, 2);
    assert.equal((await searchExercises(db, '   ')).length, CATALOG_SIZE);
    assert.deepEqual(await searchExercises(db, 'zzzinexistente'), []);
  });
});

test('search treats wildcard and SQL-like input literally and orders exact matches first', async () => {
  await withDatabase(async (db) => {
    await createCustomExercise(db, { name: 'Supino', muscleGroup: 'Peitoral', equipment: '' });
    await createCustomExercise(db, { name: "Remada d'água 100%_", muscleGroup: 'Costas', equipment: '' });
    assert.equal((await searchExercises(db, 'supino'))[0]?.name, 'Supino');
    assert.equal((await searchExercises(db, '100%_')).length, 1);
    assert.equal((await searchExercises(db, "d'agua"))[0]?.name, "Remada d'água 100%_");
    assert.deepEqual(await searchExercises(db, "' OR 1=1 --"), []);
    assert.equal((await searchExercises(db, '')).length, CATALOG_SIZE + 2);
  });
});

test('creates independent UUIDs and rejects invalid custom inputs before writing', async () => {
  await withDatabase(async (db) => {
    const input = { name: '  Elevação   em casa ', muscleGroup: ' Ombros ', equipment: ' ' };
    const first = await createCustomExercise(db, input);
    const second = await createCustomExercise(db, input);
    assert.match(first.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.notEqual(first.id, second.id);
    assert.equal(first.name, 'Elevação em casa');
    assert.equal(first.normalizedName, 'elevacao em casa');
    assert.equal(first.isCustom, true);
    assert.equal(first.equipment, null);
    assert.equal(first.imageUri, null);
    assert.equal(first.createdAt, first.updatedAt);
    for (const invalid of [
      { ...input, name: '' }, { ...input, name: 'A' }, { ...input, name: '---' },
      { ...input, name: 'a'.repeat(81) }, { ...input, muscleGroup: ' ' },
      { ...input, equipment: 'a'.repeat(61) },
    ]) await assert.rejects(createCustomExercise(db, invalid));
    assert.equal((await searchExercises(db, '')).length, CATALOG_SIZE + 2);
  });
});

test('editing updates search, preserves identity/creation/image and forbids standard or missing IDs', async () => {
  await withDatabase(async (db) => {
    const original = await createCustomExercise(db, { name: 'Remada caseira', muscleGroup: 'Costas', equipment: '' });
    await db.runAsync('UPDATE exercises SET image_uri = ?, updated_at = ? WHERE id = ?', 'file:///future-image.jpg', '2000-01-01T00:00:00.000Z', original.id);
    const updated = await updateCustomExercise(db, original.id, { name: 'Puxada com elástico', muscleGroup: 'Costas', equipment: 'Elástico' });
    assert.equal(updated.id, original.id);
    assert.equal(updated.createdAt, original.createdAt);
    assert.equal(updated.imageUri, 'file:///future-image.jpg');
    assert.notEqual(updated.updatedAt, '2000-01-01T00:00:00.000Z');
    assert.deepEqual(await searchExercises(db, 'caseira'), []);
    assert.equal((await searchExercises(db, 'puxada elastico'))[0]?.id, original.id);
    const standard = (await searchExercises(db, 'supino reto'))[0];
    assert(standard);
    const input = { name: 'Alterado', muscleGroup: 'Costas', equipment: '' };
    await assert.rejects(updateCustomExercise(db, standard.id, input), /catálogo padrão/);
    await assert.rejects(updateCustomExercise(db, 'missing', input), /não existe/);
    assert.deepEqual(await getExercise(db, standard.id), standard);
  });
});

test('custom exercise remains searchable and edited data survives database close and reopen', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'academia-exercises-'));
  const path = join(directory, 'exercises.db');
  let database = new DatabaseSync(path);
  try {
    let db = adapt(database);
    await initializeDatabase(db);
    const saved = await createCustomExercise(db, { name: 'Supino da família', muscleGroup: 'Peitoral', equipment: 'Halteres' });
    database.close();
    database = new DatabaseSync(path);
    db = adapt(database);
    await initializeDatabase(db);
    assert.deepEqual((await searchExercises(db, 'supino familia'))[0], saved);
    const edited = await updateCustomExercise(db, saved.id, { name: 'Supino da casa', muscleGroup: 'Peitoral', equipment: 'Barra' });
    database.close();
    database = new DatabaseSync(path);
    await initializeDatabase(adapt(database));
    assert.deepEqual((await searchExercises(adapt(database), 'supino casa'))[0], edited);
  } finally {
    database.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.match(basename(directory), /^academia-exercises-/);
    rmSync(directory, { recursive: true });
  }
});
