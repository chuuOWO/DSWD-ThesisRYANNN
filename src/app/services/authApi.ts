import { supabase } from '../lib/supabase';
import { createAndEncryptCustodialWallet } from '../lib/cryptoWallet';

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
  encryptedPrivateKey?: string | null;
  keyIv?: string | null;
  keyAuthTag?: string | null;
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
  encryptedPrivateKey: row.encrypted_private_key ? String(row.encrypted_private_key) : null,
  keyIv: row.key_iv ? String(row.key_iv) : null,
  keyAuthTag: row.key_auth_tag ? String(row.key_auth_tag) : null,
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
        createdAt: user.created_at
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

    // Auto-provision custodial wallet for field workers (receivers / drivers / LGU receivers)
    let finalWalletAddress = payload.walletAddress || null;
    let encryptedKey: string | null = null;
    let keyIv: string | null = null;
    let keyAuthTag: string | null = null;

    if (payload.role === 'receiver') {
      try {
        const custodial = await createAndEncryptCustodialWallet();
        finalWalletAddress = custodial.walletAddress;
        encryptedKey = custodial.encryptedPrivateKey;
        keyIv = custodial.keyIv;
        keyAuthTag = custodial.keyAuthTag;
      } catch (custodialErr) {
        console.warn('Failed to auto-provision custodial wallet during signup:', custodialErr);
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
          wallet_address: finalWalletAddress,
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
          wallet_address: finalWalletAddress,
          encrypted_private_key: encryptedKey,
          key_iv: keyIv,
          key_auth_tag: keyAuthTag,
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

  async provisionCustodialWallet(userId: string): Promise<UserProfile> {
    const custodial = await createAndEncryptCustodialWallet();
    const { data, error } = await supabase
      .from('profiles')
      .update({
        wallet_address: custodial.walletAddress,
        encrypted_private_key: custodial.encryptedPrivateKey,
        key_iv: custodial.keyIv,
        key_auth_tag: custodial.keyAuthTag
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to provision custodial wallet: ${error.message}`);
    return mapProfile(data);
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

  async updateProfile(userId: string, updates: {
    fullName?: string;
    email?: string;
    avatarUrl?: string | null;
    truckId?: string | null;
    needsAdminVerification?: boolean;
  }) {
    const trimmedEmail = updates.email?.trim().toLowerCase();

    // 1. If email is changing, verify it is not taken by another user
    if (trimmedEmail) {
      const { data: existing } = await supabase
        .from('profiles')
        .select('id, email')
        .ilike('email', trimmedEmail)
        .neq('id', userId)
        .maybeSingle();

      if (existing) {
        throw new Error('This email address is already in use by another account.');
      }

      // Update Supabase Auth user email and metadata
      try {
        await supabase.auth.updateUser({
          email: trimmedEmail,
          data: {
            full_name: updates.fullName,
            truck_id: updates.truckId
          }
        });
      } catch (authErr: any) {
        console.warn('Auth email update warning:', authErr);
      }
    } else if (updates.fullName !== undefined || updates.avatarUrl !== undefined || updates.truckId !== undefined) {
      try {
        const metaUpdates: Record<string, unknown> = {};
        if (updates.fullName !== undefined) metaUpdates.full_name = updates.fullName;
        if (updates.avatarUrl !== undefined) metaUpdates.avatar_url = updates.avatarUrl;
        if (updates.truckId !== undefined) metaUpdates.truck_id = updates.truckId;
        await supabase.auth.updateUser({ data: metaUpdates });
      } catch (metaErr) {
        console.warn('Auth user metadata update error:', metaErr);
      }
    }

    // 2. Update public.profiles row
    const profileUpdates: Record<string, unknown> = {};
    if (updates.fullName !== undefined) profileUpdates.full_name = updates.fullName.trim();
    if (trimmedEmail) profileUpdates.email = trimmedEmail;
    if (updates.avatarUrl !== undefined) profileUpdates.avatar_url = updates.avatarUrl;
    if (updates.truckId !== undefined) profileUpdates.truck_id = updates.truckId ? updates.truckId.trim() : null;

    // If marked for re-verification, reset status to 'pending' so Main Admin must verify
    if (updates.needsAdminVerification) {
      profileUpdates.status = 'pending';
    }

    const { error: dbErr } = await supabase
      .from('profiles')
      .update(profileUpdates)
      .eq('id', userId);

    if (dbErr) {
      throw new Error(`Failed to update profile: ${dbErr.message}`);
    }

    return { ok: true, requiresVerification: Boolean(updates.needsAdminVerification) };
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

