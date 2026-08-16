import { createClient } from '@supabase/supabase-js';

const rawSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

const normalizeSupabaseUrl = (value?: string) => {
  if (!value) return null;

  const withoutQuotes = value.replace(/^['"]|['"]$/g, '').trim();
  const withProtocol = withoutQuotes.startsWith('http')
    ? withoutQuotes
    : `https://${withoutQuotes}`;

  try {
    const url = new URL(withProtocol);
    return url.origin;
  } catch {
    return null;
  }
};

const supabaseUrl = normalizeSupabaseUrl(rawSupabaseUrl);

if (!supabaseUrl || !supabaseAnonKey) {
  // App can still run in mock mode while envs are being prepared.
  console.warn('Supabase environment variables are missing or invalid. Falling back to mock mode.');
}

export const supabase = createClient(
  supabaseUrl ?? 'https://placeholder.supabase.co',
  supabaseAnonKey ?? 'placeholder-anon-key'
);
