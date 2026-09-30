import { supabase } from '../lib/supabase';

export type UserRole = 'dswd_admin' | 'receiver';
export type AccountStatus = 'pending' | 'verified' | 'rejected';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  truckId?: string | null;
  lguName?: string | null;
  walletAddress?: string | null;
  avatarUrl?: string | null;
  createdAt?: string | null;
  status: AccountStatus;
}

export interface SignUpPayload {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  truckId?: string;
  walletAddress?: string;
  status?: AccountStatus;
}

const roleLabels: Record<UserRole, string> = {
  dswd_admin: 'DSWD Admin',
  receiver: 'Receiver'
};

const normalizeRole = (role: unknown): UserRole => (
  role === 'admin' || role === 'dswd_admin' ? 'dswd_admin' : 'receiver'
);

const normalizeStatus = (status: unknown): AccountStatus => {
  if (status === 'pending') return 'pending';
  if (status === 'rejected') return 'rejected';
  return 'verified'; // Existing profiles default to verified
};

const mapProfile = (row: Record<string, unknown>): UserProfile => ({
  id: String(row.id),
  email: String(row.email ?? ''),
  fullName: String(row.full_name ?? ''),
  role: normalizeRole(row.role),
  truckId: row.truck_id ? String(row.truck_id) : null,
  lguName: row.lgu_name ? String(row.lgu_name) : null,
  walletAddress: row.wallet_address ? String(row.wallet_address) : null,
  avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
  createdAt: row.created_at ? String(row.created_at) : null,
  status: normalizeStatus(row.status)
});

