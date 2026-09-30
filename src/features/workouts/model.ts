import { workoutLimits } from './types.ts';

import type { WorkoutInput } from './types.ts';

export class WorkoutValidationError extends Error {}

export function validateWorkout(input: WorkoutInput): WorkoutInput {
  const name = input.name.trim();
  const description = input.description.trim();
  if (!name || name.length > workoutLimits.name) throw new WorkoutValidationError('Informe um nome de até 100 caracteres.');
  if (description.length > workoutLimits.description) throw new WorkoutValidationError('Use até 1.000 caracteres na descrição.');
  const ids = new Set<string>();
  for (const [index, exercise] of input.exercises.entries()) {
    if (!exercise.exerciseId || ids.has(exercise.exerciseId)) throw new WorkoutValidationError('Cada exercício só pode aparecer uma vez no treino.');
    ids.add(exercise.exerciseId);
    for (const key of ['sets', 'repsMin', 'repsMax', 'restSeconds'] as const) {
      const value = exercise[key];
      if (!Number.isSafeInteger(value) || value < (key === 'restSeconds' ? 0 : 1)) {
        throw new WorkoutValidationError(`Exercício ${index + 1}: use números inteiros; séries e reps devem ser maiores que zero e descanso não pode ser negativo.`);
      }
    }
    if (exercise.repsMin > exercise.repsMax) throw new WorkoutValidationError(`Exercício ${index + 1}: reps mínimas não podem superar as máximas.`);
  }
  return { name, description, exercises: input.exercises.map((exercise) => ({ ...exercise })) };
}

export function formatReps(min: number, max: number): string {
  return min === max ? `${min} reps` : `${min}–${max} reps`;
}

export function moveExercise<T>(items: readonly T[], index: number, direction: -1 | 1): T[] {
  const result = [...items];
  const target = index + direction;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return result;
  const [item] = result.splice(index, 1);
  if (item !== undefined) result.splice(target, 0, item);
  return result;
}
