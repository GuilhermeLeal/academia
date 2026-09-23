import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';

type Props = { title: string; description: string; onRetry: () => void };

export function RecoveryScreen({ title, description, onRetry }: Props) {
  return (
    <AppScreen bottomInset>
      <AppText variant="eyebrow" tone="primary">ACADEMIA</AppText>
      <AppCard>
        <AppText variant="heading" accessibilityRole="header">{title}</AppText>
        <AppText tone="secondary">{description}</AppText>
        <AppButton title="Tentar novamente" onPress={onRetry} />
      </AppCard>
    </AppScreen>
  );
}
