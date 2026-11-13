import { useEffect, useState } from 'react';
import { Animated, Pressable } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';
import { animateTiming, motion } from '@/utils/animations';

import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export function AppPressable({ style, pressedScale = 0.975, onPressIn, onPressOut, disabled, ...props }: Props) {
  const reducedMotion = useReducedMotion();
  const [pressed] = useState(() => new Animated.Value(0));

  useEffect(() => () => pressed.stopAnimation(), [pressed]);

  function pressIn(event: GestureResponderEvent) {
    pressed.stopAnimation();
    animateTiming(pressed, 1, motion.pressIn, reducedMotion).start();
    onPressIn?.(event);
  }

  function pressOut(event: GestureResponderEvent) {
    pressed.stopAnimation();
    animateTiming(pressed, 0, motion.pressOut, reducedMotion).start();
    onPressOut?.(event);
  }

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[
        {
          opacity: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.86] }),
          transform: reducedMotion ? undefined : [{
            scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, pressedScale] }),
          }],
        },
        style,
      ]}
    />
  );
}
