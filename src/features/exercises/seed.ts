import { normalizeExerciseText } from './normalize.ts';

import type { SQLiteDatabase } from 'expo-sqlite';

// Small bundled validation catalog. IDs remain stable if the display names change.
const catalog = [
  ['001', 'Supino Reto', 'Peitoral', 'Barra', ['supino barra', 'bench press']],
  ['002', 'Supino Inclinado', 'Peitoral', 'Halteres', ['supino halteres', 'incline bench press']],
  ['003', 'Supino Máquina', 'Peitoral', 'Máquina', ['chest press']],
  ['004', 'Supino Articulado', 'Peitoral', 'Máquina', ['supino convergente']],
  ['005', 'Crucifixo Máquina', 'Peitoral', 'Máquina', ['peck deck', 'voador']],
  ['006', 'Crucifixo com Halteres', 'Peitoral', 'Halteres', ['dumbbell fly']],
  ['007', 'Puxada Frontal', 'Costas', 'Polia', ['pulldown', 'puxada alta']],
  ['008', 'Remada Baixa', 'Costas', 'Polia', ['remada sentada', 'seated row']],
  ['009', 'Remada Curvada', 'Costas', 'Barra', ['bent over row']],
  ['010', 'Agachamento Livre', 'Quadríceps', 'Barra', ['squat', 'agachamento barra']],
  ['011', 'Leg Press', 'Quadríceps', 'Máquina', ['leg press 45']],
  ['012', 'Cadeira Extensora', 'Quadríceps', 'Máquina', ['extensao de pernas', 'leg extension']],
  ['013', 'Mesa Flexora', 'Posterior de coxa', 'Máquina', ['flexao de pernas', 'leg curl']],
  ['014', 'Desenvolvimento com Halteres', 'Ombros', 'Halteres', ['shoulder press']],
  ['015', 'Elevação Lateral', 'Ombros', 'Halteres', ['lateral raise']],
  ['016', 'Rosca Direta', 'Bíceps', 'Barra', ['biceps curl']],
  ['017', 'Rosca Alternada', 'Bíceps', 'Halteres', ['rosca halteres']],
  ['018', 'Tríceps Pulley', 'Tríceps', 'Polia', ['triceps polia', 'pushdown']],
  ['019', 'Tríceps Francês', 'Tríceps', 'Halteres', ['triceps acima da cabeca']],
] as const;

export const CATALOG_SIZE = catalog.length;

/** Called inside migration 2's transaction. Conflict handling never replaces existing rows. */
export async function seedExercises(db: Pick<SQLiteDatabase, 'runAsync'>): Promise<void> {
  const timestamp = '2026-09-22T00:00:00.000Z';
  for (const [suffix, name, muscleGroup, equipment, aliases] of catalog) {
    const id = `00000000-0000-4000-8000-000000000${suffix}`;
    await db.runAsync(
      `INSERT INTO exercises (id, name, normalized_name, muscle_group, equipment, is_custom, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?) ON CONFLICT(id) DO NOTHING`,
      id, name, normalizeExerciseText(name), muscleGroup, equipment, timestamp, timestamp,
    );
    for (const alias of aliases) {
      await db.runAsync(
        `INSERT INTO exercise_aliases (exercise_id, alias, normalized_alias)
         VALUES (?, ?, ?) ON CONFLICT(exercise_id, normalized_alias) DO NOTHING`,
        id, alias, normalizeExerciseText(alias),
      );
    }
  }
}
