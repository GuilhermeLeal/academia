import { syncTables } from '../initial-sync/model.ts';

import type { SyncRow, SyncTable } from '../initial-sync/model.ts';

export { syncTables };
export type { SyncRow, SyncTable };

export const pushOrder: readonly SyncTable[] = [
  'exercises', 'workouts', 'workout_exercises',
  'workout_sessions', 'session_exercises', 'session_sets',
];
export const deleteOrder: readonly SyncTable[] = [...pushOrder].reverse();

export type PendingChange = {
  userId: string;
  table: SyncTable;
  entityId: string;
  operation: 'upsert' | 'delete';
  generation: number;
};

export interface IncrementalSyncRemote {
  assertIdentity(): Promise<void>;
  upsert<T extends SyncTable>(table: T, row: SyncRow<T>): Promise<SyncRow<T>>;
  tombstone<T extends SyncTable>(table: T, id: string): Promise<SyncRow<T> | null>;
  changes<T extends SyncTable>(table: T, since: string): Promise<SyncRow<T>[]>;
  dispose?(): void;
}

export type SyncRunResult = {
  pushed: number;
  pulled: number;
  conflicts: number;
};

export const epochCheckpoint = '1970-01-01T00:00:00.000Z';
export const checkpointOverlapMs = 5 * 60 * 1000;

export function overlappedCheckpoint(latest: string): string {
  return new Date(Math.max(0, new Date(latest).getTime() - checkpointOverlapMs)).toISOString();
}
