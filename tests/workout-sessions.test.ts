import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { adapt } from './helpers/sqlite.ts';
import { migrateExercises } from '../src/db/migrations/002-exercises.ts';
import { migrateWorkouts } from '../src/db/migrations/003-workouts.ts';
import { DATABASE_VERSION, initializeDatabase } from '../src/db/migrations.ts';
import { createCustomExercise, searchExercises, updateCustomExercise } from '../src/features/exercises/repository.ts';
import {
  ActiveSessionError, elapsedSeconds, EmptySessionError, formatDuration,
  PersonalizedResultsError, SessionValidationError, summarizeExerciseResult,
} from '../src/features/workout-session/model.ts';
import {
  addExtraSet, applyQuickExerciseResult, finishWorkoutSession, getActiveSession,
  getCompletedSessionSummary, getSession, startWorkoutSession, uncompletePlannedExercise, updateSessionSet,
} from '../src/features/workout-session/repository.ts';
import { createWorkout, deleteWorkout, updateWorkout } from '../src/features/workouts/repository.ts';

import type { WorkoutInput } from '../src/features/workouts/types.ts';

async function withDatabase(task: (db: ReturnType<typeof adapt>) => Promise<void>) {
  const database = new DatabaseSync(':memory:');
  try {
    const db = adapt(database);
    await initializeDatabase(db);
    await task(db);
  } finally { database.close(); }
}

async function createTemplate(db: ReturnType<typeof adapt>, name = 'Treino A') {
  const exercises = await searchExercises(db, 'supino');
  const first = exercises[0]; const second = exercises[1];
  assert(first && second);
  const input: WorkoutInput = {
    name, description: '', exercises: [
      { exerciseId: first.id, sets: 3, repsMin: 8, repsMax: 10, restSeconds: 60 },
      { exerciseId: second.id, sets: 2, repsMin: 10, repsMax: 10, restSeconds: 45 },
    ],
  };
  return { id: await createWorkout(db, input), input, exercises: [first, second] };
}

test('migration 4 upgrades version 3 transactionally and preserves workouts and exercises', async () => {
  const database = new DatabaseSync(':memory:');
  const db = adapt(database);
  try {
    await db.execAsync("PRAGMA foreign_keys = ON; CREATE TABLE app_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL); INSERT INTO app_metadata VALUES ('foundation', 'ready');");
    await migrateExercises(db); await migrateWorkouts(db); await db.execAsync('PRAGMA user_version = 3');
    const template = await createTemplate(db);
    await assert.rejects(initializeDatabase({ ...db, async execAsync(sql) {
      await db.execAsync(sql);
      if (sql.includes('CREATE TABLE workout_sessions')) throw new Error('Session migration interrupted');
    } }), /interrupted/);
    assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, 3);
    assert.equal(await db.getFirstAsync("SELECT name FROM sqlite_master WHERE name = 'workout_sessions'"), null);
    await initializeDatabase(db); await initializeDatabase(db);
    assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION);
    assert.equal((await db.getFirstAsync<{ name: string }>('SELECT name FROM workouts WHERE id = ?', template.id))?.name, 'Treino A');
    assert.equal((await db.getFirstAsync<{ total: number }>('SELECT COUNT(*) AS total FROM exercises'))?.total, 19);
  } finally { database.close(); }
});

test('starts one active session with ordered exercises, planned sets and independent UUIDs', async () => {
  await withDatabase(async (db) => {
    const template = await createTemplate(db);
    const id = await startWorkoutSession(db, template.id);
    const session = await getSession(db, id); assert(session);
    assert.match(id, /^[0-9a-f-]{36}$/);
    assert.equal(session.status, 'active'); assert.equal(session.workoutId, template.id);
    assert.equal(session.workoutName, 'Treino A'); assert.equal(session.finishedAt, null);
    assert.deepEqual(session.exercises.map((item) => item.exerciseName), template.exercises.map((item) => item.name));
    assert.deepEqual(session.exercises.map((item) => item.position), [0, 1]);
    assert.deepEqual(session.exercises.map((item) => item.sets.length), [3, 2]);
    assert.deepEqual(session.exercises[0]?.sets.map((item) => item.setNumber), [1, 2, 3]);
    assert(session.exercises.every((exercise) => exercise.sets.every((set) => set.weight === null && set.reps === null && !set.completed)));
    assert.equal((await getActiveSession(db))?.id, id);
  });
});

