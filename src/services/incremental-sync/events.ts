const listeners = new Set<() => void>();

export function signalSyncNeeded(): void {
  for (const listener of listeners) listener();
}

export function subscribeSyncNeeded(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
