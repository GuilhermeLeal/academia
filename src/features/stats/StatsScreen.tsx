import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppPressable } from '@/components/AppPressable';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { formatHistoryDate, formatHistoryTime, formatSetResult } from '@/features/history/model';
import { WorkoutHeader } from '@/features/workouts/WorkoutHeader';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

import { formatMonthTitle, formatStatsDuration, normalizeLocalMonth, shiftLocalMonth } from './model';
import { MonthlyCalendar } from './MonthlyCalendar';
import { useExerciseEvolution, useMonthlyStats, useStatsOverview } from './useStats';

export function StatsScreen() {
  const [selectedMonth, setSelectedMonth] = useState(() => normalizeLocalMonth(new Date()));
  const overview = useStatsOverview();
  const monthly = useMonthlyStats(selectedMonth);
  const [requestedExerciseId, setRequestedExerciseId] = useState<string | null>(null);
  const selectedExerciseId = overview.exercises.some((exercise) => exercise.exerciseId === requestedExerciseId)
    ? requestedExerciseId
    : (overview.exercises[0]?.exerciseId ?? null);
  const evolution = useExerciseEvolution(selectedExerciseId);

  return (
    <AppScreen bottomInset>
      <WorkoutHeader title="Estatísticas" fallbackPath="/" />
      {overview.status === 'loading' ? <ActivityIndicator color={colors.primary} /> : overview.status === 'error' || !overview.summary ? (
        <AppCard>
          <AppText variant="heading">Não foi possível calcular suas estatísticas</AppText>
          <AppText tone="secondary">Tente novamente. Seu histórico local foi preservado.</AppText>
          <AppButton title="Tentar novamente" onPress={overview.retry} />
        </AppCard>
      ) : <>
        <View style={styles.heading}>
          <AppText variant="eyebrow" tone="primary">SUA CONSISTÊNCIA</AppText>
          <AppText variant="hero" accessibilityRole="header">Estatísticas</AppText>
          <AppText tone="secondary">Calendário e evolução calculados somente a partir dos treinos concluídos.</AppText>
        </View>

        <MonthlyCalendar
          month={selectedMonth}
          summary={monthly.summary}
          status={monthly.status}
          onPrevious={() => setSelectedMonth((value) => shiftLocalMonth(value, -1))}
          onNext={() => setSelectedMonth((value) => shiftLocalMonth(value, 1))}
          onRetry={monthly.retry}
        />

        <View style={styles.section}>
          <AppText variant="title">Resumo de {formatMonthTitle(selectedMonth)}</AppText>
          {monthly.status === 'loading' ? <ActivityIndicator color={colors.primary} /> : monthly.status === 'ready' && monthly.summary ? (
            <View style={styles.metricGrid}>
              <Metric label="TREINOS REALIZADOS" value={String(monthly.summary.workoutCount)} />
              <Metric label="TEMPO TREINADO" value={formatStatsDuration(monthly.summary.totalSeconds)} />
              <Metric label="DIAS TREINADOS" value={String(monthly.summary.trainedDayCount)} />
            </View>
          ) : (
            <AppText tone="secondary">Os dados deste mês não estão disponíveis.</AppText>
          )}
        </View>

        <AppCard style={styles.streakCard}>
          <Ionicons name="flame" color={colors.primary} size={sizes.iconLarge} />
          <View style={styles.streakText}>
            <AppText variant="heading">{overview.summary.currentStreak} {overview.summary.currentStreak === 1 ? 'semana' : 'semanas'}</AppText>
            <AppText tone="secondary">Streak atual</AppText>
          </View>
          <View style={styles.bestStreak}>
            <AppText variant="title" tone="primary">{overview.summary.longestStreak}</AppText>
            <AppText variant="caption" tone="secondary">MAIOR STREAK</AppText>
          </View>
        </AppCard>

        <View style={styles.section}>
          <View style={styles.heading}>
            <AppText variant="title">Evolução por exercício</AppText>
            <AppText tone="secondary">Cada linha representa uma série realmente concluída.</AppText>
          </View>
          {overview.exercises.length === 0 ? (
            <AppCard>
              <AppText variant="heading">Nenhum exercício concluído ainda.</AppText>
              <AppText tone="secondary">Conclua séries em um treino para acompanhar cargas e repetições.</AppText>
            </AppCard>
          ) : <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.exercisePicker}>
              {overview.exercises.map((exercise) => {
                const selected = exercise.exerciseId === selectedExerciseId;
                return (
                  <AppPressable
                    key={exercise.exerciseId}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => setRequestedExerciseId(exercise.exerciseId)}
                    style={[styles.exercisePill, selected && styles.exercisePillSelected]}
                  >
                    <AppText variant="label" tone={selected ? 'onPrimary' : 'default'}>{exercise.exerciseName}</AppText>
                  </AppPressable>
                );
              })}
            </ScrollView>
            {evolution.status === 'loading' ? <ActivityIndicator color={colors.primary} /> : evolution.status === 'error' || !evolution.evolution ? (
              <AppCard>
                <AppText variant="heading">Não foi possível abrir esta evolução.</AppText>
                <AppText tone="secondary">Tente novamente. Seu histórico local foi preservado.</AppText>
                <AppButton title="Tentar novamente" variant="secondary" onPress={evolution.retry} />
              </AppCard>
            ) : <>
              <View style={styles.metricGrid}>
                <Metric label="ÚLTIMA CARGA" value={formatWeight(evolution.evolution.latestWeight)} />
                <Metric label="ÚLTIMAS REPS" value={evolution.evolution.latestReps === null ? '—' : String(evolution.evolution.latestReps)} />
                <Metric label="MAIOR CARGA" value={formatWeight(evolution.evolution.maxWeight)} />
              </View>
              <AppText variant="heading">Histórico recente</AppText>
              <AppText variant="caption" tone="secondary">Mais recentes primeiro.</AppText>
              <AppCard style={styles.historyCard}>
                {evolution.evolution.entries.map((entry) => (
                  <View key={entry.setId} style={styles.historyRow}>
                    <View style={styles.historyDate}>
                      <AppText variant="label">{formatHistoryDate(entry.finishedAt)}</AppText>
                      <AppText variant="caption" tone="secondary">{formatHistoryTime(entry.finishedAt)} · série {entry.setNumber}</AppText>
                    </View>
                    <AppText variant="label" tone="primary">{formatSetResult(entry.weight, entry.reps)}</AppText>
                  </View>
                ))}
              </AppCard>
            </>}
          </>}
        </View>

        <AppButton title="Ver resumo completo" onPress={() => router.push('/stats/summary')} />
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

function formatWeight(weight: number | null): string {
  return weight === null ? '—' : `${String(weight).replace('.', ',')} kg`;
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  section: { gap: spacing.lg },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  metric: { minWidth: 140, flex: 1, padding: spacing.lg, gap: spacing.sm },
  streakCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  streakText: { flex: 1, gap: spacing.xs },
  bestStreak: { alignItems: 'flex-end', gap: spacing.xs },
  exercisePicker: { gap: spacing.sm, paddingVertical: spacing.xs },
  exercisePill: {
    minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.lg,
    borderRadius: radii.pill, backgroundColor: colors.surface,
  },
  exercisePillSelected: { backgroundColor: colors.primary },
  historyCard: { gap: 0 },
  historyRow: {
    minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    gap: spacing.md, paddingVertical: spacing.sm,
  },
  historyDate: { flex: 1, gap: spacing.xs },
});
