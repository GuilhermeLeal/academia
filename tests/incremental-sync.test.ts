import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { ACCOUNT_A, ACCOUNT_B } from './helpers/initialSyncCloud.ts';
import { adapt } from './helpers/sqlite.ts';
import { initializeDatabase } from '../src/db/migrations.ts';
import { createCustomExercise } from '../src/features/exercises/repository.ts';
import {
  finishWorkoutSession, getSession, startWorkoutSession, updateSessionSet,
} from '../src/features/workout-session/repository.ts';
import { createWorkout, deleteWorkout, getWorkout, updateWorkout } from '../src/features/workouts/repository.ts';
import { createIncrementalSync } from '../src/services/incremental-sync/service.ts';
import { emptySnapshot, syncTables } from '../src/services/initial-sync/model.ts';

import type {
  IncrementalSyncRemote, SyncRow, SyncTable,
} from '../src/services/incremental-sync/model.ts';
import type { SyncSnapshot } from '../src/services/initial-sync/model.ts';
import type { UserId } from '../src/types/identity.ts';

class MemoryRemote implements IncrementalSyncRemote {
  readonly rows = new Map<SyncTable, Map<string, SyncRow<SyncTable>>>(
    syncTables.map((table) => [table, new Map()]),
  );
  writes = 0;
  failWrite = false;
  failPullTable: SyncTable | null = null;
  onUpsert: ((table: SyncTable) => Promise<void>) | null = null;
  private clock = Date.parse('2026-11-12T12:00:00.000Z');
  readonly userId: string;

  constructor(userId = ACCOUNT_A) { this.userId = userId; }
  async assertIdentity() {}
  private stamp(): string { this.clock += 1; return new Date(this.clock).toISOString(); }

  async upsert<T extends SyncTable>(table: T, row: SyncRow<T>): Promise<SyncRow<T>> {
    if (this.failWrite) throw new Error('offline');
    assert.equal(row.user_id, this.userId);
    const previous = this.rows.get(table)?.get(row.id);
    const saved = {
      ...row,
      created_at: previous?.created_at ?? row.created_at,
      updated_at: this.stamp(),
    } as SyncRow<T>;
    this.rows.get(table)?.set(row.id, saved);
    this.writes += 1;
    await this.onUpsert?.(table);
    return structuredClone(saved);
  }

  async tombstone<T extends SyncTable>(table: T, id: string): Promise<SyncRow<T> | null> {
    if (this.failWrite) throw new Error('offline');
    const previous = this.rows.get(table)?.get(id);
    if (!previous) return null;
    const updatedAt = this.stamp();
    const saved = { ...previous, updated_at: updatedAt, deleted_at: updatedAt } as SyncRow<T>;
    this.rows.get(table)?.set(id, saved);
    this.writes += 1;
    return structuredClone(saved);
  }

  async changes<T extends SyncTable>(table: T, since: string): Promise<SyncRow<T>[]> {
    if (this.failPullTable === table) throw new Error('partial pull');
    return [...(this.rows.get(table)?.values() ?? [])]
      .filter((row) => row.user_id === this.userId && row.updated_at >= since)
      .sort((a, b) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id))
      .map((row) => structuredClone(row as SyncRow<T>));
  }

  snapshot(): SyncSnapshot {
    const result = emptySnapshot();
    for (const table of syncTables) result[table] = [...(this.rows.get(table)?.values() ?? [])] as never;
    return result;
  }
}

async function device(database = new DatabaseSync(':memory:'), userId = ACCOUNT_A) {
  const local = adapt(database, userId as UserId);
  await initializeDatabase(local);
  return { database, local };
}

function inputFor(exerciseId: string) {
  return {
    name: 'Treino offline', description: '',
    exercises: [{ exerciseId, sets: 1, repsMin: 8, repsMax: 12, restSeconds: 60 }],
  };
}

async function populate(local: ReturnType<typeof adapt>) {
  const custom = await createCustomExercise(local, { name: 'Remada offline', muscleGroup: 'Costas', equipment: 'Halter' });
  const workoutId = await createWorkout(local, inputFor(custom.id));
  const sessionId = await startWorkoutSession(local, workoutId);
  const session = await getSession(local, sessionId);
  assert(session);
  await updateSessionSet(local, session.exercises[0]!.sets[0]!.id, { weight: 20, reps: 10, completed: true });
  await finishWorkoutSession(local, sessionId);
  return { customId: custom.id, workoutId, sessionId };
}

async function queueSize(local: ReturnType<typeof adapt>, userId = local.userId): Promise<number> {
  return (await local.getFirstAsync<{ count: number }>(
    'SELECT count(*) AS count FROM sync_changes WHERE user_id = ?', userId,
  ))?.count ?? -1;
}

