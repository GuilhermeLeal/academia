import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

import { PGlite } from '@electric-sql/pglite';
import { AuthSessionMissingError, createClient } from '@supabase/supabase-js';

import { syncTables } from '../../src/services/initial-sync/model.ts';
import { createSupabaseInitialSyncRemote } from '../../src/services/initial-sync/remote.ts';

import type { SyncTable } from '../../src/services/initial-sync/model.ts';
import type { Database } from '../../src/services/supabase/database.types.ts';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

export const ACCOUNT_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const ACCOUNT_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/** Real SDK requests + real PostgreSQL/RLS; only HTTP transport/Auth are simulated. */
export async function initialSyncCloud() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon NOLOGIN;
    CREATE ROLE authenticated NOLOGIN;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
      SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated;
    GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated;
  `);
  const directory = new URL('../../supabase/migrations/', import.meta.url);
  for (const file of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
    await db.exec(readFileSync(new URL(file, directory), 'utf8'));
  }
  await db.query('INSERT INTO auth.users(id) VALUES ($1), ($2)', [ACCOUNT_A, ACCOUNT_B]);
  let account: string | null = ACCOUNT_A;
  let listener: ((event: AuthChangeEvent, session: Session | null) => void | Promise<void>) | undefined;
  let failure: SyncTable | undefined;
  const requests: { table: SyncTable; method: string; userId: string | null }[] = [];
  const client = createClient<Database>('https://initial-sync.example.invalid', 'sb_publishable_test_only', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        const table = url.pathname.split('/').at(-1) as SyncTable;
        assert(syncTables.includes(table));
        const method = init?.method ?? 'GET';
        requests.push({ table, method, userId: account });
        if (method === 'POST' && table === failure) {
          return new Response(JSON.stringify({ message: 'Simulated network interruption', code: 'TEST' }), { status: 503 });
        }
        try {
          const result = await db.transaction(async (tx) => {
            await tx.exec('SET LOCAL ROLE authenticated');
            await tx.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [account ?? '']);
            if (method === 'GET') {
              assert.equal(url.searchParams.get('user_id'), `eq.${account}`);
              assert.equal(url.searchParams.get('order'), 'id.asc');
              const after = url.searchParams.get('id')?.slice(3) ?? null;
              // A server cap lower than the client page size catches truncation bugs.
              return (await tx.query<{ row: unknown }>(
                `SELECT to_jsonb(t) AS row FROM public.${table} t WHERE user_id = $1
                 AND ($2::uuid IS NULL OR id > $2::uuid) ORDER BY id LIMIT 2`, [account, after],
              )).rows.map((row) => row.row);
            }
            assert.equal(method, 'POST');
            assert.equal(url.searchParams.get('on_conflict'), 'id');
            assert.match(new Headers(init?.headers).get('Prefer') ?? '', /resolution=ignore-duplicates/);
            const rows = JSON.parse(String(init?.body)) as Record<string, unknown>[];
            for (const row of rows) {
              const columns = Object.keys(row);
              assert(columns.every((column) => /^[a-z_]+$/.test(column)));
              await tx.query(`INSERT INTO public.${table} (${columns.join(', ')})
                VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')}) ON CONFLICT(id) DO NOTHING`, Object.values(row));
            }
            return null;
          });
          return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
        } catch (error) {
          const failure = error as { message: string; code?: string };
          return new Response(JSON.stringify({ message: failure.message, code: failure.code }), { status: 400 });
        }
      },
    },
  });
  const user = (): User | null => account ? {
    id: account, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z',
  } : null;
  const session = (): Session | null => {
    const current = user();
    return current ? { access_token: 'test-only-token', refresh_token: 'test-only-refresh', token_type: 'bearer', expires_in: 3600, user: current } : null;
  };
  client.auth.getUser = async () => {
    const current = user();
    return current ? { data: { user: current }, error: null }
      : { data: { user: null }, error: new AuthSessionMissingError() };
  };
  client.auth.getSession = async () => {
    const current = session();
    return current ? { data: { session: current }, error: null } : { data: { session: null }, error: null };
  };
  client.auth.onAuthStateChange = (callback) => {
    listener = callback;
    return { data: { subscription: { id: 'test-subscription', callback, unsubscribe: () => { listener = undefined; } } } };
  };
  return {
    db, requests,
    connect: (userId = ACCOUNT_A) => createSupabaseInitialSyncRemote(client, userId),
    setAccount: (id: string | null) => { account = id; void listener?.(id ? 'SIGNED_IN' : 'SIGNED_OUT', session()); },
    failUploadsTo: (table?: SyncTable) => { failure = table; },
  };
}
