export interface CompletedSessionTime {
  id: string;
  startedAt: string;
  finishedAt: string;
}

export interface WeeklyDayStatus {
  key: string;
  label: string;
  name: string;
  completed: boolean;
  isToday: boolean;
}

export interface StatsSummary {
  completedThisWeek: number;
  completedThisMonth: number;
  totalMonthSeconds: number;
  currentStreak: number;
  longestStreak: number;
  weekDays: WeeklyDayStatus[];
}

export interface CalendarDay {
  key: string;
  day: number;
  trained: boolean;
  isToday: boolean;
}

export interface MonthlyStats {
  year: number;
  month: number;
  workoutCount: number;
  totalSeconds: number;
  trainedDayCount: number;
  calendarDays: (CalendarDay | null)[];
}

export interface EvolutionExercise {
  exerciseId: string;
  exerciseName: string;
}

export interface ExerciseEvolutionEntry {
  setId: string;
  sessionId: string;
  exerciseName: string;
  finishedAt: string;
  setNumber: number;
  weight: number | null;
  reps: number | null;
}

export interface ExerciseEvolution {
  exerciseId: string;
  exerciseName: string;
  latestWeight: number | null;
  latestReps: number | null;
  maxWeight: number | null;
  entries: ExerciseEvolutionEntry[];
}

export interface CompletedExerciseOccurrence {
  exerciseKey: string;
  exerciseName: string;
}

export interface OverallStats {
  totalWorkouts: number;
  totalSeconds: number;
  trainedDayCount: number;
  completedSetCount: number;
  averageWorkoutsPerWeek: number;
  longestStreak: number;
  mostPerformedExercise: { name: string; count: number } | null;
  firstWorkoutAt: string | null;
  latestWorkoutAt: string | null;
}
