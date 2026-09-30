import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, opacity, radii, sizes, spacing, typography } from '@/theme/tokens';

export interface SessionSetDraft {
  weight: string;
  reps: string;
  completed: boolean;
}

type Props = {
  setNumber: number;
  value: SessionSetDraft;
  disabled: boolean;
  onChange: (value: SessionSetDraft) => void;
  onToggle: () => void;
};

export function SessionSetRow({ setNumber, value, disabled, onChange, onToggle }: Props) {
  return (
    <View style={styles.row}>
      <AppText variant="label" style={styles.number}>{setNumber}</AppText>
      <TextInput
        accessibilityLabel={`Carga da série ${setNumber}, em quilogramas`}
        value={value.weight} editable={!disabled} keyboardType="decimal-pad" maxLength={8}
        placeholder="—" placeholderTextColor={colors.textSecondary} selectionColor={colors.primary}
        style={styles.input} onChangeText={(weight) => onChange({ ...value, weight })}
      />
      <TextInput
        accessibilityLabel={`Repetições da série ${setNumber}`}
        value={value.reps} editable={!disabled} keyboardType="number-pad" maxLength={5}
        placeholder="—" placeholderTextColor={colors.textSecondary} selectionColor={colors.primary}
        style={styles.input} onChangeText={(reps) => onChange({ ...value, reps })}
      />
      <Pressable
        accessibilityRole="checkbox" accessibilityLabel={`Série ${setNumber} concluída`}
        accessibilityState={{ checked: value.completed, disabled }} disabled={disabled} onPress={onToggle}
        style={({ pressed }) => [styles.check, value.completed && styles.checked, pressed && styles.pressed, disabled && styles.disabled]}
      >
        <Ionicons name={value.completed ? 'checkmark' : 'ellipse-outline'} size={sizes.icon} color={value.completed ? colors.onPrimary : colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  number: { width: spacing.xl, textAlign: 'center' },
  input: {
    ...typography.body, flex: 1, minWidth: 0, minHeight: sizes.touchTarget,
    color: colors.text, backgroundColor: colors.surfaceRaised, borderRadius: radii.sm,
    paddingHorizontal: spacing.sm, textAlign: 'center',
  },
  check: {
    width: sizes.touchTarget, height: sizes.touchTarget, borderRadius: radii.pill,
    borderWidth: sizes.border, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center',
  },
  checked: { backgroundColor: colors.primary },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
});
