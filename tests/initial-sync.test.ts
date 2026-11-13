import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { ACCOUNT_A, ACCOUNT_B, initialSyncCloud } from './helpers/initialSyncCloud.ts';
import { adapt } from './helpers/sqlite.ts';
import { initializeDatabase } from '../src/db/migrations.ts';
import { createCustomExercise } from '../src/features/exercises/repository.ts';
import { getHistorySession } from '../src/features/history/repository.ts';
import { finishWorkoutSession, getActiveSession, getSession, startWorkoutSession, updateSessionSet } from '../src/features/workout-session/repository.ts';
import { createWorkout, updateWorkout } from '../src/features/workouts/repository.ts';
import { readLocalSnapshot } from '../src/services/initial-sync/local.ts';
import { counts, liveSnapshot, signature, syncTables } from '../src/services/initial-sync/model.ts';
import { createInitialSync as createService } from '../src/services/initial-sync/service.ts';

import type { InitialSyncRemote, SyncReceipt } from '../src/services/initial-sync/model.ts';
import type { UserId } from '../src/types/identity.ts';
import type { SQLiteBindValue } from 'expo-sqlite';

function createInitialSync(local: ReturnType<typeof adapt>, remote: InitialSyncRemote) {
  return createService(local, remote, async (value) => createHash('sha256').update(value).digest('hex'));
}

async function localDatabase(userId = ACCOUNT_A) {
  const database = new DatabaseSync(':memory:');
  const local = adapt(database, userId as UserId);
  await initializeDatabase(local);
  return { database, local };
}

async function populate(local: ReturnType<typeof adapt>) {
  const exercise = await createCustomExercise(local, { name: 'Remada pessoal', muscleGroup: 'Costas', equipment: 'Halteres' });
  const template = {
    name: 'Nome histórico', description: 'Descrição preservada', exercises: [
      { exerciseId: '00000000-0000-4000-8000-000000000001', sets: 2, repsMin: 8, repsMax: 12, restSeconds: 60 },
      { exerciseId: exercise.id, sets: 2, repsMin: 10, repsMax: 10, restSeconds: 45 },
    ],
  };
  const workoutId = await createWorkout(local, template);
  const completedId = await startWorkoutSession(local, workoutId);
  const session = await getSession(local, completedId);
  assert(session);
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) await updateSessionSet(local, set.id, { weight: 12.5, reps: 10, completed: true });
  }
  await finishWorkoutSession(local, completedId);
  await updateWorkout(local, workoutId, { ...template, name: 'Nome atual' });
  const activeId = await startWorkoutSession(local, workoutId);
  return { workoutId, completedId, activeId, exerciseId: exercise.id };
}

