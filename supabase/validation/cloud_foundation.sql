-- Run the ENTIRE file as postgres in the Supabase SQL Editor or with psql
-- -v ON_ERROR_STOP=1. All fixtures (including two temporary Auth users) roll back.
-- auth.uid() is exercised under real authenticated/anon database roles.
BEGIN;

CREATE TEMP TABLE cloud_test_accounts AS
  SELECT label, gen_random_uuid() AS user_id, gen_random_uuid() AS exercise_id,
    gen_random_uuid() AS workout_id, gen_random_uuid() AS workout_exercise_id,
    gen_random_uuid() AS session_id, gen_random_uuid() AS session_exercise_id,
    gen_random_uuid() AS set_id
  FROM (VALUES ('a'), ('b')) AS labels(label);
GRANT SELECT ON cloud_test_accounts TO authenticated, anon;

INSERT INTO auth.users (id) SELECT user_id FROM cloud_test_accounts;
INSERT INTO public.exercises (id, user_id, name, normalized_name, muscle_group)
  SELECT exercise_id, user_id, 'Private exercise', 'private exercise', 'Costas' FROM cloud_test_accounts;
INSERT INTO public.workouts (id, user_id, name, created_at)
  SELECT workout_id, user_id, 'Private workout', '2026-01-01T00:00:00Z' FROM cloud_test_accounts;
INSERT INTO public.workout_exercises
  (id, user_id, workout_id, exercise_id, position, sets, reps_min, reps_max, rest_seconds)
  SELECT workout_exercise_id, user_id, workout_id,
    '00000000-0000-4000-8000-000000000001'::uuid, 0, 3, 8, 12, 60 FROM cloud_test_accounts;
INSERT INTO public.workout_sessions
  (id, user_id, workout_id, workout_name, started_at, finished_at, status)
  SELECT session_id, user_id, workout_id, 'Snapshot', '2026-01-01T10:00:00Z',
    '2026-01-01T11:00:00Z', 'completed' FROM cloud_test_accounts;
INSERT INTO public.session_exercises
  (id, user_id, session_id, exercise_id, exercise_name, position, planned_sets,
   planned_reps_min, planned_reps_max, planned_rest_seconds)
  SELECT session_exercise_id, user_id, session_id, exercise_id, 'Snapshot exercise',
    0, 3, 8, 12, 60 FROM cloud_test_accounts;
INSERT INTO public.session_sets
  (id, user_id, session_exercise_id, set_number, weight, reps, completed)
  SELECT set_id, user_id, session_exercise_id, 1, 42.5, 10, true FROM cloud_test_accounts;

CREATE FUNCTION pg_temp.assert_true(condition boolean, message text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF condition IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAILED: %', message; END IF;
END;
$$;

CREATE FUNCTION pg_temp.expect_error(statement text, codes text[], message text) RETURNS void
LANGUAGE plpgsql AS $$
DECLARE rejected boolean := false;
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF NOT (SQLSTATE = ANY(codes)) THEN
      RAISE EXCEPTION 'FAILED: %; unexpected SQLSTATE %: %', message, SQLSTATE, SQLERRM;
    END IF;
    rejected := true;
  END;
  PERFORM pg_temp.assert_true(rejected, message);
END;
$$;

SELECT set_config('request.jwt.claim.sub', user_id::text, true),
  set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true)
  FROM cloud_test_accounts WHERE label = 'a';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  a record;
  b record;
  table_name text;
  count_rows bigint;
  affected bigint;
  own_payload jsonb;
  previous_created timestamptz;
  previous_updated timestamptz;
