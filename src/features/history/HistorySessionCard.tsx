import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { AppPressable } from '@/components/AppPressable';
import { AppText } from '@/components/AppText';
import { colors, sizes, spacing } from '@/theme/tokens';

import { formatHistoryDate, formatHistoryDuration } from './model';

import type { HistorySessionListItem } from './types';

export function HistorySessionCard({ session }: { session: HistorySessionListItem }) {
  const date = formatHistoryDate(session.startedAt);
  const duration = formatHistoryDuration(session.startedAt, session.finishedAt);
  const exercises = `${session.exerciseCount} ${session.exerciseCount === 1 ? 'exercício' : 'exercícios'}`;
  const sets = `${session.completedSetCount} ${session.completedSetCount === 1 ? 'série' : 'séries'}`;
  return (
    <AppPressable
      accessibilityRole="button"
      accessibilityLabel={`${session.workoutName}, ${date}, ${duration}, ${exercises}, ${sets}`}
      accessibilityHint="Abre os resultados concluídos desta sessão"
      onPress={() => router.push({ pathname: '/history/[id]', params: { id: session.id } })}
    >
      <AppCard style={styles.card}>
        <View style={styles.header}>
          <AppText variant="heading" style={styles.name}>{session.workoutName}</AppText>
          <Ionicons name="chevron-forward" size={sizes.icon} color={colors.primary} />
        </View>
        <AppText tone="secondary">{date} · {duration}</AppText>
        <AppText variant="label" tone="primary">{exercises} · {sets}</AppText>
      </AppCard>
    </AppPressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  name: { flex: 1 },
});
