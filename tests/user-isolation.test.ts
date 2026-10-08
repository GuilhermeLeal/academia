import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { adapt } from './helpers/sqlite.ts';
import { migrateExercises } from '../src/db/migrations/002-exercises.ts';
import { migrateWorkouts } from '../src/db/migrations/003-workouts.ts';
import { migrateWorkoutSessions } from '../src/db/migrations/004-workout-sessions.ts';
import { DATABASE_VERSION, initializeDatabase } from '../src/db/migrations.ts';
import {
  dismissLegacyImport, getLegacyImportState, linkLegacyData, registerLocalUser,
} from '../src/features/auth/legacyRepository.ts';
import { createCustomExercise, getExercise, searchExercises } from '../src/features/exercises/repository.ts';
import { getHistorySession, listCompletedSessions } from '../src/features/history/repository.ts';
import { summarizeMonth, summarizeStats } from '../src/features/stats/model.ts';
import { countCompletedSets, getExerciseEvolution, listCompletedSessionTimes } from '../src/features/stats/repository.ts';
import { ActiveSessionError } from '../src/features/workout-session/model.ts';
import {
  finishWorkoutSession, getActiveSession, getLastCompletedExerciseSets, getSession,
  startWorkoutSession, updateSessionSet,
} from '../src/features/workout-session/repository.ts';
import { createWorkout, getWorkout, listWorkouts } from '../src/features/workouts/repository.ts';

import type { LegacyDatabase } from '../src/features/auth/legacyRepository.ts';
import type { UserId } from '../src/types/identity.ts';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as UserId;
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' as UserId;

