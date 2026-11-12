import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { writeTransaction } from '@/db/writeTransaction';
import { useAuthenticatedUser } from '@/features/auth/AuthProvider';
import { getSupabaseClient } from '@/services/supabase/client';

import { subscribeSyncNeeded } from './events';
import { createSupabaseIncrementalSyncRemote } from './remote';
import { createIncrementalSync } from './service';

import type { WorkoutDatabase } from '@/features/workouts/repository';
import type { PropsWithChildren } from 'react';

const debounceMs = 1500;

export function IncrementalSyncProvider({ children }: PropsWithChildren) {
  const sqlite = useSQLiteContext();
  const user = useAuthenticatedUser();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const client = getSupabaseClient();
    if (!client) return;
    let active = true;
    let queued = false;
    let working = false;
    let disposeRemote: (() => void) | undefined;
    const local: WorkoutDatabase = {
      userId: user.id,
      getFirstAsync: sqlite.getFirstAsync.bind(sqlite),
      getAllAsync: sqlite.getAllAsync.bind(sqlite),
      runAsync: sqlite.runAsync.bind(sqlite),
      transaction: (task) => writeTransaction(sqlite.databasePath, (tx) => task({
        userId: user.id,
        getFirstAsync: tx.getFirstAsync.bind(tx),
        getAllAsync: tx.getAllAsync.bind(tx),
        runAsync: tx.runAsync.bind(tx),
      })),
    };

    const run = async () => {
      if (!active) return;
      if (working) { queued = true; return; }
      working = true;
      try {
        const remote = await createSupabaseIncrementalSyncRemote(client, user.id);
        disposeRemote = () => remote.dispose?.();
        try { await createIncrementalSync(local, remote).run(); }
        finally { remote.dispose?.(); disposeRemote = undefined; }
      } catch {
        // Offline/auth/network failures deliberately leave the durable outbox intact.
      } finally {
        working = false;
        if (active && queued) { queued = false; void run(); }
      }
    };
    const schedule = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { timer.current = null; void run(); }, debounceMs);
    };
    const unsubscribe = subscribeSyncNeeded(schedule);
    const appState = AppState.addEventListener('change', (state) => { if (state === 'active') schedule(); });
    // Session restoration/login: render immediately and sync in the background.
    schedule();
    return () => {
      active = false;
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      unsubscribe();
      appState.remove();
      disposeRemote?.();
    };
  }, [sqlite, user.id]);

  return children;
}
