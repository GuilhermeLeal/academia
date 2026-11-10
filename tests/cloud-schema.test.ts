import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';

import { PGlite } from '@electric-sql/pglite';

import { adapt } from './helpers/sqlite.ts';
import { initializeDatabase } from '../src/db/migrations.ts';

import type { Database } from '../src/services/supabase/database.types.ts';

const foundationDirectory = new URL('../supabase/', import.meta.url);

async function withCloudDatabase(task: (db: PGlite) => Promise<void>) {
  const db = new PGlite();
  try {
    // Only the Supabase-owned Auth boundary is emulated. Domain migrations,
    // constraints, triggers, grants and RLS run unchanged in PostgreSQL.
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
    const directory = new URL('migrations/', foundationDirectory);
    for (const name of readdirSync(directory).filter((name) => name.endsWith('.sql')).sort()) {
      await db.exec(readFileSync(new URL(name, directory), 'utf8'));
    }
    await task(db);
  } finally {
    await db.close();
  }
}

test('PostgreSQL migrations enforce RLS, child ownership, stable UUIDs and sync tombstones', async () => {
  await withCloudDatabase(async (db) => {
    const results = await db.exec(readFileSync(new URL('validation/cloud_foundation.sql', foundationDirectory), 'utf8'));
    assert.match(JSON.stringify(results.at(-1)?.rows), /all RLS, ownership, UUID and tombstone assertions passed/);
    assert.equal((await db.query<{ count: number }>('SELECT count(*)::integer AS count FROM auth.users')).rows[0]?.count, 0);
  });
});

test('remote standard catalog exactly matches the bundled SQLite catalog', async () => {
  await withCloudDatabase(async (remote) => {
    const database = new DatabaseSync(':memory:');
    try {
      const local = adapt(database);
      await initializeDatabase(local);
      const columns = 'id, name, normalized_name, muscle_group, equipment, image_uri, created_at';
      const localRows = await local.getAllAsync<Record<string, unknown>>(
        `SELECT ${columns} FROM exercises WHERE is_custom = 0 ORDER BY id`,
      );
      const remoteRows = await remote.query<Record<string, unknown>>(
        `SELECT ${columns} FROM public.exercises WHERE NOT is_custom ORDER BY id`,
      );
      const normalize = (rows: Record<string, unknown>[]) => rows.map((row) => ({
        ...row, created_at: new Date(row.created_at as string | Date).toISOString(),
      }));
      assert.deepEqual(normalize(remoteRows.rows), normalize(localRows));
    } finally {
      database.close();
    }
  });
});

test('cloud table types match actual columns and all domain tables have four RLS policies', async () => {
  type Tables = Database['public']['Tables'];
  const fields = {
    exercises: { id: true, user_id: true, name: true, normalized_name: true, muscle_group: true, equipment: true, image_uri: true, is_custom: true, created_at: true, updated_at: true, deleted_at: true },
    workouts: { id: true, user_id: true, name: true, description: true, created_at: true, updated_at: true, deleted_at: true },
    workout_exercises: { id: true, user_id: true, workout_id: true, exercise_id: true, position: true, sets: true, reps_min: true, reps_max: true, rest_seconds: true, created_at: true, updated_at: true, deleted_at: true },
    workout_sessions: { id: true, user_id: true, workout_id: true, workout_name: true, started_at: true, finished_at: true, status: true, created_at: true, updated_at: true, deleted_at: true },
    session_exercises: { id: true, user_id: true, session_id: true, exercise_id: true, exercise_name: true, position: true, planned_sets: true, planned_reps_min: true, planned_reps_max: true, planned_rest_seconds: true, created_at: true, updated_at: true, deleted_at: true },
    session_sets: { id: true, user_id: true, session_exercise_id: true, set_number: true, weight: true, reps: true, completed: true, created_at: true, updated_at: true, deleted_at: true },
  } satisfies { [Name in keyof Tables]: Record<keyof Tables[Name]['Row'], true> };

  await withCloudDatabase(async (db) => {
    const tables = await db.query<{ name: keyof Tables; rls: boolean; force: boolean }>(`
      SELECT relname AS name, relrowsecurity AS rls, relforcerowsecurity AS force
      FROM pg_class JOIN pg_namespace n ON n.oid = relnamespace
      WHERE n.nspname = 'public' AND relkind = 'r' ORDER BY relname
    `);
    assert.deepEqual(tables.rows.map((row) => row.name), Object.keys(fields).sort());
    for (const table of tables.rows) {
      assert.equal(table.rls && table.force, true, table.name);
      const columns = await db.query<{ column_name: string }>(`
        SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 ORDER BY column_name
      `, [table.name]);
      assert.deepEqual(columns.rows.map((row) => row.column_name), Object.keys(fields[table.name]).sort());
      const policies = await db.query<{ cmd: string }>(
        'SELECT cmd FROM pg_policies WHERE schemaname = $1 AND tablename = $2 ORDER BY cmd',
        ['public', table.name],
      );
      assert.deepEqual(policies.rows.map((row) => row.cmd), ['DELETE', 'INSERT', 'SELECT', 'UPDATE']);
    }
  });
});
