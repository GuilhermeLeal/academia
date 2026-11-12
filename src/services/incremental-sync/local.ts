import { epochCheckpoint, pushOrder } from './model.ts';

import type { PendingChange, SyncRow, SyncTable } from './model.ts';
import type { WorkoutDatabase, WorkoutTransaction } from '../../features/workouts/repository.ts';
import type { SQLiteBindValue } from 'expo-sqlite';

const tableRank = new Map(pushOrder.map((table, index) => [table, index]));

type PendingRow = {
  userId: string; tableName: SyncTable; entityId: string;
  operation: 'upsert' | 'delete'; generation: number;
};

export async function pendingChanges(db: WorkoutTransaction): Promise<PendingChange[]> {
  const rows = await db.getAllAsync<PendingRow>(
    `SELECT user_id AS userId, table_name AS tableName, entity_id AS entityId, operation, generation
     FROM sync_changes WHERE user_id = ? ORDER BY changed_at, entity_id`, db.userId,
  );
  return rows.sort((a, b) => {
    const left = tableRank.get(a.tableName) ?? 99;
    const right = tableRank.get(b.tableName) ?? 99;
    return a.operation === b.operation
      ? (a.operation === 'delete' ? right - left : left - right)
      : a.operation === 'upsert' ? -1 : 1;
  }).map(({ tableName, ...row }) => ({ ...row, table: tableName }));
}

export async function readLocalRow<T extends SyncTable>(
  db: WorkoutTransaction, table: T, id: string,
): Promise<SyncRow<T> | null> {
  let row: Record<string, unknown> | null;
  switch (table) {
    case 'exercises':
      row = await db.getFirstAsync(`SELECT id, user_id, name, normalized_name, muscle_group, equipment,
        image_uri, is_custom, created_at, updated_at, NULL AS deleted_at
        FROM exercises WHERE id = ? AND user_id = ? AND is_custom = 1`, id, db.userId);
      break;
    case 'workouts':
      row = await db.getFirstAsync(`SELECT id, user_id, name, description, created_at, updated_at,
        NULL AS deleted_at FROM workouts WHERE id = ? AND user_id = ?`, id, db.userId);
      break;
    case 'workout_exercises':
      row = await db.getFirstAsync(`SELECT id, user_id, workout_id, exercise_id, position, sets,
        reps_min, reps_max, rest_seconds, created_at, updated_at, NULL AS deleted_at
        FROM workout_exercises WHERE id = ? AND user_id = ?`, id, db.userId);
      break;
    case 'workout_sessions':
      row = await db.getFirstAsync(`SELECT id, user_id, workout_id, workout_name, started_at, finished_at,
        status, started_at AS created_at, coalesce(finished_at, started_at) AS updated_at, NULL AS deleted_at
        FROM workout_sessions WHERE id = ? AND user_id = ?`, id, db.userId);
      break;
    case 'session_exercises':
      row = await db.getFirstAsync(`SELECT se.id, se.user_id, se.session_id, se.exercise_id, se.exercise_name,
        se.position, se.planned_sets, se.planned_reps_min, se.planned_reps_max, se.planned_rest_seconds,
        ws.started_at AS created_at, coalesce(ws.finished_at, ws.started_at) AS updated_at, NULL AS deleted_at
        FROM session_exercises se JOIN workout_sessions ws ON ws.id = se.session_id AND ws.user_id = se.user_id
        WHERE se.id = ? AND se.user_id = ?`, id, db.userId);
      break;
    case 'session_sets':
      row = await db.getFirstAsync(`SELECT ss.id, ss.user_id, ss.session_exercise_id, ss.set_number,
        ss.weight, ss.reps, ss.completed, ws.started_at AS created_at,
        coalesce(ws.finished_at, ws.started_at) AS updated_at, NULL AS deleted_at
        FROM session_sets ss JOIN session_exercises se ON se.id = ss.session_exercise_id AND se.user_id = ss.user_id
        JOIN workout_sessions ws ON ws.id = se.session_id AND ws.user_id = se.user_id
        WHERE ss.id = ? AND ss.user_id = ?`, id, db.userId);
      break;
  }
  if (!row) return null;
  if ('is_custom' in row) row.is_custom = row.is_custom === 1;
  if ('completed' in row) row.completed = row.completed === 1;
  return row as SyncRow<T>;
}

export async function acknowledgeChange(
  db: WorkoutDatabase, change: PendingChange, remote: { updated_at: string; deleted_at: string | null } | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    if (remote) {
      await tx.runAsync(`INSERT INTO sync_entity_state
        (user_id, table_name, entity_id, remote_updated_at, is_deleted) VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(user_id, table_name, entity_id) DO UPDATE SET
          remote_updated_at = excluded.remote_updated_at, is_deleted = excluded.is_deleted`,
      tx.userId, change.table, change.entityId, remote.updated_at, remote.deleted_at ? 1 : 0);
    }
    await tx.runAsync(`DELETE FROM sync_changes
      WHERE user_id = ? AND table_name = ? AND entity_id = ? AND generation = ?`,
    tx.userId, change.table, change.entityId, change.generation);
  });
}

export async function checkpoints(db: WorkoutTransaction): Promise<Record<SyncTable, string>> {
  const rows = await db.getAllAsync<{ tableName: SyncTable; cursor: string }>(
    'SELECT table_name AS tableName, cursor_updated_at AS cursor FROM sync_checkpoints WHERE user_id = ?', db.userId,
  );
  return Object.fromEntries(pushOrder.map((table) => [table,
    rows.find((row) => row.tableName === table)?.cursor ?? epochCheckpoint,
  ])) as Record<SyncTable, string>;
}

