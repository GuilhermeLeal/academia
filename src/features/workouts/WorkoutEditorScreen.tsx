import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AnimatedReveal } from '@/components/AnimatedReveal';
import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { LibraryContent } from '@/features/exercises/ExerciseLibraryScreen';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, radii, sizes, spacing, typography } from '@/theme/tokens';
import { animateNextLayout } from '@/utils/animations';

import { addDraftExercise, parseDraft, toDraft } from './draft';
import { moveExercise, WorkoutValidationError } from './model';
import { createWorkout, getWorkout, updateWorkout } from './repository';
import { workoutLimits } from './types';
import { useWorkoutDatabase } from './useWorkoutData';
import { WorkoutExerciseFields } from './WorkoutExerciseFields';
import { WorkoutHeader } from './WorkoutHeader';

import type { DraftExercise } from './draft';
import type { NavigationAction } from 'expo-router/react-navigation';

export function WorkoutEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <WorkoutEditor key={id ?? 'new'} id={id} />;
}

function WorkoutEditor({ id }: { id?: string }) {
  const db = useWorkoutDatabase();
  const navigation = useNavigation();
  const reducedMotion = useReducedMotion();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState<DraftExercise[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>(id ? 'loading' : 'ready');
  const [revision, setRevision] = useState(0);
  const [picking, setPicking] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<NavigationAction | null>(null);
  const savingRef = useRef(false);
  const mounted = useRef(true);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    if (!id) return;
    let active = true;
    void getWorkout(db, id).then((workout) => {
      if (!active) return;
      if (!workout) { setStatus('missing'); return; }
      setName(workout.name); setDescription(workout.description ?? '');
      setExercises(workout.exercises.map(toDraft)); setStatus('ready');
    }, () => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [db, id, revision]);

  usePreventRemove(!savedId && (dirty || saving), ({ data }) => { if (!saving) setPendingAction(data.action); });
  useEffect(() => {
    if (savedId) router.dismissTo({ pathname: '/workout/[id]', params: { id: savedId } });
  }, [savedId]);

  async function save() {
    if (savingRef.current || status !== 'ready') return;
    savingRef.current = true; setSaving(true); setError(null);
    try {
      const input = { name, description, exercises: parseDraft(exercises) };
      let result = id;
      if (result) await updateWorkout(db, result, input);
      else result = await createWorkout(db, input);
      if (mounted.current) { setDirty(false); setSavedId(result); }
    } catch (cause) {
      if (mounted.current) setError(cause instanceof WorkoutValidationError ? cause.message : 'Não foi possível salvar o treino. Suas alterações foram mantidas; tente novamente.');
    } finally { savingRef.current = false; if (mounted.current) setSaving(false); }
  }

  if (pendingAction) return (
    <AppScreen bottomInset>
      <AnimatedReveal>
        <AppCard>
          <AppText variant="heading">Descartar alterações?</AppText>
          <AppText tone="secondary">As alterações deste formulário ainda não foram salvas.</AppText>
          <AppButton title="Continuar editando" onPress={() => setPendingAction(null)} />
          <AppButton title="Descartar e voltar" variant="secondary" onPress={() => navigation.dispatch(pendingAction)} />
        </AppCard>
      </AnimatedReveal>
    </AppScreen>
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppScreen bottomInset>
        <WorkoutHeader title={id ? 'Editar treino' : 'Criar treino'} />
        {status === 'loading' ? <ActivityIndicator color={colors.primary} /> : status !== 'ready' ? (
          <AppCard>
            <AppText>{status === 'missing' ? 'Este treino não existe mais.' : 'Não foi possível carregar o treino.'}</AppText>
            {status === 'error' && <AppButton title="Tentar novamente" onPress={() => { setStatus('loading'); setRevision((value) => value + 1); }} />}
          </AppCard>
        ) : <>
          <View style={styles.field}>
            <AppText variant="label">Nome do treino</AppText>
            <TextInput accessibilityLabel="Nome do treino, obrigatório" value={name} maxLength={workoutLimits.name} editable={!saving}
              placeholder="Ex.: Treino A" placeholderTextColor={colors.textSecondary} selectionColor={colors.primary} style={styles.input}
              onChangeText={(value) => { setName(value); setDirty(true); }} />
          </View>
          <View style={styles.field}>
            <AppText variant="label">Descrição (opcional)</AppText>
            <TextInput accessibilityLabel="Descrição do treino, opcional" value={description} maxLength={workoutLimits.description} editable={!saving} multiline
              placeholder="Seu foco para este treino" placeholderTextColor={colors.textSecondary} selectionColor={colors.primary} style={styles.input}
              onChangeText={(value) => { setDescription(value); setDirty(true); }} />
          </View>
          <AppText variant="heading">Exercícios · {exercises.length}</AppText>
          {exercises.length === 0 && <AppText tone="secondary">Adicione exercícios da sua biblioteca. Você também pode salvar e completar este treino depois.</AppText>}
          {exercises.map((item, index) => <WorkoutExerciseFields key={item.exerciseId} item={item} index={index} count={exercises.length} disabled={saving}
            onChange={(updated) => { setExercises((items) => items.map((value) => value.exerciseId === updated.exerciseId ? updated : value)); setDirty(true); }}
            onMove={(direction) => { animateNextLayout(reducedMotion); setExercises((items) => moveExercise(items, index, direction)); setDirty(true); }}
            onRemove={() => { animateNextLayout(reducedMotion); setExercises((items) => items.filter((value) => value.exerciseId !== item.exerciseId)); setDirty(true); }} />)}
          <AppButton title="Adicionar exercícios" variant="secondary" disabled={saving} onPress={() => setPicking(true)} />
          {error && <AppText tone="danger" accessibilityRole="alert">{error}</AppText>}
          <AppButton title="Salvar treino" loading={saving} onPress={() => void save()} />
          <AppText variant="caption" tone="secondary">As alterações só são gravadas ao salvar.</AppText>
        </>}
      </AppScreen>
      <Modal visible={picking} onRequestClose={() => setPicking(false)} animationType={reducedMotion ? 'none' : 'fade'} presentationStyle="fullScreen">
        <SafeAreaProvider>
          {picking && <LibraryContent selection={{ selectedIds: exercises.map((item) => item.exerciseId),
            onSelect: (exercise) => { setExercises((items) => addDraftExercise(items, exercise)); setDirty(true); }, onDone: () => setPicking(false) }} />}
        </SafeAreaProvider>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  field: { gap: spacing.sm },
  input: { ...typography.body, minHeight: sizes.button, padding: spacing.lg, backgroundColor: colors.surface, color: colors.text, borderRadius: radii.md, borderWidth: sizes.border, borderColor: colors.border },
});
