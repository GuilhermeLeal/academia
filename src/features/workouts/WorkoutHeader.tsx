import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

export function WorkoutHeader({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel="Voltar" style={styles.back}
        onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/workouts'); }}>
        <Ionicons name="arrow-back" size={sizes.icon} color={colors.text} />
      </Pressable>
      <AppText variant="title" accessibilityRole="header" style={styles.title}>{title}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  title: { flex: 1 },
  back: { width: sizes.touchTarget, height: sizes.touchTarget, borderRadius: radii.pill, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
