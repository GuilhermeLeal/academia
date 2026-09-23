import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { colors, sizes } from '@/theme/tokens';

export function HistoryScreen() {
  return (
    <AppScreen>
      <AppText variant="eyebrow" tone="primary">SUA TRAJETÓRIA</AppText>
      <AppText variant="hero" accessibilityRole="header">Histórico</AppText>
      <AppText tone="secondary">Cada treino vai contar uma parte da sua evolução.</AppText>
      <AppCard>
        <Ionicons name="time-outline" size={sizes.iconLarge} color={colors.primary} />
        <AppText variant="heading">Seu primeiro registro virá aqui</AppText>
        <AppText tone="secondary">Quando o registro de treinos estiver disponível, este será o lugar para rever suas sessões, séries e cargas.</AppText>
        <AppButton title="Explorar treinos" variant="secondary" onPress={() => router.navigate('/workouts')} />
      </AppCard>
      <AppText variant="caption" tone="secondary">Os dados de exemplo da tela inicial não fazem parte do seu histórico.</AppText>
    </AppScreen>
  );
}
