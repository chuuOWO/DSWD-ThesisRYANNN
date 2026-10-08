import { supabase } from '../lib/supabase';
import { formatUserErrorMessage } from '../lib/errorUtils';

export type UserRole = 'dswd_admin' | 'receiver';
export type AccountStatus = 'pending' | 'verified' | 'rejected';

export interface UserProfile {
  id: string;
  officialId?: string | null;
  email: string;
  fullName: string;
  firstName?: string | null;
  lastName?: string | null;
  phoneNumber?: string | null;
  jobPosition?: string | null;
  workIdUrl?: string | null;
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
  fullName?: string;
  officialId?: string;
  firstName: string;
  lastName: string;
  phoneNumber?: string;
  jobPosition?: string;
  workIdUrl?: string;
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
  const s = String(status || '').trim().toLowerCase();
  if (s === 'verified' || s === 'approved' || s === 'active' || s === 'confirmed') return 'verified';
  if (s === 'rejected' || s === 'declined' || s === 'disabled') return 'rejected';
  return 'pending';
};

const mapProfile = (row: Record<string, unknown>): UserProfile => {
  const fName = row.first_name ? String(row.first_name) : null;
  const lName = row.last_name ? String(row.last_name) : null;
  const computedFullName = (fName || lName) ? `${fName || ''} ${lName || ''}`.trim() : '';
  const resolvedRole = normalizeRole(row.role);
  const resolvedStatus = resolvedRole === 'dswd_admin' ? 'verified' : normalizeStatus(row.status);

  return {
    id: String(row.id),
    officialId: row.official_id ? String(row.official_id) : null,
    email: String(row.email ?? ''),
    fullName: String(row.full_name || computedFullName || ''),
    firstName: fName,
    lastName: lName,
    phoneNumber: row.phone_number ? String(row.phone_number) : null,
    jobPosition: row.job_position ? String(row.job_position) : null,
    workIdUrl: row.work_id_url ? String(row.work_id_url) : null,
    role: resolvedRole,
    truckId: row.truck_id ? String(row.truck_id) : null,
    lguName: row.lgu_name ? String(row.lgu_name) : null,
    walletAddress: row.wallet_address ? String(row.wallet_address) : null,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : null,
    createdAt: row.created_at ? String(row.created_at) : null,
    status: resolvedStatus
  };
};

