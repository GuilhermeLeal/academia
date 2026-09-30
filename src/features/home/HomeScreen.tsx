import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { AppPressable } from '@/components/AppPressable';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { demoWeek } from '@/features/home/demo';
import { HomeWorkoutCard } from '@/features/workouts/HomeWorkoutCard';
import { useReducedMotion } from '@/hooks/useReducedMotion';
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

      <AppCard style={styles.weekCard}>
        <View style={styles.row}>
          <View style={styles.inline}>
            <Ionicons name="flame" color={colors.primary} size={sizes.icon} />
            <AppText variant="heading">{demoWeek.streak} dias de ritmo</AppText>
          </View>
          <AppText variant="caption" tone="secondary">na semana</AppText>
        </View>
        <View style={styles.days}>
          {demoWeek.days.map((day) => (
            <View key={day.name} style={styles.dayColumn} accessible accessibilityLabel={`${day.name}: ${day.state === 'done' ? 'treino concluído no exemplo' : day.state === 'today' ? 'dia atual no exemplo' : 'sem treino no exemplo'}`}>
              <AppText variant="caption" tone={day.state === 'today' ? 'primary' : 'secondary'}>{day.label}</AppText>
              <View style={[styles.day, day.state === 'done' && styles.dayDone, day.state === 'today' && styles.dayToday]}>
                {day.state === 'done' ? <Ionicons name="checkmark" color={colors.onPrimary} size={sizes.iconSmall} /> : <View style={[styles.dayDot, day.state === 'today' && styles.todayDot]} />}
              </View>
            </View>
          ))}
        </View>
      </AppCard>

      <HomeWorkoutCard />

      <AppCard>
        <View style={styles.row}>
          <View style={styles.greeting}>
            <AppText variant="eyebrow" tone="secondary">PROGRESSO SEMANAL</AppText>
            <AppText variant="heading">Um treino de cada vez.</AppText>
          </View>
          <AppText variant="title" tone="primary">{demoWeek.completed}<AppText variant="label" tone="secondary"> / {demoWeek.goal}</AppText></AppText>
        </View>
        <WeeklyProgress completed={demoWeek.completed} goal={demoWeek.goal} />
        <AppText variant="caption" tone="secondary">{demoWeek.completed} de {demoWeek.goal} treinos na semana de exemplo.</AppText>
      </AppCard>

      <AppText variant="caption" tone="secondary" style={styles.center}>Ritmo e progresso semanal são exemplos visuais. Seus treinos salvos são reais.</AppText>
    </AppScreen>
  );
}

function WeeklyProgress({ completed, goal }: { completed: number; goal: number }) {
  const reducedMotion = useReducedMotion();
  const value = Math.min(1, Math.max(0, completed / goal));
  const [progress] = useState(() => new Animated.Value(reducedMotion ? value : 0));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(value);
      return;
    }
    Animated.timing(progress, { toValue: value, duration: 220, useNativeDriver: false }).start();
  }, [progress, reducedMotion, value]);

  return (
    <View style={styles.progressTrack} accessibilityRole="progressbar" accessibilityLabel="Treinos da semana, dados de exemplo" accessibilityValue={{ min: 0, max: goal, now: completed }}>
      <Animated.View style={[styles.progressFill, {
        width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
      }]} />
    </View>
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
  center: { textAlign: 'center' },
  progressTrack: { height: sizes.progress, borderRadius: radii.pill, backgroundColor: colors.surfaceRaised, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radii.pill, backgroundColor: colors.primary },
});
