import { getActiveSession } from '../workout-session/repository.ts';
import { listWorkouts, type WorkoutTransaction } from '../workouts/repository.ts';

import type { ActiveSessionSummary } from '../workout-session/types.ts';
import type { WorkoutSummary } from '../workouts/types.ts';

export type HomeWorkoutSelection =
  | { kind: 'active'; session: ActiveSessionSummary }
  | { kind: 'suggested'; workout: WorkoutSummary }
  | { kind: 'empty' };

type LastCompletedWorkoutRow = {
  workoutId: string | null;
};

export async function getSuggestedWorkout(
  db: WorkoutTransaction,
): Promise<WorkoutSummary | null> {
  const workouts = await listWorkouts(db);

  if (workouts.length === 0) {
    return null;
  }

  const lastCompleted = await db.getFirstAsync<LastCompletedWorkoutRow>(
    `SELECT workout_id AS workoutId
       FROM workout_sessions
      WHERE user_id = ?
        AND status = 'completed'
      ORDER BY finished_at DESC, started_at DESC, id DESC
      LIMIT 1`,
    db.userId,
  );

  const lastCompletedIndex = lastCompleted?.workoutId
    ? workouts.findIndex((workout) => workout.id === lastCompleted.workoutId)
    : -1;

  const nextIndex =
    lastCompletedIndex >= 0 ? (lastCompletedIndex + 1) % workouts.length : 0;

  return workouts[nextIndex] ?? null;
}

export async function getHomeWorkoutSelection(
  db: WorkoutTransaction,
): Promise<HomeWorkoutSelection> {
  const activeSession = await getActiveSession(db);

  if (activeSession) {
    return { kind: 'active', session: activeSession };
  }

  const workout = await getSuggestedWorkout(db);

  return workout ? { kind: 'suggested', workout } : { kind: 'empty' };
}
