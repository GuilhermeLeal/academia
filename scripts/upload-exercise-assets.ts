import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import { createClient } from '@supabase/supabase-js';

import { exerciseCatalog, REPDB_ASSET_VERSION, REPDB_BUCKET, REPDB_REVISION } from '../src/features/exercises/catalog.ts';
import { exercisePoses } from '../src/features/exercises/media.ts';

// Admin-only utility. Never import into the application bundle or use EXPO_PUBLIC_* secrets.
const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !secret) throw new Error('Set SUPABASE_URL and SUPABASE_SECRET_KEY in the operator environment. Never put the secret in an EXPO_PUBLIC variable.');
const parsed = new URL(url);
if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Invalid Supabase origin.');
const directory = resolve('.repdb-assets');
const manifest = JSON.parse(await readFile(join(directory, 'manifest.json'), 'utf8')) as {
  revision: string; exercises: number; files: { path: string; sha256: string }[];
};
const expected = [...new Set(exerciseCatalog.flatMap((exercise) => [
  `${REPDB_ASSET_VERSION}/${exercise.source}/thumb.webp`,
  ...exercisePoses(`repdb://${exercise.source}/thumb.webp`).map((pose) => `${REPDB_ASSET_VERSION}/${pose.uri.slice('repdb://'.length)}`),
]))].sort();
if (manifest.revision !== REPDB_REVISION || manifest.exercises !== 150 || JSON.stringify(expected) !== JSON.stringify(manifest.files.map((file) => file.path).sort())) {
  throw new Error('Manifest differs from the selected free-tier assets. Run catalog:assets.');
}
// Validate every file before the first remote write.
for (const file of manifest.files) {
  const data = await readFile(join(directory, file.path));
  if (createHash('sha256').update(data).digest('hex') !== file.sha256) throw new Error(`Integrity failure: ${file.path}`);
}
const client = createClient(parsed.origin, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: bucket, error: bucketError } = await client.storage.getBucket(REPDB_BUCKET);
if (bucketError) throw bucketError;
if (!bucket.public || bucket.file_size_limit !== 262144 || !bucket.allowed_mime_types?.includes('image/webp')) {
  throw new Error('Apply the exercise-images Storage migration first.');
}
let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < manifest.files.length) {
    const file = manifest.files[next++]!;
    const { error } = await client.storage.from(REPDB_BUCKET).upload(file.path, await readFile(join(directory, file.path)), {
      contentType: 'image/webp', cacheControl: '31536000', upsert: true,
    });
    if (error) throw error;
  }
}));
process.stdout.write(`Uploaded ${manifest.files.length} in-app assets to ${REPDB_BUCKET}. No dataset/manifest uploaded.\n`);
