import { ActivityIndicator, StyleSheet } from 'react-native';

import { AppPressable } from '@/components/AppPressable';
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
    <AppPressable
      {...props}
      accessibilityRole="button"
      accessibilityState={{ disabled: unavailable, busy: loading }}
      disabled={unavailable}
      style={[styles.base, styles[variant], unavailable && styles.disabled]}
    >
      {loading && <ActivityIndicator color={variant === 'primary' ? colors.onPrimary : colors.primary} />}
      <AppText variant="label" tone={variant === 'primary' ? 'onPrimary' : 'primary'}>{title}</AppText>
    </AppPressable>
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
  disabled: { opacity: opacity.disabled },
});