BEGIN
  SELECT * INTO a FROM cloud_test_accounts WHERE label = 'a';
  SELECT * INTO b FROM cloud_test_accounts WHERE label = 'b';

  FOREACH table_name IN ARRAY ARRAY[
    'exercises', 'workouts', 'workout_exercises', 'workout_sessions', 'session_exercises', 'session_sets'
  ] LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = $1', table_name) INTO count_rows USING a.user_id;
    PERFORM pg_temp.assert_true(count_rows = 1, table_name || ': owner reads own row');
    EXECUTE format('SELECT count(*) FROM public.%I WHERE user_id = $1', table_name) INTO count_rows USING b.user_id;
    PERFORM pg_temp.assert_true(count_rows = 0, table_name || ': A cannot read B');

    EXECUTE format('UPDATE public.%I SET updated_at = clock_timestamp() WHERE user_id = $1', table_name) USING b.user_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    PERFORM pg_temp.assert_true(affected = 0, table_name || ': A cannot update B');
    EXECUTE format('DELETE FROM public.%I WHERE user_id = $1', table_name) USING b.user_id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    PERFORM pg_temp.assert_true(affected = 0, table_name || ': A cannot delete B');

    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE user_id = $1', table_name) INTO own_payload USING a.user_id;
    own_payload := own_payload || jsonb_build_object('id', gen_random_uuid(), 'user_id', b.user_id);
    PERFORM pg_temp.expect_error(format(
      'INSERT INTO public.%I SELECT (jsonb_populate_record(NULL::public.%I, %L::jsonb)).*',
      table_name, table_name, own_payload
    ), ARRAY['42501'], table_name || ': cannot insert for B');

    PERFORM pg_temp.expect_error(format(
      'UPDATE public.%I SET user_id = %L WHERE user_id = %L', table_name, b.user_id, a.user_id
    ), ARRAY['23514', '42501'], table_name || ': ownership cannot be transferred');
  END LOOP;

  PERFORM pg_temp.expect_error(format(
    'INSERT INTO public.workout_exercises (id,user_id,workout_id,exercise_id,position,sets,reps_min,reps_max,rest_seconds)
     VALUES (gen_random_uuid(),%L,%L,%L,91,3,8,12,60)',
    a.user_id, b.workout_id, '00000000-0000-4000-8000-000000000002'
  ), ARRAY['23503'], 'cannot insert exercise into B workout');
  PERFORM pg_temp.expect_error(format(
    'INSERT INTO public.workout_sessions (id,user_id,workout_id,workout_name,started_at,status)
     VALUES (gen_random_uuid(),%L,%L,''Snapshot'',clock_timestamp(),''active'')', a.user_id, b.workout_id
  ), ARRAY['23503'], 'cannot insert session for B workout');
  PERFORM pg_temp.expect_error(format(
    'INSERT INTO public.session_exercises (id,user_id,session_id,exercise_name,position,planned_sets,planned_reps_min,planned_reps_max,planned_rest_seconds)
     VALUES (gen_random_uuid(),%L,%L,''Snapshot'',91,3,8,12,60)', a.user_id, b.session_id
  ), ARRAY['23503'], 'cannot insert exercise into B session');
  PERFORM pg_temp.expect_error(format(
    'INSERT INTO public.session_sets (id,user_id,session_exercise_id,set_number)
     VALUES (gen_random_uuid(),%L,%L,91)', a.user_id, b.session_exercise_id
  ), ARRAY['23503'], 'cannot insert set into B session exercise');

  PERFORM pg_temp.expect_error(format(
    'INSERT INTO public.workout_exercises (id,user_id,workout_id,exercise_id,position,sets,reps_min,reps_max,rest_seconds)
     VALUES (gen_random_uuid(),%L,%L,%L,91,3,8,12,60)', a.user_id, a.workout_id, b.exercise_id
  ), ARRAY['42501'], 'cannot reference B custom exercise in workout');
  PERFORM pg_temp.expect_error(format(
    'INSERT INTO public.session_exercises (id,user_id,session_id,exercise_id,exercise_name,position,planned_sets,planned_reps_min,planned_reps_max,planned_rest_seconds)
     VALUES (gen_random_uuid(),%L,%L,%L,''Snapshot'',91,3,8,12,60)', a.user_id, a.session_id, b.exercise_id
  ), ARRAY['42501'], 'cannot reference B custom exercise in session');
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.workout_exercises SET exercise_id = %L WHERE id = %L', b.exercise_id, a.workout_exercise_id
  ), ARRAY['42501'], 'cannot reparent workout exercise to B custom exercise');
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.session_exercises SET exercise_id = %L WHERE id = %L', b.exercise_id, a.session_exercise_id
  ), ARRAY['42501'], 'cannot reparent session exercise to B custom exercise');
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.workout_exercises SET workout_id = %L, exercise_id = ''00000000-0000-4000-8000-000000000002'', position = 91 WHERE id = %L', b.workout_id, a.workout_exercise_id
  ), ARRAY['23503'], 'cannot move child to B workout');
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.session_exercises SET session_id = %L, position = 91 WHERE id = %L', b.session_id, a.session_exercise_id
  ), ARRAY['23503'], 'cannot move child to B session');
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.session_sets SET session_exercise_id = %L, set_number = 91 WHERE id = %L', b.session_exercise_id, a.set_id
  ), ARRAY['23503'], 'cannot move set to B session exercise');

  SELECT count(*) INTO count_rows FROM public.exercises WHERE NOT is_custom;
  PERFORM pg_temp.assert_true(count_rows = 150, 'one shared catalog is visible');
  UPDATE public.exercises SET name = 'Hacked' WHERE NOT is_custom;
  GET DIAGNOSTICS affected = ROW_COUNT;
  PERFORM pg_temp.assert_true(affected = 0, 'standard catalog cannot be edited');
  DELETE FROM public.exercises WHERE NOT is_custom;
  GET DIAGNOSTICS affected = ROW_COUNT;
  PERFORM pg_temp.assert_true(affected = 0, 'standard catalog cannot be deleted');
  PERFORM pg_temp.expect_error(
    'INSERT INTO public.exercises (id,name,normalized_name,muscle_group,is_custom)
     VALUES (gen_random_uuid(),''Hacked'',''hacked'',''Costas'',false)',
    ARRAY['42501'], 'standard catalog cannot be inserted by a client'
  );

  SELECT created_at, updated_at INTO previous_created, previous_updated FROM public.workouts WHERE id = a.workout_id;
  INSERT INTO public.workouts (id, user_id, name, created_at, updated_at)
    VALUES (a.workout_id, a.user_id, 'Upserted', '2099-01-01', '2099-01-01')
    ON CONFLICT (id) DO UPDATE SET name = excluded.name,
      created_at = excluded.created_at, updated_at = excluded.updated_at;
  PERFORM pg_temp.assert_true(EXISTS (
    SELECT 1 FROM public.workouts WHERE id = a.workout_id AND user_id = a.user_id
      AND name = 'Upserted' AND created_at = previous_created
      AND updated_at > previous_updated AND updated_at < '2099-01-01'
  ), 'upsert preserves UUID/creation and uses server update timestamp');
  PERFORM pg_temp.expect_error(format(
    'UPDATE public.workouts SET id = gen_random_uuid() WHERE id = %L', a.workout_id
  ), ARRAY['23514'], 'UUID cannot be reassigned');
  PERFORM pg_temp.expect_error(format(
    'INSERT INTO public.workouts (id,user_id,name) VALUES (%L,%L,''Stolen'')
     ON CONFLICT (id) DO UPDATE SET user_id = excluded.user_id, name = excluded.name', b.workout_id, a.user_id
  ), ARRAY['42501', '23514'], 'UUID collision cannot steal another account row');

  UPDATE public.workouts SET deleted_at = '2099-01-01' WHERE id = a.workout_id;
  PERFORM pg_temp.assert_true(EXISTS (
    SELECT 1 FROM public.workouts WHERE id = a.workout_id AND deleted_at = updated_at AND deleted_at < '2099-01-01'
  ), 'tombstone is server stamped and readable by sync owner');
  PERFORM pg_temp.assert_true(EXISTS (
    SELECT 1 FROM public.workout_exercises WHERE id = a.workout_exercise_id AND deleted_at IS NOT NULL
  ), 'template deletion tombstones template children');
  PERFORM pg_temp.assert_true(EXISTS (
    SELECT 1 FROM public.workout_sessions WHERE id = a.session_id AND deleted_at IS NULL
  ), 'template deletion preserves history snapshots');
  UPDATE public.workout_sessions SET deleted_at = clock_timestamp() WHERE id = a.session_id;
  PERFORM pg_temp.assert_true(EXISTS (
    SELECT 1 FROM public.session_exercises WHERE id = a.session_exercise_id AND deleted_at IS NOT NULL
  ) AND EXISTS (
    SELECT 1 FROM public.session_sets WHERE id = a.set_id AND deleted_at IS NOT NULL
  ), 'session deletion recursively tombstones exercises and results');

  DELETE FROM public.session_sets WHERE id = a.set_id;
  GET DIAGNOSTICS affected = ROW_COUNT;
  PERFORM pg_temp.assert_true(affected = 1, 'DELETE policy permits only own row');
