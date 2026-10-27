import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import {
  deriveTechnicalPassword, normalizePhone, phoneFromTechnicalEmail, technicalEmailFromPhone, validatePin,
} from '../src/features/auth/credentials.ts';
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
  assert.equal(first.email, 'phone.5511999990042@auth.academia.invalid');
  assert.match(first.password, /^acad-v1-[0-9a-f]{64}$/);
  assert.notEqual(first.password, otherPin.password);
  assert(!first.password.includes('0042'));
});

test('maps each normalized phone to one deterministic internal email without losing digits', () => {
  const first = technicalEmailFromPhone('(11) 99999-0042');
  const same = technicalEmailFromPhone('+55 11 99999-0042');
  const different = technicalEmailFromPhone('+55 11 99999-0043');

  assert.equal(first, same);
  assert.notEqual(first, different);
  assert.equal(phoneFromTechnicalEmail(first), '+5511999990042');
  assert.equal(phoneFromTechnicalEmail(different), '+5511999990043');
  assert.equal(phoneFromTechnicalEmail('person@example.com'), null);
});

test('uses the internal email for sign up and login while restoring the phone-only app identity', async () => {
  const session = {
    expires_at: 1_900_000_000,
    user: {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'phone.5511999990042@auth.academia.invalid',
      user_metadata: {},
    },
  };
  let logoutScope: string | undefined;
  let signInInput: { email: string; password: string } | undefined;
  let signUpInput: { email: string; password: string } | undefined;
  const auth = {
    async getSession() { return { data: { session }, error: null }; },
    async signInWithPassword(input: { email: string; password: string }) {
      signInInput = input;
      return { data: { session }, error: null };
    },
    async signUp(input: { email: string; password: string }) {
      signUpInput = input;
      return { data: { session }, error: null };
    },
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
  assert.equal(restored?.user.phone, '+5511999990042');
  assert.equal('email' in (restored?.user ?? {}), false);
  await service.signIn({ phone: '+5511999990042', pin: '0042' });
  await service.signUp({ phone: '(11) 99999-0042', pin: '0042' });
  assert.deepEqual(signInInput, signUpInput);
  assert.equal(signInInput?.email, 'phone.5511999990042@auth.academia.invalid');
  assert.equal('phone' in (signInInput ?? {}), false);
  assert.match(signInInput?.password ?? '', /^acad-v1-[0-9a-f]{64}$/);
  assert(!(signInInput?.password ?? '').includes('0042'));
  await service.signOut();
  assert.equal(logoutScope, 'local');
});
