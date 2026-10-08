import {
  ActiveSessionError, EmptySessionError, PersonalizedResultsError,
  SessionValidationError, validateSetValue,
} from './model.ts';

import type {
  ActiveSessionSummary, CompletedSessionSummary, SessionExercise, SessionSet,
  SessionSetValue, WorkoutSession,
} from './types.ts';
import type { UserScoped } from '@/db/userScopedDatabase';
import type { SQLiteDatabase } from 'expo-sqlite';

export type SessionTransaction = UserScoped<Pick<SQLiteDatabase, 'runAsync' | 'getFirstAsync' | 'getAllAsync'>>;
export type SessionDatabase = SessionTransaction & {
  transaction: (task: (tx: SessionTransaction) => Promise<void>) => Promise<void>;
};

type SessionRow = Omit<WorkoutSession, 'exercises'>;
type SetRow = Omit<SessionSet, 'completed'> & { completed: number };
export type PreviousSetValue = Pick<SessionSet, 'setNumber' | 'weight' | 'reps'>;

export async function getLastCompletedExerciseSets(
  db: SessionTransaction,
  exerciseId: string,
): Promise<PreviousSetValue[]> {
  return db.getAllAsync<PreviousSetValue>(
    `WITH latest_exercise AS (
       SELECT se.id
       FROM session_exercises se
       JOIN workout_sessions ws ON ws.id = se.session_id
       WHERE se.exercise_id = ? AND se.user_id = ?
         AND ws.user_id = ? AND ws.status = 'completed'
         AND EXISTS (
           SELECT 1 FROM session_sets completed_set
           WHERE completed_set.session_exercise_id = se.id
             AND completed_set.user_id = ?
             AND completed_set.completed = 1 AND completed_set.reps > 0
         )
       ORDER BY ws.finished_at DESC, ws.started_at DESC, ws.id DESC, se.id DESC
       LIMIT 1
     )
     SELECT ss.set_number AS setNumber, ss.weight, ss.reps
     FROM session_sets ss
     WHERE ss.session_exercise_id = (SELECT id FROM latest_exercise)
       AND ss.user_id = ?
       AND ss.completed = 1 AND ss.reps > 0
     ORDER BY ss.set_number`,
    exerciseId, db.userId, db.userId, db.userId, db.userId,
  );
}

export async function getActiveSession(db: SessionTransaction): Promise<ActiveSessionSummary | null> {
  return db.getFirstAsync<ActiveSessionSummary>(
    `SELECT id, workout_id AS workoutId, workout_name AS workoutName, started_at AS startedAt
     FROM workout_sessions WHERE status = 'active' AND user_id = ? LIMIT 1`,
    db.userId,
  );
}

export async function getSession(db: SessionTransaction, id: string): Promise<WorkoutSession | null> {
  const session = await db.getFirstAsync<SessionRow>(
    `SELECT id, workout_id AS workoutId, workout_name AS workoutName, started_at AS startedAt,
     finished_at AS finishedAt, status FROM workout_sessions WHERE id = ? AND user_id = ?`,
    id,
    db.userId,
  );
  if (!session) return null;
  const exercises = await db.getAllAsync<Omit<SessionExercise, 'sets'>>(
    `SELECT id, session_id AS sessionId, exercise_id AS exerciseId, exercise_name AS exerciseName,
     position, planned_sets AS plannedSets, planned_reps_min AS plannedRepsMin,
     planned_reps_max AS plannedRepsMax, planned_rest_seconds AS plannedRestSeconds
     FROM session_exercises WHERE session_id = ? AND user_id = ? ORDER BY position`, id, db.userId,
  );
  const sets = await db.getAllAsync<SetRow>(
    `SELECT ss.id, ss.session_exercise_id AS sessionExerciseId, ss.set_number AS setNumber,
     ss.weight, ss.reps, ss.completed FROM session_sets ss
     JOIN session_exercises se ON se.id = ss.session_exercise_id
     WHERE se.session_id = ? AND se.user_id = ? AND ss.user_id = ?
     ORDER BY se.position, ss.set_number`, id, db.userId, db.userId,
  );
  const byExercise = new Map<string, SessionSet[]>();
  for (const set of sets) {
    const values = byExercise.get(set.sessionExerciseId) ?? [];
    values.push({ ...set, completed: set.completed === 1 });
    byExercise.set(set.sessionExerciseId, values);
  }
  return { ...session, exercises: exercises.map((exercise) => ({ ...exercise, sets: byExercise.get(exercise.id) ?? [] })) };
}

