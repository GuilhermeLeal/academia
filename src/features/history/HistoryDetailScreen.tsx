import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { WorkoutHeader } from '@/features/workouts/WorkoutHeader';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

import {
  formatHistoryDate, formatHistoryDuration, formatHistoryTime, formatSetResult,
} from './model';
import { useHistorySession } from './useHistory';

export function HistoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <HistoryDetail key={id} id={id} />;
}

function HistoryDetail({ id }: { id: string }) {
  const { session, status, retry } = useHistorySession(id);
  return (
    <AppScreen bottomInset>
      <WorkoutHeader title="Detalhes do histórico" fallbackPath="/history" />
      {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : status === 'error' || !session ? (
        <AppCard>
          <AppText variant="heading">{status === 'error' ? 'Não foi possível abrir esta sessão' : 'Sessão concluída não encontrada'}</AppText>
          <AppText tone="secondary">Seus dados locais foram preservados.</AppText>
          {status === 'error' && <AppButton title="Tentar novamente" onPress={retry} />}
        </AppCard>
      ) : <>
        <View style={styles.heading}>
          <AppText variant="eyebrow" tone="primary">TREINO CONCLUÍDO</AppText>
          <AppText variant="hero" accessibilityRole="header">{session.workoutName}</AppText>
        </View>
        <AppCard style={styles.summary}>
          <AppText variant="heading">{formatHistoryDate(session.startedAt)}</AppText>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <AppText variant="caption" tone="secondary">INÍCIO</AppText>
              <AppText variant="label">{formatHistoryTime(session.startedAt)}</AppText>
            </View>
            <View style={styles.summaryItem}>
              <AppText variant="caption" tone="secondary">FIM</AppText>
              <AppText variant="label">{formatHistoryTime(session.finishedAt)}</AppText>
            </View>
            <View style={styles.summaryItem}>
              <AppText variant="caption" tone="secondary">DURAÇÃO TOTAL</AppText>
              <AppText variant="label" tone="primary">{formatHistoryDuration(session.startedAt, session.finishedAt)}</AppText>
            </View>
          </View>
          <AppText tone="secondary">
            {session.exerciseCount} {session.exerciseCount === 1 ? 'exercício realizado' : 'exercícios realizados'} ·{' '}
            {session.completedSetCount} {session.completedSetCount === 1 ? 'série concluída' : 'séries concluídas'}
          </AppText>
        </AppCard>
        <View style={styles.results}>
          <AppText variant="title">Exercícios realizados</AppText>
          {session.exercises.length === 0 ? (
            <AppCard>
              <AppText variant="heading">Nenhuma série concluída nesta sessão.</AppText>
            </AppCard>
          ) : session.exercises.map((exercise) => (
            <AppCard key={exercise.id} style={styles.exerciseCard}>
              <AppText variant="heading">{exercise.exerciseName}</AppText>
              {exercise.sets.map((set) => (
                <View key={set.id} style={styles.setRow}>
                  <View style={styles.setNumber}>
                    <AppText variant="label" tone="onPrimary">{set.setNumber}</AppText>
                  </View>
                  <AppText>{formatSetResult(set.weight, set.reps)}</AppText>
                </View>
              ))}
            </AppCard>
          ))}
        </View>
      </>}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  heading: { gap: spacing.sm },
  summary: { gap: spacing.md },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
  summaryItem: { minWidth: 88, gap: spacing.xs },
  results: { gap: spacing.lg },
  exerciseCard: { gap: spacing.md },
  setRow: { minHeight: sizes.touchTarget, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  setNumber: {
    width: sizes.iconLarge, height: sizes.iconLarge, borderRadius: radii.pill,
    backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
});