export const authApi = {
  roleLabels,

  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (data) {
        const mapped = mapProfile(data);
        if (!mapped.avatarUrl) {
          const { data: userData } = await supabase.auth.getUser();
          if (userData?.user?.user_metadata?.avatar_url) {
            mapped.avatarUrl = String(userData.user.user_metadata.avatar_url);
          }
        }
        return mapped;
      }
    } catch {
      // Ignore if profiles table is not used
    }

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (user && user.id === userId) {
      return {
        id: user.id,
        email: user.email ?? '',
        fullName: user.user_metadata?.full_name || user.email?.split('@')[0] || 'DSWD Officer',
        role: normalizeRole(user.user_metadata?.role),
        truckId: user.user_metadata?.truck_id || null,
        lguName: null,
        walletAddress: user.user_metadata?.wallet_address || null,
        avatarUrl: user.user_metadata?.avatar_url || null,
        createdAt: user.created_at,
        status: normalizeStatus(user.user_metadata?.status)
      };
    }

    return null;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(error.message);
    if (data.user) {
      const profile = await this.getProfile(data.user.id);
      if (profile) {
        if (profile.status === 'pending') {
          await supabase.auth.signOut();
          throw new Error('PENDING_VERIFICATION');
        }
        if (profile.status === 'rejected') {
          await supabase.auth.signOut();
          throw new Error('ACCOUNT_REJECTED');
        }
      }
    }
    return data;
  },

  async isWalletLinked(walletAddress: string, excludeUserId?: string): Promise<boolean> {
    const normalized = walletAddress.trim().toLowerCase();
    if (!normalized) return false;
    let query = supabase
      .from('profiles')
      .select('id')
      .ilike('wallet_address', normalized);

    if (excludeUserId) {
      query = query.neq('id', excludeUserId);
    }

    const { data } = await query.maybeSingle();
    return Boolean(data);
  },

  async signUp(payload: SignUpPayload) {
    const normalizedEmail = payload.email.trim().toLowerCase();

    // 1. Prevent duplicate accounts with the same email
    const { data: existingEmail } = await supabase
      .from('profiles')
      .select('id')
      .ilike('email', normalizedEmail)
      .maybeSingle();

    if (existingEmail) {
      throw new Error('An account with this email address already exists. Please sign in or use a different email.');
    }

    // 2. Prevent linking the same MetaMask wallet to multiple accounts
    if (payload.walletAddress && payload.walletAddress.trim()) {
      const normalizedWallet = payload.walletAddress.trim().toLowerCase();
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('wallet_address', normalizedWallet)
        .maybeSingle();

      if (existing) {
        throw new Error('This MetaMask account has already been linked to another user.');
      }
    }

    // 3. Create the auth user with pending verification status
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: payload.password,
      options: {
        data: {
          full_name: payload.fullName,
          role: payload.role,
          truck_id: payload.role === 'receiver' ? payload.truckId || null : null,
          wallet_address: payload.walletAddress || null,
          lgu_name: null,
          status: 'pending'
        }
      }
    });

    if (error) throw new Error(error.message);

    if (data.user) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: normalizedEmail,
          full_name: payload.fullName,
          role: payload.role,
          truck_id: payload.role === 'receiver' ? payload.truckId || null : null,
          wallet_address: payload.walletAddress || null,
          lgu_name: null,
          status: 'pending'
        });
      } catch (profileError) {
        console.warn('Profile upsert warning:', profileError);
      }
    }

    // 4. Immediately sign out the new user so they do NOT auto-login before admin verification
    try {
      await supabase.auth.signOut();
    } catch {}

    return data;
  },

  async verifyProfile(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'verified' })
      .eq('id', userId);
    if (error) throw new Error(`Failed to verify profile: ${error.message}`);
    return { ok: true };
  },

  async rejectProfile(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ status: 'rejected' })
      .eq('id', userId);
    if (error) throw new Error(`Failed to reject profile: ${error.message}`);
    return { ok: true };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  },

  async getAllProfiles(): Promise<UserProfile[]> {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) {
        console.error('Failed to fetch profiles from Supabase:', error);
        throw error;
      }
      return (data ?? []).map(mapProfile);
    } catch (err) {
      console.warn('Failed to fetch profiles:', err);
      return [];
    }
  },

  async assignProfileLgu(userId: string, lguName: string | null) {
    const { error } = await supabase
      .from('profiles')
      .update({ lgu_name: lguName || null })
      .eq('id', userId);

    if (error) throw new Error(`Failed to assign LGU: ${error.message}`);
    return { ok: true };
  },

  async updateProfileRole(userId: string, role: UserRole) {
    const { error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', userId);

    if (error) throw new Error(`Failed to update role: ${error.message}`);
    return { ok: true };
  },

  async updateProfile(userId: string, updates: { fullName?: string; avatarUrl?: string | null }) {
    // 1. Update Supabase Auth user metadata
    try {
      const metaUpdates: Record<string, unknown> = {};
      if (updates.fullName !== undefined) metaUpdates.full_name = updates.fullName;
      if (updates.avatarUrl !== undefined) metaUpdates.avatar_url = updates.avatarUrl;
      if (Object.keys(metaUpdates).length > 0) {
        await supabase.auth.updateUser({ data: metaUpdates });
      }
    } catch (metaErr) {
      console.warn('Auth user metadata update error:', metaErr);
    }

    // 2. Update public.profiles row
    const profileUpdates: Record<string, unknown> = {};
    if (updates.fullName !== undefined) profileUpdates.full_name = updates.fullName;
    if (updates.avatarUrl !== undefined) profileUpdates.avatar_url = updates.avatarUrl;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: dbErr } = await supabase
        .from('profiles')
        .update(profileUpdates)
        .eq('id', userId);

      if (dbErr) {
        console.error('Database profiles update error:', dbErr);
        throw new Error(`Failed to save profile to database: ${dbErr.message}`);
      }
    }

    return { ok: true };
  },

  async updateWalletAddress(userId: string, walletAddress: string | null) {
    const trimmed = walletAddress?.trim() || null;

    if (trimmed) {
      const normalizedWallet = trimmed.toLowerCase();
      // Check if another profile already has this wallet address
      const { data: existing, error: checkError } = await supabase
        .from('profiles')
        .select('id, email')
        .ilike('wallet_address', normalizedWallet)
        .neq('id', userId)
        .maybeSingle();

      if (checkError) {
        console.warn('Error checking existing wallet:', checkError);
      }

      if (existing) {
        throw new Error('This MetaMask account has already been linked to another user.');
      }
    }

    // 1. Update the profiles table
    const { error } = await supabase
      .from('profiles')
      .update({ wallet_address: trimmed })
      .eq('id', userId);

    if (error) throw new Error(`Failed to update wallet address: ${error.message}`);

    // 2. Update Supabase Auth user metadata
    try {
      await supabase.auth.updateUser({ data: { wallet_address: trimmed } });
    } catch (metaErr) {
      console.warn('Auth metadata wallet update error:', metaErr);
    }

    return { ok: true };
  },

  subscribeProfiles(onChange: () => void) {
    const channel = supabase
      .channel('profiles-db-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, onChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }
};

