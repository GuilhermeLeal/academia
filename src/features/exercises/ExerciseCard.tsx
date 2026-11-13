import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { memo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppPressable } from '@/components/AppPressable';
import { AppText } from '@/components/AppText';
import { colors, radii, sizes, spacing } from '@/theme/tokens';

import { resolveExerciseImage } from './media';

import type { Exercise } from './types';

export function ExerciseThumbnail({ imageUri }: { imageUri: string | null }) {
  const uri = resolveExerciseImage(imageUri, process.env.EXPO_PUBLIC_SUPABASE_URL);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  return (
    <View style={styles.thumbnail} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {uri && uri !== failedUri ? (
        <Image source={{ uri }} style={styles.image} contentFit="contain" cachePolicy="memory-disk" recyclingKey={uri} onError={() => setFailedUri(uri)} />
      ) : <Ionicons name="barbell-outline" size={sizes.icon} color={colors.primary} />}
    </View>
  );
}

type Props = { exercise: Exercise; onPress: (exercise: Exercise) => void; onPreview?: (exercise: Exercise) => void; selected?: boolean; selectionMode?: boolean };

export const ExerciseCard = memo(function ExerciseCard({ exercise, onPress, onPreview, selected = false, selectionMode = false }: Props) {
  return (
    <View style={styles.card}>
      <AppPressable
        accessibilityRole="button"
        accessibilityLabel={`${exercise.name}, ${exercise.muscleGroup}${exercise.equipment ? `, ${exercise.equipment}` : ''}${exercise.isCustom ? ', personalizado' : ''}`}
        accessibilityHint={selectionMode ? (selected ? 'Já está no treino' : 'Adiciona este exercício ao treino') : exercise.isCustom ? 'Abre a edição do exercício' : 'Abre os detalhes do exercício'}
        accessibilityState={{ selected, disabled: selectionMode && selected }}
        disabled={selectionMode && selected}
        onPress={() => onPress(exercise)}
        style={styles.content}
      >
        <ExerciseThumbnail imageUri={exercise.imageUri} />
        <View style={styles.text}>
          <AppText variant="label">{exercise.name}</AppText>
          <AppText variant="caption" tone="secondary">{exercise.muscleGroup}{exercise.equipment ? ` · ${exercise.equipment}` : ''}</AppText>
          {exercise.isCustom && <AppText variant="caption" tone="primary">Personalizado</AppText>}
        </View>
        <Ionicons name={selectionMode ? (selected ? 'checkmark-circle' : 'add-circle-outline') : 'chevron-forward'} size={sizes.icon} color={selectionMode ? colors.primary : colors.textSecondary} />
      </AppPressable>
      {onPreview && <AppPressable
        accessibilityRole="button" accessibilityLabel={`Ver execução de ${exercise.name}`}
        onPress={() => onPreview(exercise)} style={styles.preview}
      ><Ionicons name="eye-outline" size={sizes.icon} color={colors.textSecondary} /></AppPressable>}
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', alignItems: 'center', padding: spacing.md,
    minHeight: sizes.exerciseRow, borderRadius: radii.md,
    backgroundColor: colors.surface, borderWidth: sizes.border, borderColor: colors.border,
  },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  preview: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: spacing.xs },
  thumbnail: {
    width: sizes.exerciseThumbnail, height: sizes.exerciseThumbnail, borderRadius: radii.sm,
    backgroundColor: colors.primaryMuted, alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
});
