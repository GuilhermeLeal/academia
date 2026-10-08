import * as Crypto from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { getSupabaseClient, observeSessionRefresh } from '@/services/supabase/client';

import { SupabaseAuthService } from './supabaseAuthService';

import type { AuthService, AuthSession, AuthState, PhonePinCredentials } from './contracts';
import type { PropsWithChildren } from 'react';

type AuthContextValue = {
  state: AuthState;
  unavailableMessage: string | null;
  signIn: (credentials: PhonePinCredentials) => Promise<void>;
  signUp: (credentials: PhonePinCredentials) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function bootstrapAuthentication() {
  try {
    const client = getSupabaseClient();
    return {
      client,
      unavailableMessage: client
        ? null
        : 'Configure EXPO_PUBLIC_SUPABASE_URL e EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY para entrar.',
    };
  } catch {
    return {
      client: null,
      unavailableMessage: 'A configuração pública do Supabase está ausente ou inválida. Revise o arquivo .env.',
    };
  }
}

async function sha256(value: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [bootstrap] = useState(bootstrapAuthentication);
  const serviceRef = useRef<AuthService | null>(null);
  const [state, setState] = useState<AuthState>(
    bootstrap.client ? { status: 'restoring' } : { status: 'unavailable' },
  );

  useEffect(() => {
    const client = bootstrap.client;
    if (!client) return;
    let active = true;
    const service = new SupabaseAuthService(client, sha256);
    serviceRef.current = service;
    const cleanupRefresh = observeSessionRefresh(client);
    const unsubscribe = service.subscribe((next) => { if (active) setState(next); });
    void service.restoreSession().then(
      (session) => {
        if (active) setState(session ? { status: 'signed-in', session } : { status: 'signed-out' });
      },
      () => {
        if (active) setState({ status: 'signed-out' });
      },
    );
    return () => {
      active = false;
      unsubscribe();
      cleanupRefresh();
      serviceRef.current = null;
    };
  }, [bootstrap.client]);

  const requireService = useCallback(() => {
    const service = serviceRef.current;
    if (!service) throw new Error('O Supabase não está configurado neste aplicativo.');
    return service;
  }, []);

  const finishAuthentication = useCallback((session: AuthSession) => {
    setState({ status: 'signed-in', session });
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    state,
    unavailableMessage: bootstrap.unavailableMessage,
    signIn: async (credentials) => finishAuthentication(await requireService().signIn(credentials)),
    signUp: async (credentials) => finishAuthentication(await requireService().signUp(credentials)),
    signOut: async () => {
      await requireService().signOut();
      setState({ status: 'signed-out' });
    },
  }), [bootstrap.unavailableMessage, finishAuthentication, requireService, state]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider não foi montado.');
  return context;
}

export function useAuthenticatedUser(): AuthSession['user'] {
  const { state } = useAuth();
  if (state.status !== 'signed-in') throw new Error('Esta área exige uma conta autenticada.');
  return state.session.user;
}
