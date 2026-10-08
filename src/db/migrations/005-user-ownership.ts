import type { SQLiteDatabase } from 'expo-sqlite';

type Database = Pick<SQLiteDatabase, 'execAsync'>;

export async function migrateUserOwnership(db: Database): Promise<void> {
  await db.execAsync(`
    CREATE TABLE local_users (
      id TEXT PRIMARY KEY NOT NULL,
      phone TEXT,
      authenticated_at TEXT NOT NULL
    );

    CREATE TABLE legacy_import_decisions (
      user_id TEXT PRIMARY KEY NOT NULL REFERENCES local_users(id) ON DELETE CASCADE,
      dismissed_at TEXT,
      linked_at TEXT
    );

    ALTER TABLE exercises ADD COLUMN user_id TEXT REFERENCES local_users(id) ON DELETE RESTRICT;
    ALTER TABLE workouts ADD COLUMN user_id TEXT REFERENCES local_users(id) ON DELETE RESTRICT;
    ALTER TABLE workout_exercises ADD COLUMN user_id TEXT REFERENCES local_users(id) ON DELETE RESTRICT;
    ALTER TABLE workout_sessions ADD COLUMN user_id TEXT REFERENCES local_users(id) ON DELETE RESTRICT;
    ALTER TABLE session_exercises ADD COLUMN user_id TEXT REFERENCES local_users(id) ON DELETE RESTRICT;
    ALTER TABLE session_sets ADD COLUMN user_id TEXT REFERENCES local_users(id) ON DELETE RESTRICT;

    DROP INDEX one_active_workout_session;
    CREATE UNIQUE INDEX one_active_workout_session_per_user
      ON workout_sessions(user_id)
      WHERE status = 'active' AND user_id IS NOT NULL;

    CREATE INDEX exercises_user_name ON exercises(user_id, normalized_name, id);
    CREATE INDEX workouts_user_creation_v5 ON workouts(user_id, created_at, id);
    CREATE INDEX workout_exercises_user_workout ON workout_exercises(user_id, workout_id, position);
    CREATE INDEX workout_sessions_user_status ON workout_sessions(user_id, status, finished_at);
    CREATE INDEX session_exercises_user_session_v5 ON session_exercises(user_id, session_id, position);
    CREATE INDEX session_sets_user_exercise_v5 ON session_sets(user_id, session_exercise_id, set_number);

    CREATE TRIGGER standard_exercise_owner_insert
    BEFORE INSERT ON exercises
    WHEN NEW.is_custom = 0 AND NEW.user_id IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT, 'standard exercises cannot have an owner');
    END;

    CREATE TRIGGER standard_exercise_owner_update
    BEFORE UPDATE OF user_id, is_custom ON exercises
    WHEN NEW.is_custom = 0 AND NEW.user_id IS NOT NULL
    BEGIN
      SELECT RAISE(ABORT, 'standard exercises cannot have an owner');
    END;

    CREATE TRIGGER workout_exercise_owner_insert
    BEFORE INSERT ON workout_exercises
    WHEN NOT EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = NEW.workout_id AND w.user_id IS NEW.user_id
    ) OR NOT EXISTS (
      SELECT 1 FROM exercises e
      WHERE e.id = NEW.exercise_id
        AND ((e.is_custom = 0 AND e.user_id IS NULL) OR e.user_id IS NEW.user_id)
    )
    BEGIN
      SELECT RAISE(ABORT, 'workout exercise owner mismatch');
    END;

    CREATE TRIGGER workout_exercise_owner_update
    BEFORE UPDATE OF workout_id, exercise_id, user_id ON workout_exercises
    WHEN NOT EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = NEW.workout_id AND w.user_id IS NEW.user_id
    ) OR NOT EXISTS (
      SELECT 1 FROM exercises e
      WHERE e.id = NEW.exercise_id
        AND ((e.is_custom = 0 AND e.user_id IS NULL) OR e.user_id IS NEW.user_id)
    )
    BEGIN
      SELECT RAISE(ABORT, 'workout exercise owner mismatch');
    END;

    CREATE TRIGGER workout_session_owner_insert
    BEFORE INSERT ON workout_sessions
    WHEN NEW.workout_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = NEW.workout_id AND w.user_id IS NEW.user_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'workout session owner mismatch');
    END;

    CREATE TRIGGER workout_session_owner_update
    BEFORE UPDATE OF workout_id, user_id ON workout_sessions
    WHEN NEW.workout_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM workouts w
      WHERE w.id = NEW.workout_id AND w.user_id IS NEW.user_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'workout session owner mismatch');
    END;

    CREATE TRIGGER session_exercise_owner_insert
    BEFORE INSERT ON session_exercises
    WHEN NOT EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = NEW.session_id AND ws.user_id IS NEW.user_id
    ) OR (NEW.exercise_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM exercises e
      WHERE e.id = NEW.exercise_id
        AND ((e.is_custom = 0 AND e.user_id IS NULL) OR e.user_id IS NEW.user_id)
    ))
    BEGIN
      SELECT RAISE(ABORT, 'session exercise owner mismatch');
    END;

    CREATE TRIGGER session_exercise_owner_update
    BEFORE UPDATE OF session_id, exercise_id, user_id ON session_exercises
    WHEN NOT EXISTS (
      SELECT 1 FROM workout_sessions ws
      WHERE ws.id = NEW.session_id AND ws.user_id IS NEW.user_id
    ) OR (NEW.exercise_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM exercises e
      WHERE e.id = NEW.exercise_id
        AND ((e.is_custom = 0 AND e.user_id IS NULL) OR e.user_id IS NEW.user_id)
    ))
    BEGIN
      SELECT RAISE(ABORT, 'session exercise owner mismatch');
    END;

    CREATE TRIGGER session_set_owner_insert
    BEFORE INSERT ON session_sets
    WHEN NOT EXISTS (
      SELECT 1 FROM session_exercises se
      WHERE se.id = NEW.session_exercise_id AND se.user_id IS NEW.user_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'session set owner mismatch');
    END;

    CREATE TRIGGER session_set_owner_update
    BEFORE UPDATE OF session_exercise_id, user_id ON session_sets
    WHEN NOT EXISTS (
      SELECT 1 FROM session_exercises se
      WHERE se.id = NEW.session_exercise_id AND se.user_id IS NEW.user_id
    )
    BEGIN
      SELECT RAISE(ABORT, 'session set owner mismatch');
    END;
  `);
}
