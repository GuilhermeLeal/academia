import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const chunkSize = 1800;

type Metadata = { generation: string; count: number };

function storageKey(key: string): string {
  return `academia.${key.replace(/[^A-Za-z0-9._-]/g, '_')}`;
}

function parseMetadata(value: string | null): Metadata | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<Metadata>;
    return typeof parsed.generation === 'string' && Number.isInteger(parsed.count) && (parsed.count ?? 0) > 0
      ? { generation: parsed.generation, count: parsed.count as number }
      : null;
  } catch { return null; }
}

async function removeGeneration(base: string, metadata: Metadata | null): Promise<void> {
  if (!metadata) return;
  await Promise.all(Array.from({ length: metadata.count }, (_, index) => (
    SecureStore.deleteItemAsync(`${base}.${metadata.generation}.${index}`)
  )));
}

export const secureSessionStorage = {
  async getItem(key: string): Promise<string | null> {
    const base = storageKey(key);
    const metadata = parseMetadata(await SecureStore.getItemAsync(`${base}.meta`));
    if (!metadata) return null;
    const chunks = await Promise.all(Array.from({ length: metadata.count }, (_, index) => (
      SecureStore.getItemAsync(`${base}.${metadata.generation}.${index}`)
    )));
    return chunks.every((chunk): chunk is string => chunk !== null) ? chunks.join('') : null;
  },

  async setItem(key: string, value: string): Promise<void> {
    const base = storageKey(key);
    const oldMetadata = parseMetadata(await SecureStore.getItemAsync(`${base}.meta`));
    const metadata = {
      generation: Crypto.randomUUID(),
      count: Math.max(1, Math.ceil(value.length / chunkSize)),
    };
    await Promise.all(Array.from({ length: metadata.count }, (_, index) => (
      SecureStore.setItemAsync(
        `${base}.${metadata.generation}.${index}`,
        value.slice(index * chunkSize, (index + 1) * chunkSize),
      )
    )));
    await SecureStore.setItemAsync(`${base}.meta`, JSON.stringify(metadata));
    await removeGeneration(base, oldMetadata);
  },

  async removeItem(key: string): Promise<void> {
    const base = storageKey(key);
    const metadata = parseMetadata(await SecureStore.getItemAsync(`${base}.meta`));
    await SecureStore.deleteItemAsync(`${base}.meta`);
    await removeGeneration(base, metadata);
  },
};
