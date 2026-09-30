import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppText } from '@/components/AppText';
import { useActiveWorkoutSession } from '@/features/workout-session/useWorkoutSession';
import { colors } from '@/theme/tokens';

import { useWorkoutData } from './useWorkoutData';

export function HomeWorkoutCard() {
  const { items, status, retry } = useWorkoutData();
  const active = useActiveWorkoutSession();
  const workout = items[0];
  return (
    <AppCard>
      <AppText variant="eyebrow" tone="primary">SEU TREINO</AppText>
      {status === 'loading' || active.status === 'loading' ? <ActivityIndicator color={colors.primary} /> : status === 'error' || active.status === 'error' ? <>
        <AppText tone="secondary">Não foi possível consultar seus treinos.</AppText>
        <AppButton title="Tentar novamente" variant="secondary" onPress={() => { retry(); active.retry(); }} />
      </> : active.session ? <>
        <AppText variant="title">{active.session.workoutName}</AppText>
        <AppText variant="label" tone="primary">Treino em andamento</AppText>
        <AppButton title="Continuar treino" onPress={() => router.push({ pathname: '/session/[id]', params: { id: active.session!.id } })} />
        <AppText variant="caption" tone="secondary">Seus registros estão salvos neste dispositivo.</AppText>
      </> : workout ? <>
        <AppText variant="title">{workout.name}</AppText>
        {workout.description && <AppText tone="secondary" numberOfLines={3}>{workout.description}</AppText>}
        <AppText variant="label">{workout.exerciseCount} exercícios</AppText>
        <AppButton title="Ver treino" onPress={() => router.push({ pathname: '/workout/[id]', params: { id: workout.id } })} />
        <AppText variant="caption" tone="secondary">Primeiro treino salvo.</AppText>
      </> : <>
        <AppText variant="heading">Monte sua rotina</AppText>
        <AppText tone="secondary">Escolha exercícios e organize um treino do seu jeito.</AppText>
        <AppButton title="Criar primeiro treino" onPress={() => router.push('/workout/new')} />
      </>}
    </AppCard>
  );
}
