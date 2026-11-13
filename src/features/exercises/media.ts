import { REPDB_ASSET_VERSION, REPDB_BUCKET } from './catalog.ts';

const mainSources = new Set(['wall-sit', 'plank', 'side-plank']);

export function repdbSource(imageUri: string | null): string | null {
  return imageUri?.match(/^repdb:\/\/([a-z0-9-]+)\/thumb\.webp$/)?.[1] ?? null;
}

export function exercisePoses(imageUri: string | null): { label: string; uri: string }[] {
  const source = repdbSource(imageUri);
  if (!source) return imageUri ? [{ label: 'Movimento', uri: imageUri }] : [];
  return mainSources.has(source)
    ? [{ label: 'Posição', uri: `repdb://${source}/main.webp` }]
    : [
      { label: '1 · Início', uri: `repdb://${source}/start.webp` },
      { label: '2 · Contração', uri: `repdb://${source}/peak.webp` },
    ];
}

/** App-owned storage; no runtime dependency on GitHub/RepDB hotlinks. */
export function resolveExerciseImage(imageUri: string | null, supabaseUrl?: string): string | null {
  if (!imageUri?.startsWith('repdb://')) return imageUri;
  const match = imageUri.match(/^repdb:\/\/([a-z0-9-]+)\/(thumb|start|peak|main)\.webp$/);
  if (!match || !supabaseUrl) return null;
  try {
    const url = new URL(supabaseUrl);
    if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) return null;
    return `${url.origin}/storage/v1/object/public/${REPDB_BUCKET}/${REPDB_ASSET_VERSION}/${match[1]}/${match[2]}.webp`;
  } catch { return null; }
}
