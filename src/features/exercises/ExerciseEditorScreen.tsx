import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { colors, radii, sizes, spacing, typography } from '@/theme/tokens';

import { ExerciseThumbnail } from './ExerciseCard';
import { ExerciseHeader } from './ExerciseHeader';
import { createCustomExercise, ExerciseValidationError, getExercise, updateCustomExercise } from './repository';
import { exerciseLimits } from './types';

import type { Exercise, ExerciseInput } from './types';

const emptyInput: ExerciseInput = { name: '', muscleGroup: '', equipment: '' };

export function ExerciseEditorScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <ExerciseEditorForm key={id ?? 'new'} id={id} />;
}

function ExerciseEditorForm({ id }: { id?: string }) {
  const db = useSQLiteContext();
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [form, setForm] = useState<ExerciseInput>(emptyInput);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error' | 'missing'>(id ? 'loading' : 'ready');
  const [retry, setRetry] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  const groupInput = useRef<TextInput>(null);
  const equipmentInput = useRef<TextInput>(null);

  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let active = true;
    if (!id) return;
    void getExercise(db, id).then(
      (result) => {
        if (!active) return;
        setExercise(result);
        setForm(result ? { name: result.name, muscleGroup: result.muscleGroup, equipment: result.equipment ?? '' } : emptyInput);
        setStatus(result ? 'ready' : 'missing');
      },
      () => { if (active) setStatus('error'); },
    );
    return () => { active = false; };
  }, [db, id, retry]);

  const isStandard = exercise !== null && !exercise.isCustom;
  const title = id ? (isStandard ? 'Exercício' : 'Editar exercício') : 'Criar exercício';

  async function save() {
    if (savingRef.current || status !== 'ready' || isStandard) return;
    savingRef.current = true;
    setSaving(true);
    setError(null);
    try {
      const saved = id ? await updateCustomExercise(db, id, form) : await createCustomExercise(db, form);
      if (mounted.current) router.dismissTo({
        pathname: '/exercises',
        params: { savedName: saved.name, savedId: saved.id, savedAt: saved.updatedAt },
      });
    } catch (cause) {
      if (mounted.current) setError(cause instanceof ExerciseValidationError ? cause.message : 'Não foi possível salvar. Seus campos foram mantidos; tente novamente.');
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppScreen bottomInset>
        <ExerciseHeader title={title} />
        {status === 'loading' ? (
          <View style={styles.feedback}><ActivityIndicator color={colors.primary} /><AppText tone="secondary">Abrindo exercício…</AppText></View>
        ) : status === 'error' || status === 'missing' ? (
          <AppCard>
            <AppText variant="heading">{status === 'missing' ? 'Exercício não encontrado' : 'Não foi possível abrir o exercício'}</AppText>
            <AppText tone="secondary">Volte à biblioteca ou tente consultar novamente.</AppText>
            {status === 'error' && <AppButton title="Tentar novamente" onPress={() => { setStatus('loading'); setRetry((value) => value + 1); }} />}
          </AppCard>
        ) : isStandard && exercise ? (
          <AppCard>
            <ExerciseThumbnail imageUri={exercise.imageUri} />
            <AppText variant="eyebrow" tone="primary">CATÁLOGO INICIAL</AppText>
            <AppText variant="title">{exercise.name}</AppText>
            <AppText>{exercise.muscleGroup}</AppText>
            {exercise.equipment && <AppText tone="secondary">{exercise.equipment}</AppText>}
            <AppText variant="caption" tone="secondary">Este exercício faz parte do catálogo padrão e não pode ser editado. Você pode criar seu próprio exercício na biblioteca.</AppText>
          </AppCard>
        ) : (
          <>
            <AppText tone="secondary">Personalize sua biblioteca com um exercício salvo neste celular.</AppText>
            <View style={styles.field}>
              <AppText variant="label">Nome</AppText>
              <TextInput
                accessibilityLabel="Nome do exercício, obrigatório" value={form.name} maxLength={exerciseLimits.name}
                onChangeText={(name) => setForm((value) => ({ ...value, name }))} editable={!saving}
                placeholder="Ex.: Remada com elástico" placeholderTextColor={colors.textSecondary}
                style={styles.input} selectionColor={colors.primary} returnKeyType="next" submitBehavior="submit"
                onSubmitEditing={() => groupInput.current?.focus()}
              />
            </View>
            <View style={styles.field}>
              <AppText variant="label">Grupo muscular</AppText>
              <TextInput
                ref={groupInput} accessibilityLabel="Grupo muscular, obrigatório" value={form.muscleGroup} maxLength={exerciseLimits.muscleGroup}
                onChangeText={(muscleGroup) => setForm((value) => ({ ...value, muscleGroup }))} editable={!saving}
                placeholder="Ex.: Costas" placeholderTextColor={colors.textSecondary}
                style={styles.input} selectionColor={colors.primary} returnKeyType="next" submitBehavior="submit"
                onSubmitEditing={() => equipmentInput.current?.focus()}
              />
            </View>
            <View style={styles.field}>
              <AppText variant="label">Equipamento <AppText variant="caption" tone="secondary">(opcional)</AppText></AppText>
              <TextInput
                ref={equipmentInput} accessibilityLabel="Equipamento, opcional" value={form.equipment} maxLength={exerciseLimits.equipment}
                onChangeText={(equipment) => setForm((value) => ({ ...value, equipment }))} editable={!saving}
                placeholder="Ex.: Elástico" placeholderTextColor={colors.textSecondary}
                style={styles.input} selectionColor={colors.primary} returnKeyType="done" onSubmitEditing={() => void save()}
              />
            </View>
            {error && <AppText tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">{error}</AppText>}
            <AppButton title={id ? 'Salvar alterações' : 'Salvar exercício'} loading={saving} onPress={() => void save()} />
            <AppText variant="caption" tone="secondary">A imagem poderá ser adicionada em uma próxima etapa.</AppText>
          </>
        )}
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  field: { gap: spacing.sm },
  input: { ...typography.body, minHeight: sizes.button, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, color: colors.text, backgroundColor: colors.surface, borderWidth: sizes.border, borderColor: colors.border, borderRadius: radii.md },
  feedback: { gap: spacing.lg, paddingVertical: spacing.xxl },
});