export const authApi = {
  roleLabels,

  async changePassword(newPassword: string) {
    const { data, error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message);
    return data;
  },

  async getProfile(userId: string): Promise<UserProfile | null> {
    try {
      let { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!data) {
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user?.email) {
          const res = await supabase
            .from('profiles')
            .select('*')
            .ilike('email', userData.user.email)
            .maybeSingle();
          data = res.data;
        }
      }

      if (data) {
        return mapProfile(data);
      }
    } catch (err) {
      console.warn('getProfile error:', err);
    }

    return null;
  },

  async checkProfileStatusByEmail(email: string): Promise<AccountStatus | null> {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('status')
        .ilike('email', email.trim())
        .maybeSingle();
      if (!data) return null;
      return normalizeStatus(data.status);
    } catch {
      return null;
    }
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(formatUserErrorMessage(error));
    if (data.user) {
      const profile = await this.getProfile(data.user.id);
      if (profile) {
        if (profile.status === 'rejected') {
          await supabase.auth.signOut();
          throw new Error('ACCOUNT_REJECTED');
        }
        if (profile.role !== 'dswd_admin' && profile.status !== 'verified') {
          await supabase.auth.signOut();
          throw new Error('ACCOUNT_PENDING');
        }
      } else {
        const { data: rawProfile } = await supabase
          .from('profiles')
          .select('role, status')
          .eq('id', data.user.id)
          .maybeSingle();

        if (rawProfile) {
          if (rawProfile.status === 'rejected') {
            await supabase.auth.signOut();
            throw new Error('ACCOUNT_REJECTED');
          }
          if (rawProfile.role !== 'dswd_admin' && rawProfile.status !== 'verified') {
            await supabase.auth.signOut();
            throw new Error('ACCOUNT_PENDING');
          }
        } else {
          await supabase.auth.signOut();
          throw new Error('ACCOUNT_PENDING');
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
    const computedFullName = payload.fullName || `${payload.firstName || ''} ${payload.lastName || ''}`.trim() || 'DSWD Officer';

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
          full_name: computedFullName,
          first_name: payload.firstName,
          last_name: payload.lastName,
          phone_number: payload.phoneNumber || null,
          job_position: payload.jobPosition || null,
          work_id_url: payload.workIdUrl || null,
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
          full_name: computedFullName,
          first_name: payload.firstName,
          last_name: payload.lastName,
          phone_number: payload.phoneNumber || null,
          job_position: payload.jobPosition || null,
          work_id_url: payload.workIdUrl || null,
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

    // Sign out newly created user so they return cleanly to the login screen awaiting admin verification
    try {
      await supabase.auth.signOut();
    } catch {}

    return data;
  },

  async verifyProfile(userId: string) {
    const { error } = await supabase.rpc('admin_verify_profile', { target_user_id: userId });
    if (error) {
      const { error: directError } = await supabase
        .from('profiles')
        .update({ status: 'verified' })
        .eq('id', userId);
      if (directError) throw new Error(`Failed to verify profile: ${error.message || directError.message}`);
    }
    return { ok: true };
  },

  async rejectProfile(userId: string) {
    const { error } = await supabase.rpc('admin_delete_profile', { target_user_id: userId });
    if (error) {
      const { error: directError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      if (directError) throw new Error(`Failed to decline profile: ${error.message || directError.message}`);
    }
    return { ok: true };
  },

  async deleteProfile(userId: string) {
    const { error } = await supabase.rpc('admin_delete_profile', { target_user_id: userId });
    if (error) {
      const { error: directError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      if (directError) throw new Error(`Failed to delete account: ${error.message || directError.message}`);
    }
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
    firstName?: string;
    lastName?: string;
    phoneNumber?: string;
    jobPosition?: string;
    avatarUrl?: string | null;
  }) {
    // 1. Update Supabase Auth user metadata
    try {
      const metaUpdates: Record<string, unknown> = {};
      if (updates.fullName !== undefined) metaUpdates.full_name = updates.fullName;
      if (updates.firstName !== undefined) metaUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) metaUpdates.last_name = updates.lastName;
      if (updates.phoneNumber !== undefined) metaUpdates.phone_number = updates.phoneNumber;
      if (updates.jobPosition !== undefined) metaUpdates.job_position = updates.jobPosition;
      if (updates.avatarUrl !== undefined) metaUpdates.avatar_url = updates.avatarUrl;
      if (Object.keys(metaUpdates).length > 0) {
        await supabase.auth.updateUser({ data: metaUpdates });
      }
    } catch (metaErr) {
      console.warn('Auth user metadata update error:', metaErr);
    }

    // 2. Update public.profiles row
    try {
      const profileUpdates: Record<string, unknown> = {};
      if (updates.fullName !== undefined) profileUpdates.full_name = updates.fullName;
      if (updates.firstName !== undefined) profileUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) profileUpdates.last_name = updates.lastName;
      if (updates.phoneNumber !== undefined) profileUpdates.phone_number = updates.phoneNumber;
      if (updates.jobPosition !== undefined) profileUpdates.job_position = updates.jobPosition;
      if (updates.avatarUrl !== undefined) profileUpdates.avatar_url = updates.avatarUrl;
      if (Object.keys(profileUpdates).length > 0) {
        await supabase.from('profiles').update(profileUpdates).eq('id', userId);
      }
    } catch (dbErr) {
      console.warn('Database profiles update error:', dbErr);
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

