import type {
  HistoryExerciseResult, HistorySessionDetail, HistorySessionListItem, HistorySetResult,
} from './types.ts';
import type { UserScoped } from '@/db/userScopedDatabase';
import type { SQLiteDatabase } from 'expo-sqlite';

export type HistoryDatabase = UserScoped<Pick<SQLiteDatabase, 'getFirstAsync' | 'getAllAsync'>>;

const historySummarySelect = `
  SELECT ws.id, ws.workout_name AS workoutName, ws.started_at AS startedAt,
    ws.finished_at AS finishedAt,
    COUNT(DISTINCT CASE WHEN ss.completed = 1 THEN se.id END) AS exerciseCount,
    COALESCE(SUM(CASE WHEN ss.completed = 1 THEN 1 ELSE 0 END), 0) AS completedSetCount
  FROM workout_sessions ws
  LEFT JOIN session_exercises se ON se.session_id = ws.id AND se.user_id = ws.user_id
  LEFT JOIN session_sets ss ON ss.session_exercise_id = se.id AND ss.user_id = ws.user_id
`;

export async function listCompletedSessions(db: HistoryDatabase): Promise<HistorySessionListItem[]> {
  return db.getAllAsync<HistorySessionListItem>(
    `${historySummarySelect}
     WHERE ws.user_id = ? AND ws.status = 'completed' AND ws.finished_at IS NOT NULL
     GROUP BY ws.id
     ORDER BY ws.finished_at DESC, ws.started_at DESC, ws.id DESC`,
    db.userId,
  );
}

export async function getHistorySession(db: HistoryDatabase, id: string): Promise<HistorySessionDetail | null> {
  const session = await db.getFirstAsync<HistorySessionListItem>(
    `${historySummarySelect}
     WHERE ws.id = ? AND ws.user_id = ? AND ws.status = 'completed' AND ws.finished_at IS NOT NULL
     GROUP BY ws.id`,
    id,
    db.userId,
  );
  if (!session) return null;

  const exercises = await db.getAllAsync<Omit<HistoryExerciseResult, 'sets'>>(
    `SELECT se.id, se.exercise_name AS exerciseName, se.position
     FROM session_exercises se
     WHERE se.session_id = ? AND se.user_id = ? AND EXISTS (
       SELECT 1 FROM session_sets ss
       WHERE ss.session_exercise_id = se.id AND ss.user_id = ? AND ss.completed = 1
     )
     ORDER BY se.position, se.id`,
    id,
    db.userId,
    db.userId,
  );
  const sets = await db.getAllAsync<HistorySetResult & { sessionExerciseId: string }>(
    `SELECT ss.id, ss.session_exercise_id AS sessionExerciseId, ss.set_number AS setNumber,
       ss.weight, ss.reps
     FROM session_sets ss
     JOIN session_exercises se ON se.id = ss.session_exercise_id
     WHERE se.session_id = ? AND se.user_id = ? AND ss.user_id = ? AND ss.completed = 1
     ORDER BY se.position, ss.set_number, ss.id`,
    id,
    db.userId,
    db.userId,
  );
  const setsByExercise = new Map<string, HistorySetResult[]>();
  for (const { sessionExerciseId, ...set } of sets) {
    const values = setsByExercise.get(sessionExerciseId) ?? [];
    values.push(set);
    setsByExercise.set(sessionExerciseId, values);
  }
  return {
    ...session,
    exercises: exercises.map((exercise) => ({
      ...exercise,
      sets: setsByExercise.get(exercise.id) ?? [],
    })),
  };
}
