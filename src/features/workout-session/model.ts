import type { ExerciseResultState, SessionExercise, SessionSetValue } from './types.ts';

export class SessionValidationError extends Error {}

export class ActiveSessionError extends Error {
  readonly sessionId: string;

  constructor(sessionId: string) {
    super('Já existe um treino em andamento. Continue essa sessão antes de iniciar outra.');
    this.sessionId = sessionId;
  }
}

export class EmptySessionError extends Error {}
export class PersonalizedResultsError extends Error {}

export function validateSetValue(value: SessionSetValue): SessionSetValue {
  if (value.weight !== null && (!Number.isFinite(value.weight) || value.weight < 0 || value.weight > 1_000_000)) {
    throw new SessionValidationError('Informe uma carga válida, maior ou igual a zero.');
  }
  if (value.reps !== null && (!Number.isSafeInteger(value.reps) || value.reps <= 0)) {
    throw new SessionValidationError('Informe repetições inteiras, maiores que zero.');
  }
  if (value.completed && value.reps === null) {
    throw new SessionValidationError('Informe as repetições antes de concluir a série.');
  }
  return value;
}

export function summarizeExerciseResult(exercise: SessionExercise): ExerciseResultState {
  const planned = exercise.sets.filter((set) => set.setNumber <= exercise.plannedSets);
  const signatures = new Set(exercise.sets.map((set) => `${set.weight ?? ''}|${set.reps ?? ''}`));
  const first = exercise.sets[0];
  const hasResult = exercise.sets.some((set) => set.weight !== null || set.reps !== null);
  const kind = !hasResult ? 'empty' : signatures.size === 1 ? 'uniform' : 'custom';
  return {
    kind,
    weight: kind === 'uniform' ? (first?.weight ?? null) : null,
    reps: kind === 'uniform' ? (first?.reps ?? null) : null,
    allPlannedCompleted: planned.length === exercise.plannedSets && planned.every((set) => set.completed),
    completedSetCount: exercise.sets.filter((set) => set.completed).length,
    totalSetCount: exercise.sets.length,
  };
}

export function elapsedSeconds(startedAt: string, endedAt: string | number = Date.now()): number {
  const start = Date.parse(startedAt);
  const end = typeof endedAt === 'number' ? endedAt : Date.parse(endedAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return 0;
  return Math.max(0, Math.floor((end - start) / 1000));
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}
