import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { PGlite } from '@electric-sql/pglite';

import { adapt } from './helpers/sqlite.ts';
import { migrateExerciseCatalog } from '../src/db/migrations/007-exercise-catalog.ts';
import { initializeDatabase } from '../src/db/migrations.ts';
import { CATALOG_SIZE, exerciseCatalog } from '../src/features/exercises/catalog.ts';
import { exercisePoses, resolveExerciseImage } from '../src/features/exercises/media.ts';
import { createCustomExercise, getExercise, searchExercises } from '../src/features/exercises/repository.ts';
import { getHistorySession } from '../src/features/history/repository.ts';
import { finishWorkoutSession, getSession, startWorkoutSession, updateSessionSet } from '../src/features/workout-session/repository.ts';
import { createWorkout, getWorkout } from '../src/features/workouts/repository.ts';

test('v6 → v7 preserves all 19 UUIDs/metadata, custom data, workouts, history and sync queue, including rollback/retry', async () => {
  const database = new DatabaseSync(':memory:');
  const db = adapt(database);
  try {
    // Stop before v7 so the fixture is a real v6 database with the original seed.
    await assert.rejects(initializeDatabase({ ...db, async runAsync(sql, ...params: unknown[]) {
      if (sql.includes('INSERT INTO exercises\n')) throw new Error('stop before v7');
      return db.runAsync(sql, params as string[]);
    } }), /stop before v7/);
    assert.equal(database.prepare('PRAGMA user_version').get()?.user_version, 6);
    const originals = database.prepare('SELECT * FROM exercises ORDER BY id').all();
    assert.equal(originals.length, 19);
    const expectedIds = Array.from({ length: 19 }, (_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`);
    assert.deepEqual(originals.map((row) => row.id), expectedIds);
    const custom = await createCustomExercise(db, { name: 'Remada pessoal antiga', muscleGroup: 'Costas', equipment: 'Elástico' });
    const workoutId = await createWorkout(db, { name: 'Treino antigo', description: '', exercises: [
      { exerciseId: expectedIds[0]!, sets: 1, repsMin: 8, repsMax: 12, restSeconds: 60 },
      { exerciseId: custom.id, sets: 1, repsMin: 8, repsMax: 12, restSeconds: 60 },
    ] });
    const completedId = await startWorkoutSession(db, workoutId);
    const session = await getSession(db, completedId);
    for (const exercise of session!.exercises) for (const set of exercise.sets) {
      await updateSessionSet(db, set.id, { weight: 42.5, reps: 10, completed: true });
    }
    await finishWorkoutSession(db, completedId);
    const activeId = await startWorkoutSession(db, workoutId);
    const history = await getHistorySession(db, completedId);
    const active = await getSession(db, activeId);
    const workout = await getWorkout(db, workoutId);
    const changes = database.prepare('SELECT * FROM sync_changes ORDER BY table_name, entity_id').all();
    let writes = 0;
    await assert.rejects(initializeDatabase({ ...db, async runAsync(sql, ...params: unknown[]) {
      if (++writes === 12) throw new Error('interrupted');
      return db.runAsync(sql, params as string[]);
    } }), /interrupted/);
    assert.equal(database.prepare('SELECT count(*) AS n FROM exercises WHERE is_custom = 0').get()?.n, 19);
    assert.equal(database.prepare('PRAGMA user_version').get()?.user_version, 6);
    await initializeDatabase(db);
    await initializeDatabase(db);
    await db.withTransactionAsync(() => migrateExerciseCatalog(db));
    assert.equal(CATALOG_SIZE, 150);
    assert.equal(database.prepare('SELECT count(*) AS n FROM exercises WHERE is_custom = 0 AND user_id IS NULL').get()?.n, 150);
    assert.equal(database.prepare('SELECT count(DISTINCT id) AS n FROM exercises').get()?.n, 151);
    for (const original of originals) {
      const after = database.prepare('SELECT * FROM exercises WHERE id = ?').get(original.id!);
      assert.deepEqual({ ...after, image_uri: original.image_uri }, { ...original });
    }
    assert.deepEqual(await getExercise(db, custom.id), custom);
    assert.deepEqual(await getWorkout(db, workoutId), workout);
    assert.deepEqual(await getHistorySession(db, completedId), history);
    assert.deepEqual(await getSession(db, activeId), active);
    assert.deepEqual(database.prepare('SELECT * FROM sync_changes ORDER BY table_name, entity_id').all(), changes);
    assert.deepEqual(database.prepare('PRAGMA foreign_key_check').all(), []);
    for (const [query, source] of [
      ['elevacao lateral polia', 'cable-lateral-raise'], ['ombro lateral', 'lateral-raise'],
      ['cadeira abdutora', 'hip-abduction'], ['serrote', 'single-arm-db-row'],
      ['russian twist', 'russian-twist'], ['core', 'plank'], ['Dumbbell Bench Press', 'db-bench-press'],
    ]) {
      const expected = exerciseCatalog.find((row) => row.source === source)!;
      const found = await searchExercises(db, query!);
      assert(found.some((exercise) => exercise.id === expected.id), query);
      assert.equal(new Set(found.map((exercise) => exercise.id)).size, found.length);
    }
  } finally { database.close(); }
});

test('media resolves only app Storage, supports paired/single poses and preserves custom image URIs', () => {
  for (const exercise of exerciseCatalog) {
    const poses = exercisePoses(`repdb://${exercise.source}/thumb.webp`);
    assert(poses.length === 1 || poses.length === 2);
    for (const pose of poses) assert.match(resolveExerciseImage(pose.uri, 'https://app.supabase.co')!, /^https:\/\/app.supabase.co\/storage\/v1\/object\/public\/exercise-images\/v1\/[a-z0-9-]+\/(start|peak|main)\.webp$/);
  }
  assert.equal(exercisePoses('repdb://plank/thumb.webp').length, 1);
  assert.equal(exercisePoses('repdb://bench-press/thumb.webp').length, 2);
  assert.equal(resolveExerciseImage('repdb://bench-press/thumb.webp'), null);
  assert.equal(resolveExerciseImage('repdb://../thumb.webp', 'https://app.supabase.co'), null);
  assert.equal(resolveExerciseImage('repdb://plank/thumb.webp', 'http://app.supabase.co'), null);
  assert.equal(resolveExerciseImage('file:///custom.jpg'), 'file:///custom.jpg');
});

test('Storage migration creates the public in-app bucket with WebP/size limits and is idempotent', async () => {
  const db = new PGlite();
  try {
    await db.exec(`CREATE SCHEMA storage; CREATE TABLE storage.buckets (
      id text PRIMARY KEY, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]
    )`);
    const migration = readFileSync(new URL('../supabase/migrations/20261113000001_exercise_images.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    await db.exec(migration);
    assert.deepEqual((await db.query('SELECT id, public, file_size_limit::integer, allowed_mime_types FROM storage.buckets')).rows, [
      { id: 'exercise-images', public: true, file_size_limit: 262144, allowed_mime_types: ['image/webp'] },
    ]);
  } finally { await db.close(); }
});
