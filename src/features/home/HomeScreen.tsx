import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppPressable } from '@/components/AppPressable';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { useStatsSummary } from '@/features/stats/useStats';
import { HomeWorkoutCard } from '@/features/workouts/HomeWorkoutCard';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

export function HomeScreen() {
  return (
    <AppScreen>
      <View style={styles.header}>
        <View style={styles.greeting}>
          <AppText variant="eyebrow" tone="primary">SEU ESPAÇO DE TREINO</AppText>
          <AppText variant="hero" accessibilityRole="header">Vamos treinar.</AppText>
        </View>
        <AppPressable accessibilityRole="button" accessibilityLabel="Abrir minha conta" pressedScale={0.92} onPress={() => router.navigate('/account')} style={styles.avatar}>
          <Ionicons name="person-outline" size={sizes.icon} color={colors.primary} />
        </AppPressable>
      </View>

      <HomeWeekCard />
      <HomeWorkoutCard />
    </AppScreen>
  );
}

function HomeWeekCard() {
  const { summary, status, retry } = useStatsSummary();
  if (status === 'loading') {
    return <AppCard><ActivityIndicator color={colors.primary} /></AppCard>;
  }
  if (status === 'error' || !summary) {
    return (
      <AppCard>
        <AppText variant="heading">Não foi possível calcular sua semana</AppText>
        <AppText tone="secondary">Seus treinos continuam salvos neste dispositivo.</AppText>
        <AppButton title="Tentar novamente" variant="secondary" onPress={retry} />
      </AppCard>
    );
  }
  const weekCount = `${summary.completedThisWeek} ${summary.completedThisWeek === 1 ? 'treino' : 'treinos'}`;
  return (
    <AppCard style={styles.weekCard}>
      <View style={styles.row}>
        <View style={styles.inline}>
          <Ionicons name="flame" color={colors.primary} size={sizes.icon} />
          <AppText variant="heading">
            {summary.currentStreak} {summary.currentStreak === 1 ? 'semana' : 'semanas'}
          </AppText>
        </View>
        <AppText variant="caption" tone="secondary">{weekCount} nesta semana</AppText>
      </View>
      <View style={styles.days}>
        {summary.weekDays.map((day) => (
          <View
            key={day.key}
            style={styles.dayColumn}
            accessible
            accessibilityLabel={`${day.name}: ${day.completed ? 'treino concluído' : 'sem treino concluído'}${day.isToday ? ', hoje' : ''}`}
          >
            <AppText variant="caption" tone={day.isToday ? 'primary' : 'secondary'}>{day.label}</AppText>
            <View style={[styles.day, day.completed && styles.dayDone, day.isToday && !day.completed && styles.dayToday]}>
              {day.completed
                ? <Ionicons name="checkmark" color={colors.onPrimary} size={sizes.iconSmall} />
                : <View style={[styles.dayDot, day.isToday && styles.todayDot]} />}
            </View>
          </View>
        ))}
      </View>
      <AppText variant="caption" tone="secondary">
        {summary.completedThisWeek === 0
          ? 'Nenhum treino concluído nesta semana ainda.'
          : `${weekCount} concluído${summary.completedThisWeek === 1 ? '' : 's'} nesta semana.`}
      </AppText>
      <AppButton title="Ver estatísticas e evolução" variant="secondary" onPress={() => router.push('/stats')} />
    </AppCard>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  greeting: { gap: spacing.xs, flex: 1 },
  avatar: { width: sizes.avatar, height: sizes.avatar, borderRadius: radii.pill, backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center' },
  weekCard: { padding: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  inline: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  days: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xxs },
  dayColumn: { alignItems: 'center', flex: 1, gap: spacing.sm },
  day: { width: '100%', maxWidth: sizes.day, aspectRatio: 1, borderRadius: radii.pill, backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  dayDone: { backgroundColor: colors.primary },
  dayToday: { borderWidth: sizes.border, borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  dayDot: { width: spacing.xs, height: spacing.xs, borderRadius: radii.pill, backgroundColor: colors.textSecondary },
  todayDot: { backgroundColor: colors.primary },
});
