import assert from 'node:assert/strict';
import { test } from 'node:test';

import { AuthSessionMissingError, createClient } from '@supabase/supabase-js';

import { createRemoteWorkoutsRepository } from '../src/services/supabase/remoteWorkoutsRepository.ts';

import type { Database } from '../src/services/supabase/database.types.ts';
import type { User } from '@supabase/supabase-js';

const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const WORKOUT_ID = '12345678-1234-4123-8123-123456789abc';

function harness() {
  let userId: string | null = USER_A;
  let authReads = 0;
  let responseBody: unknown = null;
  let responseStatus = 200;
  const requests: { url: URL; method: string; body: Record<string, unknown> | null }[] = [];
  const client = createClient<Database>('https://foundation.example.invalid', 'sb_publishable_test_only', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        requests.push({
          url: new URL(String(input)),
          method: init?.method ?? 'GET',
          body: typeof init?.body === 'string' ? JSON.parse(init.body) : null,
        });
        return new Response(JSON.stringify(responseBody), {
          status: responseStatus, headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  });
  client.auth.getUser = async () => {
    authReads += 1;
    if (!userId) return { data: { user: null }, error: new AuthSessionMissingError() };
    const user: User = {
      id: userId, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z',
      app_metadata: {}, user_metadata: {},
    };
    return { data: { user }, error: null };
  };
  return {
    repository: createRemoteWorkoutsRepository(client),
    requests,
    authReads: () => authReads,
    signInAs: (id: string | null) => { userId = id; },
    respond: (body: unknown, status = 200) => { responseBody = body; responseStatus = status; },
  };
}

test('remote repository is inert until called and upserts the local UUID with authenticated ownership', async () => {
  const remote = harness();
  assert.equal(remote.authReads(), 0);
  assert.equal(remote.requests.length, 0);
  const payload = {
    id: WORKOUT_ID, name: 'Treino A', description: 'Descrição', created_at: '2026-01-01T00:00:00Z',
    user_id: USER_B, updated_at: '2099-01-01T00:00:00Z', deleted_at: '2099-01-01T00:00:00Z',
  };
  remote.respond({ id: WORKOUT_ID, user_id: USER_A, name: 'Treino A' });
  assert.equal((await remote.repository.upsert(payload)).id, WORKOUT_ID);
  const request = remote.requests[0];
  assert(request);
  assert.equal(request.method, 'POST');
  assert.equal(request.url.pathname, '/rest/v1/workouts');
  assert.equal(request.url.searchParams.get('on_conflict'), 'id');
  assert.deepEqual(request.body, {
    id: WORKOUT_ID, name: 'Treino A', description: 'Descrição',
    created_at: '2026-01-01T00:00:00Z', user_id: USER_A,
  });
});

test('remote reads filter by user and UUID while preserving tombstones for a future consumer', async () => {
  const remote = harness();
  const tombstone = { id: WORKOUT_ID, user_id: USER_A, deleted_at: '2026-11-10T10:00:00Z' };
  remote.respond([tombstone]);
  assert.deepEqual(await remote.repository.getById(WORKOUT_ID), tombstone);
  const request = remote.requests[0];
  assert(request);
  assert.equal(request.url.searchParams.get('user_id'), `eq.${USER_A}`);
  assert.equal(request.url.searchParams.get('id'), `eq.${WORKOUT_ID}`);
  remote.respond([]);
  assert.equal(await remote.repository.getById(WORKOUT_ID), null);
});

test('remote operations resolve the current login each time and stop before database access after logout', async () => {
  const remote = harness();
  remote.respond([]);
  await remote.repository.getById(WORKOUT_ID);
  remote.signInAs(null);
  await assert.rejects(remote.repository.getById(WORKOUT_ID), AuthSessionMissingError);
  await assert.rejects(remote.repository.upsert({ id: WORKOUT_ID, name: 'A' }), AuthSessionMissingError);
  await assert.rejects(remote.repository.markDeleted(WORKOUT_ID), AuthSessionMissingError);
  assert.equal(remote.requests.length, 1);
  remote.signInAs(USER_B);
  await remote.repository.getById(WORKOUT_ID);
  assert.equal(remote.requests[1]?.url.searchParams.get('user_id'), `eq.${USER_B}`);
  remote.signInAs(USER_A);
  await remote.repository.getById(WORKOUT_ID);
  assert.equal(remote.requests[2]?.url.searchParams.get('user_id'), `eq.${USER_A}`);
});

test('remote deletion marks a tombstone and propagates database/RLS failures', async () => {
  const remote = harness();
  remote.respond([{ id: WORKOUT_ID, user_id: USER_A, deleted_at: '2026-11-10T10:00:00Z' }]);
  assert.equal((await remote.repository.markDeleted(WORKOUT_ID))?.id, WORKOUT_ID);
  const request = remote.requests[0];
  assert(request);
  assert.equal(request.method, 'PATCH');
  assert.equal(request.url.searchParams.get('user_id'), `eq.${USER_A}`);
  assert.equal(request.url.searchParams.get('id'), `eq.${WORKOUT_ID}`);
  assert.deepEqual(Object.keys(request.body ?? {}), ['deleted_at']);
  remote.respond({ code: '42501', message: 'RLS rejected', details: null, hint: null }, 403);
  await assert.rejects(remote.repository.upsert({ id: WORKOUT_ID, name: 'A' }), { code: '42501' });
  await assert.rejects(remote.repository.getById(WORKOUT_ID), { code: '42501' });
  await assert.rejects(remote.repository.markDeleted(WORKOUT_ID), { code: '42501' });
});
