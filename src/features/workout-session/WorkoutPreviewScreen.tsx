import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { demoWorkout } from '@/features/home/demo';
import { colors, sizes } from '@/theme/tokens';

export function WorkoutPreviewScreen() {
  return (
    <AppScreen bottomInset>
      <AppText variant="eyebrow" tone="primary">PRÉVIA DO TREINO</AppText>
      <AppText variant="hero" accessibilityRole="header">{demoWorkout.name}</AppText>
      <AppText tone="secondary">{demoWorkout.focus}</AppText>
      <AppCard>
        <Ionicons name="barbell-outline" size={sizes.iconLarge} color={colors.primary} />
        <AppText variant="heading">Um espaço para se concentrar</AppText>
        <AppText tone="secondary">Aqui você poderá acompanhar os exercícios e registrar suas séries e cargas durante o treino.</AppText>
        <AppText variant="label">{demoWorkout.exerciseCount} exercícios · cerca de {demoWorkout.estimatedMinutes} min</AppText>
      </AppCard>
      <AppText tone="secondary">Esta é uma demonstração da navegação. Nenhum treino foi iniciado ou salvo.</AppText>
      <AppButton title="Voltar" variant="secondary" onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/'); }} />
    </AppScreen>
  );
}
