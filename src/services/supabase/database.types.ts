// Migration-aligned types for the cloud foundation. These are maintained locally
// until CLI generation can run against the linked project; see docs/cloud-foundation.md.
type Metadata = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

type Relationship<
  Name extends string,
  Columns extends string[],
  Table extends string,
  ReferencedColumns extends string[],
> = {
  foreignKeyName: Name;
  columns: Columns;
  isOneToOne: false;
  referencedRelation: Table;
  referencedColumns: ReferencedColumns;
};

type Table<
  Row,
  Required extends keyof Row,
  Relationships extends {
    foreignKeyName: string;
    columns: string[];
    isOneToOne: boolean;
    referencedRelation: string;
    referencedColumns: string[];
  }[] = [],
> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Relationships;
};

type ExerciseRow = Omit<Metadata, 'user_id'> & {
  user_id: string | null;
  name: string;
  normalized_name: string;
  muscle_group: string;
  equipment: string | null;
  image_uri: string | null;
  is_custom: boolean;
};

type WorkoutRow = Metadata & { name: string; description: string | null };

type WorkoutExerciseRow = Metadata & {
  workout_id: string;
  exercise_id: string;
  position: number;
  sets: number;
  reps_min: number;
  reps_max: number;
  rest_seconds: number;
};

type WorkoutSessionRow = Metadata & {
  workout_id: string | null;
  workout_name: string;
  started_at: string;
  finished_at: string | null;
  // PostgreSQL stores checked text, not an enum.
  status: string;
};

type SessionExerciseRow = Metadata & {
  session_id: string;
  exercise_id: string | null;
  exercise_name: string;
  position: number;
  planned_sets: number;
  planned_reps_min: number;
  planned_reps_max: number;
  planned_rest_seconds: number;
};

type SessionSetRow = Metadata & {
  session_exercise_id: string;
  set_number: number;
  weight: number | null;
  reps: number | null;
  completed: boolean;
};

export type Database = {
  public: {
    Tables: {
      exercises: Table<ExerciseRow, 'id' | 'name' | 'normalized_name' | 'muscle_group'>;
      workouts: Table<WorkoutRow, 'id' | 'user_id' | 'name'>;
      workout_exercises: Table<WorkoutExerciseRow,
        'id' | 'user_id' | 'workout_id' | 'exercise_id' | 'position' | 'sets' | 'reps_min' | 'reps_max' | 'rest_seconds',
        [
          Relationship<'workout_exercises_owner_fk', ['user_id', 'workout_id'], 'workouts', ['user_id', 'id']>,
          Relationship<'workout_exercises_exercise_id_fkey', ['exercise_id'], 'exercises', ['id']>,
        ]>;
      workout_sessions: Table<WorkoutSessionRow,
        'id' | 'user_id' | 'workout_name' | 'started_at' | 'status',
        [Relationship<'workout_sessions_owner_fk', ['user_id', 'workout_id'], 'workouts', ['user_id', 'id']>]>;
      session_exercises: Table<SessionExerciseRow,
        'id' | 'user_id' | 'session_id' | 'exercise_name' | 'position' | 'planned_sets' | 'planned_reps_min' | 'planned_reps_max' | 'planned_rest_seconds',
        [
          Relationship<'session_exercises_owner_fk', ['user_id', 'session_id'], 'workout_sessions', ['user_id', 'id']>,
          Relationship<'session_exercises_exercise_id_fkey', ['exercise_id'], 'exercises', ['id']>,
        ]>;
      session_sets: Table<SessionSetRow, 'id' | 'user_id' | 'session_exercise_id' | 'set_number',
        [Relationship<'session_sets_owner_fk', ['user_id', 'session_exercise_id'], 'session_exercises', ['user_id', 'id']>]>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