export async function startWorkoutSession(db: SessionDatabase, workoutId: string): Promise<string> {
  let sessionId = '';
  try {
    await db.transaction(async (tx) => {
      const active = await getActiveSession(tx);
      if (active) throw new ActiveSessionError(active.id);
      const workout = await tx.getFirstAsync<{ id: string; name: string }>(
        'SELECT id, name FROM workouts WHERE id = ? AND user_id = ?',
        workoutId,
        tx.userId,
      );
      if (!workout) throw new SessionValidationError('Este treino não existe mais.');
      const exercises = await tx.getAllAsync<{
        exerciseId: string; exerciseName: string; position: number; sets: number;
        repsMin: number; repsMax: number; restSeconds: number;
      }>(
        `SELECT we.exercise_id AS exerciseId, e.name AS exerciseName, we.position, we.sets,
         we.reps_min AS repsMin, we.reps_max AS repsMax, we.rest_seconds AS restSeconds
         FROM workout_exercises we JOIN exercises e ON e.id = we.exercise_id
         WHERE we.workout_id = ? AND we.user_id = ? ORDER BY we.position`, workoutId, tx.userId,
      );
      if (exercises.length === 0) throw new SessionValidationError('Adicione pelo menos um exercício antes de iniciar este treino.');
      const startedAt = new Date().toISOString();
      const session = await tx.getFirstAsync<{ id: string }>(
        `INSERT INTO workout_sessions (workout_id, workout_name, started_at, status, user_id)
         VALUES (?, ?, ?, 'active', ?) RETURNING id`,
        workout.id, workout.name, startedAt, tx.userId,
      );
      if (!session) throw new Error('Não foi possível iniciar o treino.');
      sessionId = session.id;
      for (const exercise of exercises) {
        const previousSets = new Map(
          (await getLastCompletedExerciseSets(tx, exercise.exerciseId)).map((set) => [set.setNumber, set]),
        );
        const snapshot = await tx.getFirstAsync<{ id: string }>(
          `INSERT INTO session_exercises
           (session_id, exercise_id, exercise_name, position, planned_sets, planned_reps_min,
            planned_reps_max, planned_rest_seconds, user_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
          session.id, exercise.exerciseId, exercise.exerciseName, exercise.position, exercise.sets,
          exercise.repsMin, exercise.repsMax, exercise.restSeconds, tx.userId,
        );
        if (!snapshot) throw new Error('Não foi possível preparar os exercícios da sessão.');
        for (let setNumber = 1; setNumber <= exercise.sets; setNumber += 1) {
          const previous = previousSets.get(setNumber);
          await tx.runAsync(
            `INSERT INTO session_sets (session_exercise_id, set_number, weight, reps, completed, user_id)
             VALUES (?, ?, ?, ?, 0, ?)`,
            snapshot.id, setNumber, previous?.weight ?? null, previous?.reps ?? null, tx.userId,
          );
        }
      }
    });
  } catch (cause) {
    if (cause instanceof ActiveSessionError) throw cause;
    const active = await getActiveSession(db);
    if (active) throw new ActiveSessionError(active.id);
    throw cause;
  }
  return sessionId;
}

export async function updateSessionSet(db: SessionDatabase, setId: string, input: SessionSetValue): Promise<void> {
  const value = validateSetValue(input);
  await db.transaction(async (tx) => {
    const result = await tx.runAsync(
      `UPDATE session_sets SET weight = ?, reps = ?, completed = ?
       WHERE id = ? AND user_id = ? AND EXISTS (
         SELECT 1 FROM session_exercises se JOIN workout_sessions ws ON ws.id = se.session_id
         WHERE se.id = session_sets.session_exercise_id
           AND se.user_id = ? AND ws.user_id = ? AND ws.status = 'active'
       )`, value.weight, value.reps, value.completed ? 1 : 0,
      setId, tx.userId, tx.userId, tx.userId,
    );
    if (!result.changes) throw new SessionValidationError('Esta série não pertence a uma sessão em andamento.');
  });
}

export async function applyQuickExerciseResult(
  db: SessionDatabase,
  sessionExerciseId: string,
  input: Pick<SessionSetValue, 'weight' | 'reps'>,
  allowPersonalizedOverwrite = false,
): Promise<void> {
  const value = validateSetValue({ ...input, completed: true });
  await db.transaction(async (tx) => {
    const exercise = await tx.getFirstAsync<{ plannedSets: number }>(
      `SELECT se.planned_sets AS plannedSets FROM session_exercises se
       JOIN workout_sessions ws ON ws.id = se.session_id
       WHERE se.id = ? AND se.user_id = ? AND ws.user_id = ? AND ws.status = 'active'`,
      sessionExerciseId, tx.userId, tx.userId,
    );
    if (!exercise) throw new SessionValidationError('Este exercício não pertence a uma sessão em andamento.');
    const planned = await tx.getAllAsync<{ weight: number | null; reps: number | null }>(
      `SELECT weight, reps FROM session_sets
       WHERE session_exercise_id = ? AND user_id = ? AND set_number <= ? ORDER BY set_number`,
      sessionExerciseId, tx.userId, exercise.plannedSets,
    );
    if (planned.length !== exercise.plannedSets) throw new SessionValidationError('As séries planejadas desta sessão estão incompletas.');
    const signatures = new Set(planned.map((set) => `${set.weight ?? ''}|${set.reps ?? ''}`));
    if (signatures.size > 1 && !allowPersonalizedOverwrite) {
      throw new PersonalizedResultsError('Este exercício possui valores diferentes por série. Confirme para substituir somente as séries planejadas.');
    }
    await tx.runAsync(
      `UPDATE session_sets SET weight = ?, reps = ?, completed = 1
       WHERE session_exercise_id = ? AND user_id = ? AND set_number <= ?`,
      value.weight, value.reps, sessionExerciseId, tx.userId, exercise.plannedSets,
    );
  });
}

export async function uncompletePlannedExercise(db: SessionDatabase, sessionExerciseId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const result = await tx.runAsync(
      `UPDATE session_sets SET completed = 0
       WHERE session_exercise_id = ? AND user_id = ? AND set_number <= (
         SELECT se.planned_sets FROM session_exercises se
         JOIN workout_sessions ws ON ws.id = se.session_id
         WHERE se.id = ? AND se.user_id = ? AND ws.user_id = ? AND ws.status = 'active'
       )`, sessionExerciseId, tx.userId, sessionExerciseId, tx.userId, tx.userId,
    );
    if (!result.changes) throw new SessionValidationError('Este exercício não pertence a uma sessão em andamento.');
  });
}

export async function addExtraSet(db: SessionDatabase, sessionExerciseId: string): Promise<string> {
  let id = '';
  await db.transaction(async (tx) => {
    const row = await tx.getFirstAsync<{ next: number }>(
      `SELECT COALESCE(MAX(ss.set_number), 0) + 1 AS next FROM session_sets ss
       JOIN session_exercises se ON se.id = ss.session_exercise_id
       JOIN workout_sessions ws ON ws.id = se.session_id
       WHERE ss.session_exercise_id = ? AND ss.user_id = ?
         AND se.user_id = ? AND ws.user_id = ? AND ws.status = 'active'
       GROUP BY ss.session_exercise_id`, sessionExerciseId,
      tx.userId, tx.userId, tx.userId,
    );
    if (!row || row.next < 1) throw new SessionValidationError('Este exercício não pertence a uma sessão em andamento.');
    const created = await tx.getFirstAsync<{ id: string }>(
      `INSERT INTO session_sets (session_exercise_id, set_number, user_id)
       VALUES (?, ?, ?) RETURNING id`, sessionExerciseId, row.next, tx.userId,
    );
    if (!created) throw new Error('Não foi possível adicionar a série.');
    id = created.id;
  });
  return id;
}

export async function finishWorkoutSession(db: SessionDatabase, id: string, confirmEmpty = false): Promise<CompletedSessionSummary> {
  let summary: CompletedSessionSummary | null = null;
  await db.transaction(async (tx) => {
    const session = await tx.getFirstAsync<{ workoutName: string; startedAt: string }>(
      `SELECT workout_name AS workoutName, started_at AS startedAt
       FROM workout_sessions WHERE id = ? AND user_id = ? AND status = 'active'`, id, tx.userId,
    );
    if (!session) throw new SessionValidationError('Esta sessão não está mais em andamento.');
    const totals = await tx.getFirstAsync<{ exerciseCount: number; completedSetCount: number }>(
      `SELECT COUNT(DISTINCT se.id) AS exerciseCount,
       COALESCE(SUM(CASE WHEN ss.completed = 1 THEN 1 ELSE 0 END), 0) AS completedSetCount
       FROM session_exercises se LEFT JOIN session_sets ss
         ON ss.session_exercise_id = se.id AND ss.user_id = ?
       WHERE se.session_id = ? AND se.user_id = ?`, tx.userId, id, tx.userId,
    );
    if (!totals) throw new Error('Não foi possível resumir esta sessão.');
    if (totals.completedSetCount === 0 && !confirmEmpty) {
      throw new EmptySessionError('Nenhuma série foi concluída. Confirme para finalizar mesmo assim.');
    }
    const finishedAt = new Date().toISOString();
    await tx.runAsync(
      `UPDATE workout_sessions SET status = 'completed', finished_at = ?
       WHERE id = ? AND user_id = ? AND status = 'active'`, finishedAt, id, tx.userId,
    );
    summary = { id, workoutName: session.workoutName, startedAt: session.startedAt, finishedAt, ...totals };
  });
  if (!summary) throw new Error('Não foi possível finalizar o treino.');
  return summary;
}

export async function getCompletedSessionSummary(db: SessionTransaction, id: string): Promise<CompletedSessionSummary | null> {
  return db.getFirstAsync<CompletedSessionSummary>(
    `SELECT ws.id, ws.workout_name AS workoutName, ws.started_at AS startedAt, ws.finished_at AS finishedAt,
     COUNT(DISTINCT se.id) AS exerciseCount,
     COALESCE(SUM(CASE WHEN ss.completed = 1 THEN 1 ELSE 0 END), 0) AS completedSetCount
     FROM workout_sessions ws
     LEFT JOIN session_exercises se ON se.session_id = ws.id
       AND se.user_id = ws.user_id
     LEFT JOIN session_sets ss ON ss.session_exercise_id = se.id
       AND ss.user_id = ws.user_id
     WHERE ws.id = ? AND ws.user_id = ? AND ws.status = 'completed' GROUP BY ws.id`,
    id,
    db.userId,
  );
}
