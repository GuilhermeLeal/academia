import type { Database } from './database.types.ts';
import type { SupabaseClient } from '@supabase/supabase-js';

type WorkoutTable = Database['public']['Tables']['workouts'];
export type RemoteWorkout = WorkoutTable['Row'];
export type RemoteWorkoutUpload = Pick<WorkoutTable['Insert'], 'id' | 'name'> &
  Partial<Pick<WorkoutTable['Insert'], 'description' | 'created_at'>>;

/** Explicit cloud operations only. No singleton, SQLite access or UI integration. */
export function createRemoteWorkoutsRepository(client: SupabaseClient<Database>) {
  async function authenticatedUserId(): Promise<string> {
    // Resolve every operation, so a repository cannot retain the previous account.
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Autenticação necessária para acessar os dados remotos.');
    return data.user.id;
  }

  return {
    async getById(id: string): Promise<RemoteWorkout | null> {
      const userId = await authenticatedUserId();
      const { data, error } = await client.from('workouts').select('*')
        .eq('user_id', userId).eq('id', id).maybeSingle();
      if (error) throw error;
      // Deliberately includes tombstones for the future sync consumer.
      return data;
    },

    async upsert(input: RemoteWorkoutUpload): Promise<RemoteWorkout> {
      const userId = await authenticatedUserId();
      // Allowlist fields: never trust caller-supplied ownership/server timestamps.
      const payload = {
        id: input.id,
        name: input.name,
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.created_at !== undefined ? { created_at: input.created_at } : {}),
        user_id: userId,
      };
      const { data, error } = await client.from('workouts')
        .upsert(payload, { onConflict: 'id' }).select('*').single();
      if (error) throw error;
      return data;
    },

    async markDeleted(id: string): Promise<RemoteWorkout | null> {
      const userId = await authenticatedUserId();
      const { data, error } = await client.from('workouts')
        // The trigger replaces this marker with a server timestamp.
        .update({ deleted_at: new Date().toISOString() })
        .eq('user_id', userId).eq('id', id).select('*').maybeSingle();
      if (error) throw error;
      return data;
    },
  };
}
