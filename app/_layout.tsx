import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { RecoveryScreen } from '@/components/RecoveryScreen';
import { LocalDatabaseProvider } from '@/db/LocalDatabaseProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors } from '@/theme/tokens';

import type { ErrorBoundaryProps } from 'expo-router';

const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background,
    card: colors.surface,
    text: colors.text,
    border: colors.border,
    notification: colors.primary,
  },
};

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <RecoveryScreen title="Vamos tentar de novo" description="Não foi possível abrir esta tela ou seus dados locais. Tente novamente. Se continuar, feche e reabra o aplicativo e confira se ele está atualizado. Seus dados não serão apagados." onRetry={retry} />
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const reducedMotion = useReducedMotion();
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ThemeProvider value={navigationTheme}>
        <LocalDatabaseProvider>
          <Stack screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: reducedMotion ? 'none' : 'fade',
            animationDuration: 180,
          }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="workout-preview" />
            <Stack.Screen name="exercises/index" />
            <Stack.Screen name="exercises/new" />
            <Stack.Screen name="exercises/[id]" />
            <Stack.Screen name="workout/new" />
            <Stack.Screen name="workout/[id]/index" />
            <Stack.Screen name="workout/[id]/edit" />
            <Stack.Screen name="session/[id]" />
            <Stack.Screen name="session/[id]/exercise/[exerciseId]" />
            <Stack.Screen name="session/[id]/summary" />
            <Stack.Screen name="history/[id]" />
            <Stack.Screen name="stats" />
            <Stack.Screen name="stats/summary" />
          </Stack>
        </LocalDatabaseProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