test('prevents two active sessions in repository and database constraints', async () => {
  await withDatabase(async (db) => {
    const first = await createTemplate(db, 'Primeiro');
    const second = await createTemplate(db, 'Segundo');
    const activeId = await startWorkoutSession(db, first.id);
    await assert.rejects(startWorkoutSession(db, second.id), (error: unknown) => error instanceof ActiveSessionError && error.sessionId === activeId);
    await assert.rejects(db.runAsync(
      "INSERT INTO workout_sessions (workout_id, workout_name, started_at, status) VALUES (?, 'Direto', ?, 'active')",
      second.id, new Date().toISOString(),
    ), /UNIQUE/);
    assert.equal((await db.getFirstAsync<{ total: number }>("SELECT COUNT(*) AS total FROM workout_sessions WHERE status = 'active'"))?.total, 1);
  });
});

test('records decimal weight and reps, completes and uncompletes a set, and validates values', async () => {
  await withDatabase(async (db) => {
    const template = await createTemplate(db);
    const id = await startWorkoutSession(db, template.id);
    const created = await getSession(db, id); const set = created?.exercises[0]?.sets[0]; assert(set);
    await updateSessionSet(db, set.id, { weight: 32.5, reps: 1, completed: true });
    let stored = (await getSession(db, id))?.exercises[0]?.sets[0];
    assert.deepEqual(stored, { ...set, weight: 32.5, reps: 1, completed: true });
    await updateSessionSet(db, set.id, { weight: 30.25, reps: 9, completed: false });
    stored = (await getSession(db, id))?.exercises[0]?.sets[0];
    assert.equal(stored?.weight, 30.25); assert.equal(stored?.reps, 9); assert.equal(stored?.completed, false);
    await assert.rejects(updateSessionSet(db, set.id, { weight: -1, reps: 1, completed: false }), SessionValidationError);
    await assert.rejects(updateSessionSet(db, set.id, { weight: 0, reps: 0, completed: false }), SessionValidationError);
    await assert.rejects(updateSessionSet(db, set.id, { weight: 1, reps: 1.5, completed: false }), SessionValidationError);
    await assert.rejects(updateSessionSet(db, set.id, { weight: null, reps: null, completed: true }), /repetições/);
    await assert.rejects(db.runAsync('UPDATE session_sets SET reps = 1.5 WHERE id = ?', set.id), /CHECK/);
    await assert.rejects(db.runAsync('UPDATE session_sets SET weight = -1 WHERE id = ?', set.id), /CHECK/);
  });
});

test('quick mode applies one decimal weight and specific reps to every planned set atomically', async () => {
  await withDatabase(async (db) => {
    const template = await createTemplate(db);
    const id = await startWorkoutSession(db, template.id);
    const exercise = (await getSession(db, id))?.exercises[0]; assert(exercise);
    await applyQuickExerciseResult(db, exercise.id, { weight: 30.5, reps: 10 });
    const updated = (await getSession(db, id))?.exercises[0]; assert(updated);
    assert.equal(updated.sets.length, 3);
    assert(updated.sets.every((set) => set.weight === 30.5 && set.reps === 10 && set.completed));
    assert.deepEqual(summarizeExerciseResult(updated), {
      kind: 'uniform', weight: 30.5, reps: 10, allPlannedCompleted: true,
      completedSetCount: 3, totalSetCount: 3,
    });
    await uncompletePlannedExercise(db, exercise.id);
    const uncompleted = (await getSession(db, id))?.exercises[0]; assert(uncompleted);
    assert(uncompleted.sets.every((set) => set.weight === 30.5 && set.reps === 10 && !set.completed));
  });
});

test('quick mode accepts zero weight but requires positive specific repetitions', async () => {
  await withDatabase(async (db) => {
    const template = await createTemplate(db);
    const id = await startWorkoutSession(db, template.id);
    const exercise = (await getSession(db, id))?.exercises[1]; assert(exercise);
    await applyQuickExerciseResult(db, exercise.id, { weight: 0, reps: 12 });
    const updated = (await getSession(db, id))?.exercises[1]; assert(updated);
    assert(updated.sets.every((set) => set.weight === 0 && set.reps === 12 && set.completed));
    await assert.rejects(applyQuickExerciseResult(db, exercise.id, { weight: 0, reps: 0 }), /maiores que zero/);
    assert((await getSession(db, id))?.exercises[1]?.sets.every((set) => set.reps === 12));
  });
});

