import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppPressable } from '@/components/AppPressable';
import { AppText } from '@/components/AppText';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

export function WorkoutHeader({ title, fallbackPath = '/workouts' }: { title: string; fallbackPath?: '/' | '/workouts' | '/history' | '/stats' }) {
  return (
    <View style={styles.row}>
      <AppPressable accessibilityRole="button" accessibilityLabel="Voltar" pressedScale={0.9} style={styles.back}
        onPress={() => { if (router.canGoBack()) router.back(); else router.replace(fallbackPath); }}>
        <Ionicons name="arrow-back" size={sizes.icon} color={colors.text} />
      </AppPressable>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>{title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  back: { width: sizes.touchTarget, height: sizes.touchTarget, borderRadius: radii.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
