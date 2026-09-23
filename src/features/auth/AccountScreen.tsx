import Ionicons from '@expo/vector-icons/Ionicons';

import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { colors, sizes } from '@/theme/tokens';

export function AccountScreen() {
  return (
    <AppScreen>
      <AppText variant="eyebrow" tone="primary">SEU ESPAÇO</AppText>
      <AppText variant="hero" accessibilityRole="header">Conta</AppText>
      <AppCard>
        <Ionicons name="person-circle-outline" size={sizes.avatar} color={colors.primary} />
        <AppText variant="heading">Bem-vindo à prévia</AppText>
        <AppText tone="secondary">Explore o aplicativo sem criar uma conta. Nenhum perfil pessoal está conectado neste momento.</AppText>
      </AppCard>
      <AppCard>
        <AppText variant="eyebrow" tone="primary">PENSADO PARA A FAMÍLIA</AppText>
        <AppText variant="heading">Cada pessoa, seu próprio ritmo</AppText>
        <AppText tone="secondary">Em uma próxima etapa, cada pessoa terá sua conta e seus treinos. A experiência planejada é entrar com telefone e PIN e continuar conectado neste celular.</AppText>
      </AppCard>
      <AppText variant="caption" tone="secondary">Academia · versão inicial 0.1.0</AppText>
    </AppScreen>
  );
}