test('detailed values appear as personalized and quick mode never overwrites them or extra sets silently', async () => {
  await withDatabase(async (db) => {
    const template = await createTemplate(db);
    const id = await startWorkoutSession(db, template.id);
    let exercise = (await getSession(db, id))?.exercises[0]; assert(exercise);
    const [first, second, third] = exercise.sets; assert(first && second && third);
    await updateSessionSet(db, first.id, { weight: 20, reps: 10, completed: true });
    await updateSessionSet(db, second.id, { weight: 15, reps: 10, completed: true });
    await updateSessionSet(db, third.id, { weight: 10, reps: 12, completed: true });
    const extraId = await addExtraSet(db, exercise.id);
    await updateSessionSet(db, extraId, { weight: 5, reps: 15, completed: true });
    exercise = (await getSession(db, id))?.exercises[0]; assert(exercise);
    assert.equal(summarizeExerciseResult(exercise).kind, 'custom');
    const before = exercise.sets.map((set) => ({ ...set }));
    await assert.rejects(
      applyQuickExerciseResult(db, exercise.id, { weight: 30, reps: 8 }),
      PersonalizedResultsError,
    );
    assert.deepEqual((await getSession(db, id))?.exercises[0]?.sets, before);
    await applyQuickExerciseResult(db, exercise.id, { weight: 30, reps: 8 }, true);
    exercise = (await getSession(db, id))?.exercises[0]; assert(exercise);
    assert(exercise.sets.slice(0, 3).every((set) => set.weight === 30 && set.reps === 8 && set.completed));
    assert.equal(exercise.sets[3]?.weight, 5); assert.equal(exercise.sets[3]?.reps, 15);
    assert.equal(summarizeExerciseResult(exercise).kind, 'custom');
  });
});

test('adds sequential extra sets without changing planned sets and rejects additions after finish', async () => {
  await withDatabase(async (db) => {
    const template = await createTemplate(db);
    const id = await startWorkoutSession(db, template.id);
    const exercise = (await getSession(db, id))?.exercises[0]; assert(exercise);
    const fourth = await addExtraSet(db, exercise.id);
    const fifth = await addExtraSet(db, exercise.id);
    const updated = (await getSession(db, id))?.exercises[0]; assert(updated);
    assert.equal(updated.plannedSets, 3);
    assert.deepEqual(updated.sets.map((set) => set.setNumber), [1, 2, 3, 4, 5]);
    assert.equal(updated.sets[3]?.id, fourth); assert.equal(updated.sets[4]?.id, fifth);
    await finishWorkoutSession(db, id, true);
    await assert.rejects(addExtraSet(db, exercise.id), /andamento/);
  });
});

test('session snapshots survive template edits, exercise rename and template deletion', async () => {
  await withDatabase(async (db) => {
    const custom = await createCustomExercise(db, { name: 'Exercício original', muscleGroup: 'Costas', equipment: '' });
    const input: WorkoutInput = { name: 'Snapshot original', description: '', exercises: [
      { exerciseId: custom.id, sets: 4, repsMin: 6, repsMax: 8, restSeconds: 90 },
    ] };
    const workoutId = await createWorkout(db, input);
    const sessionId = await startWorkoutSession(db, workoutId);
    await updateCustomExercise(db, custom.id, { name: 'Exercício renomeado', muscleGroup: 'Costas', equipment: '' });
    await updateWorkout(db, workoutId, { name: 'Template alterado', description: '', exercises: [
      { exerciseId: custom.id, sets: 1, repsMin: 20, repsMax: 20, restSeconds: 0 },
    ] });
    let session = await getSession(db, sessionId); assert(session);
    assert.equal(session.workoutName, 'Snapshot original'); assert.equal(session.exercises[0]?.exerciseName, 'Exercício original');
    assert.equal(session.exercises[0]?.plannedSets, 4); assert.equal(session.exercises[0]?.sets.length, 4);
    assert.equal(session.exercises[0]?.plannedRepsMin, 6); assert.equal(session.exercises[0]?.plannedRestSeconds, 90);
    await deleteWorkout(db, workoutId);
    await db.runAsync('DELETE FROM exercises WHERE id = ?', custom.id);
    session = await getSession(db, sessionId); assert(session);
    assert.equal(session.workoutId, null); assert.equal(session.exercises[0]?.exerciseId, null);
    assert.equal(session.workoutName, 'Snapshot original'); assert.equal(session.exercises[0]?.exerciseName, 'Exercício original');
  });
});

