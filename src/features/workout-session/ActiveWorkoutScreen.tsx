import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, View } from 'react-native';

import { AnimatedReveal } from '@/components/AnimatedReveal';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { useWorkoutDatabase } from '@/features/workouts/useWorkoutData';
import { WorkoutHeader } from '@/features/workouts/WorkoutHeader';
import { colors, spacing } from '@/theme/tokens';

import { EmptySessionError, elapsedSeconds, formatDuration, SessionValidationError } from './model';
import { QuickExerciseCard } from './QuickExerciseCard';
import { finishWorkoutSession } from './repository';
import { useWorkoutSession } from './useWorkoutSession';

import type { WorkoutSession } from './types';

export function ActiveWorkoutScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ActiveWorkout key={id} id={id} />;
}

function ActiveWorkout({ id }: { id: string }) {
  const { session, status, reload } = useWorkoutSession(id);
  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppScreen bottomInset>
        <WorkoutHeader title="Treino em andamento" />
        {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : status === 'error' || !session ? <AppCard>
          <AppText variant="heading">{status === 'error' ? 'Não foi possível abrir a sessão' : 'Sessão não encontrada'}</AppText>
          <AppText tone="secondary">Seus dados locais foram preservados.</AppText>
          {status === 'error' && <AppButton title="Tentar novamente" onPress={reload} />}
          <AppButton title="Voltar à Home" variant="secondary" onPress={() => router.replace('/')} />
        </AppCard> : session.status === 'completed' ? <AppCard>
          <AppText variant="heading">Este treino já foi finalizado.</AppText>
          <AppButton title="Ver resumo" onPress={() => router.replace({ pathname: '/session/[id]/summary', params: { id } })} />
        </AppCard> : <ActiveSessionForm session={session} reload={reload} />}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function ActiveSessionForm({ session, reload }: { session: WorkoutSession; reload: () => void }) {
  const db = useWorkoutDatabase();
  const [now, setNow] = useState(0);
  const [busy, setBusy] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  async function finish(allowEmpty: boolean) {
    if (busy) return;
    setBusy(true); setError(null);
    try {
      await finishWorkoutSession(db, session.id, allowEmpty);
      router.replace({ pathname: '/session/[id]/summary', params: { id: session.id } });
    } catch (cause) {
      if (cause instanceof EmptySessionError) setConfirmEmpty(true);
      else setError(cause instanceof SessionValidationError ? cause.message : 'Não foi possível finalizar o treino. Tente novamente.');
    } finally { setBusy(false); }
  }

  const duration = formatDuration(elapsedSeconds(session.startedAt, now || session.startedAt));
  return <>
    <AppText variant="eyebrow" tone="primary">TREINO EM ANDAMENTO</AppText>
    <View style={styles.titleRow}>
      <AppText variant="hero" accessibilityRole="header" style={styles.title}>{session.workoutName}</AppText>
      <AppText variant="title" tone="primary" accessibilityLabel={`Tempo de treino ${duration}`}>{duration}</AppText>
    </View>
    <AppText variant="caption" tone="secondary">Informe um resultado por exercício ou abra a seta para editar série por série.</AppText>
    {session.exercises.map((exercise) => (
      <QuickExerciseCard key={exercise.id} sessionId={session.id} exercise={exercise} onSaved={reload} />
    ))}
    {error && <AppText tone="danger" accessibilityRole="alert">{error}</AppText>}
    {confirmEmpty ? <AnimatedReveal>
      <AppCard>
        <AppText variant="heading">Finalizar sem séries concluídas?</AppText>
        <AppText tone="secondary">Nenhuma série está marcada como concluída. Os campos preenchidos continuarão salvos no resumo da sessão.</AppText>
        <AppButton title="Finalizar mesmo assim" loading={busy} onPress={() => void finish(true)} />
        <AppButton title="Continuar treino" variant="secondary" disabled={busy} onPress={() => setConfirmEmpty(false)} />
      </AppCard>
    </AnimatedReveal> : <AppButton title="Finalizar treino" loading={busy} onPress={() => void finish(false)} />}
  </>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
  title: { flex: 1 },
});
