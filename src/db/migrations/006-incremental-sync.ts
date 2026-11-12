import type { SQLiteDatabase } from 'expo-sqlite';

const tables = [
  'exercises', 'workouts', 'workout_exercises',
  'workout_sessions', 'session_exercises', 'session_sets',
] as const;

function trackingTrigger(table: typeof tables[number], event: 'INSERT' | 'UPDATE' | 'DELETE'): string {
  const row = event === 'DELETE' ? 'OLD' : 'NEW';
  const operation = event === 'DELETE' ? 'delete' : 'upsert';
  return `
    CREATE TRIGGER sync_track_${table}_${event.toLowerCase()}
    AFTER ${event} ON ${table}
    WHEN ${row}.user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM sync_suppression WHERE user_id = ${row}.user_id
    )
    BEGIN
      INSERT INTO sync_changes(user_id, table_name, entity_id, operation, generation, changed_at)
      VALUES (${row}.user_id, '${table}', ${row}.id, '${operation}', 1, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      ON CONFLICT(user_id, table_name, entity_id) DO UPDATE SET
        operation = excluded.operation,
        generation = sync_changes.generation + 1,
        changed_at = excluded.changed_at;
    END;`;
}

export async function migrateIncrementalSync(db: Pick<SQLiteDatabase, 'execAsync'>): Promise<void> {
  await db.execAsync(`
    CREATE TABLE sync_changes (
      user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
      table_name TEXT NOT NULL CHECK(table_name IN (
        'exercises', 'workouts', 'workout_exercises',
        'workout_sessions', 'session_exercises', 'session_sets'
      )),
      entity_id TEXT NOT NULL,
      operation TEXT NOT NULL CHECK(operation IN ('upsert', 'delete')),
      generation INTEGER NOT NULL CHECK(generation > 0),
      changed_at TEXT NOT NULL,
      PRIMARY KEY(user_id, table_name, entity_id)
    );

    CREATE TABLE sync_checkpoints (
      user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
      table_name TEXT NOT NULL,
      cursor_updated_at TEXT NOT NULL,
      PRIMARY KEY(user_id, table_name)
    );

    CREATE TABLE sync_entity_state (
      user_id TEXT NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
      table_name TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      remote_updated_at TEXT NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0 CHECK(is_deleted IN (0, 1)),
      PRIMARY KEY(user_id, table_name, entity_id)
    );

    -- A marker exists only inside a local transaction that applies remote data.
    -- A crash rolls it back together with that data, so tracking cannot remain disabled.
    CREATE TABLE sync_suppression (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES local_users(id) ON DELETE CASCADE
    );

    CREATE INDEX sync_changes_user_order
      ON sync_changes(user_id, operation, table_name, changed_at, entity_id);
    CREATE INDEX sync_entity_state_tombstones
      ON sync_entity_state(user_id, table_name, is_deleted, entity_id);

    ${tables.flatMap((table) => [
      trackingTrigger(table, 'INSERT'), trackingTrigger(table, 'UPDATE'), trackingTrigger(table, 'DELETE'),
    ]).join('\n')}
  `);
}