test('requires discreet confirmation for an empty session, then finalizes and exposes a summary', async () => {
  await withDatabase(async (db) => {
    const template = await createTemplate(db);
    const id = await startWorkoutSession(db, template.id);
    await assert.rejects(finishWorkoutSession(db, id), EmptySessionError);
    assert.equal((await getSession(db, id))?.status, 'active');
    const summary = await finishWorkoutSession(db, id, true);
    assert.equal(summary.completedSetCount, 0); assert.equal(summary.exerciseCount, 2);
    assert(summary.finishedAt >= summary.startedAt);
    assert.equal(await getActiveSession(db), null);
    assert.deepEqual({ ...await getCompletedSessionSummary(db, id) }, summary);
    const set = (await getSession(db, id))?.exercises[0]?.sets[0]; assert(set);
    await assert.rejects(updateSessionSet(db, set.id, { weight: 10, reps: 2, completed: true }), /andamento/);
    await assert.rejects(finishWorkoutSession(db, id, true), /andamento/);
  });
});

test('completed series produce the final totals and a new session can start afterwards', async () => {
  await withDatabase(async (db) => {
    const template = await createTemplate(db);
    const id = await startWorkoutSession(db, template.id);
    const session = await getSession(db, id); assert(session);
    const first = session.exercises[0]?.sets[0]; const second = session.exercises[1]?.sets[0]; assert(first && second);
    await updateSessionSet(db, first.id, { weight: 30, reps: 10, completed: true });
    await updateSessionSet(db, second.id, { weight: null, reps: 8, completed: true });
    const summary = await finishWorkoutSession(db, id);
    assert.equal(summary.completedSetCount, 2);
    const next = await startWorkoutSession(db, template.id);
    assert.notEqual(next, id); assert.equal((await getActiveSession(db))?.id, next);
  });
});

test('active set records and extra series survive closing and reopening the database file', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'academia-sessions-'));
  const path = join(directory, 'sessions.db');
  let database = new DatabaseSync(path);
  try {
    let db = adapt(database); await initializeDatabase(db);
    const template = await createTemplate(db); const id = await startWorkoutSession(db, template.id);
    const exercise = (await getSession(db, id))?.exercises[0]; const set = exercise?.sets[0]; assert(exercise && set);
    await applyQuickExerciseResult(db, exercise.id, { weight: 27.5, reps: 12 });
    await addExtraSet(db, exercise.id);
    database.close(); database = new DatabaseSync(path); db = adapt(database); await initializeDatabase(db);
    const reopened = await getSession(db, id); assert(reopened);
    assert.equal((await getActiveSession(db))?.id, id);
    assert.equal(reopened.exercises[0]?.sets.length, 4);
    assert.equal(reopened.exercises[0]?.sets[0]?.weight, 27.5);
    assert.equal(reopened.exercises[0]?.sets[0]?.reps, 12);
    assert.equal(reopened.exercises[0]?.sets[0]?.completed, true);
  } finally {
    database.close();
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()));
    assert.match(basename(directory), /^academia-sessions-/);
    rmSync(directory, { recursive: true });
  }
});

test('duration derives from timestamps and formats short and long sessions', () => {
  assert.equal(elapsedSeconds('2026-01-01T10:00:00.000Z', '2026-01-01T10:05:07.900Z'), 307);
  assert.equal(elapsedSeconds('invalid', '2026-01-01T10:05:00.000Z'), 0);
  assert.equal(elapsedSeconds('2026-01-01T10:05:00.000Z', '2026-01-01T10:00:00.000Z'), 0);
  assert.equal(formatDuration(307), '05:07');
  assert.equal(formatDuration(3723), '01:02:03');
});
