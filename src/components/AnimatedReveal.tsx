import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { animateTiming, motion } from '@/utils/animations';

import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = PropsWithChildren<{
  style?: StyleProp<ViewStyle>;
  delay?: number;
  distance?: number;
  duration?: number;
}>;

type ListItemProps = PropsWithChildren<{
  index: number;
  limit?: number;
  step?: number;
  distance?: number;
}>;

export function AnimatedReveal({
  children,
  style,
  delay = 0,
  distance = motion.revealOffset,
  duration = motion.content,
}: Props) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    const animation = animateTiming(progress, 1, duration, reducedMotion);
    const timer = setTimeout(() => animation.start(), delay);
    return () => { clearTimeout(timer); animation.stop(); };
  }, [delay, duration, progress, reducedMotion]);

  return (
    <Animated.View style={[
      style,
      {
        opacity: progress,
        transform: reducedMotion ? undefined : [{
          translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
        }],
      },
    ]}>
      {children}
    </Animated.View>
  );
}

export function AnimatedListItem({
  children,
  index,
  limit = 8,
  step = 18,
  distance = 6,
}: ListItemProps) {
  if (index >= limit) return <>{children}</>;
  return <AnimatedReveal delay={index * step} distance={distance}>{children}</AnimatedReveal>;
}
