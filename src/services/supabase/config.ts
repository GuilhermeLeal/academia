export type SupabaseConfiguration =
  | { status: 'unconfigured' }
  | { status: 'invalid' }
  | { status: 'configured'; url: string; publishableKey: string };

export function parseSupabaseConfiguration(urlValue?: string, keyValue?: string): SupabaseConfiguration {
  const url = urlValue?.trim();
  const publishableKey = keyValue?.trim();
  if (!url && !publishableKey) return { status: 'unconfigured' };
  if (!url || !publishableKey || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    return { status: 'invalid' };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
      return { status: 'invalid' };
    }
    return { status: 'configured', url: parsed.origin, publishableKey };
  } catch {
    return { status: 'invalid' };
  }
}

export function getSupabaseConfiguration(): SupabaseConfiguration {
  // Expo only replaces direct EXPO_PUBLIC_* accesses in the app bundle.
  return parseSupabaseConfiguration(
    process.env.EXPO_PUBLIC_SUPABASE_URL,
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
