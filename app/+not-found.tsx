import { router } from 'expo-router';

import { AppButton } from '@/components/AppButton';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';

export default function NotFoundScreen() {
  return (
    <AppScreen bottomInset>
      <AppText variant="title">Tela não encontrada</AppText>
      <AppText tone="secondary">Volte ao início para continuar.</AppText>
      <AppButton title="Ir para o início" onPress={() => router.replace('/')} />
    </AppScreen>
  );
}
