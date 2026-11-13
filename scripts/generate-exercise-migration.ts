import { writeFileSync } from 'node:fs';

import { exerciseCatalog } from '../src/features/exercises/catalog.ts';
import { normalizeExerciseText } from '../src/features/exercises/normalize.ts';

const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const rows = exerciseCatalog.slice(19).map((exercise) => `  (${[
  exercise.id, exercise.name, normalizeExerciseText(exercise.name), exercise.muscleGroup,
  exercise.equipment, `repdb://${exercise.source}/thumb.webp`,
].map(quote).join(', ')}, false, '2026-11-13T00:00:00.000Z')`);
const media = exerciseCatalog.map((exercise) =>
  `  (${quote(exercise.id)}::uuid, ${quote(`repdb://${exercise.source}/thumb.webp`)})`);
writeFileSync(new URL('../supabase/migrations/20261113000000_exercise_catalog_150.sql', import.meta.url),
  `-- Generated from the app curation by npm run catalog:sql. In-app use only.
-- Original 19 rows and every referenced UUID remain in place; never delete/replace.
INSERT INTO public.exercises
  (id, name, normalized_name, muscle_group, equipment, image_uri, is_custom, created_at)
VALUES
${rows.join(',\n')}
ON CONFLICT(id) DO NOTHING;

UPDATE public.exercises AS e SET image_uri = media.uri
FROM (VALUES
${media.join(',\n')}
) AS media(id, uri)
WHERE e.id = media.id AND NOT e.is_custom AND e.user_id IS NULL
  AND e.image_uri IS DISTINCT FROM media.uri;
`);
