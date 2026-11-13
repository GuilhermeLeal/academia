import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppPressable } from '@/components/AppPressable';
import { AppText } from '@/components/AppText';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, sizes, spacing, typography } from '@/theme/tokens';
import { animateTiming, motion } from '@/utils/animations';

import type { TabsScreenOptions } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      animation: reducedMotion ? 'none' : 'shift',
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textSecondary,
      tabBarLabelStyle: typography.caption,
      tabBarButton: (props) => <AppPressable {...props} pressedScale={0.95} />,
      tabBarStyle: {
        backgroundColor: colors.background, borderTopColor: colors.border,
        height: sizes.tabBar + insets.bottom, paddingTop: spacing.sm,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
      },
      sceneStyle: { backgroundColor: colors.background },
    }}>
      <Tabs.Screen name="index" options={tabOptions('Início', 'home', 'home-outline')} />
      <Tabs.Screen name="workouts" options={tabOptions('Treinos', 'barbell', 'barbell-outline')} />
      <Tabs.Screen name="history" options={tabOptions('Histórico', 'time', 'time-outline')} />
      <Tabs.Screen name="account" options={tabOptions('Conta', 'person-circle', 'person-circle-outline')} />
    </Tabs>
  );
}

// The router must see Tabs.Screen directly; share options, never wrap the declaration.
function tabOptions(title: string, icon: IconName, outline: IconName): TabsScreenOptions {
  return {
    title,
    tabBarIcon: ({ color, size, focused }) => (
      <AnimatedTabIcon color={color} size={size} focused={focused} icon={icon} outline={outline} />
    ),
    tabBarLabel: ({ color, focused, children }) => (
      <AnimatedTabLabel color={color} focused={focused} label={children} />
    ),
  };
}

function useFocusProgress(focused: boolean) {
  const reducedMotion = useReducedMotion();
  const [progress] = useState(() => new Animated.Value(focused ? 1 : 0));
  useEffect(() => {
    const animation = animateTiming(progress, focused ? 1 : 0, motion.feedback, reducedMotion);
    animation.start();
    return () => animation.stop();
  }, [focused, progress, reducedMotion]);
  return { progress, reducedMotion };
}

function AnimatedTabIcon({ color, size, focused, icon, outline }: {
  color: ColorValue;
  size: number;
  focused: boolean;
  icon: IconName;
  outline: IconName;
}) {
  const { progress, reducedMotion } = useFocusProgress(focused);
  return (
    <Animated.View style={{
      opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.78, 1] }),
      transform: reducedMotion ? undefined : [
        { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) },
        { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) },
      ],
    }}>
      <Ionicons
        name={focused ? icon : outline}
        size={size}
        color={typeof color === 'number' ? colors.textSecondary : (color ?? colors.textSecondary)}
      />
    </Animated.View>
  );
}

function AnimatedTabLabel({ color, focused, label }: {
  color: ColorValue;
  focused: boolean;
  label: string;
}) {
  const { progress } = useFocusProgress(focused);
  return (
    <Animated.View style={{ opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.76, 1] }) }}>
      <AppText variant="caption" style={{ color }}>{label}</AppText>
    </Animated.View>
  );
}
