import { acknowledgeChange, applyPulledChanges, checkpoints, pendingChanges, readLocalRow } from './local.ts';
import { overlappedCheckpoint, pushOrder } from './model.ts';

import type { IncrementalSyncRemote, SyncRow, SyncRunResult, SyncTable } from './model.ts';
import type { WorkoutDatabase } from '../../features/workouts/repository.ts';

export function createIncrementalSync(local: WorkoutDatabase, remote: IncrementalSyncRemote) {
  let running: Promise<SyncRunResult> | null = null;

  async function execute(): Promise<SyncRunResult> {
    await remote.assertIdentity();
    let pushed = 0;
    for (const change of await pendingChanges(local)) {
      await remote.assertIdentity();
      if (change.userId !== local.userId) throw new Error('Fila local pertence a outra conta.');
      if (change.operation === 'upsert') {
        const row = await readLocalRow(local, change.table, change.entityId);
        if (!row) {
          // A later physical delete normally changed the outbox operation. If a
          // foreign-key cascade raced this read, treat it as the same tombstone.
          const confirmed = await remote.tombstone(change.table, change.entityId);
          await acknowledgeChange(local, change, confirmed);
        } else {
          const confirmed = await remote.upsert(change.table, row);
          await acknowledgeChange(local, change, confirmed);
        }
      } else {
        const confirmed = await remote.tombstone(change.table, change.entityId);
        await acknowledgeChange(local, change, confirmed);
      }
      pushed += 1;
    }

    const current = await checkpoints(local);
    const batches = {} as Record<SyncTable, SyncRow<SyncTable>[]>;
    const next = { ...current };
    for (const table of pushOrder) {
      const rows = await remote.changes(table, current[table]);
      batches[table] = rows;
      const latest = rows.reduce((value, row) => (
        Date.parse(row.updated_at) > Date.parse(value) ? row.updated_at : value
      ), current[table]);
      next[table] = overlappedCheckpoint(latest);
    }
    await remote.assertIdentity();
    const result = await applyPulledChanges(local, batches, next);
    await remote.assertIdentity();
    return { pushed, pulled: result.applied, conflicts: result.conflicts };
  }

  return {
    run(): Promise<SyncRunResult> {
      if (!running) running = execute().finally(() => { running = null; });
      return running;
    },
  };
}