test('migration v5 preserves legacy UUIDs and links every private row transactionally only after consent', async () => {
  const database = new DatabaseSync(':memory:');
  const db = adapt(database, USER_A);
  try {
    await db.execAsync(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE app_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      INSERT INTO app_metadata VALUES ('foundation', 'ready');
    `);
    await migrateExercises(db);
    await migrateWorkouts(db);
    await migrateWorkoutSessions(db);
    await db.execAsync(`
      PRAGMA user_version = 4;
      INSERT INTO exercises
        (id, name, normalized_name, muscle_group, is_custom, created_at, updated_at)
        VALUES ('legacy-exercise', 'Remada antiga', 'remada antiga', 'Costas', 1, '2025-01-01', '2025-01-01');
      INSERT INTO workouts (id, name, created_at, updated_at)
        VALUES ('legacy-workout', 'Treino antigo', '2025-01-02', '2025-01-02');
      INSERT INTO workout_exercises
        (id, workout_id, exercise_id, position, sets, reps_min, reps_max, rest_seconds, created_at, updated_at)
        VALUES ('legacy-workout-exercise', 'legacy-workout', 'legacy-exercise', 0, 1, 8, 10, 60, '2025-01-02', '2025-01-02');
      INSERT INTO workout_sessions
        (id, workout_id, workout_name, started_at, finished_at, status)
        VALUES ('legacy-session', 'legacy-workout', 'Treino antigo', '2025-01-03T10:00:00Z', '2025-01-03T11:00:00Z', 'completed');
      INSERT INTO session_exercises
        (id, session_id, exercise_id, exercise_name, position, planned_sets,
         planned_reps_min, planned_reps_max, planned_rest_seconds)
        VALUES ('legacy-session-exercise', 'legacy-session', 'legacy-exercise', 'Remada antiga', 0, 1, 8, 10, 60);
      INSERT INTO session_sets
        (id, session_exercise_id, set_number, weight, reps, completed)
        VALUES ('legacy-set', 'legacy-session-exercise', 1, 30, 10, 1);
    `);

    await initializeDatabase(db);
    assert.equal((await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version, DATABASE_VERSION);
    assert.equal((await db.getFirstAsync<{ userId: string | null }>(
      'SELECT user_id AS userId FROM workouts WHERE id = ?', 'legacy-workout',
    ))?.userId, null);
    assert.equal((await getLegacyImportState(db, USER_A)).hasLegacyData, true);
    assert.deepEqual(await listWorkouts(db), []);

    await dismissLegacyImport(db, USER_A);
    assert.deepEqual(await getLegacyImportState(db, USER_A), { hasLegacyData: true, dismissed: true });

    const failing: LegacyDatabase = {
      ...db,
      transaction: (task) => db.transaction((tx) => task({
        ...tx,
        async runAsync(sql, ...params: unknown[]) {
          if (sql.startsWith('UPDATE workout_sessions')) throw new Error('simulated link failure');
          return tx.runAsync(sql, params as string[]);
        },
      })),
    };
    await assert.rejects(linkLegacyData(failing, USER_A), /simulated link failure/);
    assert.equal((await db.getFirstAsync<{ userId: string | null }>(
      'SELECT user_id AS userId FROM exercises WHERE id = ?', 'legacy-exercise',
    ))?.userId, null);

    await linkLegacyData(db, USER_A);
    await linkLegacyData(db, USER_A);
    for (const [table, id] of [
      ['exercises', 'legacy-exercise'],
      ['workouts', 'legacy-workout'],
      ['workout_exercises', 'legacy-workout-exercise'],
      ['workout_sessions', 'legacy-session'],
      ['session_exercises', 'legacy-session-exercise'],
      ['session_sets', 'legacy-set'],
    ] as const) {
      assert.equal((await db.getFirstAsync<{ userId: string }>(
        `SELECT user_id AS userId FROM ${table} WHERE id = ?`, id,
      ))?.userId, USER_A);
    }
    assert.equal((await getLegacyImportState(db, USER_A)).hasLegacyData, false);
    assert.equal((await db.getFirstAsync<{ owned: number }>(
      'SELECT COUNT(*) AS owned FROM exercises WHERE is_custom = 0 AND user_id IS NOT NULL',
    ))?.owned, 0);
    assert.equal((await listWorkouts(db))[0]?.id, 'legacy-workout');
    assert.equal((await listCompletedSessions(db))[0]?.id, 'legacy-session');
  } finally { database.close(); }
});

test('repositories keep two accounts isolated while sharing only the standard catalog', async () => {
  const database = new DatabaseSync(':memory:');
  const a = adapt(database, USER_A);
  const b = adapt(database, USER_B);
  try {
    await initializeDatabase(a);
    await registerLocalUser(b, USER_B, '+5511888888888');

    const standardA = (await searchExercises(a, 'supino'))[0];
    const standardB = (await searchExercises(b, 'supino'))[0];
    assert(standardA && standardB);
    assert.equal(standardA.id, standardB.id);
    assert.equal(standardA.isCustom, false);

    const customA = await createCustomExercise(a, {
      name: 'Exercício da conta A', muscleGroup: 'Costas', equipment: '',
    });
    const customB = await createCustomExercise(b, {
      name: 'Exercício da conta B', muscleGroup: 'Pernas', equipment: '',
    });
    assert.equal(await getExercise(b, customA.id), null);
    assert.equal(await getExercise(a, customB.id), null);
    assert(!(await searchExercises(b, '')).some((exercise) => exercise.id === customA.id));

    const workoutA = await createWorkout(a, {
      name: 'Treino A', description: '', exercises: [
        { exerciseId: standardA.id, sets: 1, repsMin: 8, repsMax: 10, restSeconds: 30 },
        { exerciseId: customA.id, sets: 1, repsMin: 8, repsMax: 10, restSeconds: 30 },
      ],
    });
    const workoutB = await createWorkout(b, {
      name: 'Treino B', description: '', exercises: [
        { exerciseId: standardB.id, sets: 1, repsMin: 8, repsMax: 10, restSeconds: 30 },
      ],
    });
    assert.equal(await getWorkout(b, workoutA), null);
    assert.equal(await getWorkout(a, workoutB), null);
    assert.deepEqual((await listWorkouts(a)).map((workout) => workout.id), [workoutA]);
    assert.deepEqual((await listWorkouts(b)).map((workout) => workout.id), [workoutB]);
    await assert.rejects(createWorkout(b, {
      name: 'Tentativa cruzada', description: '', exercises: [
        { exerciseId: customA.id, sets: 1, repsMin: 8, repsMax: 10, restSeconds: 30 },
      ],
    }), /owner mismatch/);

    const sessionA = await startWorkoutSession(a, workoutA);
    const sessionB = await startWorkoutSession(b, workoutB);
    assert.equal((await getActiveSession(a))?.id, sessionA);
    assert.equal((await getActiveSession(b))?.id, sessionB);
    await assert.rejects(startWorkoutSession(a, workoutA), ActiveSessionError);
    await assert.rejects(a.runAsync(
      `INSERT INTO workout_sessions (workout_id, workout_name, started_at, status, user_id)
       VALUES (?, 'Outra A', ?, 'active', ?)`,
      workoutA, new Date().toISOString(), USER_A,
    ), /UNIQUE/);
    assert.equal(await getSession(b, sessionA), null);
    assert.equal(await getSession(a, sessionB), null);

    const aSet = (await getSession(a, sessionA))?.exercises[0]?.sets[0];
    assert(aSet);
    await updateSessionSet(a, aSet.id, { weight: 42.5, reps: 9, completed: true });
    await finishWorkoutSession(a, sessionA);

    assert.deepEqual((await listCompletedSessions(a)).map((session) => session.id), [sessionA]);
    assert.deepEqual(await listCompletedSessions(b), []);
    assert(await getHistorySession(a, sessionA));
    assert.equal(await getHistorySession(b, sessionA), null);
    const statsA = await listCompletedSessionTimes(a);
    const statsB = await listCompletedSessionTimes(b);
    assert.equal(statsA.length, 1);
    assert.equal(statsB.length, 0);
    assert.equal(summarizeStats(statsA, new Date()).completedThisWeek, 1);
    assert.equal(summarizeStats(statsB, new Date()).completedThisWeek, 0);
    assert.equal(summarizeMonth(statsA, new Date()).trainedDayCount, 1);
    assert.equal(summarizeMonth(statsB, new Date()).trainedDayCount, 0);
    assert.equal(await countCompletedSets(a), 1);
    assert.equal(await countCompletedSets(b), 0);
    assert(await getExerciseEvolution(a, standardA.id));
    assert.equal(await getExerciseEvolution(b, standardB.id), null);
    assert.deepEqual((await getLastCompletedExerciseSets(a, standardA.id)).map((set) => ({ ...set })), [
      { setNumber: 1, weight: 42.5, reps: 9 },
    ]);
    assert.deepEqual(await getLastCompletedExerciseSets(b, standardB.id), []);
  } finally { database.close(); }
});