test('initial upload/restore round-trips a whole account through SDK + PostgreSQL/RLS without duplication or account leakage', async (t) => {
  const cloud = await initialSyncCloud();
  const origin = await localDatabase();
  const destination = await localDatabase();
  let remote = await cloud.connect();
  try {
    const ids = await populate(origin.local);
    const other = adapt(origin.database, ACCOUNT_B as UserId);
    await other.execAsync('SELECT 1');
    await populate(other);
    const source = await readLocalSnapshot(origin.local);
    const service = createInitialSync(origin.local, remote);
    let receipt!: SyncReceipt;

    await t.test('upload sends all six entities in FK order with original UUIDs and only A ownership', async () => {
      const result = await service.upload();
      assert(result.status === 'uploaded');
      assert.deepEqual(result.counts, counts(source));
      receipt = result.receipt;
      assert.deepEqual(cloud.requests.filter((request) => request.method === 'POST').map((request) => request.table), [...syncTables]);
      const uploaded = await remote.read();
      assert.equal(signature(uploaded, true), signature(source, true));
      assert.equal(uploaded.session_sets.length, 8);
      for (const table of syncTables) {
        assert(uploaded[table].every((row) => row.user_id === ACCOUNT_A));
        assert.deepEqual(uploaded[table].map((row) => row.id).sort(), source[table].map((row) => row.id).sort());
      }
    });

    await t.test('a second upload is an idempotent no-op, including server timestamps', async () => {
      const before = await remote.read();
      const posts = cloud.requests.filter((request) => request.method === 'POST').length;
      assert.equal((await service.upload()).status, 'already-synced');
      assert.equal(cloud.requests.filter((request) => request.method === 'POST').length, posts);
      assert.equal(signature(await remote.read()), signature(before));
      // Low-level duplicate upserts also do not overwrite timestamps/data.
      await remote.insertMissing(source);
      assert.equal(signature(await remote.read()), signature(before));
    });

    await t.test('empty account restoration is atomic, preserves history/active session and leaves B data intact', async () => {
      const b = adapt(destination.database, ACCOUNT_B as UserId);
      await b.execAsync('SELECT 1');
      await populate(b);
      const beforeB = signature(await readLocalSnapshot(b));
      assert.equal((await createInitialSync(destination.local, remote).restore()).status, 'conflict');
      assert.deepEqual(await createInitialSync(destination.local, remote).restore(receipt), { status: 'restored', counts: counts(source) });
      assert.equal(signature(await readLocalSnapshot(destination.local), true), signature(source, true));
      assert.deepEqual(await getHistorySession(destination.local, ids.completedId), await getHistorySession(origin.local, ids.completedId));
      assert.deepEqual(await getSession(destination.local, ids.activeId), await getSession(origin.local, ids.activeId));
      assert.equal((await getActiveSession(destination.local))?.id, ids.activeId);
      assert.equal(signature(await readLocalSnapshot(b)), beforeB);
      assert.equal(destination.database.prepare('SELECT count(*) AS n FROM exercises WHERE is_custom = 0').get()?.n, 150);
      assert.equal((await cloud.db.query<{ n: number }>('SELECT count(*)::integer AS n FROM exercises WHERE NOT is_custom')).rows[0]?.n, 150);
    });

    await t.test('populated local restore and divergent upload report conflict without overwriting either side', async () => {
      const restored = signature(await readLocalSnapshot(destination.local));
      assert.equal((await createInitialSync(destination.local, remote).restore()).status, 'conflict');
      assert.equal(signature(await readLocalSnapshot(destination.local)), restored);
      const before = signature(await remote.read());
      await origin.local.runAsync('UPDATE workouts SET name = ? WHERE id = ? AND user_id = ?', 'Alterado localmente', ids.workoutId, ACCOUNT_A);
      assert.deepEqual(await service.upload(), { status: 'conflict', reason: 'both-have-data', counts: counts(source) });
      assert.equal(signature(await remote.read()), before);
    });

    await t.test('local edits made during download are detected again inside the import transaction', async () => {
      const target = await localDatabase();
      let reads = 0;
      try {
        const racingRemote: InitialSyncRemote = {
          ...remote,
          read: async () => {
            const data = await remote.read();
            if (++reads === 2) await createWorkout(target.local, { name: 'Created while downloading', description: '', exercises: [] });
            return data;
          },
        };
        const result = await createInitialSync(target.local, racingRemote).restore(receipt);
        assert(result.status === 'conflict' && result.reason === 'local-not-empty');
        const snapshot = await readLocalSnapshot(target.local);
        assert.equal(snapshot.workouts.length, 1);
        assert.equal(snapshot.workouts[0]?.name, 'Created while downloading');
        assert.equal(snapshot.exercises.length, 0);
      } finally { target.database.close(); }
    });

    await t.test('legacy data is never silently linked or exported', async () => {
      const target = await localDatabase();
      try {
        await target.local.runAsync('INSERT INTO workouts(name,created_at,updated_at) VALUES (?,?,?)', 'Legacy', '2026-01-01', '2026-01-01');
        const result = await createInitialSync(target.local, remote).restore(receipt);
        assert(result.status === 'conflict' && result.reason === 'legacy-data');
        const upload = await createInitialSync(target.local, remote).upload();
        assert(upload.status === 'conflict' && upload.reason === 'legacy-data');
        assert.equal(target.database.prepare('SELECT user_id FROM workouts').get()?.user_id, null);
      } finally { target.database.close(); }
    });

    await t.test('logout during import rolls back the entire local transaction', async () => {
      const target = await localDatabase();
      try {
        const guarded = {
          ...target.local,
          transaction: (task: Parameters<typeof target.local.transaction>[0]) => target.local.transaction((tx) => task({
            ...tx,
            runAsync: async (source: string, ...params: unknown[]) => {
              const result = await tx.runAsync(source, (Array.isArray(params[0]) ? params[0] : params) as SQLiteBindValue[]);
              if (source.startsWith('INSERT INTO session_sets')) cloud.setAccount(null);
              return result;
            },
          })),
        };
        await assert.rejects(createInitialSync(guarded, remote).restore(receipt), /revertida integralmente/);
        assert(Object.values(counts(await readLocalSnapshot(target.local))).every((count) => count === 0));
      } finally {
        target.database.close(); remote.dispose(); cloud.setAccount(ACCOUNT_A); remote = await cloud.connect();
      }
    });

    await t.test('B cannot download A and stale A adapter is invalidated by logout/login', async () => {
      cloud.setAccount(null);
      await assert.rejects(remote.read(), /sessão mudou/);
      cloud.setAccount(ACCOUNT_B);
      await assert.rejects(remote.insertMissing(source), /sessão mudou/);
      remote.dispose();
      remote = await cloud.connect(ACCOUNT_B);
      const emptyB = await localDatabase(ACCOUNT_B);
      try {
        assert.equal((await createInitialSync(emptyB.local, remote).restore()).status, 'empty');
        assert(Object.values(counts(await readLocalSnapshot(emptyB.local))).every((count) => count === 0));
      } finally { emptyB.database.close(); }
    });
  } finally {
    remote.dispose(); origin.database.close(); destination.database.close(); await cloud.db.close();
  }
});

