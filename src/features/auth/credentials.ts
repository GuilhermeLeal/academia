import type { PhonePinCredentials } from './contracts.ts';

export type Sha256Digest = (value: string) => Promise<string>;

export class CredentialsValidationError extends Error {}

export function normalizePhone(value: string): string {
  const trimmed = value.trim();
  const hasPlus = trimmed.startsWith('+');
  let digits = trimmed.replace(/\D/g, '');
  if (!hasPlus && digits.startsWith('00')) digits = digits.slice(2);
  if (!hasPlus && !value.trim().startsWith('00')) {
    if (digits.length === 10 || digits.length === 11) digits = `55${digits}`;
    else if (!(digits.startsWith('55') && (digits.length === 12 || digits.length === 13))) {
      throw new CredentialsValidationError('Informe um telefone brasileiro com DDD ou use o formato internacional com +.');
    }
  }
  if (!/^[1-9]\d{7,14}$/.test(digits)) {
    throw new CredentialsValidationError('Informe um telefone válido no formato internacional.');
  }
  return `+${digits}`;
}

export function validatePin(pin: string): string {
  if (!/^\d{4}$/.test(pin)) throw new CredentialsValidationError('O PIN deve ter exatamente 4 dígitos.');
  return pin;
}

export async function deriveTechnicalPassword(
  credentials: PhonePinCredentials,
  digest: Sha256Digest,
): Promise<{ phone: string; password: string }> {
  const phone = normalizePhone(credentials.phone);
  const pin = validatePin(credentials.pin);
  const hash = await digest(`academia-auth:v1:${phone}:${pin}`);
  return { phone, password: `acad-v1-${hash}` };
}
