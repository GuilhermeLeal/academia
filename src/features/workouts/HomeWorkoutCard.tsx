import { router } from 'expo-router';
import { ActivityIndicator } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppText } from '@/components/AppText';
import { useHomeWorkout } from '@/features/home/useHomeWorkout';
import { colors } from '@/theme/tokens';

export function HomeWorkoutCard() {
  const { selection, status, retry } = useHomeWorkout();
  const activeSession = selection?.kind === 'active' ? selection.session : null;
  const workout = selection?.kind === 'suggested' ? selection.workout : null;
  return (
    <AppCard>
      <AppText variant="eyebrow" tone="primary">SEU TREINO</AppText>
      {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : status === 'error' || !selection ? <>
        <AppText tone="secondary">Não foi possível consultar seus treinos.</AppText>
        <AppButton title="Tentar novamente" variant="secondary" onPress={retry} />
      </> : activeSession ? <>
        <AppText variant="title">{activeSession.workoutName}</AppText>
        <AppText variant="label" tone="primary">Treino em andamento</AppText>
        <AppButton title="Continuar treino" onPress={() => router.push({ pathname: '/session/[id]', params: { id: activeSession.id } })} />
        <AppText variant="caption" tone="secondary">Seus registros estão salvos neste dispositivo.</AppText>
      </> : workout ? <>
        <AppText variant="title">{workout.name}</AppText>
        {workout.description && <AppText tone="secondary" numberOfLines={3}>{workout.description}</AppText>}
        <AppText variant="label">{workout.exerciseCount} exercícios</AppText>
        <AppButton title="Ver treino" onPress={() => router.push({ pathname: '/workout/[id]', params: { id: workout.id } })} />
        <AppText variant="caption" tone="secondary">Próximo treino da sua sequência.</AppText>
      </> : <>
        <AppText variant="heading">Monte sua rotina</AppText>
        <AppText tone="secondary">Escolha exercícios e organize um treino do seu jeito.</AppText>
        <AppButton title="Criar primeiro treino" onPress={() => router.push('/workout/new')} />
      </>}
    </AppCard>
  );
}
