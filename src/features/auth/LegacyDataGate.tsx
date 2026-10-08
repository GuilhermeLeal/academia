import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppText } from '@/components/AppText';
import { useWorkoutDatabase } from '@/features/workouts/useWorkoutData';
import { colors, spacing } from '@/theme/tokens';

import { useAuthenticatedUser } from './AuthProvider';
import {
  dismissLegacyImport, getLegacyImportState, linkLegacyData, registerLocalUser,
} from './legacyRepository';

import type { PropsWithChildren } from 'react';

type GateState = 'loading' | 'prompt' | 'ready' | 'error';

export function LegacyDataGate({ children }: PropsWithChildren) {
  const user = useAuthenticatedUser();
  const db = useWorkoutDatabase();
  const [state, setState] = useState<GateState>('loading');
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        await registerLocalUser(db, user.id, user.phone);
        const legacy = await getLegacyImportState(db, user.id);
        if (active) setState(legacy.hasLegacyData && !legacy.dismissed ? 'prompt' : 'ready');
      } catch { if (active) setState('error'); }
    })();
    return () => { active = false; };
  }, [db, user.id, user.phone]);

  if (state === 'ready') return children;
  if (state === 'loading') return <GateMessage><ActivityIndicator color={colors.primary} /><AppText tone="secondary">Preparando sua conta…</AppText></GateMessage>;
  if (state === 'error') return (
    <GateMessage>
      <AppText variant="heading">Não foi possível preparar seus dados locais</AppText>
      <AppText tone="secondary">Feche e reabra o aplicativo. Nenhum dado foi removido.</AppText>
    </GateMessage>
  );
  return (
    <GateMessage>
      <AppText variant="eyebrow" tone="primary">DADOS DESTE APARELHO</AppText>
      <AppText variant="heading">Encontramos dados existentes neste aparelho.</AppText>
      <AppText tone="secondary">Você pode vinculá-los a esta conta agora ou decidir depois pela tela Conta.</AppText>
      <AppButton
        title="Vincular à minha conta"
        loading={working}
        onPress={() => {
          setWorking(true);
          void linkLegacyData(db, user.id).then(() => setState('ready'), () => setState('error')).finally(() => setWorking(false));
        }}
      />
      <AppButton
        title="Agora não"
        variant="secondary"
        disabled={working}
        onPress={() => {
          setWorking(true);
          void dismissLegacyImport(db, user.id).then(() => setState('ready'), () => setState('error')).finally(() => setWorking(false));
        }}
      />
    </GateMessage>
  );
}

function GateMessage({ children }: PropsWithChildren) {
  return <View style={styles.screen}><AppCard style={styles.card}>{children}</AppCard></View>;
}

const styles = StyleSheet.create({
  screen: {
    flex: 1, justifyContent: 'center', backgroundColor: colors.background,
    paddingHorizontal: spacing.xl, paddingVertical: spacing.xxl,
  },
  card: { gap: spacing.lg },
});
