import assert from 'node:assert/strict';
import { test } from 'node:test';

import { getSupabaseConfiguration, parseSupabaseConfiguration } from '../src/services/supabase/config.ts';

test('allows the application to run without cloud configuration', () => {
  assert.deepEqual(parseSupabaseConfiguration(), { status: 'unconfigured' });
  assert.deepEqual(parseSupabaseConfiguration(' ', ''), { status: 'unconfigured' });
});

test('accepts the public key and normalizes the HTTPS project URL', () => {
  const publishableKey = 'sb_publishable_example_123-ABC';
  assert.deepEqual(parseSupabaseConfiguration(' https://example.supabase.co/ ', ` ${publishableKey} `), {
    status: 'configured', url: 'https://example.supabase.co', publishableKey,
  });
});

test('reads the exact Expo public environment variable names', () => {
  const previousUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const previousKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_environment_test';
  try {
    assert.deepEqual(getSupabaseConfiguration(), {
      status: 'configured',
      url: 'https://example.supabase.co',
      publishableKey: 'sb_publishable_environment_test',
    });
  } finally {
    if (previousUrl === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
    else process.env.EXPO_PUBLIC_SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    else process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY = previousKey;
  }
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
