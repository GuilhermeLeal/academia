export interface WorkoutExerciseInput {
  exerciseId: string;
  sets: number;
  repsMin: number;
  repsMax: number;
  restSeconds: number;
}

export interface WorkoutInput {
  name: string;
  description: string;
  exercises: WorkoutExerciseInput[];
}

export interface WorkoutSummary {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  exerciseCount: number;
}

export interface WorkoutExercise extends WorkoutExerciseInput {
  id: string;
  workoutId: string;
  position: number;
  name: string;
  muscleGroup: string;
  createdAt: string;
  updatedAt: string;
}

export interface Workout extends WorkoutSummary { exercises: WorkoutExercise[] }
export const workoutLimits = { name: 100, description: 1000 } as const;
