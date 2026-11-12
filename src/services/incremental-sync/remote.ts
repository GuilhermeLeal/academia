import type { IncrementalSyncRemote, SyncRow, SyncTable } from './model.ts';
import type { Database } from '../supabase/database.types.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

const pageSize = 250;

export async function createSupabaseIncrementalSyncRemote(
  client: SupabaseClient<Database>, userId: string,
): Promise<IncrementalSyncRemote> {
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
    if (invalidated || data.session?.user.id !== userId) throw new Error('A sessão mudou durante a sincronização.');
  }

  async function writeUpsert(table: SyncTable, row: SyncRow<SyncTable>): Promise<SyncRow<SyncTable>> {
    const options = { onConflict: 'id' };
    switch (table) {
      case 'exercises': return write(client.from('exercises').upsert(row as SyncRow<'exercises'>, options).select('*').single().retry(false));
      case 'workouts': return write(client.from('workouts').upsert(row as SyncRow<'workouts'>, options).select('*').single().retry(false));
      case 'workout_exercises': return write(client.from('workout_exercises').upsert(row as SyncRow<'workout_exercises'>, options).select('*').single().retry(false));
      case 'workout_sessions': return write(client.from('workout_sessions').upsert(row as SyncRow<'workout_sessions'>, options).select('*').single().retry(false));
      case 'session_exercises': return write(client.from('session_exercises').upsert(row as SyncRow<'session_exercises'>, options).select('*').single().retry(false));
      case 'session_sets': return write(client.from('session_sets').upsert(row as SyncRow<'session_sets'>, options).select('*').single().retry(false));
    }
  }

  async function write(query: PromiseLike<{ data: SyncRow<SyncTable> | null; error: Error | null }>): Promise<SyncRow<SyncTable>> {
    const { data, error } = await query;
    if (error) throw error;
    if (!data) throw new Error('O servidor não confirmou a alteração.');
    return data;
  }

  return {
    assertIdentity,
    dispose: () => { invalidated = true; listener.subscription.unsubscribe(); },
    async upsert<T extends SyncTable>(table: T, row: SyncRow<T>): Promise<SyncRow<T>> {
      if (row.user_id !== userId || (table === 'exercises' && !(row as SyncRow<'exercises'>).is_custom)) {
        throw new Error('Push contém dados fora da conta autenticada.');
      }
      await assertIdentity();
      const data = await writeUpsert(table, row);
      await assertIdentity();
      if (data.user_id !== userId || data.id !== row.id) throw new Error('Confirmação remota inválida.');
      return data as SyncRow<T>;
    },
    async tombstone<T extends SyncTable>(table: T, id: string): Promise<SyncRow<T> | null> {
      await assertIdentity();
      const { data, error } = await client.from(table as SyncTable).update({ deleted_at: new Date().toISOString() })
        .eq('id', id).eq('user_id', userId).select('*')
        .overrideTypes<SyncRow<T>[], { merge: false }>().retry(false);
      if (error) throw error;
      await assertIdentity();
      if (data.length > 1 || data.some((row) => row.user_id !== userId || row.id !== id || !row.deleted_at)) {
        throw new Error('Confirmação de tombstone inválida.');
      }
      return data[0] ?? null;
    },
    async changes<T extends SyncTable>(table: T, since: string): Promise<SyncRow<T>[]> {
      const result: SyncRow<T>[] = [];
      for (let start = 0;; start += pageSize) {
        await assertIdentity();
        const { data, error } = await client.from(table as SyncTable).select('*')
          .eq('user_id', userId).gte('updated_at', since)
          .order('updated_at').order('id').range(start, start + pageSize - 1)
          .overrideTypes<SyncRow<T>[], { merge: false }>().retry(false);
        if (error) throw error;
        await assertIdentity();
        if (data.some((row) => row.user_id !== userId || Date.parse(row.updated_at) < Date.parse(since))) {
          throw new Error('Página incremental inválida ou de outra conta.');
        }
        result.push(...data);
        if (data.length < pageSize) break;
      }
      return result;
    },
  };
}
