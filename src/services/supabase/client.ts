import 'react-native-url-polyfill/auto';

import { createClient, processLock } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import { AppState } from 'react-native';

import { getSupabaseConfiguration } from '@/services/supabase/config';

import type { Database } from '@/services/supabase/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient<Database> | undefined;

// Lazy: no initialization, network traffic or required .env on the home screen.
export function getSupabaseClient(): SupabaseClient<Database> | null {
  if (client) return client;
  const configuration = getSupabaseConfiguration();
  if (configuration.status === 'unconfigured') return null;
  if (configuration.status === 'invalid') throw new Error('Revise as variáveis públicas do Supabase.');

  client = createClient<Database>(configuration.url, configuration.publishableKey, {
    auth: {
      storage: Storage,
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  });
  return client;
}

// The future auth provider should call this once and return its cleanup in an effect.
export function observeSessionRefresh(supabase: SupabaseClient<Database>): () => void {
  const update = (state: string) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  };
  update(AppState.currentState);
  const subscription = AppState.addEventListener('change', update);
  return () => { subscription.remove(); supabase.auth.stopAutoRefresh(); };
}
