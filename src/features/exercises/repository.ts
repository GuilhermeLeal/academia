import { normalizeExerciseText } from './normalize.ts';
import { exerciseLimits } from './types.ts';

import type { Exercise, ExerciseInput } from './types.ts';
import type { SQLiteDatabase } from 'expo-sqlite';

type ExerciseDatabase = Pick<SQLiteDatabase, 'getFirstAsync' | 'getAllAsync'>;
type ExerciseRow = Omit<Exercise, 'isCustom'> & { isCustom: number };

const columns = `id, name, normalized_name AS normalizedName, muscle_group AS muscleGroup,
  equipment, image_uri AS imageUri, is_custom AS isCustom,
  created_at AS createdAt, updated_at AS updatedAt`;

function toExercise(row: ExerciseRow): Exercise {
  return { ...row, isCustom: row.isCustom === 1 };
}

export class ExerciseValidationError extends Error {}

export function validateExerciseInput(input: ExerciseInput): ExerciseInput {
  const result = {
    name: input.name.trim().replace(/\s+/g, ' '),
    muscleGroup: input.muscleGroup.trim().replace(/\s+/g, ' '),
    equipment: input.equipment.trim().replace(/\s+/g, ' '),
  };
  for (const [field, label] of [['name', 'nome'], ['muscleGroup', 'grupo muscular']] as const) {
    if (result[field].length < 2 || result[field].length > exerciseLimits[field] || !/[\p{L}\p{N}]/u.test(result[field])) {
      throw new ExerciseValidationError(`Preencha o ${label} com 2 a ${exerciseLimits[field]} caracteres.`);
    }
  }
  if (result.equipment.length > exerciseLimits.equipment) {
    throw new ExerciseValidationError(`Use até ${exerciseLimits.equipment} caracteres no equipamento.`);
  }
  return result;
}

export async function searchExercises(db: ExerciseDatabase, query: string): Promise<Exercise[]> {
  const normalized = normalizeExerciseText(query.slice(0, exerciseLimits.search));
  const terms = normalized ? normalized.split(' ') : [];
  // instr treats %, _ and quotes literally. Only fixed SQL is interpolated, never user text.
  const conditions = terms.map(() => `(instr(e.normalized_name, ?) > 0 OR EXISTS (
    SELECT 1 FROM exercise_aliases a WHERE a.exercise_id = e.id AND instr(a.normalized_alias, ?) > 0
  ))`);
  const rows = await db.getAllAsync<ExerciseRow>(
    `SELECT ${columns} FROM exercises e
     ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
     ORDER BY CASE WHEN e.normalized_name = ? THEN 0
       WHEN instr(e.normalized_name, ?) = 1 THEN 1 ELSE 2 END, e.normalized_name, e.id`,
    [...terms.flatMap((term) => [term, term]), normalized, normalized],
  );
  return rows.map(toExercise);
}

export async function getExercise(db: ExerciseDatabase, id: string): Promise<Exercise | null> {
  const row = await db.getFirstAsync<ExerciseRow>(`SELECT ${columns} FROM exercises WHERE id = ?`, id);
  return row ? toExercise(row) : null;
}

export async function createCustomExercise(db: ExerciseDatabase, input: ExerciseInput): Promise<Exercise> {
  const value = validateExerciseInput(input);
  const now = new Date().toISOString();
  // SQLite generates an internal UUID; one atomic write, with no extra native dependency.
  const row = await db.getFirstAsync<ExerciseRow>(
    `INSERT INTO exercises (name, normalized_name, muscle_group, equipment, is_custom, created_at, updated_at)
     VALUES (?, ?, ?, ?, 1, ?, ?) RETURNING ${columns}`,
    value.name, normalizeExerciseText(value.name), value.muscleGroup, value.equipment || null, now, now,
  );
  if (!row) throw new Error('Não foi possível salvar o exercício.');
  return toExercise(row);
}

export async function updateCustomExercise(db: ExerciseDatabase, id: string, input: ExerciseInput): Promise<Exercise> {
  const value = validateExerciseInput(input);
  // The restriction belongs in the write itself, not just in the screen's disabled state.
  const row = await db.getFirstAsync<ExerciseRow>(
    `UPDATE exercises SET name = ?, normalized_name = ?, muscle_group = ?, equipment = ?, updated_at = ?
     WHERE id = ? AND is_custom = 1 RETURNING ${columns}`,
    value.name, normalizeExerciseText(value.name), value.muscleGroup, value.equipment || null,
    new Date().toISOString(), id,
  );
  if (!row) throw new ExerciseValidationError('Este exercício não existe ou pertence ao catálogo padrão e não pode ser editado.');
  return toExercise(row);
}
