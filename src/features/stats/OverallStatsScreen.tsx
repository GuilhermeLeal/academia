import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { formatHistoryDate } from '@/features/history/model';
import { WorkoutHeader } from '@/features/workouts/WorkoutHeader';
import { colors, sizes, spacing } from '@/theme/tokens';

import { formatStatsDuration } from './model';
import { useOverallStats } from './useStats';

export function OverallStatsScreen() {
  const { summary, status, retry } = useOverallStats();
  return (
    <AppScreen bottomInset>
      <WorkoutHeader title="Resumo completo" fallbackPath="/stats" />
      {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : status === 'error' || !summary ? (
        <AppCard>
          <AppText variant="heading">Não foi possível calcular o resumo</AppText>
          <AppText tone="secondary">Seu histórico local foi preservado.</AppText>
          <AppButton title="Tentar novamente" onPress={retry} />
        </AppCard>
      ) : summary.totalWorkouts === 0 ? (
        <AppCard>
          <Ionicons name="analytics-outline" size={sizes.iconLarge} color={colors.primary} />
          <AppText variant="heading">Nenhum treino concluído ainda.</AppText>
          <AppText tone="secondary">O resumo geral aparecerá depois da primeira sessão finalizada.</AppText>
        </AppCard>
      ) : <>
        <View style={styles.heading}>
          <AppText variant="eyebrow" tone="primary">TODO O SEU HISTÓRICO</AppText>
          <AppText variant="hero" accessibilityRole="header">Visão geral</AppText>
          <AppText tone="secondary">Agregados dos seus treinos reais, sem repetir a lista do Histórico.</AppText>
        </View>
        <View style={styles.metricGrid}>
          <Metric label="TREINOS CONCLUÍDOS" value={String(summary.totalWorkouts)} />
          <Metric label="TEMPO TOTAL" value={formatStatsDuration(summary.totalSeconds)} />
          <Metric label="DIAS TREINADOS" value={String(summary.trainedDayCount)} />
          <Metric label="SÉRIES CONCLUÍDAS" value={String(summary.completedSetCount)} />
          <Metric label="MÉDIA POR SEMANA" value={formatAverage(summary.averageWorkoutsPerWeek)} />
          <Metric label="MAIOR STREAK" value={`${summary.longestStreak} ${summary.longestStreak === 1 ? 'semana' : 'semanas'}`} />
        </View>
        <AppCard>
          <AppText variant="caption" tone="secondary">EXERCÍCIO MAIS REALIZADO</AppText>
          {summary.mostPerformedExercise ? <>
            <AppText variant="title" tone="primary">{summary.mostPerformedExercise.name}</AppText>
            <AppText tone="secondary">
              Presente em {summary.mostPerformedExercise.count} {summary.mostPerformedExercise.count === 1 ? 'treino concluído' : 'treinos concluídos'}.
            </AppText>
          </> : (
            <AppText tone="secondary">Ainda não há séries concluídas para comparar exercícios.</AppText>
          )}
        </AppCard>
        <AppCard style={styles.datesCard}>
          <View style={styles.dateItem}>
            <AppText variant="caption" tone="secondary">PRIMEIRO TREINO</AppText>
            <AppText variant="heading">{summary.firstWorkoutAt ? formatHistoryDate(summary.firstWorkoutAt) : '—'}</AppText>
          </View>
          <View style={styles.dateItem}>
            <AppText variant="caption" tone="secondary">TREINO MAIS RECENTE</AppText>
            <AppText variant="heading">{summary.latestWorkoutAt ? formatHistoryDate(summary.latestWorkoutAt) : '—'}</AppText>
          </View>
        </AppCard>
      </>}
    </AppScreen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <AppCard style={styles.metric}>
      <AppText variant="caption" tone="secondary">{label}</AppText>
      <AppText variant="title" tone="primary">{value}</AppText>
    </AppCard>
  );
}

function formatAverage(value: number): string {
  return value.toFixed(1).replace('.', ',');
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { minWidth: 140, flex: 1, padding: spacing.lg, gap: spacing.sm },
  datesCard: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  dateItem: { flex: 1, minWidth: 180, gap: spacing.sm },
});
