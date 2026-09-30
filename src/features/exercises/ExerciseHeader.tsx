import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, opacity, radii, sizes, spacing } from '@/theme/tokens';

export function ExerciseHeader({ title, library = false, onBack }: { title: string; library?: boolean; onBack?: () => void }) {
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button" accessibilityLabel="Voltar"
        onPress={onBack ?? (() => { if (router.canGoBack()) router.back(); else router.replace(library ? '/workouts' : '/exercises'); })}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Ionicons name="arrow-back" color={colors.text} size={sizes.icon} />
      </Pressable>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>{title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  back: { width: sizes.touchTarget, height: sizes.touchTarget, borderRadius: radii.pill, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  pressed: { opacity: opacity.pressed },
});
