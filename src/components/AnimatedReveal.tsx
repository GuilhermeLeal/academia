import { useEffect, useState } from 'react';
import { Animated } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';

import type { PropsWithChildren } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

type Props = PropsWithChildren<{ style?: StyleProp<ViewStyle> }>;

export function AnimatedReveal({ children, style }: Props) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(reducedMotion ? 1 : 0));

  useEffect(() => {
    if (reducedMotion) {
      progress.setValue(1);
      return;
    }
    Animated.timing(progress, { toValue: 1, duration: 180, useNativeDriver: true }).start();
  }, [progress, reducedMotion]);

  return (
    <Animated.View style={[
      style,
      {
        opacity: progress,
        transform: reducedMotion ? undefined : [{
          translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }),
        }],
      },
    ]}>
      {children}
    </Animated.View>
  );
}
