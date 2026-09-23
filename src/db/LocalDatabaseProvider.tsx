import { SQLiteProvider } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/AppText';
import { initializeDatabase } from '@/db/migrations';
import { colors, spacing } from '@/theme/tokens';

import type { SQLiteDatabase } from 'expo-sqlite';
import type { PropsWithChildren } from 'react';

export function LocalDatabaseProvider({ children }: PropsWithChildren) {
  const [ready, setReady] = useState(false);

  const initialize = useCallback(async (db: SQLiteDatabase) => {
    await initializeDatabase(db);
    setReady(true);
  }, []);

  return (
    <>
      {!ready && (
        <View style={styles.loading} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
          <AppText tone="secondary">Preparando seu espaço…</AppText>
        </View>
      )}
      <SQLiteProvider databaseName="academia.db" onInit={initialize}>
        {children}
      </SQLiteProvider>
    </>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, gap: spacing.lg },
});
