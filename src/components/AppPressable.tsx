import { useState } from 'react';
import { Animated, Pressable } from 'react-native';

import { useReducedMotion } from '@/hooks/useReducedMotion';

import type { GestureResponderEvent, PressableProps, StyleProp, ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressedScale?: number;
};

export function AppPressable({ style, pressedScale = 0.98, onPressIn, onPressOut, disabled, ...props }: Props) {
  const reducedMotion = useReducedMotion();
  const [pressed] = useState(() => new Animated.Value(0));

  function animate(toValue: number, duration: number) {
    Animated.timing(pressed, {
      toValue,
      duration: reducedMotion ? 0 : duration,
      useNativeDriver: true,
    }).start();
  }

  function pressIn(event: GestureResponderEvent) {
    animate(1, 90);
    onPressIn?.(event);
  }

  function pressOut(event: GestureResponderEvent) {
    animate(0, 140);
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
          opacity: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, 0.82] }),
          transform: reducedMotion ? undefined : [{
            scale: pressed.interpolate({ inputRange: [0, 1], outputRange: [1, pressedScale] }),
          }],
        },
        style,
      ]}
    />
  );
}
