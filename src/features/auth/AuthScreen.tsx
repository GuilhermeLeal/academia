import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppCard } from '@/components/AppCard';
import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';
import { colors, radii, sizes, spacing, typography } from '@/theme/tokens';

import { useAuth } from './AuthProvider';
import { CredentialsValidationError, normalizePhone, validatePin } from './credentials';

type Mode = 'sign-in' | 'sign-up';

export function AuthScreen() {
  const { state, unavailableMessage, signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('sign-in');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    setError(null);
    try {
      normalizePhone(phone);
      validatePin(pin);
      if (mode === 'sign-up' && confirmation !== pin) throw new CredentialsValidationError('A confirmação do PIN deve ser igual.');
      setSubmitting(true);
      const credentials = { phone, pin };
      if (mode === 'sign-up') await signUp(credentials);
      else await signIn(credentials);
    } catch (cause) {
      setError(friendlyAuthError(cause));
    } finally { setSubmitting(false); }
  };

  if (state.status === 'unavailable') {
    return (
      <AppScreen bottomInset>
        <View style={styles.heading}>
          <AppText variant="eyebrow" tone="primary">SEU ESPAÇO</AppText>
          <AppText variant="hero" accessibilityRole="header">Entrar</AppText>
        </View>
        <AppCard>
          <AppText variant="heading">Supabase não configurado</AppText>
          <AppText tone="secondary">{unavailableMessage}</AppText>
          <AppText variant="caption" tone="secondary">Use somente a URL e a chave pública do projeto. Nunca coloque service_role no aplicativo.</AppText>
        </AppCard>
      </AppScreen>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppScreen bottomInset>
        <View style={styles.heading}>
          <AppText variant="eyebrow" tone="primary">ACADEMIA EM FAMÍLIA</AppText>
          <AppText variant="hero" accessibilityRole="header">{mode === 'sign-in' ? 'Entrar' : 'Criar conta'}</AppText>
          <AppText tone="secondary">Seus treinos ficam separados neste aparelho.</AppText>
        </View>
        <AppCard style={styles.form}>
          <Field
            label="Telefone"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            autoComplete="tel"
            placeholder="(11) 99999-9999"
          />
          <Field label="PIN" value={pin} onChangeText={setPin} pin />
          {mode === 'sign-up' && (
            <Field label="Confirmar PIN" value={confirmation} onChangeText={setConfirmation} pin />
          )}
          {error && <AppText tone="danger" accessibilityLiveRegion="polite">{error}</AppText>}
          <AppButton
            title={mode === 'sign-in' ? 'Entrar' : 'Criar conta'}
            loading={submitting}
            disabled={submitting}
            onPress={() => { void submit(); }}
          />
          <AppButton
            title={mode === 'sign-in' ? 'Criar conta' : 'Já tenho uma conta'}
            variant="secondary"
            disabled={submitting}
            onPress={() => {
              setMode((value) => value === 'sign-in' ? 'sign-up' : 'sign-in');
              setConfirmation('');
              setError(null);
            }}
          />
        </AppCard>
        <AppText variant="caption" tone="secondary">O PIN possui quatro dígitos. O aplicativo nunca salva seu PIN.</AppText>
      </AppScreen>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChangeText, pin = false, ...props }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  pin?: boolean;
  keyboardType?: 'phone-pad';
  autoComplete?: 'tel';
  placeholder?: string;
}) {
  return (
    <View style={styles.field}>
      <AppText variant="label">{label}</AppText>
      <TextInput
        {...props}
        value={value}
        onChangeText={(next) => onChangeText(pin ? next.replace(/\D/g, '').slice(0, 4) : next)}
        keyboardType={pin ? 'number-pad' : props.keyboardType}
        secureTextEntry={pin}
        maxLength={pin ? 4 : 24}
        autoCapitalize="none"
        autoCorrect={false}
        textContentType={pin ? 'password' : 'telephoneNumber'}
        placeholderTextColor={colors.textSecondary}
        style={styles.input}
      />
    </View>
  );
}

function friendlyAuthError(cause: unknown): string {
  if (cause instanceof CredentialsValidationError) return cause.message;
  const message = cause instanceof Error ? cause.message : '';
  if (/invalid login credentials/i.test(message)) return 'Telefone ou PIN incorreto.';
  if (/already registered|already exists/i.test(message)) return 'Este telefone já possui uma conta.';
  if (/network|fetch/i.test(message)) return 'Não foi possível conectar ao Supabase. Confira sua internet.';
  return message || 'Não foi possível autenticar. Tente novamente.';
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  heading: { gap: spacing.sm },
  form: { gap: spacing.lg },
  field: { gap: spacing.sm },
  input: {
    minHeight: sizes.button, borderRadius: radii.md, borderWidth: sizes.border,
    borderColor: colors.border, backgroundColor: colors.surfaceRaised, color: colors.text,
    paddingHorizontal: spacing.lg, ...typography.body,
  },
});
