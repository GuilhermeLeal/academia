import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { useWorkoutDatabase } from '@/features/workouts/useWorkoutData';
import { colors, sizes } from '@/theme/tokens';

import { elapsedSeconds, formatDuration } from './model';
import { getCompletedSessionSummary } from './repository';

import type { CompletedSessionSummary } from './types';

export function WorkoutSessionSummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useWorkoutDatabase();
  const [summary, setSummary] = useState<CompletedSessionSummary | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    void getCompletedSessionSummary(db, id).then((value) => {
      if (!active) return;
      setSummary(value); setStatus('ready');
    }, () => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [db, id]);

  return (
    <AppScreen bottomInset>
      {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : status === 'error' || !summary ? <AppCard>
        <AppText variant="heading">Não foi possível abrir o resumo.</AppText>
        <AppButton title="Voltar à Home" onPress={() => router.replace('/')} />
      </AppCard> : <>
        <Ionicons name="checkmark-circle" color={colors.primary} size={sizes.iconLarge} />
        <AppText variant="eyebrow" tone="primary">TREINO FINALIZADO</AppText>
        <AppText variant="hero" accessibilityRole="header">{summary.workoutName}</AppText>
        <AppCard>
          <AppText variant="heading">Resumo da sessão</AppText>
          <AppText>Duração: {formatDuration(elapsedSeconds(summary.startedAt, summary.finishedAt))}</AppText>
          <AppText>{summary.exerciseCount} {summary.exerciseCount === 1 ? 'exercício' : 'exercícios'}</AppText>
          <AppText>{summary.completedSetCount} {summary.completedSetCount === 1 ? 'série concluída' : 'séries concluídas'}</AppText>
        </AppCard>
        <AppText variant="caption" tone="secondary">O resumo foi salvo localmente. O histórico completo será criado em uma fase futura.</AppText>
        <AppButton title="Voltar à Home" onPress={() => router.replace('/')} />
        <AppButton title="Ver treinos" variant="secondary" onPress={() => router.replace('/workouts')} />
      </>}
    </AppScreen>
  );
}