function values(row: Record<string, unknown>, columns: readonly string[]): SQLiteBindValue[] {
  return columns.map((column) => {
    const value = row[column];
    if (typeof value === 'boolean') return Number(value);
    return value as SQLiteBindValue;
  });
}

const localColumns = {
  exercises: ['id', 'user_id', 'name', 'normalized_name', 'muscle_group', 'equipment', 'image_uri', 'is_custom', 'created_at', 'updated_at'],
  workouts: ['id', 'user_id', 'name', 'description', 'created_at', 'updated_at'],
  workout_exercises: ['id', 'user_id', 'workout_id', 'exercise_id', 'position', 'sets', 'reps_min', 'reps_max', 'rest_seconds', 'created_at', 'updated_at'],
  workout_sessions: ['id', 'user_id', 'workout_id', 'workout_name', 'started_at', 'finished_at', 'status'],
  session_exercises: ['id', 'user_id', 'session_id', 'exercise_id', 'exercise_name', 'position', 'planned_sets', 'planned_reps_min', 'planned_reps_max', 'planned_rest_seconds'],
  session_sets: ['id', 'user_id', 'session_exercise_id', 'set_number', 'weight', 'reps', 'completed'],
} as const satisfies Record<SyncTable, readonly string[]>;

async function hasPending(tx: WorkoutTransaction, table: SyncTable, id: string): Promise<boolean> {
  return Boolean(await tx.getFirstAsync('SELECT 1 AS found FROM sync_changes WHERE user_id = ? AND table_name = ? AND entity_id = ?',
    tx.userId, table, id));
}

async function applyLive(tx: WorkoutTransaction, table: SyncTable, row: SyncRow<SyncTable>): Promise<void> {
  if (table === 'workout_exercises') {
    const exerciseId = (row as SyncRow<'workout_exercises'>).exercise_id;
    const deletedExercise = await tx.getFirstAsync(`SELECT 1 AS found FROM sync_entity_state
      WHERE user_id = ? AND table_name = 'exercises' AND entity_id = ? AND is_deleted = 1`, tx.userId, exerciseId);
    if (deletedExercise) return;
  }
  const columns: readonly string[] = localColumns[table];
  const updates = columns.filter((column) => column !== 'id' && column !== 'user_id')
    .map((column) => `${column} = excluded.${column}`).join(', ');
  await tx.runAsync(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map(() => '?').join(', ')})
    ON CONFLICT(id) DO UPDATE SET ${updates}`, values(row as unknown as Record<string, unknown>, columns));
}

async function applyDeleted(tx: WorkoutTransaction, table: SyncTable, row: SyncRow<SyncTable>): Promise<void> {
  if (table === 'exercises') {
    await tx.runAsync('DELETE FROM workout_exercises WHERE user_id = ? AND exercise_id = ?', tx.userId, row.id);
  }
  await tx.runAsync(`DELETE FROM ${table} WHERE id = ? AND user_id = ?`, row.id, tx.userId);
}

export async function applyPulledChanges(
  db: WorkoutDatabase,
  batches: Record<SyncTable, SyncRow<SyncTable>[]>,
  nextCheckpoints: Record<SyncTable, string>,
): Promise<{ applied: number; conflicts: number }> {
  let applied = 0;
  let conflicts = 0;
  await db.transaction(async (tx) => {
    await tx.runAsync('INSERT OR IGNORE INTO sync_suppression(user_id) VALUES (?)', tx.userId);
    try {
      const deleted = [...pushOrder].reverse().flatMap((table) =>
        batches[table].filter((row) => row.deleted_at !== null).map((row) => ({ table, row })));
      const live = pushOrder.flatMap((table) =>
        batches[table].filter((row) => row.deleted_at === null).map((row) => ({ table, row })));
      for (const { table, row } of [...deleted, ...live]) {
        if (row.user_id !== tx.userId) throw new Error('Pull retornou dados de outra conta.');
        if (await hasPending(tx, table, row.id)) { conflicts += 1; continue; }
        const known = await tx.getFirstAsync<{ updatedAt: string }>(`SELECT remote_updated_at AS updatedAt
          FROM sync_entity_state WHERE user_id = ? AND table_name = ? AND entity_id = ?`, tx.userId, table, row.id);
        if (known && Date.parse(known.updatedAt) >= Date.parse(row.updated_at)) continue;
        if (row.deleted_at) await applyDeleted(tx, table, row);
        else await applyLive(tx, table, row);
        await tx.runAsync(`INSERT INTO sync_entity_state
          (user_id, table_name, entity_id, remote_updated_at, is_deleted) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id, table_name, entity_id) DO UPDATE SET
            remote_updated_at = excluded.remote_updated_at, is_deleted = excluded.is_deleted`,
        tx.userId, table, row.id, row.updated_at, row.deleted_at ? 1 : 0);
        applied += 1;
      }
      for (const table of pushOrder) {
        await tx.runAsync(`INSERT INTO sync_checkpoints(user_id, table_name, cursor_updated_at)
          VALUES (?, ?, ?) ON CONFLICT(user_id, table_name) DO UPDATE SET cursor_updated_at = excluded.cursor_updated_at`,
        tx.userId, table, nextCheckpoints[table]);
      }
    } finally {
      await tx.runAsync('DELETE FROM sync_suppression WHERE user_id = ?', tx.userId);
    }
  });
  return { applied, conflicts };
}
