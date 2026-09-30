import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppText } from '@/components/AppText';
import { colors, sizes, spacing } from '@/theme/tokens';

import { HistorySessionCard } from './HistorySessionCard';
import { useHistorySessions } from './useHistory';

export function HistoryScreen() {
  const { items, status, retry } = useHistorySessions();
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <AppText variant="eyebrow" tone="primary">SUA TRAJETÓRIA</AppText>
          <AppText variant="hero" accessibilityRole="header">Histórico</AppText>
          <AppText tone="secondary">Reveja os resultados que você concluiu em cada treino.</AppText>
        </View>
        <FlatList
          data={status === 'ready' ? items : []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <HistorySessionCard session={item} />}
          ListEmptyComponent={status === 'loading' ? <ActivityIndicator color={colors.primary} /> : (
            <AppCard>
              <Ionicons name={status === 'error' ? 'alert-circle-outline' : 'time-outline'} size={sizes.iconLarge} color={colors.primary} />
              <AppText variant="heading">
                {status === 'error' ? 'Não foi possível consultar seu histórico' : 'Nenhum treino concluído ainda.'}
              </AppText>
              <AppText tone="secondary">
                {status === 'error' ? 'Tente novamente. Seus dados locais foram preservados.' : 'Finalize um treino para ver seus resultados aqui.'}
              </AppText>
              {status === 'error' && <AppButton title="Tentar novamente" onPress={retry} />}
            </AppCard>
          )}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  container: { flex: 1, width: '100%', maxWidth: sizes.contentMaxWidth },
  header: { padding: spacing.xl, gap: spacing.md },
  list: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
});
