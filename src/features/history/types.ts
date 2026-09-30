export interface HistorySessionListItem {
  id: string;
  workoutName: string;
  startedAt: string;
  finishedAt: string;
  exerciseCount: number;
  completedSetCount: number;
}

export interface HistorySetResult {
  id: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
}

export interface HistoryExerciseResult {
  id: string;
  exerciseName: string;
  position: number;
  sets: HistorySetResult[];
}

export interface HistorySessionDetail extends HistorySessionListItem {
  exercises: HistoryExerciseResult[];
}
