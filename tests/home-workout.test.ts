import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { adapt } from './helpers/sqlite.ts';
import { initializeDatabase } from '../src/db/migrations.ts';
import {
  getHomeWorkoutSelection,
  getSuggestedWorkout,
} from '../src/features/home/repository.ts';
import { deleteWorkout } from '../src/features/workouts/repository.ts';

import type { UserId } from '../src/types/identity.ts';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' as UserId;
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' as UserId;

type TestDatabase = ReturnType<typeof adapt>;
type SessionStatus = 'active' | 'completed';

async function withDatabase(task: (db: TestDatabase) => Promise<void>) {
  const database = new DatabaseSync(':memory:');
  try {
    const db = adapt(database, USER_A);
    await initializeDatabase(db);
    await task(db);
  } finally {
    database.close();
  }
}

async function addWorkout(
  db: TestDatabase,
  id: string,
  name: string,
  order: number,
) {
  const timestamp = `2026-01-${String(order).padStart(2, '0')}T10:00:00.000Z`;
  await db.runAsync(
    `INSERT INTO workouts (id, name, description, created_at, updated_at, user_id)
     VALUES (?, ?, NULL, ?, ?, ?)`,
    id,
    name,
    timestamp,
    timestamp,
    db.userId,
  );
}

async function addABC(db: TestDatabase, prefix = '') {
  await addWorkout(db, `${prefix}a`, 'A', 1);
  await addWorkout(db, `${prefix}b`, 'B', 2);
  await addWorkout(db, `${prefix}c`, 'C', 3);
}

async function addSession(
  db: TestDatabase,
  id: string,
  workoutId: string,
  status: SessionStatus,
  order: number,
) {
  const startedAt = `2026-02-${String(order).padStart(2, '0')}T10:00:00.000Z`;
  const finishedAt =
    status === 'completed'
      ? `2026-02-${String(order).padStart(2, '0')}T11:00:00.000Z`
      : null;

  await db.runAsync(
    `INSERT INTO workout_sessions
       (id, workout_id, workout_name, started_at, finished_at, status, user_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    id,
    workoutId,
    `Treino ${workoutId}`,
    startedAt,
    finishedAt,
    status,
    db.userId,
  );
}

test('Home suggests A when there is no completed history', async () => {
  await withDatabase(async (db) => {
    await addABC(db);
    assert.equal((await getSuggestedWorkout(db))?.id, 'a');
  });
});

test('Home rotates from completed A to B', async () => {
  await withDatabase(async (db) => {
    await addABC(db);
    await addSession(db, 'session-a', 'a', 'completed', 1);
    assert.equal((await getSuggestedWorkout(db))?.id, 'b');
  });
});

test('Home rotates from completed B to C', async () => {
  await withDatabase(async (db) => {
    await addABC(db);
    await addSession(db, 'session-a', 'a', 'completed', 1);
    await addSession(db, 'session-b', 'b', 'completed', 2);
    assert.equal((await getSuggestedWorkout(db))?.id, 'c');
  });
});

test('Home wraps from completed C to A', async () => {
  await withDatabase(async (db) => {
    await addABC(db);
    await addSession(db, 'session-a', 'a', 'completed', 1);
    await addSession(db, 'session-b', 'b', 'completed', 2);
    await addSession(db, 'session-c', 'c', 'completed', 3);
    assert.equal((await getSuggestedWorkout(db))?.id, 'a');
  });
});

test('an incomplete session does not advance the suggestion', async () => {
  await withDatabase(async (db) => {
    await addABC(db);
    await addSession(db, 'completed-a', 'a', 'completed', 1);
    await addSession(db, 'active-c', 'c', 'active', 2);
    assert.equal((await getSuggestedWorkout(db))?.id, 'b');
  });
});

test('an active session has priority over the next suggestion', async () => {
  await withDatabase(async (db) => {
    await addABC(db);
    await addSession(db, 'completed-a', 'a', 'completed', 1);
    await addSession(db, 'active-c', 'c', 'active', 2);

    const selection = await getHomeWorkoutSelection(db);
    assert.equal(selection.kind, 'active');
    if (selection.kind === 'active') {
      assert.equal(selection.session.id, 'active-c');
    }
  });
});

test('completed history is isolated between users', async () => {
  const database = new DatabaseSync(':memory:');
  const userA = adapt(database, USER_A);
  const userB = adapt(database, USER_B);
  try {
    await initializeDatabase(userA);
    await userB.execAsync('PRAGMA foreign_keys = ON');
    await addABC(userA, 'user-a-');
    await addABC(userB, 'user-b-');
    await addSession(userA, 'user-a-session', 'user-a-a', 'completed', 1);

    assert.equal((await getSuggestedWorkout(userA))?.id, 'user-a-b');
    assert.equal((await getSuggestedWorkout(userB))?.id, 'user-b-a');
  } finally {
    database.close();
  }
});

test('a single workout remains the suggestion after completion', async () => {
  await withDatabase(async (db) => {
    await addWorkout(db, 'only', 'Único', 1);
    await addSession(db, 'only-session', 'only', 'completed', 1);
    assert.equal((await getSuggestedWorkout(db))?.id, 'only');
  });
});

test('a deleted last completed workout falls back to the first current workout', async () => {
  await withDatabase(async (db) => {
    await addABC(db);
    await addSession(db, 'session-b', 'b', 'completed', 1);
    await deleteWorkout(db, 'b');
    assert.equal((await getSuggestedWorkout(db))?.id, 'a');
  });
});

test('Home preserves the empty state when there are no workouts', async () => {
  await withDatabase(async (db) => {
    assert.deepEqual(await getHomeWorkoutSelection(db), { kind: 'empty' });
  });
});
