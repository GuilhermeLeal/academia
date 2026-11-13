import { Animated, Easing, LayoutAnimation } from 'react-native';

export const motion = {
  pressIn: 100,
  pressOut: 150,
  feedback: 160,
  content: 200,
  screen: 240,
  revealOffset: 8,
} as const;

export const motionEasing = Easing.bezier(0.2, 0, 0, 1);

export function animateTiming(
  value: Animated.Value,
  toValue: number,
  duration: number,
  reducedMotion: boolean,
): Animated.CompositeAnimation {
  return Animated.timing(value, {
    toValue,
    duration: reducedMotion ? 0 : duration,
    easing: motionEasing,
    useNativeDriver: true,
  });
}

const subtleLayoutTransition = {
  duration: motion.content,
  create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  update: { type: LayoutAnimation.Types.easeInEaseOut },
  delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
};

export function animateNextLayout(reducedMotion: boolean) {
  if (!reducedMotion) LayoutAnimation.configureNext(subtleLayoutTransition);
}
