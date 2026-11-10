import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { useWorkoutDatabase } from '@/features/workouts/useWorkoutData';
import { colors, radii, sizes, spacing, typography } from '@/theme/tokens';

import { useAuth, useAuthenticatedUser } from './AuthProvider';
import { getLegacyImportState, linkLegacyData } from './legacyRepository';

import type { InitialSyncResult, SyncReceipt } from '@/services/initial-sync/model';

export function AccountScreen() {
  const user = useAuthenticatedUser();
  const { signOut } = useAuth();
  const db = useWorkoutDatabase();
  const [hasLegacyData, setHasLegacyData] = useState(false);
  const [working, setWorking] = useState<'link' | 'logout' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getLegacyImportState(db, user.id).then(
      (state) => { if (active) setHasLegacyData(state.hasLegacyData); },
      () => { if (active) setMessage('Não foi possível verificar os dados pendentes.'); },
    );
    return () => { active = false; };
  }, [db, user.id]);

  const linkLegacy = async () => {
    setWorking('link');
    setMessage(null);
    try {
      await linkLegacyData(db, user.id);
      setHasLegacyData(false);
      setMessage('Dados existentes vinculados à sua conta.');
    } catch {
      setMessage('Não foi possível vincular os dados. Nada foi alterado parcialmente.');
    } finally { setWorking(null); }
  };

  const logout = async () => {
    setWorking('logout');
    setMessage(null);
    try { await signOut(); }
    catch {
      setMessage('Não foi possível sair agora. Tente novamente.');
      setWorking(null);
    }
  };

  return (
    <AppScreen>
      <AppText variant="eyebrow" tone="primary">SEU ESPAÇO</AppText>
      <AppText variant="hero" accessibilityRole="header">Conta</AppText>
      <AppCard>
        <Ionicons name="person-circle-outline" size={sizes.avatar} color={colors.primary} />
        <AppText variant="heading">Conta conectada</AppText>
        <AppText tone="secondary">{user.phone ?? 'Telefone não informado pelo Supabase'}</AppText>
      </AppCard>

      {hasLegacyData && (
        <AppCard>
          <AppText variant="eyebrow" tone="primary">DADOS PENDENTES</AppText>
          <AppText variant="heading">Dados existentes neste aparelho</AppText>
          <AppText tone="secondary">
            Vincule os treinos anteriores a esta conta quando quiser. A operação preserva todo o histórico.
          </AppText>
          <AppButton
            title="Vincular à minha conta"
            loading={working === 'link'}
            disabled={working !== null && working !== 'link'}
            onPress={() => { void linkLegacy(); }}
          />
        </AppCard>
      )}

      {message && <AppText tone="secondary" accessibilityLiveRegion="polite">{message}</AppText>}

      {__DEV__ && <DevelopmentInitialSyncTools />}

      <AppButton
        title="Sair"
        variant="secondary"
        loading={working === 'logout'}
        disabled={working !== null && working !== 'logout'}
        onPress={() => { void logout(); }}
      />
      <AppText variant="caption" tone="secondary">Academia · versão inicial 0.1.0</AppText>
    </AppScreen>
  );
}

function DevelopmentInitialSyncTools() {
  const [receipt, setReceipt] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const restore = async () => {
    setResult(null);
    let parsedReceipt: SyncReceipt;
    try {
      parsedReceipt = JSON.parse(receipt) as SyncReceipt;
    } catch {
      setResult('Erro: o receipt não é um JSON válido.');
      return;
    }

    setRestoring(true);
    try {
      const initialSync = globalThis.__ACADEMIA_INITIAL_SYNC__;
      if (!initialSync) throw new Error('A ferramenta de Initial Sync não está disponível.');
      const restoreResult = await initialSync.restore(parsedReceipt);
      setResult(formatRestoreResult(restoreResult));
    } catch (cause) {
      setResult(`Erro: ${cause instanceof Error ? cause.message : 'não foi possível restaurar o backup.'}`);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <AppCard>
      <AppText variant="eyebrow" tone="primary">FERRAMENTAS DE DESENVOLVIMENTO</AppText>
      <AppText variant="heading">Testar restauração do Initial Sync</AppText>
      <View style={styles.field}>
        <AppText variant="label">Receipt JSON</AppText>
        <TextInput
          accessibilityLabel="Receipt JSON do Initial Sync"
          value={receipt}
          onChangeText={setReceipt}
          editable={!restoring}
          multiline
          numberOfLines={8}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="Cole aqui o receipt completo"
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.primary}
          style={styles.receiptInput}
        />
      </View>
      <AppButton
        title="Restaurar backup de teste"
        loading={restoring}
        disabled={restoring || receipt.trim().length === 0}
        onPress={() => { void restore(); }}
      />
      {result && <AppText tone="secondary" accessibilityLiveRegion="polite">{result}</AppText>}
    </AppCard>
  );
}

function formatRestoreResult(result: InitialSyncResult): string {
  if (result.status !== 'conflict') return `Resultado: ${result.status}`;
  const detail = result.reason === 'local-not-empty' ? ' — a conta local não está vazia' : '';
  return `Resultado: conflict / ${result.reason}${detail}`;
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  receiptInput: {
    minHeight: 160, borderRadius: radii.md, borderWidth: sizes.border,
    borderColor: colors.border, backgroundColor: colors.surfaceRaised, color: colors.text,
    padding: spacing.lg, textAlignVertical: 'top', ...typography.body,
  },
});
