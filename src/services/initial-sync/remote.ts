import { syncTables } from './model.ts';

import type { InitialSyncRemote, SyncRow, SyncSnapshot, SyncTable } from './model.ts';
import type { Database } from '../supabase/database.types.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const batchSize = 250;

export async function createSupabaseInitialSyncRemote(
  client: SupabaseClient<Database>, userId: string,
): Promise<InitialSyncRemote & { dispose(): void }> {
  const verified = await client.auth.getUser();
  if (verified.error) throw verified.error;
  if (verified.data.user?.id !== userId) throw new Error('A conta autenticada mudou.');
  let invalidated = false;
  const { data: listener } = client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (session && session.user.id !== userId)) invalidated = true;
  });

  async function assertIdentity() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    if (invalidated || data.session?.user.id !== userId) throw new Error('A sessão mudou durante o Initial Sync.');
  }

  async function readTable<T extends SyncTable>(table: T): Promise<SyncRow<T>[]> {
    const rows: SyncRow<T>[] = [];
    let after: string | undefined;
    for (;;) {
      await assertIdentity();
      let query = client.from(table as SyncTable).select('*').eq('user_id', userId).order('id').limit(batchSize);
      if (after) query = query.gt('id', after);
      const { data, error } = await query.overrideTypes<SyncRow<T>[], { merge: false }>().retry(false);
      if (error) throw error;
      await assertIdentity();
      // The schema/table generic describes precisely this SELECT * boundary.
      const page = data;
      if (!page.length) break;
      if (page.some((row) => row.user_id !== userId || (after !== undefined && row.id <= after))) {
        throw new Error('Página remota inválida ou de outra conta.');
      }
      rows.push(...page);
      after = page[page.length - 1]!.id;
      // Keep going even if server max_rows is lower than batchSize.
    }
    return rows;
  }

  return {
    assertIdentity,
    dispose: () => { invalidated = true; listener.subscription.unsubscribe(); },
    async read(): Promise<SyncSnapshot> {
      return {
        exercises: await readTable('exercises'), workouts: await readTable('workouts'),
        workout_exercises: await readTable('workout_exercises'), workout_sessions: await readTable('workout_sessions'),
        session_exercises: await readTable('session_exercises'), session_sets: await readTable('session_sets'),
      };
    },
    async insertMissing(snapshot) {
      const options = { onConflict: 'id', ignoreDuplicates: true };
      const upserts = {
        exercises: (start: number) => client.from('exercises').upsert(snapshot.exercises.slice(start, start + batchSize), options).retry(false),
        workouts: (start: number) => client.from('workouts').upsert(snapshot.workouts.slice(start, start + batchSize), options).retry(false),
        workout_exercises: (start: number) => client.from('workout_exercises').upsert(snapshot.workout_exercises.slice(start, start + batchSize), options).retry(false),
        workout_sessions: (start: number) => client.from('workout_sessions').upsert(snapshot.workout_sessions.slice(start, start + batchSize), options).retry(false),
        session_exercises: (start: number) => client.from('session_exercises').upsert(snapshot.session_exercises.slice(start, start + batchSize), options).retry(false),
        session_sets: (start: number) => client.from('session_sets').upsert(snapshot.session_sets.slice(start, start + batchSize), options).retry(false),
      };
      for (const table of syncTables) {
        const rows = snapshot[table];
        if (rows.some((row) => row.user_id !== userId || row.deleted_at !== null) ||
          (table === 'exercises' && snapshot.exercises.some((row) => !row.is_custom))) {
          throw new Error('Upload contém dados fora da conta ou do escopo inicial.');
        }
      }
      for (const table of syncTables) {
        const rows = snapshot[table];
        for (let start = 0; start < rows.length; start += batchSize) {
          await assertIdentity();
          // INSERT ON CONFLICT DO NOTHING is intentional: even a race must never
          // turn this initial import into an overwrite of an existing remote row.
          const { error } = await upserts[table](start);
          if (error) throw error;
          await assertIdentity();
        }
      }
    },
  };
}
