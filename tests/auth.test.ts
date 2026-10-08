import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { deriveTechnicalPassword, normalizePhone, validatePin } from '../src/features/auth/credentials.ts';
import { SupabaseAuthService } from '../src/features/auth/supabaseAuthService.ts';

import type { PhonePinCredentials } from '../src/features/auth/contracts.ts';

const digest = async (value: string) => createHash('sha256').update(value).digest('hex');

test('normalizes Brazilian and international phones to E.164', () => {
  assert.equal(normalizePhone('(11) 99999-0042'), '+5511999990042');
  assert.equal(normalizePhone('55 11 99999-0042'), '+5511999990042');
  assert.equal(normalizePhone('0055 11 99999-0042'), '+5511999990042');
  assert.equal(normalizePhone('+1 (415) 555-2671'), '+14155552671');
  assert.throws(() => normalizePhone('12345'), /telefone/);
});

test('keeps PIN 0042 as a four-character string and derives a deterministic versioned credential', async () => {
  assert.equal(validatePin('0042'), '0042');
  assert.throws(() => validatePin('42'), /4 dígitos/);
  assert.throws(() => validatePin('00a2'), /4 dígitos/);

  const credentials: PhonePinCredentials = { phone: '(11) 99999-0042', pin: '0042' };
  const first = await deriveTechnicalPassword(credentials, digest);
  const second = await deriveTechnicalPassword(credentials, digest);
  const otherPin = await deriveTechnicalPassword({ ...credentials, pin: '1042' }, digest);

  assert.deepEqual(first, second);
  assert.equal(first.phone, '+5511999990042');
  assert.match(first.password, /^acad-v1-[0-9a-f]{64}$/);
  assert.notEqual(first.password, otherPin.password);
  assert(!first.password.includes('0042'));
});

test('restores an existing Supabase session and performs a local logout', async () => {
  const session = {
    expires_at: 1_900_000_000,
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      phone: '+5511999990042',
      user_metadata: {},
    },
  };
  let logoutScope: string | undefined;
  let signedInPassword = '';
  const auth = {
    async getSession() { return { data: { session }, error: null }; },
    async signInWithPassword(input: { phone: string; password: string }) {
      signedInPassword = input.password;
      return { data: { session }, error: null };
    },
    async signUp() { return { data: { session }, error: null }; },
    async signOut(input: { scope: string }) {
      logoutScope = input.scope;
      return { error: null };
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } };
    },
  };
  const service = new SupabaseAuthService({ auth } as never, digest);

  const restored = await service.restoreSession();
  assert.equal(restored?.user.id, session.user.id);
  assert.equal(restored?.user.phone, session.user.phone);
  await service.signIn({ phone: session.user.phone, pin: '0042' });
  assert.match(signedInPassword, /^acad-v1-[0-9a-f]{64}$/);
  assert(!signedInPassword.includes('0042'));
  await service.signOut();
  assert.equal(logoutScope, 'local');
});
