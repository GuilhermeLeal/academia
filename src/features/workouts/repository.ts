import { validateWorkout, WorkoutValidationError } from './model.ts';
import { workoutLimits } from './types.ts';

import type { Workout, WorkoutExercise, WorkoutInput, WorkoutSummary } from './types.ts';
import type { SQLiteDatabase } from 'expo-sqlite';

export type WorkoutTransaction = Pick<SQLiteDatabase, 'runAsync' | 'getFirstAsync' | 'getAllAsync'>;
export type WorkoutDatabase = WorkoutTransaction & {
  transaction: (task: (tx: WorkoutTransaction) => Promise<void>) => Promise<void>;
};

const summarySql = `SELECT w.id, w.name, w.description, w.created_at AS createdAt,
  w.updated_at AS updatedAt, COUNT(we.id) AS exerciseCount
  FROM workouts w LEFT JOIN workout_exercises we ON we.workout_id = w.id`;

export async function listWorkouts(db: WorkoutTransaction): Promise<WorkoutSummary[]> {
  return db.getAllAsync<WorkoutSummary>(`${summarySql} GROUP BY w.id ORDER BY w.created_at, w.id`);
}

export async function getWorkout(db: WorkoutTransaction, id: string): Promise<Workout | null> {
  const workout = await db.getFirstAsync<WorkoutSummary>(`${summarySql} WHERE w.id = ? GROUP BY w.id`, id);
  if (!workout) return null;
  const exercises = await db.getAllAsync<WorkoutExercise>(
    `SELECT we.id, we.workout_id AS workoutId, we.exercise_id AS exerciseId, we.position,
     we.sets, we.reps_min AS repsMin, we.reps_max AS repsMax, we.rest_seconds AS restSeconds,
     we.created_at AS createdAt, we.updated_at AS updatedAt, e.name, e.muscle_group AS muscleGroup
     FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
     WHERE we.workout_id = ? ORDER BY we.position`, id,
  );
  return { ...workout, exerciseCount: exercises.length, exercises };
}

async function writeExercises(tx: WorkoutTransaction, workoutId: string, input: WorkoutInput, now: string) {
  const ids = input.exercises.map((exercise) => exercise.exerciseId);
  await tx.runAsync(
    `DELETE FROM workout_exercises WHERE workout_id = ?${ids.length ? ` AND exercise_id NOT IN (${ids.map(() => '?').join(',')})` : ''}`,
    [workoutId, ...ids],
  );
  // Move retained positions outside the final range before reordering, preserving IDs and creation dates.
  const max = await tx.getFirstAsync<{ position: number }>('SELECT COALESCE(MAX(position), 0) AS position FROM workout_exercises WHERE workout_id = ?', workoutId);
  await tx.runAsync('UPDATE workout_exercises SET position = position + ? WHERE workout_id = ?',
    (max?.position ?? 0) + input.exercises.length + 1, workoutId);
  for (const [position, exercise] of input.exercises.entries()) {
    await tx.runAsync(
      `INSERT INTO workout_exercises (workout_id, exercise_id, position, sets, reps_min, reps_max, rest_seconds, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(workout_id, exercise_id) DO UPDATE SET
         position = excluded.position, sets = excluded.sets, reps_min = excluded.reps_min,
         reps_max = excluded.reps_max, rest_seconds = excluded.rest_seconds, updated_at = excluded.updated_at`,
      workoutId, exercise.exerciseId, position, exercise.sets, exercise.repsMin, exercise.repsMax, exercise.restSeconds, now, now,
    );
  }
}

async function insertWorkout(tx: WorkoutTransaction, input: WorkoutInput): Promise<string> {
  const now = new Date().toISOString();
  const row = await tx.getFirstAsync<{ id: string }>(
    'INSERT INTO workouts (name, description, created_at, updated_at) VALUES (?, ?, ?, ?) RETURNING id',
    input.name, input.description || null, now, now,
  );
  if (!row) throw new Error('Não foi possível criar o treino.');
  await writeExercises(tx, row.id, input, now);
  return row.id;
}

export async function createWorkout(db: WorkoutDatabase, input: WorkoutInput): Promise<string> {
  const value = validateWorkout(input);
  let id = '';
  await db.transaction(async (tx) => { id = await insertWorkout(tx, value); });
  return id;
}

export async function updateWorkout(db: WorkoutDatabase, id: string, input: WorkoutInput): Promise<void> {
  const value = validateWorkout(input);
  await db.transaction(async (tx) => {
    const now = new Date().toISOString();
    const result = await tx.runAsync('UPDATE workouts SET name = ?, description = ?, updated_at = ? WHERE id = ?', value.name, value.description || null, now, id);
    if (!result.changes) throw new WorkoutValidationError('Este treino não existe mais. Volte à lista de treinos.');
    await writeExercises(tx, id, value, now);
  });
}

export async function deleteWorkout(db: WorkoutDatabase, id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.runAsync('DELETE FROM workouts WHERE id = ?', id);
  });
}

export async function duplicateWorkout(db: WorkoutDatabase, id: string): Promise<string> {
  let copyId = '';
  await db.transaction(async (tx) => {
    const source = await getWorkout(tx, id);
    if (!source) throw new WorkoutValidationError('Este treino não existe mais.');
    const suffix = ' - Cópia';
    const copy = validateWorkout({ name: source.name.slice(0, workoutLimits.name - suffix.length) + suffix,
      description: source.description ?? '', exercises: source.exercises });
    copyId = await insertWorkout(tx, copy);
  });
  return copyId;
}
