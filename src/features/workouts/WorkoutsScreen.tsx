import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { demoWorkout } from '@/features/home/demo';
import { colors, sizes } from '@/theme/tokens';

export function WorkoutsScreen() {
  return (
    <AppScreen>
      <AppText variant="eyebrow" tone="primary">SUA ROTINA</AppText>
      <AppText variant="hero" accessibilityRole="header">Treinos</AppText>
      <AppText tone="secondary">Seu treino, sempre à mão.</AppText>
      <AppButton title="Biblioteca de exercícios" variant="secondary" onPress={() => router.push('/exercises')} />
      <AppCard>
        <Ionicons name="barbell-outline" size={sizes.iconLarge} color={colors.primary} />
        <AppText variant="eyebrow" tone="primary">TREINO DE EXEMPLO</AppText>
        <AppText variant="title">{demoWorkout.name}</AppText>
        <AppText tone="secondary">{demoWorkout.focus}</AppText>
        <AppText variant="label" tone="secondary">{demoWorkout.exerciseCount} exercícios · cerca de {demoWorkout.estimatedMinutes} min</AppText>
        <AppButton title="Explorar prévia" onPress={() => router.push('/workout-preview')} />
      </AppCard>
      <AppText variant="caption" tone="secondary">Em breve, você poderá montar e organizar seus próprios treinos. Este exemplo serve apenas para conhecer o aplicativo.</AppText>
    </AppScreen>
  );
}