test('incremental outbox survives offline/restart, retries idempotently and uploads only changed rows', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'academia-sync-'));
  const path = join(directory, 'academia.db');
  let first = await device(new DatabaseSync(path));
  const remote = new MemoryRemote();
  try {
    const ids = await populate(first.local); // Workout execution never calls the network.
    assert.equal(await queueSize(first.local), 6);
    remote.failWrite = true;
    await assert.rejects(createIncrementalSync(first.local, remote).run(), /offline/);
    assert.equal(await queueSize(first.local), 6);

    first.database.close();
    first = await device(new DatabaseSync(path));
    assert.equal(await queueSize(first.local), 6);
    remote.failWrite = false;
    const result = await createIncrementalSync(first.local, remote).run();
    assert.equal(result.pushed, 6);
    assert.equal(await queueSize(first.local), 0);
    assert.equal(remote.snapshot().workouts.length, 1);
    assert.equal(remote.snapshot().session_sets.length, 1);
    const writes = remote.writes;
    await createIncrementalSync(first.local, remote).run();
    assert.equal(remote.writes, writes);

    await updateWorkout(first.local, ids.workoutId, {
      name: 'Só este treino mudou', description: '',
      exercises: [{ exerciseId: ids.customId, sets: 1, repsMin: 8, repsMax: 12, restSeconds: 60 }],
    });
    await createIncrementalSync(first.local, remote).run();
    assert.equal(remote.snapshot().workouts[0]?.name, 'Só este treino mudou');

    await updateWorkout(first.local, ids.workoutId, { ...inputFor(ids.customId), name: 'Versão enviada' });
    remote.onUpsert = async (table) => {
      if (table !== 'workouts') return;
      remote.onUpsert = null;
      await updateWorkout(first.local, ids.workoutId, { ...inputFor(ids.customId), name: 'Versão durante request' });
    };
    await createIncrementalSync(first.local, remote).run();
    assert.equal(await queueSize(first.local) > 0, true);
    await createIncrementalSync(first.local, remote).run();
    assert.equal(remote.snapshot().workouts[0]?.name, 'Versão durante request');
  } finally { first.database.close(); rmSync(directory, { recursive: true, force: true }); }
});

test('pull transfers another-device edits/tombstones and pending local wins deterministic conflicts', async () => {
  const one = await device();
  const two = await device();
  const remote = new MemoryRemote();
  try {
    const ids = await populate(one.local);
    await createIncrementalSync(one.local, remote).run();
    await createIncrementalSync(two.local, remote).run();
    assert.equal((await getWorkout(two.local, ids.workoutId))?.name, 'Treino offline');

    const input = { name: 'Edição aparelho 1', description: '', exercises: [
      { exerciseId: ids.customId, sets: 1, repsMin: 8, repsMax: 12, restSeconds: 60 },
    ] };
    await updateWorkout(one.local, ids.workoutId, input);
    await createIncrementalSync(one.local, remote).run();
    await createIncrementalSync(two.local, remote).run();
    assert.equal((await getWorkout(two.local, ids.workoutId))?.name, input.name);

    await updateWorkout(two.local, ids.workoutId, { ...input, name: 'Pendente aparelho 2' });
    await updateWorkout(one.local, ids.workoutId, { ...input, name: 'Concorrente aparelho 1' });
    await createIncrementalSync(one.local, remote).run();
    const conflict = await createIncrementalSync(two.local, remote).run();
    assert.equal(conflict.pushed > 0, true);
    assert.equal((await getWorkout(two.local, ids.workoutId))?.name, 'Pendente aparelho 2');
    assert.equal(remote.snapshot().workouts[0]?.name, 'Pendente aparelho 2');

    await deleteWorkout(two.local, ids.workoutId);
    await createIncrementalSync(two.local, remote).run();
    await createIncrementalSync(one.local, remote).run();
    assert.equal(await getWorkout(one.local, ids.workoutId), null);
    const history = await getSession(one.local, ids.sessionId);
    assert(history);
    assert.equal(history.workoutId, null);
    assert.equal(remote.snapshot().workouts[0]?.deleted_at !== null, true);
  } finally { one.database.close(); two.database.close(); }
});

test('partial pull never advances checkpoints and A/B queues remain isolated', async () => {
  const shared = await device();
  const remoteA = new MemoryRemote(ACCOUNT_A);
  try {
    await populate(shared.local);
    const b = adapt(shared.database, ACCOUNT_B as UserId);
    await b.execAsync('SELECT 1');
    await createWorkout(b, { name: 'Somente B', description: '', exercises: [] });
    const before = await shared.local.getAllAsync('SELECT * FROM sync_checkpoints WHERE user_id = ?', ACCOUNT_A);
    remoteA.failPullTable = 'workout_sessions';
    await assert.rejects(createIncrementalSync(shared.local, remoteA).run(), /partial pull/);
    assert.deepEqual(await shared.local.getAllAsync('SELECT * FROM sync_checkpoints WHERE user_id = ?', ACCOUNT_A), before);
    assert.equal(await queueSize(b, ACCOUNT_B as UserId), 1);
    assert.equal(remoteA.snapshot().workouts.some((row) => row.user_id === ACCOUNT_B), false);
    assert.equal((await getWorkout(b, (await b.getFirstAsync<{ id: string }>('SELECT id FROM workouts WHERE user_id = ?', ACCOUNT_B))!.id))?.name, 'Somente B');
  } finally { shared.database.close(); }
});
