import type { UserId } from '@/types/identity';

export interface AppUser {
  id: UserId;
  displayName: string | null;
  phone: string | null;
}

export interface PhonePinCredentials {
  phone: string;
  /** Four numeric digits; never persist, log or use directly as a cloud password. */
  pin: string;
}

export interface AuthSession {
  user: AppUser;
  expiresAt: number | null;
}

export type AuthState =
  | { status: 'unavailable' }
  | { status: 'restoring' }
  | { status: 'signed-out' }
  | { status: 'signed-in'; session: AuthSession };

export interface AuthService {
  restoreSession(): Promise<AuthSession | null>;
  signIn(credentials: PhonePinCredentials): Promise<AuthSession>;
  signUp(credentials: PhonePinCredentials): Promise<AuthSession>;
  signOut(): Promise<void>;
  subscribe(listener: (state: AuthState) => void): () => void;
}
