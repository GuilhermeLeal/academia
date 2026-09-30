import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppText } from '@/components/AppText';
import { useWorkoutDatabase } from '@/features/workouts/useWorkoutData';
import { colors, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';

import { PersonalizedResultsError, SessionValidationError, summarizeExerciseResult } from './model';
import { applyQuickExerciseResult, uncompletePlannedExercise } from './repository';

import type { SessionExercise } from './types';

const weightPattern = /^\d*(?:[.,]\d*)?$/;
const repsPattern = /^\d*$/;

type Props = { sessionId: string; exercise: SessionExercise; onSaved: () => void };

export function QuickExerciseCard({ sessionId, exercise, onSaved }: Props) {
  const db = useWorkoutDatabase();
  const result = summarizeExerciseResult(exercise);
  const [weight, setWeight] = useState(result.weight === null ? '' : String(result.weight));
  const [reps, setReps] = useState(result.reps === null ? '' : String(result.reps));
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeWeight(value: string) {
    if (weightPattern.test(value)) { setWeight(value); setConfirmOverwrite(false); setError(null); }
  }

  function changeReps(value: string) {
    if (repsPattern.test(value)) { setReps(value); setConfirmOverwrite(false); setError(null); }
  }

  async function complete(allowOverwrite: boolean) {
    if (busy) return;
    if (weight === '' || reps === '') {
      setError('Informe carga e repetições para concluir o exercício. Use carga 0 quando não houver peso.');
      return;
    }
    setBusy(true); setError(null);
    try {
      await applyQuickExerciseResult(db, exercise.id, {
        weight: Number(weight.replace(',', '.')),
        reps: Number(reps),
      }, allowOverwrite);
      setConfirmOverwrite(false);
      onSaved();
    } catch (cause) {
      if (cause instanceof PersonalizedResultsError) setConfirmOverwrite(true);
      else setError(cause instanceof SessionValidationError ? cause.message : 'Não foi possível concluir o exercício. Tente novamente.');
    } finally { setBusy(false); }
  }

  async function uncomplete() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await uncompletePlannedExercise(db, exercise.id); onSaved(); }
    catch { setError('Não foi possível desmarcar o exercício. Tente novamente.'); }
    finally { setBusy(false); }
  }

  return (
    <AppCard style={styles.card}>
      <Pressable
        accessibilityRole="button" accessibilityLabel={`Abrir séries de ${exercise.exerciseName}`}
        accessibilityHint="Permite editar cada série separadamente"
        onPress={() => router.push({ pathname: '/session/[id]/exercise/[exerciseId]', params: { id: sessionId, exerciseId: exercise.id } })}
        style={({ pressed }) => [styles.header, pressed && styles.pressed]}
      >
        <View style={styles.name}>
          <AppText variant="heading">{exercise.position + 1}. {exercise.exerciseName}</AppText>
          <AppText variant="label" tone="secondary">
            {exercise.plannedSets} × {exercise.plannedRepsMin === exercise.plannedRepsMax ? exercise.plannedRepsMin : `${exercise.plannedRepsMin}–${exercise.plannedRepsMax}`}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={sizes.icon} color={colors.primary} />
      </Pressable>

      <View style={styles.statusRow}>
        {result.kind === 'custom' && <View style={styles.badge}><AppText variant="caption" tone="primary">Personalizado</AppText></View>}
        {result.allPlannedCompleted && <AppText variant="caption" tone="primary">Planejamento concluído</AppText>}
        {!result.allPlannedCompleted && result.completedSetCount > 0 && (
          <AppText variant="caption" tone="secondary">{result.completedSetCount}/{result.totalSetCount} séries concluídas</AppText>
        )}
      </View>

      {!result.allPlannedCompleted && <View style={styles.fields}>
        <View style={styles.field}>
          <AppText variant="caption" tone="secondary">Carga (kg)</AppText>
          <TextInput
            accessibilityLabel={`Carga rápida de ${exercise.exerciseName}, em quilogramas`}
            value={weight} editable={!busy} keyboardType="decimal-pad" maxLength={8}
            placeholder={result.kind === 'custom' ? 'Personalizado' : '0'} placeholderTextColor={colors.textSecondary}
            selectionColor={colors.primary} style={styles.input} onChangeText={changeWeight}
          />
        </View>
        <View style={styles.field}>
          <AppText variant="caption" tone="secondary">Reps</AppText>
          <TextInput
            accessibilityLabel={`Repetições rápidas de ${exercise.exerciseName}`}
            value={reps} editable={!busy} keyboardType="number-pad" maxLength={5}
            placeholder={result.kind === 'custom' ? 'Personalizado' : '10'} placeholderTextColor={colors.textSecondary}
            selectionColor={colors.primary} style={styles.input} onChangeText={changeReps}
          />
        </View>
      </View>}

      {error && <AppText tone="danger" accessibilityRole="alert">{error}</AppText>}
      {confirmOverwrite ? <View style={styles.confirm}>
        <AppText variant="label">Substituir valores personalizados?</AppText>
        <AppText variant="caption" tone="secondary">Apenas as {exercise.plannedSets} séries planejadas receberão {weight.replace(',', '.')} kg × {reps} reps. Séries extras não serão alteradas.</AppText>
        <AppButton title="Aplicar às séries planejadas" loading={busy} onPress={() => void complete(true)} />
        <AppButton title="Cancelar" variant="secondary" disabled={busy} onPress={() => setConfirmOverwrite(false)} />
      </View> : result.allPlannedCompleted
        ? <AppButton title="Desmarcar exercício" variant="secondary" loading={busy} onPress={() => void uncomplete()} />
        : <AppButton title="Concluir exercício" loading={busy} onPress={() => void complete(false)} />}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.md },
  header: { minHeight: sizes.touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { flex: 1, gap: spacing.xs },
  pressed: { opacity: opacity.pressed },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.sm },
  badge: { alignSelf: 'flex-start', backgroundColor: colors.primaryMuted, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radii.pill },
  fields: { flexDirection: 'row', gap: spacing.md },
  field: { flex: 1, gap: spacing.xs },
  input: {
    ...typography.body, minHeight: sizes.touchTarget, color: colors.text,
    backgroundColor: colors.surfaceRaised, borderRadius: radii.sm,
    paddingHorizontal: spacing.md, textAlign: 'center',
  },
  confirm: { gap: spacing.sm },
});
