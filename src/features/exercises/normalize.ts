/** Same normalization on write and search; SQLite NOCASE alone is not accent-aware. */
export function normalizeExerciseText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().replace(/\s+/g, ' ');
}
