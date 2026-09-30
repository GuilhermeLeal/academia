import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { adapt } from './helpers/sqlite.ts';
import { migrateExercises } from '../src/db/migrations/002-exercises.ts';
import { DATABASE_VERSION, initializeDatabase } from '../src/db/migrations.ts';
import { createCustomExercise, getExercise, searchExercises, updateCustomExercise } from '../src/features/exercises/repository.ts';
import { addDraftExercise, parseDraft, toDraft } from '../src/features/workouts/draft.ts';
import { formatReps, moveExercise, validateWorkout, WorkoutValidationError } from '../src/features/workouts/model.ts';
import { createWorkout, deleteWorkout, duplicateWorkout, getWorkout, listWorkouts, updateWorkout } from '../src/features/workouts/repository.ts';

import type { WorkoutDatabase } from '../src/features/workouts/repository.ts';
import type { WorkoutExercise, WorkoutExerciseInput, WorkoutInput } from '../src/features/workouts/types.ts';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const configuration = (exerciseId: string): WorkoutExerciseInput => ({ exerciseId, sets: 3, repsMin: 8, repsMax: 10, restSeconds: 60 });
const inputFor = (ids: string[]): WorkoutInput => ({ name: 'Treino A', description: '', exercises: ids.map(configuration) });

async function withDatabase(task: (db: ReturnType<typeof adapt>, ids: string[]) => Promise<void>) {
  const database = new DatabaseSync(':memory:');
  try {
    const db = adapt(database);
    await initializeDatabase(db);
    const ids = (await searchExercises(db, '')).slice(0, 4).map((exercise) => exercise.id);
    assert.equal(ids.length, 4);
    await task(db, ids);
  } finally { database.close(); }
}

test('migration 3 preserves version 2 exercises and metadata, rolls back on failure and retries idempotently', async () => {
  const database = new DatabaseSync(':memory:');
  const db = adapt(database);
  try {
    await db.execAsync("PRAGMA foreign_keys = ON; CREATE TABLE app_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); INSERT INTO app_metadata VALUES ('foundation', 'ready'), ('family', 'preserved');");
    await migrateExercises(db);
    await db.execAsync('PRAGMA user_version = 2;');
    const custom = await createCustomExercise(db, { name: 'Remada familiar', muscleGroup: 'Costas', equipment: '' });
    const existing = await searchExercises(db, '');
    await assert.rejects(initializeDatabase({ ...db, async execAsync(sql) {
      await db.execAsync(sql);
      if (sql.includes('CREATE TABLE workouts')) throw new Error('Migration interrupted');
    } }), /Migration interrupted/);
    assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 2);
    assert.equal(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'workouts'"), null);
    await initializeDatabase(db);
    await initializeDatabase(db);
    assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION);
    assert.deepEqual(await searchExercises(db, ''), existing);
    assert.deepEqual(await getExercise(db, custom.id), custom);
    assert.equal((await db.getFirstAsync<{ value: string }>("SELECT value FROM app_metadata WHERE key = 'family'"))?.value, 'preserved');
    assert.deepEqual(await listWorkouts(db), []);
  } finally { database.close(); }
});

test('creates UUID workouts with ordered exercise associations, counts and nullable description', async () => {
  await withDatabase(async (db, ids) => {
    const input = { ...inputFor(ids), name: '  Treino A  ', description: '  ' };
    const id = await createWorkout(db, input);
    const workout = await getWorkout(db, id);
    assert(workout);
    assert.match(id, uuid);
    assert.equal(workout.name, 'Treino A');
    assert.equal(workout.description, null);
    assert.equal(workout.exerciseCount, ids.length);
    assert.equal(workout.createdAt, workout.updatedAt);
    assert.deepEqual(workout.exercises.map((item) => item.exerciseId), ids);
    for (const [index, exercise] of workout.exercises.entries()) {
      assert.match(exercise.id, uuid);
      assert.equal(exercise.workoutId, id);
      assert.equal(exercise.position, index);
      assert.equal(exercise.sets, 3);
      assert.equal(exercise.repsMin, 8);
      assert.equal(exercise.repsMax, 10);
      assert.equal(exercise.restSeconds, 60);
      assert.equal(exercise.name, (await getExercise(db, exercise.exerciseId))?.name);
    }
    assert.equal((await listWorkouts(db))[0]?.exerciseCount, ids.length);
    assert.equal(await getWorkout(db, 'missing'), null);
    const empty = await createWorkout(db, inputFor([]));
    assert.equal((await getWorkout(db, empty))?.exerciseCount, 0);
  });
});

