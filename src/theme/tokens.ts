export { default as colors } from './colors.json';

export const spacing = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radii = { sm: 8, md: 16, lg: 24, pill: 999 } as const;
export const sizes = {
  iconSmall: 18,
  icon: 24,
  iconLarge: 32,
  touchTarget: 48,
  button: 56,
  avatar: 48,
  exerciseThumbnail: 56,
  exerciseRow: 84,
  day: 34,
  progress: 6,
  tabBar: 64,
  contentMaxWidth: 560,
  border: 1,
} as const;
export const typography = {
  hero: { fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -1 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: -0.6 },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600', letterSpacing: -0.3 },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 18, fontWeight: '400' },
  eyebrow: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 1.6 },
} as const;
export const opacity = { pressed: 0.78, disabled: 0.45 } as const;
