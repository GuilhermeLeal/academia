import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppPressable } from '@/components/AppPressable';
import { AppText } from '@/components/AppText';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

import { formatMonthTitle } from './model';

import type { MonthlyStats } from './types';

const weekLabels = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];

type Props = {
  month: Date;
  summary: MonthlyStats | null;
  status: 'loading' | 'ready' | 'error';
  onPrevious: () => void;
  onNext: () => void;
  onRetry: () => void;
};

export function MonthlyCalendar({ month, summary, status, onPrevious, onNext, onRetry }: Props) {
  const rows: MonthlyStats['calendarDays'][] = [];
  if (summary) {
    for (let index = 0; index < summary.calendarDays.length; index += 7) {
      rows.push(summary.calendarDays.slice(index, index + 7));
    }
  }
  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <AppPressable
          accessibilityRole="button"
          accessibilityLabel="Mês anterior"
          pressedScale={0.9}
          onPress={onPrevious}
          style={styles.navigationButton}
        >
          <Ionicons name="chevron-back" size={sizes.icon} color={colors.primary} />
        </AppPressable>
        <AppText variant="heading" accessibilityRole="header" style={styles.monthTitle}>
          {formatMonthTitle(month)}
        </AppText>
        <AppPressable
          accessibilityRole="button"
          accessibilityLabel="Próximo mês"
          pressedScale={0.9}
          onPress={onNext}
          style={styles.navigationButton}
        >
          <Ionicons name="chevron-forward" size={sizes.icon} color={colors.primary} />
        </AppPressable>
      </View>
      <View style={styles.weekRow}>
        {weekLabels.map((label, index) => (
          <AppText key={`${label}-${index}`} variant="caption" tone="secondary" style={styles.weekLabel}>{label}</AppText>
        ))}
      </View>
      {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : status === 'error' || !summary ? <>
        <AppText tone="secondary">Não foi possível consultar este mês.</AppText>
        <AppButton title="Tentar novamente" variant="secondary" onPress={onRetry} />
      </> : rows.map((row, rowIndex) => (
        <View key={`row-${rowIndex}`} style={styles.weekRow}>
          {row.map((day, columnIndex) => (
            <View key={day?.key ?? `empty-${rowIndex}-${columnIndex}`} style={styles.dayCell}>
              {day && (
                <View
                  accessible
                  accessibilityLabel={`${day.day} de ${formatMonthTitle(month)}: ${day.trained ? 'treino concluído' : 'sem treino concluído'}${day.isToday ? ', hoje' : ''}`}
                  style={[
                    styles.day,
                    day.trained && styles.trainedDay,
                    day.isToday && (day.trained ? styles.trainedToday : styles.today),
                  ]}
                >
                  <AppText variant="caption" tone={day.trained ? 'onPrimary' : 'default'}>{day.day}</AppText>
                  {day.trained && <Ionicons name="checkmark" size={14} color={colors.onPrimary} />}
                </View>
              )}
            </View>
          ))}
        </View>
      ))}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthTitle: { flex: 1, textAlign: 'center' },
  navigationButton: {
    width: sizes.touchTarget, height: sizes.touchTarget, borderRadius: radii.pill,
    backgroundColor: colors.surfaceRaised, alignItems: 'center', justifyContent: 'center',
  },
  weekRow: { flexDirection: 'row' },
  weekLabel: { flex: 1, textAlign: 'center' },
  dayCell: { flex: 1, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: {
    width: 40, height: 40, maxWidth: '100%', borderRadius: radii.pill,
    alignItems: 'center', justifyContent: 'center', gap: spacing.xxs,
  },
  trainedDay: { backgroundColor: colors.primary },
  today: { borderWidth: sizes.border, borderColor: colors.primary, backgroundColor: colors.primaryMuted },
  trainedToday: { borderWidth: 2, borderColor: colors.text },
});