test('validates required name, lengths, positive integers, repetition range, nonnegative rest and duplicate IDs before writing', async () => {
  await withDatabase(async (db, ids) => {
    const input = inputFor(ids);
    const first = input.exercises[0]; assert(first);
    const invalid: WorkoutInput[] = [
      { ...input, name: ' \n ' }, { ...input, name: 'a'.repeat(101) },
      { ...input, description: 'a'.repeat(1001) },
      { ...input, exercises: [first, first] },
      { ...input, exercises: [{ ...first, exerciseId: '' }] },
      { ...input, exercises: [{ ...first, repsMin: 11, repsMax: 10 }] },
    ];
    for (const key of ['sets', 'repsMin', 'repsMax', 'restSeconds'] as const) {
      for (const value of [-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1, ...(key === 'restSeconds' ? [] : [0])]) {
        invalid.push({ ...input, exercises: [{ ...first, [key]: value }] });
      }
    }
    for (const candidate of invalid) await assert.rejects(createWorkout(db, candidate), WorkoutValidationError);
    assert.deepEqual(await listWorkouts(db), []);
    const valid = { ...input, description: '  Observação  ', exercises: [{ ...first, repsMin: 10, repsMax: 10, restSeconds: 0 }] };
    assert.equal(validateWorkout(valid).description, 'Observação');
    assert.equal((await getWorkout(db, await createWorkout(db, valid)))?.exercises[0]?.restSeconds, 0);
  });
});

test('edits header and configurations, reorders retained associations and removes only the association', async () => {
  await withDatabase(async (db, ids) => {
    const id = await createWorkout(db, inputFor(ids.slice(0, 3)));
    const before = await getWorkout(db, id); assert(before);
    const [first, second, third, fourth] = ids; assert(first && second && third && fourth);
    await db.runAsync('UPDATE workouts SET updated_at = ? WHERE id = ?', '2000-01-01', id);
    const reordered = [third, first, fourth];
    await updateWorkout(db, id, { name: '  Treino editado ', description: ' Novo foco ', exercises: reordered.map((exerciseId) => ({ ...configuration(exerciseId), sets: 4, repsMin: 10, repsMax: 10, restSeconds: 0 })) });
    const after = await getWorkout(db, id); assert(after);
    assert.equal(after.name, 'Treino editado');
    assert.equal(after.description, 'Novo foco');
    assert.equal(after.createdAt, before.createdAt);
    assert.notEqual(after.updatedAt, '2000-01-01');
    assert.deepEqual(after.exercises.map((item) => item.exerciseId), reordered);
    assert.deepEqual(after.exercises.map((item) => item.position), [0, 1, 2]);
    for (const exercise of after.exercises) {
      assert.equal(exercise.sets, 4); assert.equal(exercise.repsMin, 10); assert.equal(exercise.restSeconds, 0);
      const retained: WorkoutExercise | undefined = before.exercises.find((item) => item.exerciseId === exercise.exerciseId);
      if (retained) { assert.equal(exercise.id, retained.id); assert.equal(exercise.createdAt, retained.createdAt); }
    }
    assert(await getExercise(db, second));
    await updateWorkout(db, id, inputFor([]));
    assert.equal((await getWorkout(db, id))?.exerciseCount, 0);
    assert(await getExercise(db, first));
  });
});

