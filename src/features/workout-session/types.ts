export type SessionStatus = 'active' | 'completed';

export interface SessionSet {
  id: string;
  sessionExerciseId: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
}

export interface SessionExercise {
  id: string;
  sessionId: string;
  exerciseId: string | null;
  exerciseName: string;
  position: number;
  plannedSets: number;
  plannedRepsMin: number;
  plannedRepsMax: number;
  plannedRestSeconds: number;
  sets: SessionSet[];
}

export interface WorkoutSession {
  id: string;
  workoutId: string | null;
  workoutName: string;
  startedAt: string;
  finishedAt: string | null;
  status: SessionStatus;
  exercises: SessionExercise[];
}

export interface ActiveSessionSummary {
  id: string;
  workoutId: string | null;
  workoutName: string;
  startedAt: string;
}

export interface CompletedSessionSummary {
  id: string;
  workoutName: string;
  startedAt: string;
  finishedAt: string;
  exerciseCount: number;
  completedSetCount: number;
}

export interface SessionSetValue {
  weight: number | null;
  reps: number | null;
  completed: boolean;
}

export interface ExerciseResultState {
  kind: 'empty' | 'uniform' | 'custom';
  weight: number | null;
  reps: number | null;
  allPlannedCompleted: boolean;
  completedSetCount: number;
  totalSetCount: number;
}
