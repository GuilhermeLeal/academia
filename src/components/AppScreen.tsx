import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, sizes, spacing } from '@/theme/tokens';

import type { PropsWithChildren } from 'react';

type Props = PropsWithChildren<{ bottomInset?: boolean }>;

export function AppScreen({ children, bottomInset = false }: Props) {
  return (
    <SafeAreaView style={styles.screen} edges={bottomInset ? ['top', 'left', 'right', 'bottom'] : ['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.content}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, alignItems: 'center' },
  content: {
    width: '100%', maxWidth: sizes.contentMaxWidth, flexGrow: 1,
    paddingHorizontal: spacing.xl, paddingTop: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.xl,
  },
});
