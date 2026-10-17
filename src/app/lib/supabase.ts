import { createClient } from '@supabase/supabase-js';

const env: any = (typeof import.meta !== 'undefined' && (import.meta as any).env) || (typeof process !== 'undefined' && process.env) || {};

const rawSupabaseUrl = (
  env.VITE_SUPABASE_URL ||
  env.NEXT_PUBLIC_SUPABASE_URL
)?.trim();

const supabaseAnonKey = (
  env.VITE_SUPABASE_ANON_KEY ||
  env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
)?.trim();

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
  throw new Error('Missing VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
