import { router, useLocalSearchParams } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { ActiveSessionError, SessionValidationError } from '@/features/workout-session/model';
import { startWorkoutSession } from '@/features/workout-session/repository';
import { useActiveWorkoutSession } from '@/features/workout-session/useWorkoutSession';
import { colors } from '@/theme/tokens';

import { formatReps } from './model';
import { deleteWorkout, duplicateWorkout } from './repository';
import { useWorkoutData, useWorkoutDatabase } from './useWorkoutData';
import { WorkoutHeader } from './WorkoutHeader';

import type { Href } from 'expo-router';

export function WorkoutDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <WorkoutDetail key={id} id={id} />;
}

function WorkoutDetail({ id }: { id: string }) {
  const db = useWorkoutDatabase();
  const { workout, status, retry } = useWorkoutData(id);
  const activeSession = useActiveWorkoutSession();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [destination, setDestination] = useState<Href | null>(null);
  const locked = useRef(false);
  usePreventRemove(busy, () => {});
  useEffect(() => { if (destination && !busy) router.replace(destination); }, [destination, busy]);

  async function act(action: 'delete' | 'duplicate') {
    if (locked.current || !workout || status !== 'ready') return;
    locked.current = true; setBusy(true); setError(null);
    try {
      if (action === 'delete') { await deleteWorkout(db, id); setDestination('/workouts'); }
      else {
        const copy = await duplicateWorkout(db, id);
        setDestination({ pathname: '/workout/[id]', params: { id: copy } });
      }
    } catch { setError('Não foi possível concluir. Tente novamente.'); }
    finally { locked.current = false; setBusy(false); }
  }

  async function start() {
    if (locked.current || !workout || status !== 'ready') return;
    if (activeSession.session) {
      router.push({ pathname: '/session/[id]', params: { id: activeSession.session.id } });
      return;
    }
    locked.current = true; setBusy(true); setError(null);
    try {
      const sessionId = await startWorkoutSession(db, id);
      setDestination({ pathname: '/session/[id]', params: { id: sessionId } });
    } catch (cause) {
      if (cause instanceof ActiveSessionError) setDestination({ pathname: '/session/[id]', params: { id: cause.sessionId } });
      else setError(cause instanceof SessionValidationError ? cause.message : 'Não foi possível iniciar o treino. Tente novamente.');
    } finally { locked.current = false; setBusy(false); }
  }

  return (
    <AppScreen bottomInset>
      <WorkoutHeader title="Seu treino" />
      {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : status === 'error' || !workout ? (
        <AppCard>
          <AppText>{status === 'error' ? 'Não foi possível abrir este treino.' : 'Este treino não existe mais.'}</AppText>
          {status === 'error' && <AppButton title="Tentar novamente" onPress={retry} />}
        </AppCard>
      ) : <>
        <AppText variant="hero">{workout.name}</AppText>
        {workout.description && <AppText tone="secondary">{workout.description}</AppText>}
        <AppText variant="label" tone="primary">{workout.exerciseCount} exercícios</AppText>
        <AppButton title="Editar treino" disabled={busy} onPress={() => router.push({ pathname: '/workout/[id]/edit', params: { id } })} />
        <AppButton
          title={activeSession.session ? 'Continuar treino em andamento' : 'Iniciar treino'}
          loading={busy} disabled={activeSession.status === 'loading' || (!activeSession.session && workout.exerciseCount === 0)}
          onPress={() => void start()}
        />
        {activeSession.session && activeSession.session.workoutId !== id && (
          <AppText variant="caption" tone="secondary">Há outro treino em andamento. Finalize-o antes de iniciar este.</AppText>
        )}
        {workout.exercises.length === 0 && <AppText tone="secondary">Este treino ainda não tem exercícios. Toque em Editar treino para adicionar.</AppText>}
        {workout.exercises.map((exercise) => <AppCard key={exercise.id}>
          <AppText variant="heading">{exercise.position + 1}. {exercise.name}</AppText>
          <AppText tone="secondary">{exercise.muscleGroup}</AppText>
          <AppText variant="label">{exercise.sets} séries × {formatReps(exercise.repsMin, exercise.repsMax)}</AppText>
          <AppText tone="secondary">Descanso: {exercise.restSeconds} s</AppText>
        </AppCard>)}
        {error && <AppText tone="danger" accessibilityRole="alert">{error}</AppText>}
        <AppButton title="Duplicar treino" variant="secondary" disabled={busy} onPress={() => void act('duplicate')} />
        {busy && <ActivityIndicator color={colors.primary} />}
        {confirmDelete ? <AppCard>
          <AppText variant="heading">Excluir este treino?</AppText>
          <AppText tone="secondary">O treino e suas configurações serão excluídos. Os exercícios continuarão na biblioteca.</AppText>
          <AppButton title="Confirmar exclusão" disabled={busy} onPress={() => void act('delete')} />
          <AppButton title="Cancelar" variant="secondary" disabled={busy} onPress={() => setConfirmDelete(false)} />
        </AppCard> : <AppButton title="Excluir treino" variant="secondary" disabled={busy} onPress={() => setConfirmDelete(true)} />}
      </>}
    </AppScreen>
  );
}
