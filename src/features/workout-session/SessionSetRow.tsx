import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, TextInput, View } from 'react-native';

import { AppPressable } from '@/components/AppPressable';
import { AppText } from '@/components/AppText';
import { useReducedMotion } from '@/hooks/useReducedMotion';
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
  const reducedMotion = useReducedMotion();
  const [check] = useState(() => new Animated.Value(value.completed ? 1 : 0));

  useEffect(() => {
    const target = value.completed ? 1 : 0;
    if (reducedMotion) {
      check.setValue(target);
      return;
    }
    const animation = Animated.timing(check, { toValue: target, duration: 150, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [check, reducedMotion, value.completed]);

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
      <AppPressable
        accessibilityRole="checkbox" accessibilityLabel={`Série ${setNumber} concluída`}
        accessibilityState={{ checked: value.completed, disabled }} disabled={disabled} onPress={onToggle}
        pressedScale={0.9}
        style={[styles.check, value.completed && styles.checked, disabled && styles.disabled]}
      >
        {!value.completed && <Ionicons name="ellipse-outline" size={sizes.icon} color={colors.primary} />}
        <Animated.View style={[styles.checkIcon, {
          opacity: check,
          transform: reducedMotion ? undefined : [{
            scale: check.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }),
          }],
        }]}>
          <Ionicons name="checkmark" size={sizes.icon} color={colors.onPrimary} />
        </Animated.View>
      </AppPressable>
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
  checkIcon: { position: 'absolute' },
  disabled: { opacity: opacity.disabled },
});
