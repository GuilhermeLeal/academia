import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, sizes, spacing, typography } from '@/theme/tokens';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textSecondary,
      tabBarLabelStyle: typography.caption,
      tabBarStyle: {
        backgroundColor: colors.background, borderTopColor: colors.border,
        height: sizes.tabBar + insets.bottom, paddingTop: spacing.sm,
        paddingBottom: Math.max(insets.bottom, spacing.sm),
      },
      sceneStyle: { backgroundColor: colors.background },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'home' : 'home-outline'} size={size} color={color} /> }} />
      <Tabs.Screen name="workouts" options={{ title: 'Treinos', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'barbell' : 'barbell-outline'} size={size} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'Histórico', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'time' : 'time-outline'} size={size} color={color} /> }} />
      <Tabs.Screen name="account" options={{ title: 'Conta', tabBarIcon: ({ color, size, focused }) => <Ionicons name={focused ? 'person-circle' : 'person-circle-outline'} size={size} color={color} /> }} />
    </Tabs>
  );
}
