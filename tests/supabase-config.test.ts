import assert from 'node:assert/strict';
import { test } from 'node:test';

import { parseSupabaseConfiguration } from '../src/services/supabase/config.ts';

test('allows the application to run without cloud configuration', () => {
  assert.deepEqual(parseSupabaseConfiguration(), { status: 'unconfigured' });
  assert.deepEqual(parseSupabaseConfiguration(' ', ''), { status: 'unconfigured' });
});

test('accepts the public key and normalizes the HTTPS project URL', () => {
  assert.deepEqual(parseSupabaseConfiguration(' https://example.supabase.co/ ', ' sb_publishable_example '), {
    status: 'configured', url: 'https://example.supabase.co', publishableKey: 'sb_publishable_example',
  });
});

test('rejects incomplete configuration, secret keys and malformed project URLs', () => {
  for (const [url, key] of [
    ['https://example.supabase.co', ''],
    ['', 'sb_publishable_example'],
    ['https://example.supabase.co', 'sb_secret_example'],
    ['not-a-url', 'sb_publishable_example'],
    ['http://example.supabase.co', 'sb_publishable_example'],
    ['https://user:password@example.supabase.co', 'sb_publishable_example'],
    ['https://example.supabase.co/rest/v1', 'sb_publishable_example'],
  ]) {
    assert.deepEqual(parseSupabaseConfiguration(url, key), { status: 'invalid' });
  }
});