test('restore rolls back every row on UUID collision with another account or a late import failure', async () => {
  const cloud = await initialSyncCloud();
  const origin = await localDatabase();
  const destination = await localDatabase();
  const remote = await cloud.connect();
  try {
    const ids = await populate(origin.local);
    const upload = await createInitialSync(origin.local, remote).upload();
    assert(upload.status === 'uploaded');
    const other = adapt(destination.database, ACCOUNT_B as UserId);
    await other.execAsync('SELECT 1');
    await other.runAsync('INSERT INTO workouts (id,user_id,name,created_at,updated_at) VALUES (?,?,?,?,?)',
      ids.workoutId, ACCOUNT_B, 'B owns this UUID', '2026-01-01', '2026-01-01');
    await assert.rejects(createInitialSync(destination.local, remote).restore(upload.receipt), /revertida integralmente/);
    assert(Object.values(counts(await readLocalSnapshot(destination.local))).every((count) => count === 0));
    assert.equal((await readLocalSnapshot(other)).workouts[0]?.name, 'B owns this UUID');

    const clean = await localDatabase();
    try {
      await clean.local.execAsync("CREATE TRIGGER fail_import BEFORE INSERT ON session_sets BEGIN SELECT RAISE(ABORT, 'failure'); END;");
      await assert.rejects(createInitialSync(clean.local, remote).restore(upload.receipt), /revertida integralmente/);
      assert(Object.values(counts(await readLocalSnapshot(clean.local))).every((count) => count === 0));
    } finally { clean.database.close(); }
  } finally { remote.dispose(); origin.database.close(); destination.database.close(); await cloud.db.close(); }
});

test('partial upload failure has no automatic retry/merge and preserves local data', async () => {
  const cloud = await initialSyncCloud();
  const origin = await localDatabase();
  const remote = await cloud.connect();
  try {
    await populate(origin.local);
    const before = signature(await readLocalSnapshot(origin.local));
    cloud.failUploadsTo('workout_sessions');
    await assert.rejects(createInitialSync(origin.local, remote).upload(), /registros remotos parciais/);
    assert.equal(signature(await readLocalSnapshot(origin.local)), before);
    assert.equal(cloud.requests.filter((request) => request.table === 'workout_sessions' && request.method === 'POST').length, 1);
    cloud.failUploadsTo();
    assert.equal((await createInitialSync(origin.local, remote).upload()).status, 'conflict');
    assert.equal(signature(await readLocalSnapshot(origin.local)), before);
    const clean = await localDatabase();
    try {
      const result = await createInitialSync(clean.local, remote).restore();
      assert(result.status === 'conflict' && result.reason === 'receipt-required');
      assert(Object.values(counts(await readLocalSnapshot(clean.local))).every((count) => count === 0));
    } finally { clean.database.close(); }
  } finally { remote.dispose(); origin.database.close(); await cloud.db.close(); }
});

test('remote tombstones invalidate the receipt; their local projection preserves historical snapshots', async () => {
  const cloud = await initialSyncCloud();
  const origin = await localDatabase();
  const destination = await localDatabase();
  const remote = await cloud.connect();
  try {
    const ids = await populate(origin.local);
    const upload = await createInitialSync(origin.local, remote).upload();
    assert(upload.status === 'uploaded');
    await cloud.db.query('UPDATE workouts SET deleted_at = now() WHERE id = $1', [ids.workoutId]);
    assert.equal((await createInitialSync(origin.local, remote).upload()).status, 'conflict');
    const result = await createInitialSync(destination.local, remote).restore(upload.receipt);
    assert(result.status === 'conflict' && result.reason === 'receipt-mismatch');
    const restored = liveSnapshot(await remote.read());
    assert.equal(restored.workouts.length, 0);
    assert.equal(restored.workout_exercises.length, 0);
    assert.equal(restored.workout_sessions.length, 2);
    assert(restored.workout_sessions.every((session) => session.workout_id === null));
    assert.equal(restored.workout_sessions.find((session) => session.id === ids.completedId)?.workout_name, 'Nome histórico');
    assert.equal(restored.session_sets.length, 8);
  } finally { remote.dispose(); origin.database.close(); destination.database.close(); await cloud.db.close(); }
});
