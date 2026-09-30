import { openDatabaseAsync } from 'expo-sqlite';

import type { SQLiteDatabase } from 'expo-sqlite';

/** A dedicated connection keeps other screens' reads out of a multi-statement write. */
export async function writeTransaction(
  databasePath: string,
  task: (tx: SQLiteDatabase) => Promise<void>,
): Promise<void> {
  const slash = databasePath.lastIndexOf('/');
  const connection = await openDatabaseAsync(databasePath.slice(slash + 1), { useNewConnection: true }, databasePath.slice(0, slash));
  try {
    // Foreign keys are connection-local and must be enabled BEFORE BEGIN.
    await connection.execAsync('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
    await connection.withTransactionAsync(() => task(connection));
  } finally { await connection.closeAsync(); }
}