test('failed create or edit rolls back the header, removals, shifted positions and partially written associations', async () => {
  await withDatabase(async (db, ids) => {
    await assert.rejects(createWorkout(db, inputFor([...ids, 'missing'])), /FOREIGN KEY/);
    assert.deepEqual(await listWorkouts(db), []);
    const id = await createWorkout(db, inputFor(ids));
    const before = await getWorkout(db, id); assert(before);
    const first = ids[0]; assert(first);
    await assert.rejects(updateWorkout(db, id, { ...inputFor([first, 'missing']), name: 'Must roll back' }), /FOREIGN KEY/);
    assert.deepEqual(await getWorkout(db, id), before);
    await assert.rejects(updateWorkout(db, id, inputFor([first, first])), WorkoutValidationError);
    assert.deepEqual(await getWorkout(db, id), before);
    const failing: WorkoutDatabase = { ...db, transaction: (task) => db.transaction((tx) => task({
      ...tx, async runAsync(sql, ...params: unknown[]) {
        const values = Array.isArray(params[0]) ? params[0] : params;
        const result = await tx.runAsync(sql, values as string[]);
        if (sql.includes('INSERT INTO workout_exercises')) throw new Error('Simulated write failure');
        return result;
      },
    })) };
    await assert.rejects(updateWorkout(failing, id, { ...inputFor([first]), name: 'Interrupted' }), /Simulated write failure/);
    assert.deepEqual(await getWorkout(db, id), before);
    await assert.rejects(updateWorkout(db, 'missing', inputFor(ids)), /não existe/);
  });
});

test('SQLite enforces foreign keys, unique exercises/positions and numeric constraints independently of UI validation', async () => {
  await withDatabase(async (db, ids) => {
    const id = await createWorkout(db, inputFor(ids.slice(0, 2)));
    const workout = await getWorkout(db, id); assert(workout);
    const [first, second] = workout.exercises; assert(first && second);
    await assert.rejects(db.runAsync('UPDATE workout_exercises SET exercise_id = ? WHERE id = ?', first.exerciseId, second.id), /UNIQUE/);
    await assert.rejects(db.runAsync('UPDATE workout_exercises SET position = ? WHERE id = ?', first.position, second.id), /UNIQUE/);
    await assert.rejects(db.runAsync('DELETE FROM exercises WHERE id = ?', first.exerciseId), /FOREIGN KEY/);
    await assert.rejects(db.runAsync('UPDATE workout_exercises SET workout_id = ? WHERE id = ?', 'missing', first.id), /FOREIGN KEY/);
    for (const sql of [
      'sets = 0', 'sets = 1.5', 'reps_min = 0', 'reps_max = 1', 'rest_seconds = -1', 'position = -1',
    ]) await assert.rejects(db.runAsync(`UPDATE workout_exercises SET ${sql} WHERE id = ?`, first.id), /CHECK/);
    assert.deepEqual(await getWorkout(db, id), workout);
  });
});

test('custom exercise association reads later catalog edits without copying or modifying catalog records', async () => {
  await withDatabase(async (db) => {
    const custom = await createCustomExercise(db, { name: 'Remada familiar', muscleGroup: 'Costas', equipment: '' });
    const id = await createWorkout(db, inputFor([custom.id]));
    await updateCustomExercise(db, custom.id, { name: 'Remada em casa', muscleGroup: 'Costas', equipment: 'Elástico' });
    assert.equal((await getWorkout(db, id))?.exercises[0]?.name, 'Remada em casa');
    await updateWorkout(db, id, inputFor([]));
    assert.equal((await getExercise(db, custom.id))?.name, 'Remada em casa');
  });
});

