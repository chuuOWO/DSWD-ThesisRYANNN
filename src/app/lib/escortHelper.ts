import { supabase } from './supabase';

export interface EscortLookupProfile {
  id: string;
  fullName: string;
  email?: string;
  role?: string;
  phone?: string;
  truckId?: string;
}

const KNOWN_ESCORTS: Record<string, string> = {
  '27a1b935-4448-4692-9336-e6a6b6de7d30': 'Rover Rover',
  '8d0b5e27-4a1c-42b5-aa1f-7e39d272c0f6': 'John Mayhem',
  'fa1b1b22-c9ee-4f49-a13c-f0a8ecefc7c3': 'Jane Doe',
  'c1ad582e-d999-43d0-a6ef-216e3befe29b': 'Ryan Lawrence',
  '0a4c9760-32da-4571-8d8e-5f7ccf30b41f': 'Admin Test',
  '0a2570bf-2831-4096-a131-e4883353f8a8': 'Clean Escort',
  '233b1152-68f9-4238-b654-fd2782a4c7e9': 'Test Officer',
  'a3c241e6-dbeb-4e7c-94c7-f7bf7afbbc71': 'Pavia Guy',
  '0b6ca448-0ad5-4be2-b1d4-aec59068208d': 'Neil Vergara',
  '050041dc-3a41-46af-b557-12dd895caeda': 'John Admin',
  'b2c3222d-3876-4f95-8b08-466034c6c8f4': 'Joe Bone',
  'c8b17207-d7b8-4fea-bfe7-6faa93d5522e': 'Juan Dcruz',
  '7b599829-dc73-4c2c-9e00-c2572302826f': 'James Harden',
  'escort-01': 'Officer Mark Santos (Lead Escort)',
  'escort-02': 'Officer Carlos Reyes (Convoy Escort)',
  'escort-03': 'Officer Maria Elena Gomez (Field Escort)',
  'escort-04': 'Officer Roberto Tan (Preposition Escort)'
};

const escortCache: Map<string, string> = new Map(Object.entries(KNOWN_ESCORTS));
const inflightLookups: Set<string> = new Set();

export function isUuid(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str.trim());
}

export function registerEscortProfiles(
  profiles: Array<{ id: string; fullName?: string; first_name?: string; last_name?: string; email?: string }>
): void {
  for (const p of profiles) {
    if (!p.id) continue;
    const name = p.fullName || `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email;
    if (name) {
      escortCache.set(p.id, name);
    }
  }
}

async function fetchEscortProfileAsync(raw: string): Promise<void> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, email')
      .eq('id', raw)
      .maybeSingle();

    if (data) {
      const resolvedName =
        `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email || 'Relief Escort Officer';
      escortCache.set(raw, resolvedName);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('escort-profile-resolved', { detail: { id: raw, name: resolvedName } }));
      }
    }
  } catch {
    // Ignore network/lookup errors in background
  }
}

export function resolveEscortName(
  idOrName?: string | null,
  profilesList?: Array<{ id: string; fullName?: string; email?: string }>
): string {
  if (!idOrName || !idOrName.trim()) {
    return 'Not assigned';
  }

  const raw = idOrName.trim();

  // 1. Check passed profilesList
  if (profilesList && profilesList.length > 0) {
    const matched = profilesList.find((p) => p.id === raw || p.fullName === raw || p.email === raw);
    if (matched && (matched.fullName || matched.email)) {
      const name = (matched.fullName || matched.email)!.trim();
      escortCache.set(raw, name);
      return name;
    }
  }

  // 2. Check memory cache
  if (escortCache.has(raw)) {
    return escortCache.get(raw)!;
  }

  // 3. If raw string is not a UUID, it's already a human name
  if (!isUuid(raw)) {
    return raw;
  }

  // 4. It is a UUID and not yet in cache -> trigger background lookup
  if (!inflightLookups.has(raw)) {
    inflightLookups.add(raw);
    void fetchEscortProfileAsync(raw);
  }

  return 'Relief Escort Officer';
}

