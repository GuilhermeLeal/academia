import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

import sharp from 'sharp';

import { exerciseCatalog, REPDB_ASSET_VERSION, REPDB_REVISION } from '../src/features/exercises/catalog.ts';
import { exercisePoses } from '../src/features/exercises/media.ts';

type SourceExercise = { id: string; images: { flat: { start?: string; peak?: string; main?: string } } };
const base = `https://raw.githubusercontent.com/RepDB/exercise-dataset/${REPDB_REVISION}/`;
const output = resolve('.repdb-assets');
const digest = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');

async function download(path: string): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetch(`${base}${path}`, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`RepDB ${response.status}: ${path}`);
      return Buffer.from(await response.arrayBuffer());
    } catch (error) { if (attempt >= 2) throw error; }
  }
}

// Only the free official JSON is read in memory. Never clone/unzip the dataset.
const license = (await download('LICENSE-DATA.md')).toString('utf8');
if (!license.includes('Free Tier License (v1.0)') || !license.includes('No redistribution as a dataset')) {
  throw new Error('RepDB license changed; review the official license before preparing assets.');
}
const dataset = JSON.parse((await download('exercises.json')).toString('utf8')) as { exercises: SourceExercise[] };
const sources = [...new Set(exerciseCatalog.map((exercise) => exercise.source))];
const files: { path: string; bytes: number; sha256: string }[] = [];
await mkdir(output, { recursive: true });
await writeFile(join(output, 'LICENSE-DATA.md'), license);

async function save(path: string, bytes: Buffer) {
  await mkdir(join(output, REPDB_ASSET_VERSION, path.split('/')[0]!), { recursive: true });
  const fullPath = `${REPDB_ASSET_VERSION}/${path}`;
  await writeFile(join(output, fullPath), bytes);
  files.push({ path: fullPath, bytes: bytes.length, sha256: digest(bytes) });
}

let next = 0;
await Promise.all(Array.from({ length: 4 }, async () => {
  while (next < sources.length) {
    const source = sources[next++]!;
    const exercise = dataset.exercises.find((exercise) => exercise.id === source);
    if (!exercise) throw new Error(`Unknown RepDB source: ${source}`);
    const poses = exercise.images.flat;
    const actual = Object.keys(poses).sort();
    const expected = exercisePoses(`repdb://${source}/thumb.webp`).map((pose) => pose.uri.split('/').at(-1)!.replace('.webp', '')).sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`Pose mismatch: ${source}`);
    const images = new Map<string, Buffer>();
    for (const [pose, path] of Object.entries(poses)) {
      // Strict free-tier allowlist. premium-samples and all other paths are rejected.
      if (path !== `images/flat/${source}-${pose}.webp`) throw new Error(`Non-free path rejected: ${path}`);
      const bytes = await download(path);
      const metadata = await sharp(bytes).metadata();
      if (metadata.format !== 'webp' || metadata.width !== 512 || metadata.height !== 512 || (metadata.pages ?? 1) > 1) {
        throw new Error(`Expected a free 512px still: ${path}`);
      }
      images.set(pose, bytes);
      await save(`${source}/${pose}.webp`, bytes);
    }
    const thumbnail = await sharp(images.get('peak') ?? images.get('main')!).resize(128, 128).webp({ quality: 72 }).toBuffer();
    await save(`${source}/thumb.webp`, thumbnail);
  }
}));
files.sort((a, b) => a.path.localeCompare(b.path));
const manifest = {
  revision: REPDB_REVISION, licenseSha256: digest(license), sources: sources.length,
  exercises: exerciseCatalog.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), files,
};
await writeFile(join(output, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
// Verify persisted bytes before reporting readiness for a separate upload step.
for (const file of files) {
  if (digest(await readFile(join(output, file.path))) !== file.sha256) throw new Error(`Integrity failure: ${file.path}`);
}
process.stdout.write(`Prepared ${manifest.exercises} exercises / ${manifest.sources} sources / ${files.length} WebP files / ${(manifest.bytes / 1024 / 1024).toFixed(2)} MiB in .repdb-assets (gitignored).\n`);
