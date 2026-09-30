import { WorkoutValidationError } from './model.ts';

import type { WorkoutExercise, WorkoutExerciseInput } from './types.ts';
import type { Exercise } from '../exercises/types.ts';

export type DraftExercise = {
  exerciseId: string; name: string; sets: string; repsMin: string; repsMax: string; restSeconds: string;
};

export function addDraftExercise(items: DraftExercise[], exercise: Pick<Exercise, 'id' | 'name'>): DraftExercise[] {
  if (items.some((item) => item.exerciseId === exercise.id)) return items;
  return [...items, { exerciseId: exercise.id, name: exercise.name, sets: '3', repsMin: '8', repsMax: '12', restSeconds: '60' }];
}

export function toDraft(exercise: WorkoutExercise): DraftExercise {
  return { exerciseId: exercise.exerciseId, name: exercise.name, sets: String(exercise.sets), repsMin: String(exercise.repsMin), repsMax: String(exercise.repsMax), restSeconds: String(exercise.restSeconds) };
}

export function parseDraft(items: DraftExercise[]): WorkoutExerciseInput[] {
  return items.map((item, index) => {
    const number = (field: 'sets' | 'repsMin' | 'repsMax' | 'restSeconds') => {
      if (!/^\d+$/.test(item[field].trim())) throw new WorkoutValidationError(`Exercício ${index + 1}: preencha todos os campos com números inteiros.`);
      return Number(item[field]);
    };
    return { exerciseId: item.exerciseId, sets: number('sets'), repsMin: number('repsMin'), repsMax: number('repsMax'), restSeconds: number('restSeconds') };
  });
}
