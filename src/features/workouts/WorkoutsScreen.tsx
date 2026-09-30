import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppText } from '@/components/AppText';
import { colors, opacity, sizes, spacing } from '@/theme/tokens';

import { useWorkoutData } from './useWorkoutData';

export function WorkoutsScreen() {
  const { items, status, retry } = useWorkoutData();
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <View style={styles.container}>
        <View style={styles.header}>
          <AppText variant="eyebrow" tone="primary">SUA ROTINA</AppText>
          <AppText variant="hero" accessibilityRole="header">Treinos</AppText>
          <AppButton title="+ Criar treino" onPress={() => router.push('/workout/new')} />
          <AppButton title="Biblioteca de exercícios" variant="secondary" onPress={() => router.push('/exercises')} />
        </View>
        <FlatList data={status === 'ready' ? items : []} keyExtractor={(item) => item.id} contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable accessibilityRole="button" accessibilityLabel={`${item.name}, ${item.exerciseCount} exercícios`}
              style={({ pressed }) => pressed && styles.pressed} onPress={() => router.push({ pathname: '/workout/[id]', params: { id: item.id } })}>
              <AppCard>
                <AppText variant="heading">{item.name}</AppText>
                {item.description && <AppText tone="secondary" numberOfLines={2}>{item.description}</AppText>}
                <AppText variant="label" tone="primary">{item.exerciseCount} exercícios</AppText>
              </AppCard>
            </Pressable>
          )}
          ListEmptyComponent={status === 'loading' ? <ActivityIndicator color={colors.primary} /> : (
            <AppCard>
              <AppText variant="heading">{status === 'error' ? 'Não foi possível consultar seus treinos' : 'Sua rotina começa aqui'}</AppText>
              <AppText tone="secondary">{status === 'error' ? 'Tente novamente. Seus dados estão preservados.' : 'Escolha exercícios da biblioteca e organize seu primeiro treino.'}</AppText>
              <AppButton title={status === 'error' ? 'Tentar novamente' : 'Criar primeiro treino'} onPress={status === 'error' ? retry : () => router.push('/workout/new')} />
            </AppCard>
          )} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  container: { flex: 1, width: '100%', maxWidth: sizes.contentMaxWidth },
  header: { padding: spacing.xl, gap: spacing.md },
  list: { paddingHorizontal: spacing.xl, paddingBottom: spacing.xxl, gap: spacing.lg },
  pressed: { opacity: opacity.pressed },
});
