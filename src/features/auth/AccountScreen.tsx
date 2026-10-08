import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { useWorkoutDatabase } from '@/features/workouts/useWorkoutData';
import { colors, sizes } from '@/theme/tokens';

import { useAuth, useAuthenticatedUser } from './AuthProvider';
import { getLegacyImportState, linkLegacyData } from './legacyRepository';

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
