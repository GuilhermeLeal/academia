-- Supabase owns storage schema. Local PostgreSQL domain tests may omit it.
-- Public serving of individual in-app assets only; no object-list/write policies.
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('exercise-images', 'exercise-images', true, 262144, ARRAY['image/webp'])
    ON CONFLICT(id) DO UPDATE SET public = true, file_size_limit = 262144,
      allowed_mime_types = ARRAY['image/webp'];
  END IF;
END;
$$;