END;
$$;

-- Reusing the same database connection with another JWT must switch isolation.
RESET ROLE;
SELECT set_config('request.jwt.claim.sub', user_id::text, true),
  set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true)
  FROM cloud_test_accounts WHERE label = 'b';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(
  (SELECT count(*) FROM public.workouts WHERE user_id = (SELECT user_id FROM cloud_test_accounts WHERE label = 'a')) = 0
  AND (SELECT count(*) FROM public.workouts WHERE user_id = auth.uid()) = 1,
  'switching account exposes only B ownership'
);
SELECT pg_temp.assert_true((SELECT count(*) FROM public.exercises WHERE NOT is_custom) = 150,
  'B sees the same shared catalog without A custom exercises');

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', '', true), set_config('request.jwt.claims', '{}', true);
SET LOCAL ROLE anon;
DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'exercises', 'workouts', 'workout_exercises', 'workout_sessions', 'session_exercises', 'session_sets'
  ] LOOP
    PERFORM pg_temp.expect_error(format('SELECT * FROM public.%I', table_name),
      ARRAY['42501'], table_name || ': anonymous cannot read');
    PERFORM pg_temp.expect_error(format('UPDATE public.%I SET updated_at = clock_timestamp()', table_name),
      ARRAY['42501'], table_name || ': anonymous cannot update');
    PERFORM pg_temp.expect_error(format('DELETE FROM public.%I', table_name),
      ARRAY['42501'], table_name || ': anonymous cannot delete');
    PERFORM pg_temp.expect_error(format('INSERT INTO public.%I DEFAULT VALUES', table_name),
      ARRAY['42501'], table_name || ': anonymous cannot insert');
  END LOOP;
END;
$$;

RESET ROLE;
SELECT set_config('request.jwt.claim.sub', user_id::text, true),
  set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true)
  FROM cloud_test_accounts WHERE label = 'a';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_true(EXISTS (
  SELECT 1 FROM public.workouts WHERE id = (SELECT workout_id FROM cloud_test_accounts WHERE label = 'a')
    AND user_id = auth.uid() AND name = 'Upserted'
), 'login restores the original UUID and ownership');

RESET ROLE;
ROLLBACK;
SELECT 'cloud foundation: all RLS, ownership, UUID and tombstone assertions passed' AS result;
