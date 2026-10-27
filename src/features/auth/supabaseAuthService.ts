import { deriveTechnicalPassword, phoneFromTechnicalEmail } from './credentials.ts';

import type { AuthService, AuthSession, AuthState, PhonePinCredentials } from './contracts.ts';
import type { Sha256Digest } from './credentials.ts';
import type { Database } from '@/services/supabase/database.types';
import type { UserId } from '@/types/identity';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';

type AuthClient = Pick<SupabaseClient<Database>, 'auth'>;

function toAppSession(session: Session): AuthSession {
  return {
    user: {
      id: session.user.id as UserId,
      displayName: displayName(session.user),
      phone: session.user.phone ?? phoneFromTechnicalEmail(session.user.email),
    },
    expiresAt: session.expires_at ?? null,
  };
}

function displayName(user: User): string | null {
  const value = user.user_metadata.display_name;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export class SupabaseAuthService implements AuthService {
  private readonly client: AuthClient;
  private readonly digest: Sha256Digest;

  constructor(client: AuthClient, digest: Sha256Digest) {
    this.client = client;
    this.digest = digest;
  }

  async restoreSession(): Promise<AuthSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return data.session ? toAppSession(data.session) : null;
  }

  async signIn(credentials: PhonePinCredentials): Promise<AuthSession> {
    const { email, password } = await deriveTechnicalPassword(credentials, this.digest);
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (!data.session) throw new Error('O Supabase não iniciou a sessão. Revise a configuração de autenticação por email e senha.');
    return toAppSession(data.session);
  }

  async signUp(credentials: PhonePinCredentials): Promise<AuthSession> {
    const { email, password } = await deriveTechnicalPassword(credentials, this.digest);
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) throw error;
    if (!data.session) {
      throw new Error('O cadastro aguarda confirmação. Desative a confirmação de email no projeto Supabase.');
    }
    return toAppSession(data.session);
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }

  subscribe(listener: (state: AuthState) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      listener(session
        ? { status: 'signed-in', session: toAppSession(session) }
        : { status: 'signed-out' });
    });
    return () => data.subscription.unsubscribe();
  }
}
