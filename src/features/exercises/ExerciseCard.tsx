import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useState } from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, opacity, radii, sizes, spacing } from '@/theme/tokens';

import type { Exercise } from './types';

export function ExerciseThumbnail({ imageUri }: { imageUri: string | null }) {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return (
    <View style={styles.thumbnail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {imageUri && imageUri !== failedUri ? (
        <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" onError={() => setFailedUri(imageUri)} />
      ) : <Ionicons name="barbell-outline" size={sizes.icon} color={colors.primary} />}
    </View>
  );
}

type Props = { exercise: Exercise; onPress: (exercise: Exercise) => void };

export const ExerciseCard = memo(function ExerciseCard({ exercise, onPress }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${exercise.name}, ${exercise.muscleGroup}${exercise.equipment ? `, ${exercise.equipment}` : ''}${exercise.isCustom ? ', personalizado' : ''}`}
      accessibilityHint={exercise.isCustom ? 'Abre a edição do exercício' : 'Abre os detalhes do exercício'}
      onPress={() => onPress(exercise)}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <ExerciseThumbnail imageUri={exercise.imageUri} />
      <View style={styles.text}>
        <AppText variant="label">{exercise.name}</AppText>
        <AppText variant="caption" tone="secondary">{exercise.muscleGroup}{exercise.equipment ? ` · ${exercise.equipment}` : ''}</AppText>
        {exercise.isCustom && <AppText variant="caption" tone="primary">Personalizado</AppText>}
      </View>
      <Ionicons name="chevron-forward" size={sizes.iconSmall} color={colors.textSecondary} />
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md,
    minHeight: sizes.exerciseRow, borderRadius: radii.md,
    backgroundColor: colors.surface, borderWidth: sizes.border, borderColor: colors.border,
  },
  text: { flex: 1, gap: spacing.xs },
  thumbnail: {
    width: sizes.exerciseThumbnail, height: sizes.exerciseThumbnail, borderRadius: radii.sm,
    backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  pressed: { opacity: opacity.pressed },
});
