import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppText } from '@/components/AppText';
import { colors, radii, sizes, spacing, typography } from '@/theme/tokens';

import { ExerciseCard } from './ExerciseCard';
import { ExerciseHeader } from './ExerciseHeader';
import { exerciseLimits } from './types';
import { useExerciseSearch } from './useExerciseSearch';

import type { Exercise } from './types';
import type { ListRenderItemInfo } from 'react-native';

const keyExtractor = (exercise: Exercise) => exercise.id;
const openExercise = (exercise: Exercise) => router.push({ pathname: '/exercises/[id]', params: { id: exercise.id } });
const renderExercise = ({ item }: ListRenderItemInfo<Exercise>) => <ExerciseCard exercise={item} onPress={openExercise} />;

export function ExerciseLibraryScreen() {
  const { savedName, savedId, savedAt } = useLocalSearchParams<{ savedName?: string; savedId?: string; savedAt?: string }>();
  // A completed save starts a fresh search for that exercise; normal navigation preserves typing.
  return <LibraryContent key={`${savedId ?? ''}:${savedAt ?? ''}`} initialQuery={typeof savedName === 'string' ? savedName : ''} />;
}

function LibraryContent({ initialQuery }: { initialQuery: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(false);
  const list = useRef<FlatList<Exercise>>(null);
  const input = useRef<TextInput>(null);
  const { items, status, retry } = useExerciseSearch(query);

  useEffect(() => { list.current?.scrollToOffset({ offset: 0, animated: false }); }, [query]);
  const changeQuery = useCallback((value: string) => setQuery(value), []);

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom', 'left', 'right']}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <ExerciseHeader title="Exercícios" library />
          <View style={[styles.search, focused && styles.searchFocused]}>
            <Ionicons name="search-outline" color={colors.textSecondary} size={sizes.iconSmall} />
            <TextInput
              ref={input} value={query} onChangeText={changeQuery}
              placeholder="Pesquisar exercício..." placeholderTextColor={colors.textSecondary}
              accessibilityLabel="Pesquisar exercício por nome ou apelido"
              style={styles.input} selectionColor={colors.primary} maxLength={exerciseLimits.search}
              autoCorrect={false} autoCapitalize="none" returnKeyType="search"
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
            />
            {query.length > 0 && (
              <Pressable accessibilityRole="button" accessibilityLabel="Limpar pesquisa" style={styles.clear} onPress={() => { setQuery(''); input.current?.focus(); }}>
                <Ionicons name="close-circle" color={colors.textSecondary} size={sizes.icon} />
              </Pressable>
            )}
          </View>
          <AppButton title="Criar exercício" variant="secondary" onPress={() => router.push('/exercises/new')} />
          <View style={styles.summary} accessibilityLiveRegion="polite">
            <AppText variant="caption" tone="secondary">
              {status === 'loading' ? 'Buscando exercícios…' : status === 'error' ? 'Biblioteca indisponível' : `${items.length} ${items.length === 1 ? 'exercício' : 'exercícios'}${query.trim() ? ' encontrados' : ' na biblioteca'}`}
            </AppText>
            {status === 'loading' && <ActivityIndicator color={colors.primary} size="small" />}
          </View>
        </View>
        <FlatList
          ref={list} data={items} renderItem={renderExercise} keyExtractor={keyExtractor}
          style={styles.list} contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          initialNumToRender={10} showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name={status === 'error' ? 'alert-circle-outline' : 'barbell-outline'} size={sizes.iconLarge} color={colors.primary} />
              <AppText variant="heading">
                {status === 'loading' ? 'Abrindo sua biblioteca' : status === 'error' ? 'Não foi possível consultar os exercícios' : query.trim() ? 'Nenhum exercício encontrado' : 'Sua biblioteca está vazia'}
              </AppText>
              <AppText tone="secondary">
                {status === 'loading' ? 'Seus exercícios estarão aqui em instantes.' : status === 'error' ? 'Tente consultar novamente. Seus exercícios salvos serão preservados.' : query.trim() ? 'Tente outro nome, como supino, remada ou elevação.' : 'Crie um exercício para começar.'}
              </AppText>
              {status === 'error' && <AppButton title="Tentar novamente" onPress={retry} />}
            </View>
          }
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background, alignItems: 'center' },
  container: { flex: 1, width: '100%', maxWidth: sizes.contentMaxWidth },
  header: { paddingHorizontal: spacing.xl, paddingTop: spacing.lg, gap: spacing.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.lg, minHeight: sizes.button, borderRadius: radii.md, backgroundColor: colors.surface, borderWidth: sizes.border, borderColor: colors.border },
  searchFocused: { borderColor: colors.primary },
  input: { ...typography.body, flex: 1, color: colors.text, paddingVertical: spacing.md, paddingRight: spacing.sm },
  clear: { width: sizes.touchTarget, height: sizes.touchTarget, alignItems: 'center', justifyContent: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: sizes.icon, marginBottom: spacing.sm },
  list: { flex: 1 },
  listContent: { flexGrow: 1, paddingHorizontal: spacing.xl, paddingBottom: spacing.xl, gap: spacing.md },
  empty: { paddingVertical: spacing.xxl, gap: spacing.lg },
});
