import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/AppText';
import { colors, opacity, radii, sizes, spacing } from '@/theme/tokens';

import type { PressableProps } from 'react-native';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
};

export function AppButton({ title, variant = 'primary', loading = false, disabled, ...props }: Props) {
  const unavailable = disabled || loading;
  return (
    <Pressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      style={({ pressed }) => [styles.base, styles[variant], pressed && styles.pressed, unavailable && styles.disabled]}
    >
      {loading && <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />}
      <AppText variant="label" tone={variant === 'primary' ? 'onPrimary' : 'primary'}>{title}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: sizes.button, borderRadius: radii.md, paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg, flexDirection: 'row', gap: spacing.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  primary: { backgroundColor: colors.primary },
  secondary: { backgroundColor: colors.primaryMuted },
  pressed: { opacity: opacity.pressed },
  disabled: { opacity: opacity.disabled },
});
