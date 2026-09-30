import { useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { useWorkoutDatabase } from '@/features/workouts/useWorkoutData';
import { WorkoutHeader } from '@/features/workouts/WorkoutHeader';
import { colors, spacing } from '@/theme/tokens';

import { SessionValidationError } from './model';
import { addExtraSet, updateSessionSet } from './repository';
import { SessionSetRow } from './SessionSetRow';
import { useWorkoutSession } from './useWorkoutSession';

import type { SessionSetDraft } from './SessionSetRow';
import type { SessionExercise, SessionSet, SessionSetValue } from './types';

const weightPattern = /^\d*(?:[.,]\d*)?$/;
const repsPattern = /^\d*$/;

function draftFrom(set: SessionSet): SessionSetDraft {
  return {
    weight: set.weight === null ? '' : String(set.weight),
    reps: set.reps === null ? '' : String(set.reps),
    completed: set.completed,
  };
}

function toValue(draft: SessionSetDraft): SessionSetValue {
  return {
    weight: draft.weight === '' ? null : Number(draft.weight.replace(',', '.')),
    reps: draft.reps === '' ? null : Number(draft.reps),
    completed: draft.completed,
  };
}

export function DetailedExerciseScreen() {
  const { id, exerciseId } = useLocalSearchParams<{ id: string; exerciseId: string }>();
  return <DetailedExerciseLoader key={`${id}:${exerciseId}`} sessionId={id} exerciseId={exerciseId} />;
}

function DetailedExerciseLoader({ sessionId, exerciseId }: { sessionId: string; exerciseId: string }) {
  const { session, status, reload } = useWorkoutSession(sessionId);
  const exercise = session?.exercises.find((item) => item.id === exerciseId);
  const contentKey = exercise?.sets.map((set) => `${set.id}:${set.weight}:${set.reps}:${set.completed}`).join('|');
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppScreen bottomInset>
        <WorkoutHeader title="Detalhar exercício" />
        {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : status === 'error' || !exercise ? <AppCard>
          <AppText variant="heading">{status === 'error' ? 'Não foi possível abrir o exercício' : 'Exercício não encontrado nesta sessão'}</AppText>
          {status === 'error' && <AppButton title="Tentar novamente" onPress={reload} />}
        </AppCard> : session?.status !== 'active' ? <AppCard>
          <AppText variant="heading">Esta sessão já foi finalizada.</AppText>
          <AppText tone="secondary">Os resultados concluídos são somente leitura.</AppText>
        </AppCard> : <DetailedExerciseForm key={contentKey} exercise={exercise} reload={reload} />}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function DetailedExerciseForm({ exercise, reload }: { exercise: SessionExercise; reload: () => void }) {
  const db = useWorkoutDatabase();
  const [drafts, setDrafts] = useState<Record<string, SessionSetDraft>>(() => Object.fromEntries(
    exercise.sets.map((set) => [set.id, draftFrom(set)]),
  ));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const writeQueue = useRef<Promise<void>>(Promise.resolve());

  function queueWrite(setId: string, value: SessionSetDraft) {
    writeQueue.current = writeQueue.current.catch(() => undefined).then(() => updateSessionSet(db, setId, toValue(value)));
    void writeQueue.current.catch((cause) => setError(cause instanceof SessionValidationError ? cause.message : 'Não foi possível salvar esta série. Tente novamente.'));
  }

  function changeSet(set: SessionSet, value: SessionSetDraft) {
    if (!weightPattern.test(value.weight) || !repsPattern.test(value.reps)) return;
    const next = value.reps === '' ? { ...value, completed: false } : value;
    setDrafts((current) => ({ ...current, [set.id]: next }));
    setError(null);
    queueWrite(set.id, next);
  }

  function toggleSet(set: SessionSet) {
    const current = drafts[set.id];
    if (!current) return;
    if (!current.completed && (!current.reps || Number(current.reps) <= 0)) {
      setError('Informe repetições maiores que zero antes de concluir a série.');
      return;
    }
    changeSet(set, { ...current, completed: !current.completed });
  }

  async function addSet() {
    if (busy) return;
    setBusy(true); setError(null);
    try { await writeQueue.current; await addExtraSet(db, exercise.id); reload(); }
    catch { setError('Não foi possível adicionar a série. Tente novamente.'); }
    finally { setBusy(false); }
  }

  return <>
    <AppText variant="hero" accessibilityRole="header">{exercise.exerciseName}</AppText>
    <AppText variant="label" tone="secondary">
      Planejado: {exercise.plannedSets} × {exercise.plannedRepsMin === exercise.plannedRepsMax ? exercise.plannedRepsMin : `${exercise.plannedRepsMin}–${exercise.plannedRepsMax}`}
    </AppText>
    <AppText variant="caption" tone="secondary">Edite e conclua cada série separadamente. Todas as alterações válidas são salvas neste dispositivo.</AppText>
    <AppCard>
      <View style={styles.labels}>
        <AppText variant="caption" tone="secondary" style={styles.setLabel}>Série</AppText>
        <AppText variant="caption" tone="secondary" style={styles.fieldLabel}>kg</AppText>
        <AppText variant="caption" tone="secondary" style={styles.fieldLabel}>reps</AppText>
        <AppText variant="caption" tone="secondary" style={styles.doneLabel}>Feita</AppText>
      </View>
      {exercise.sets.map((set) => <SessionSetRow key={set.id} setNumber={set.setNumber}
        value={drafts[set.id] ?? draftFrom(set)} disabled={busy}
        onChange={(value) => changeSet(set, value)} onToggle={() => toggleSet(set)} />)}
      {error && <AppText tone="danger" accessibilityRole="alert">{error}</AppText>}
      <AppButton title="+ Adicionar série" variant="secondary" loading={busy} onPress={() => void addSet()} />
    </AppCard>
  </>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  labels: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  setLabel: { width: spacing.xl, textAlign: 'center' },
  fieldLabel: { flex: 1, textAlign: 'center' },
  doneLabel: { width: 48, textAlign: 'center' },
});
