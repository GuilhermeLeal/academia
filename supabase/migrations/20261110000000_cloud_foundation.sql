-- SQLite v5 is the source of truth. IDs have no generated default: uploads
-- must supply the existing local UUID. No Auth users or local data are changed.

CREATE TABLE public.exercises (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  normalized_name text NOT NULL CHECK (char_length(normalized_name) > 0),
  muscle_group text NOT NULL CHECK (char_length(btrim(muscle_group)) BETWEEN 2 AND 60),
  equipment text CHECK (equipment IS NULL OR char_length(equipment) <= 60),
  image_uri text,
  is_custom boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  CONSTRAINT exercises_owner CHECK (
    (is_custom AND user_id IS NOT NULL) OR (NOT is_custom AND user_id IS NULL)
  ),
  CONSTRAINT standard_exercises_not_deleted CHECK (is_custom OR deleted_at IS NULL)
);

CREATE TABLE public.workouts (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 100),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  UNIQUE (user_id, id)
);

CREATE TABLE public.workout_exercises (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid NOT NULL,
  exercise_id uuid NOT NULL REFERENCES public.exercises(id),
  position integer NOT NULL CHECK (position >= 0),
  sets integer NOT NULL CHECK (sets > 0),
  reps_min integer NOT NULL CHECK (reps_min > 0),
  reps_max integer NOT NULL CHECK (reps_max >= reps_min),
  rest_seconds integer NOT NULL CHECK (rest_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  CONSTRAINT workout_exercises_owner_fk FOREIGN KEY (user_id, workout_id)
    REFERENCES public.workouts(user_id, id)
);

CREATE TABLE public.workout_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_id uuid,
  workout_name text NOT NULL CHECK (char_length(btrim(workout_name)) BETWEEN 1 AND 100),
  started_at timestamptz NOT NULL,
  finished_at timestamptz,
  status text NOT NULL CHECK (status IN ('active', 'completed')),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  UNIQUE (user_id, id),
  CONSTRAINT workout_sessions_owner_fk FOREIGN KEY (user_id, workout_id)
    REFERENCES public.workouts(user_id, id),
  CONSTRAINT workout_sessions_status CHECK (
    (status = 'active' AND finished_at IS NULL) OR
    (status = 'completed' AND finished_at IS NOT NULL)
  )
);

