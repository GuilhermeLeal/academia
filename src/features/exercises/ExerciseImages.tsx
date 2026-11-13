import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppText } from '@/components/AppText';
import { colors, radii, spacing } from '@/theme/tokens';

import { exercisePoses, resolveExerciseImage } from './media';

function Pose({ uri, label, name }: { uri: string; label: string; name: string }) {
  const resolved = resolveExerciseImage(uri, process.env.EXPO_PUBLIC_SUPABASE_URL);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  return (
    <View style={styles.pose}>
      <AppText variant="label">{label}</AppText>
      <View style={styles.frame}>
        {resolved && status !== 'error' && <Image
          key={attempt} source={{ uri: resolved }} contentFit="contain" style={styles.image}
          cachePolicy="memory-disk" recyclingKey={resolved} accessibilityLabel={`${name}: ${label}`}
          onLoad={() => setStatus('ready')} onError={() => setStatus('error')}
        />}
        {resolved && status === 'loading' && <ActivityIndicator style={styles.loading} color={colors.primary} />}
        {(!resolved || status === 'error') && <View style={styles.feedback}>
          <AppText variant="caption" tone="secondary">Imagem indisponível. Conecte-se para carregar a execução.</AppText>
          {resolved && <AppButton title="Tentar novamente" variant="secondary" onPress={() => { setStatus('loading'); setAttempt((value) => value + 1); }} />}
        </View>}
      </View>
    </View>
  );
}

export function ExerciseImages({ imageUri, name }: { imageUri: string | null; name: string }) {
  const poses = exercisePoses(imageUri);
  if (!poses.length) return null;
  return <View style={styles.gallery}>
    <AppText variant="label">{poses.length === 2 ? 'Execução · início → contração' : 'Execução'}</AppText>
    {poses.map((pose) => <Pose key={pose.uri} {...pose} name={name} />)}
  </View>;
}

const styles = StyleSheet.create({
  gallery: { gap: spacing.lg },
  pose: { gap: spacing.sm },
  frame: { width: '100%', aspectRatio: 1, maxHeight: 360, borderRadius: radii.md, overflow: 'hidden', backgroundColor: colors.surface },
  image: { width: '100%', height: '100%' },
  loading: { position: 'absolute', alignSelf: 'center', top: '45%' },
  feedback: { position: 'absolute', inset: 0, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
});
