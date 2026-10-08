import type {
  CompletedExerciseOccurrence, CompletedSessionTime, EvolutionExercise,
  ExerciseEvolution, ExerciseEvolutionEntry,
} from './types.ts';
import type { UserScoped } from '@/db/userScopedDatabase';
import type { SQLiteDatabase } from 'expo-sqlite';

export type StatsDatabase = UserScoped<Pick<SQLiteDatabase, 'getFirstAsync' | 'getAllAsync'>>;

export async function listCompletedSessionTimes(db: StatsDatabase): Promise<CompletedSessionTime[]> {
  return db.getAllAsync<CompletedSessionTime>(
    `SELECT id, started_at AS startedAt, finished_at AS finishedAt
     FROM workout_sessions
     WHERE user_id = ? AND status = 'completed' AND finished_at IS NOT NULL
     ORDER BY finished_at`, db.userId,
  );
}

export async function listCompletedSessionTimesInRange(
  db: StatsDatabase,
  start: string,
  end: string,
): Promise<CompletedSessionTime[]> {
  return db.getAllAsync<CompletedSessionTime>(
    `SELECT id, started_at AS startedAt, finished_at AS finishedAt
     FROM workout_sessions
     WHERE user_id = ? AND status = 'completed' AND finished_at >= ? AND finished_at < ?
     ORDER BY finished_at`,
    db.userId,
    start,
    end,
  );
}

export async function countCompletedSets(db: StatsDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM session_sets ss
     JOIN session_exercises se ON se.id = ss.session_exercise_id
     JOIN workout_sessions ws ON ws.id = se.session_id
     WHERE ss.user_id = ? AND se.user_id = ? AND ws.user_id = ?
       AND ss.completed = 1 AND ws.status = 'completed'`,
    db.userId,
    db.userId,
    db.userId,
  );
  return row?.total ?? 0;
}

export async function listCompletedExerciseOccurrences(
  db: StatsDatabase,
): Promise<CompletedExerciseOccurrence[]> {
  return db.getAllAsync<CompletedExerciseOccurrence>(
    `SELECT CASE
       WHEN se.exercise_id IS NOT NULL THEN se.exercise_id
       ELSE 'snapshot:' || se.exercise_name
     END AS exerciseKey,
     se.exercise_name AS exerciseName
     FROM session_exercises se
     JOIN workout_sessions ws ON ws.id = se.session_id
     WHERE se.user_id = ? AND ws.user_id = ? AND ws.status = 'completed' AND EXISTS (
       SELECT 1 FROM session_sets ss
       WHERE ss.session_exercise_id = se.id AND ss.user_id = ? AND ss.completed = 1
     )
     ORDER BY ws.finished_at DESC, ws.started_at DESC, ws.id DESC, se.position`,
    db.userId,
    db.userId,
    db.userId,
  );
}

export async function listEvolutionExercises(db: StatsDatabase): Promise<EvolutionExercise[]> {
  const rows = await db.getAllAsync<EvolutionExercise & { finishedAt: string }>(
    `SELECT se.exercise_id AS exerciseId, se.exercise_name AS exerciseName,
       ws.finished_at AS finishedAt
     FROM session_exercises se
     JOIN workout_sessions ws ON ws.id = se.session_id
     WHERE se.user_id = ? AND ws.user_id = ?
       AND ws.status = 'completed' AND ws.finished_at IS NOT NULL
       AND se.exercise_id IS NOT NULL
       AND EXISTS (
         SELECT 1 FROM session_sets ss
         WHERE ss.session_exercise_id = se.id AND ss.user_id = ? AND ss.completed = 1
       )
     ORDER BY ws.finished_at DESC, ws.started_at DESC, ws.id DESC, se.position`,
    db.userId,
    db.userId,
    db.userId,
  );
  const exercises = new Map<string, EvolutionExercise>();
  for (const { exerciseId, exerciseName } of rows) {
    if (!exercises.has(exerciseId)) exercises.set(exerciseId, { exerciseId, exerciseName });
  }
  return [...exercises.values()].sort((a, b) => a.exerciseName.localeCompare(b.exerciseName, 'pt-BR'));
}

export async function getExerciseEvolution(
  db: StatsDatabase,
  exerciseId: string,
  recentLimit = 20,
): Promise<ExerciseEvolution | null> {
  const aggregate = await db.getFirstAsync<{ maxWeight: number | null }>(
    `SELECT MAX(ss.weight) AS maxWeight
     FROM session_sets ss
     JOIN session_exercises se ON se.id = ss.session_exercise_id
     JOIN workout_sessions ws ON ws.id = se.session_id
     WHERE se.exercise_id = ? AND ss.user_id = ? AND se.user_id = ? AND ws.user_id = ?
       AND ss.completed = 1
       AND ws.status = 'completed' AND ws.finished_at IS NOT NULL`,
    exerciseId,
    db.userId,
    db.userId,
    db.userId,
  );
  const entries = await db.getAllAsync<ExerciseEvolutionEntry>(
    `SELECT ss.id AS setId, ws.id AS sessionId, se.exercise_name AS exerciseName,
       ws.finished_at AS finishedAt, ss.set_number AS setNumber, ss.weight, ss.reps
     FROM session_sets ss
     JOIN session_exercises se ON se.id = ss.session_exercise_id
     JOIN workout_sessions ws ON ws.id = se.session_id
     WHERE se.exercise_id = ? AND ss.user_id = ? AND se.user_id = ? AND ws.user_id = ?
       AND ss.completed = 1
       AND ws.status = 'completed' AND ws.finished_at IS NOT NULL
     ORDER BY ws.finished_at DESC, ws.started_at DESC, ws.id DESC, ss.set_number DESC, ss.id DESC
     LIMIT ?`,
    exerciseId,
    db.userId,
    db.userId,
    db.userId,
    recentLimit,
  );
  const latest = entries[0];
  if (!latest) return null;
  return {
    exerciseId,
    exerciseName: latest.exerciseName,
    latestWeight: latest.weight,
    latestReps: latest.reps,
    maxWeight: aggregate?.maxWeight ?? null,
    entries,
  };
}
