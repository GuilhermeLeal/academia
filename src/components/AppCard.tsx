import { StyleSheet, View } from 'react-native';

import { colors, radii, sizes, spacing } from '@/theme/tokens';

import type { ViewProps } from 'react-native';

export function AppCard({ style, ...props }: ViewProps) {
  return <View {...props} style={[styles.card, style]} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderRadius: radii.lg, borderWidth: sizes.border,
    borderColor: colors.border, padding: spacing.xl, gap: spacing.lg,
  },
});
