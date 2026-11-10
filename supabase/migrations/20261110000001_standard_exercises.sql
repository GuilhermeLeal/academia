-- Same deterministic UUIDs and bundled catalog as src/features/exercises/seed.ts.
-- Aliases remain bundled search metadata, not private sync entities.
INSERT INTO public.exercises
  (id, name, normalized_name, muscle_group, equipment, is_custom, created_at)
VALUES
  ('00000000-0000-4000-8000-000000000001', 'Supino Reto', 'supino reto', 'Peitoral', 'Barra', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000002', 'Supino Inclinado', 'supino inclinado', 'Peitoral', 'Halteres', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000003', 'Supino Máquina', 'supino maquina', 'Peitoral', 'Máquina', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000004', 'Supino Articulado', 'supino articulado', 'Peitoral', 'Máquina', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000005', 'Crucifixo Máquina', 'crucifixo maquina', 'Peitoral', 'Máquina', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000006', 'Crucifixo com Halteres', 'crucifixo com halteres', 'Peitoral', 'Halteres', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000007', 'Puxada Frontal', 'puxada frontal', 'Costas', 'Polia', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000008', 'Remada Baixa', 'remada baixa', 'Costas', 'Polia', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000009', 'Remada Curvada', 'remada curvada', 'Costas', 'Barra', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000010', 'Agachamento Livre', 'agachamento livre', 'Quadríceps', 'Barra', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000011', 'Leg Press', 'leg press', 'Quadríceps', 'Máquina', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000012', 'Cadeira Extensora', 'cadeira extensora', 'Quadríceps', 'Máquina', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000013', 'Mesa Flexora', 'mesa flexora', 'Posterior de coxa', 'Máquina', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000014', 'Desenvolvimento com Halteres', 'desenvolvimento com halteres', 'Ombros', 'Halteres', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000015', 'Elevação Lateral', 'elevacao lateral', 'Ombros', 'Halteres', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000016', 'Rosca Direta', 'rosca direta', 'Bíceps', 'Barra', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000017', 'Rosca Alternada', 'rosca alternada', 'Bíceps', 'Halteres', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000018', 'Tríceps Pulley', 'triceps pulley', 'Tríceps', 'Polia', false, '2026-09-22T00:00:00Z'),
  ('00000000-0000-4000-8000-000000000019', 'Tríceps Francês', 'triceps frances', 'Tríceps', 'Halteres', false, '2026-09-22T00:00:00Z');
