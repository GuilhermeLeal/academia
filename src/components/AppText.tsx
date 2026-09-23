import { StyleSheet, Text } from 'react-native';

import { colors, typography } from '@/theme/tokens';

import type { TextProps } from 'react-native';

type Props = TextProps & {
  variant?: keyof typeof typography;
  tone?: 'default' | 'secondary' | 'primary' | 'onPrimary' | 'danger';
};

const tones = {
  default: colors.text,
  secondary: colors.textSecondary,
  primary: colors.primary,
  onPrimary: colors.onPrimary,
  danger: colors.danger,
};

export function AppText({ variant = 'body', tone = 'default', style, ...props }: Props) {
  return <Text {...props} style={[styles.base, typography[variant], { color: tones[tone] }, style]} />;
}

const styles = StyleSheet.create({ base: { flexShrink: 1 } });
