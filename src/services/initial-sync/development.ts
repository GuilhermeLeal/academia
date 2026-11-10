import * as Crypto from 'expo-crypto';
import { openDatabaseAsync } from 'expo-sqlite';

import { DATABASE_VERSION } from '@/db/migrations';
import { getSupabaseClient } from '@/services/supabase/client';

import { createSupabaseInitialSyncRemote } from './remote';
import { createInitialSync } from './service';

import type { InitialSyncResult, SyncReceipt } from './model';
import type { WorkoutDatabase } from '@/features/workouts/repository';
import type { UserId } from '@/types/identity';

let busy = false;

async function run(direction: 'upload' | 'restore', receipt?: SyncReceipt): Promise<InitialSyncResult> {
  if (!__DEV__) throw new Error('O gatilho interno está disponível somente em desenvolvimento.');
  if (busy) throw new Error('Aguarde a operação de Initial Sync em andamento.');
  busy = true;
  try {
    const client = getSupabaseClient();
    if (!client) throw new Error('Supabase não configurado.');
    const { data, error } = await client.auth.getUser();
    if (error) throw error;
    if (!data.user) throw new Error('Entre na conta antes de executar o Initial Sync.');
    const remote = await createSupabaseInitialSyncRemote(client, data.user.id);
    try {
      const connection = await openDatabaseAsync('academia.db', { useNewConnection: true });
      try {
        await connection.execAsync('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;');
        const version = await connection.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
        if (version?.user_version !== DATABASE_VERSION) throw new Error('Aguarde a inicialização do banco e abra a Home antes de sincronizar.');
        const local: WorkoutDatabase = {
          userId: data.user.id as UserId,
          getFirstAsync: connection.getFirstAsync.bind(connection),
          getAllAsync: connection.getAllAsync.bind(connection),
          runAsync: connection.runAsync.bind(connection),
          // Dedicated connection; its foreign_keys pragma was set before BEGIN.
          transaction: (task) => connection.withTransactionAsync(() => task(local)),
        };
        const service = createInitialSync(local, remote, (value) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value));
        return await (direction === 'upload' ? service.upload() : service.restore(receipt));
      } finally { await connection.closeAsync(); }
    } finally { remote.dispose(); }
  } finally { busy = false; }
}

declare global {
  var __ACADEMIA_INITIAL_SYNC__: undefined | {
    upload(): Promise<InitialSyncResult>;
    restore(receipt?: SyncReceipt): Promise<InitialSyncResult>;
  };
}

// Register functions only: no authentication/network/SQLite work at import time.
if (__DEV__) {
  globalThis.__ACADEMIA_INITIAL_SYNC__ = { upload: () => run('upload'), restore: (receipt) => run('restore', receipt) };
}