CREATE TABLE public.session_exercises (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL,
  exercise_id uuid REFERENCES public.exercises(id),
  exercise_name text NOT NULL CHECK (char_length(btrim(exercise_name)) > 0),
  position integer NOT NULL CHECK (position >= 0),
  planned_sets integer NOT NULL CHECK (planned_sets > 0),
  planned_reps_min integer NOT NULL CHECK (planned_reps_min > 0),
  planned_reps_max integer NOT NULL CHECK (planned_reps_max >= planned_reps_min),
  planned_rest_seconds integer NOT NULL CHECK (planned_rest_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  UNIQUE (user_id, id),
  CONSTRAINT session_exercises_owner_fk FOREIGN KEY (user_id, session_id)
    REFERENCES public.workout_sessions(user_id, id)
);

CREATE TABLE public.session_sets (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_exercise_id uuid NOT NULL,
  set_number integer NOT NULL CHECK (set_number > 0),
  weight double precision CHECK (weight IS NULL OR (weight >= 0 AND weight < 'Infinity'::double precision)),
  reps integer CHECK (reps IS NULL OR reps >= 0),
  completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  deleted_at timestamptz,
  CONSTRAINT session_sets_owner_fk FOREIGN KEY (user_id, session_exercise_id)
    REFERENCES public.session_exercises(user_id, id)
);

-- Tombstones keep IDs/FKs and remain visible to their owner. Live uniqueness
-- excludes tombstones so a removed exercise/position can be reused.
CREATE UNIQUE INDEX workout_exercises_live_exercise
  ON public.workout_exercises(workout_id, exercise_id) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX workout_exercises_live_position
  ON public.workout_exercises(workout_id, position) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX workout_sessions_one_active_per_user
  ON public.workout_sessions(user_id) WHERE status = 'active' AND deleted_at IS NULL;
CREATE UNIQUE INDEX session_exercises_live_position
  ON public.session_exercises(session_id, position) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX session_sets_live_number
  ON public.session_sets(session_exercise_id, set_number) WHERE deleted_at IS NULL;

CREATE INDEX exercises_user_name ON public.exercises(user_id, normalized_name, id);
CREATE INDEX workouts_user_creation ON public.workouts(user_id, created_at, id);
CREATE INDEX workout_exercises_parent ON public.workout_exercises(user_id, workout_id, position);
CREATE INDEX workout_exercises_exercise ON public.workout_exercises(exercise_id);
CREATE INDEX workout_sessions_parent ON public.workout_sessions(user_id, workout_id, started_at);
CREATE INDEX workout_sessions_history ON public.workout_sessions(user_id, finished_at DESC, started_at DESC, id DESC)
  WHERE status = 'completed' AND deleted_at IS NULL;
CREATE INDEX session_exercises_parent ON public.session_exercises(user_id, session_id, position);
CREATE INDEX session_exercises_exercise ON public.session_exercises(exercise_id);
CREATE INDEX session_sets_parent ON public.session_sets(user_id, session_exercise_id, set_number);

-- Server timestamps are independent of the device clock. Ownership, UUID and
-- exercise kind cannot be reassigned, even by an UPDATE/ON CONFLICT payload.
CREATE FUNCTION public.stamp_cloud_row() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.id IS DISTINCT FROM OLD.id OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      RAISE EXCEPTION 'Cloud identity and ownership are immutable' USING ERRCODE = '23514';
    END IF;
    IF TG_TABLE_NAME = 'exercises' THEN
      IF NEW.is_custom IS DISTINCT FROM OLD.is_custom THEN
        RAISE EXCEPTION 'Exercise kind is immutable' USING ERRCODE = '23514';
      END IF;
    END IF;
    NEW.created_at := OLD.created_at;
    NEW.updated_at := greatest(clock_timestamp(), OLD.updated_at + interval '1 microsecond');
    IF NEW.deleted_at IS NOT NULL THEN
      NEW.deleted_at := coalesce(OLD.deleted_at, NEW.updated_at);
    END IF;
  ELSE
    NEW.updated_at := clock_timestamp();
    IF NEW.deleted_at IS NOT NULL THEN NEW.deleted_at := NEW.updated_at; END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.stamp_cloud_row() FROM PUBLIC, anon, authenticated;

-- Deleting a template does not delete session snapshots. Deleting a session
-- tombstones its snapshots/results. No hard-delete cascade can lose tombstones.
CREATE FUNCTION public.tombstone_cloud_children() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  IF TG_TABLE_NAME = 'workouts' THEN
    UPDATE public.workout_exercises SET deleted_at = NEW.deleted_at
      WHERE user_id = NEW.user_id AND workout_id = NEW.id AND deleted_at IS NULL;
  ELSIF TG_TABLE_NAME = 'workout_sessions' THEN
    UPDATE public.session_exercises SET deleted_at = NEW.deleted_at
      WHERE user_id = NEW.user_id AND session_id = NEW.id AND deleted_at IS NULL;
  ELSIF TG_TABLE_NAME = 'session_exercises' THEN
    UPDATE public.session_sets SET deleted_at = NEW.deleted_at
      WHERE user_id = NEW.user_id AND session_exercise_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.tombstone_cloud_children() FROM PUBLIC, anon, authenticated;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'exercises', 'workouts', 'workout_exercises', 'workout_sessions', 'session_exercises', 'session_sets'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', table_name);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC, anon, authenticated', table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.%I TO authenticated', table_name);
    EXECUTE format('CREATE INDEX %I ON public.%I (user_id, updated_at, id)', table_name || '_user_changes', table_name);
    EXECUTE format('CREATE TRIGGER stamp_cloud_row BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.stamp_cloud_row()', table_name);
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY['workouts', 'workout_exercises', 'workout_sessions', 'session_exercises', 'session_sets'] LOOP
    EXECUTE format('CREATE POLICY select_own ON public.%I FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id)', table_name);
    EXECUTE format('CREATE POLICY delete_own ON public.%I FOR DELETE TO authenticated USING ((SELECT auth.uid()) = user_id)', table_name);
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY['workouts', 'workout_sessions', 'session_sets'] LOOP
    EXECUTE format('CREATE POLICY insert_own ON public.%I FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id)', table_name);
    EXECUTE format('CREATE POLICY update_own ON public.%I FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)', table_name);
  END LOOP;

  FOREACH table_name IN ARRAY ARRAY['workouts', 'workout_sessions', 'session_exercises'] LOOP
    EXECUTE format('CREATE TRIGGER tombstone_cloud_children AFTER UPDATE OF deleted_at ON public.%I FOR EACH ROW WHEN (OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL) EXECUTE FUNCTION public.tombstone_cloud_children()', table_name);
  END LOOP;
END;
$$;

CREATE POLICY select_visible ON public.exercises FOR SELECT TO authenticated
  USING ((NOT is_custom AND user_id IS NULL) OR (SELECT auth.uid()) = user_id);
CREATE POLICY insert_own ON public.exercises FOR INSERT TO authenticated
  WITH CHECK (is_custom AND (SELECT auth.uid()) = user_id);
CREATE POLICY update_own ON public.exercises FOR UPDATE TO authenticated
  USING (is_custom AND (SELECT auth.uid()) = user_id)
  WITH CHECK (is_custom AND (SELECT auth.uid()) = user_id);
CREATE POLICY delete_own ON public.exercises FOR DELETE TO authenticated
  USING (is_custom AND (SELECT auth.uid()) = user_id);

-- Parent ownership is enforced by composite FKs. Exercise ownership additionally
-- allows the shared catalog, but never another account's custom exercise.
CREATE POLICY insert_own ON public.workout_exercises FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND EXISTS (
    SELECT 1 FROM public.exercises e WHERE e.id = workout_exercises.exercise_id
      AND ((NOT e.is_custom AND e.user_id IS NULL) OR e.user_id = workout_exercises.user_id)
  ));
CREATE POLICY update_own ON public.workout_exercises FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id AND EXISTS (
    SELECT 1 FROM public.exercises e WHERE e.id = workout_exercises.exercise_id
      AND ((NOT e.is_custom AND e.user_id IS NULL) OR e.user_id = workout_exercises.user_id)
  ));
CREATE POLICY insert_own ON public.session_exercises FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id AND (exercise_id IS NULL OR EXISTS (
    SELECT 1 FROM public.exercises e WHERE e.id = session_exercises.exercise_id
      AND ((NOT e.is_custom AND e.user_id IS NULL) OR e.user_id = session_exercises.user_id)
  )));
CREATE POLICY update_own ON public.session_exercises FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id AND (exercise_id IS NULL OR EXISTS (
    SELECT 1 FROM public.exercises e WHERE e.id = session_exercises.exercise_id
      AND ((NOT e.is_custom AND e.user_id IS NULL) OR e.user_id = session_exercises.user_id)
  )));