test('deletes only the chosen workout and cascades its associations while preserving catalog and other workouts', async () => {
  await withDatabase(async (db, ids) => {
    const catalog = await searchExercises(db, '');
    const id = await createWorkout(db, inputFor(ids));
    const other = await createWorkout(db, inputFor(ids));
    const retained = await getWorkout(db, other);
    await deleteWorkout(db, id);
    assert.equal(await getWorkout(db, id), null);
    assert.equal((await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM workout_exercises WHERE workout_id = ?', id))?.total, 0);
    assert.deepEqual(await getWorkout(db, other), retained);
    assert.deepEqual(await searchExercises(db, ''), catalog);
    await deleteWorkout(db, id);
    assert.equal((await listWorkouts(db)).length, 1);
  });
});

test('duplicates ordered configurations with independent IDs and a bounded copy name', async () => {
  await withDatabase(async (db, ids) => {
    const id = await createWorkout(db, { ...inputFor(ids), description: 'Descrição' });
    const source = await getWorkout(db, id); assert(source);
    const copyId = await duplicateWorkout(db, id);
    const copy = await getWorkout(db, copyId); assert(copy);
    assert.notEqual(copyId, id);
    assert.equal(copy.name, 'Treino A - Cópia');
    assert.equal(copy.description, source.description);
    assert.deepEqual(copy.exercises.map(toDraft), source.exercises.map(toDraft));
    copy.exercises.forEach((item, index) => assert.notEqual(item.id, source.exercises[index]?.id));
    await updateWorkout(db, copyId, inputFor([]));
    assert.deepEqual(await getWorkout(db, id), source);
    await updateWorkout(db, id, { ...inputFor([]), name: 'a'.repeat(100) });
    const longCopy = await getWorkout(db, await duplicateWorkout(db, id)); assert(longCopy);
    assert.equal(longCopy.name.length, 100);
    assert(longCopy.name.endsWith(' - Cópia'));
    await assert.rejects(duplicateWorkout(db, 'missing'), /não existe/);
  });
});

test('saved creation, reordered edits and deletion survive close/reopen on a real database file', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'academia-workouts-'));
  const path = join(directory, 'workouts.db');
  let database = new DatabaseSync(path);
  try {
    let db = adapt(database);
    await initializeDatabase(db);
    const ids = (await searchExercises(db, 'supino')).map((item) => item.id);
    const id = await createWorkout(db, inputFor(ids));
    const created = await getWorkout(db, id);
    database.close(); database = new DatabaseSync(path); db = adapt(database);
    await initializeDatabase(db);
    assert.deepEqual(await getWorkout(db, id), created);
    await updateWorkout(db, id, { ...inputFor(ids.toReversed()), name: 'Treino persistido' });
    const edited = await getWorkout(db, id);
    database.close(); database = new DatabaseSync(path); db = adapt(database);
    await initializeDatabase(db);
    assert.deepEqual(await getWorkout(db, id), edited);
    await deleteWorkout(db, id);
    database.close(); database = new DatabaseSync(path); db = adapt(database);
    await initializeDatabase(db);
    assert.deepEqual(await listWorkouts(db), []);
    assert.equal((await searchExercises(db, 'supino')).length, ids.length);
  } finally {
    database.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.match(basename(directory), /^academia-workouts-/);
    rmSync(directory, { recursive: true });
  }
});

test('move buttons handle both directions and boundaries without mutating the draft; reps display correctly', () => {
  const original = ['a', 'b', 'c'];
  assert.deepEqual(moveExercise(original, 0, 1), ['b', 'a', 'c']);
  assert.deepEqual(moveExercise(original, 2, -1), ['a', 'c', 'b']);
  for (const [index, direction] of [[0, -1], [2, 1], [-1, 1], [3, -1]] as const) assert.deepEqual(moveExercise(original, index, direction), original);
  assert.deepEqual(original, ['a', 'b', 'c']);
  assert.equal(formatReps(10, 10), '10 reps');
  assert.equal(formatReps(8, 10), '8–10 reps');
});

test('selection rejects repeated exercises and numeric drafts reject empty or partially numeric values', () => {
  const exercise = { id: 'first', name: 'Supino Reto' };
  const selected = addDraftExercise([], exercise);
  assert.equal(addDraftExercise(selected, exercise), selected);
  assert.equal(addDraftExercise(selected, { id: 'second', name: 'Remada' }).length, 2);
  const first = selected[0]; assert(first);
  for (const value of ['', ' ', '3abc', '1.5', '-1', '1e2', '+2']) {
    assert.throws(() => parseDraft([{ ...first, sets: value }]), WorkoutValidationError);
  }
  assert.equal(parseDraft([{ ...first, restSeconds: '0' }])[0]?.restSeconds, 0);
});
