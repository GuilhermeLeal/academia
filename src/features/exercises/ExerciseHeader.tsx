import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { AppPressable } from '@/components/AppPressable';
import { AppText } from '@/components/AppText';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

export function ExerciseHeader({ title, library = false, onBack }: { title: string; library?: boolean; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      <AppPressable
        accessibilityRole="button" accessibilityLabel="Voltar"
        onPress={onBack ?? (() => { if (router.canGoBack()) router.back(); else router.replace(library ? '/workouts' : '/exercises'); })}
        style={styles.back}
      >
        <Ionicons name="arrow-back" color={colors.text} size={sizes.icon} />
      </AppPressable>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>{title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  back: { width: sizes.touchTarget, height: sizes.touchTarget, borderRadius: radii.pill, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
});
