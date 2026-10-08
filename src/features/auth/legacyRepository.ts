import type { UserId } from '@/types/identity';
import type { SQLiteDatabase } from 'expo-sqlite';

type LegacyTransaction = Pick<SQLiteDatabase, 'getFirstAsync' | 'runAsync'>;
export type LegacyDatabase = LegacyTransaction & {
  transaction: (task: (tx: LegacyTransaction) => Promise<void>) => Promise<void>;
};

export type LegacyImportState = { hasLegacyData: boolean; dismissed: boolean };

export async function registerLocalUser(
  db: LegacyTransaction,
  userId: UserId,
  phone: string | null,
): Promise<void> {
  await db.runAsync(
    `INSERT INTO local_users (id, phone, authenticated_at) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET phone = excluded.phone, authenticated_at = excluded.authenticated_at`,
    userId, phone, new Date().toISOString(),
  );
}

export async function getLegacyImportState(
  db: LegacyTransaction,
  userId: UserId,
): Promise<LegacyImportState> {
  const legacy = await db.getFirstAsync<{ found: number }>(
    `SELECT EXISTS (
       SELECT 1 FROM exercises WHERE is_custom = 1 AND user_id IS NULL
       UNION ALL SELECT 1 FROM workouts WHERE user_id IS NULL
       UNION ALL SELECT 1 FROM workout_exercises WHERE user_id IS NULL
       UNION ALL SELECT 1 FROM workout_sessions WHERE user_id IS NULL
       UNION ALL SELECT 1 FROM session_exercises WHERE user_id IS NULL
       UNION ALL SELECT 1 FROM session_sets WHERE user_id IS NULL
     ) AS found`,
  );
  const decision = await db.getFirstAsync<{ dismissedAt: string | null }>(
    `SELECT dismissed_at AS dismissedAt FROM legacy_import_decisions WHERE user_id = ?`,
    userId,
  );
  return { hasLegacyData: legacy?.found === 1, dismissed: Boolean(decision?.dismissedAt) };
}

export async function dismissLegacyImport(db: LegacyTransaction, userId: UserId): Promise<void> {
  await db.runAsync(
    `INSERT INTO legacy_import_decisions (user_id, dismissed_at) VALUES (?, ?)
     ON CONFLICT(user_id) DO UPDATE SET dismissed_at = excluded.dismissed_at`,
    userId, new Date().toISOString(),
  );
}

export async function linkLegacyData(db: LegacyDatabase, userId: UserId): Promise<void> {
  await db.transaction(async (tx) => {
    const user = await tx.getFirstAsync<{ id: string }>('SELECT id FROM local_users WHERE id = ?', userId);
    if (!user) throw new Error('A identidade local ainda não foi preparada.');
    await tx.runAsync('UPDATE exercises SET user_id = ? WHERE is_custom = 1 AND user_id IS NULL', userId);
    await tx.runAsync('UPDATE workouts SET user_id = ? WHERE user_id IS NULL', userId);
    await tx.runAsync(
      `UPDATE workout_exercises SET user_id = ?
       WHERE user_id IS NULL AND workout_id IN (SELECT id FROM workouts WHERE user_id = ?)`,
      userId, userId,
    );
    await tx.runAsync('UPDATE workout_sessions SET user_id = ? WHERE user_id IS NULL', userId);
    await tx.runAsync(
      `UPDATE session_exercises SET user_id = ?
       WHERE user_id IS NULL AND session_id IN (SELECT id FROM workout_sessions WHERE user_id = ?)`,
      userId, userId,
    );
    await tx.runAsync(
      `UPDATE session_sets SET user_id = ?
       WHERE user_id IS NULL AND session_exercise_id IN (SELECT id FROM session_exercises WHERE user_id = ?)`,
      userId, userId,
    );
    await tx.runAsync(
      `INSERT INTO legacy_import_decisions (user_id, linked_at) VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET linked_at = excluded.linked_at, dismissed_at = NULL`,
      userId, new Date().toISOString(),
    );
  });
}
