import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppCard } from '@/components/AppCard';
import { AppText } from '@/components/AppText';
import { colors, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';

import type { DraftExercise } from './draft';

type Props = {
  item: DraftExercise; index: number; count: number; disabled: boolean;
  onChange: (item: DraftExercise) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void;
};

export function WorkoutExerciseFields({ item, index, count, disabled, onChange, onMove, onRemove }: Props) {
  return (
    <AppCard>
      <AppText variant="heading">{index + 1}. {item.name}</AppText>
      <View style={styles.fields}>
        {([['sets', 'Séries'], ['repsMin', 'Reps mínimas'], ['repsMax', 'Reps máximas'], ['restSeconds', 'Descanso (s)']] as const).map(([field, label]) => (
          <View key={field} style={styles.field}>
            <AppText variant="caption" tone="secondary">{label}</AppText>
            <TextInput accessibilityLabel={`${label}, ${item.name}`} value={item[field]} keyboardType="number-pad"
              maxLength={9} editable={!disabled} style={styles.input} selectionColor={colors.primary}
              onChangeText={(value) => onChange({ ...item, [field]: value })} />
          </View>
        ))}
      </View>
      <View style={styles.actions}>
        {([-1, 1] as const).map((direction) => {
          const unavailable = disabled || (direction === -1 ? index === 0 : index === count - 1);
          return <Pressable key={direction} accessibilityRole="button" accessibilityLabel={`Mover ${item.name} para ${direction === -1 ? 'cima' : 'baixo'}`}
            disabled={unavailable} accessibilityState={{ disabled: unavailable }} onPress={() => onMove(direction)} style={[styles.action, unavailable && styles.disabled]}>
            <Ionicons name={direction === -1 ? 'arrow-up' : 'arrow-down'} size={sizes.icon} color={colors.primary} />
          </Pressable>;
        })}
        <Pressable accessibilityRole="button" accessibilityLabel={`Remover ${item.name} deste treino`} disabled={disabled} onPress={onRemove} style={styles.remove}>
          <AppText variant="label" tone="danger">Remover</AppText>
        </Pressable>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  field: { width: '46%', gap: spacing.xs, flexGrow: 1 },
  input: { ...typography.body, color: colors.text, backgroundColor: colors.surfaceRaised, minHeight: sizes.touchTarget, borderRadius: radii.sm, padding: spacing.md },
  actions: { flexDirection: 'row', gap: spacing.sm },
  action: { minWidth: sizes.touchTarget, minHeight: sizes.touchTarget, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primaryMuted, borderRadius: radii.sm },
  remove: { flex: 1, minHeight: sizes.touchTarget, justifyContent: 'center', alignItems: 'flex-end' },
  disabled: { opacity: opacity.disabled },
});
