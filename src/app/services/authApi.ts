import { supabase } from '../lib/supabase';
import { formatUserErrorMessage } from '../lib/errorUtils';
import { backendApi } from './backendApi';
import { provisionSmartAccountAddress } from './embeddedWallet';

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

  async getProfile(userId?: string | null, email?: string | null): Promise<UserProfile | null> {
    try {
      const cleanEmail = email?.trim().toLowerCase();

      // 1. Direct query by userId if provided
      if (userId) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        if (data) {
          if (!data.wallet_address && (data.id || userId)) {
            try {
              const targetId = String(data.id || userId);
              const targetEmail = String(data.email || cleanEmail || '');
              const autoWallet = await provisionSmartAccountAddress(targetId, targetEmail);
              if (autoWallet) {
                await supabase.from('profiles').update({ wallet_address: autoWallet }).eq('id', targetId);
                data.wallet_address = autoWallet;
              }
            } catch (autoErr) {
              console.warn('Auto provision Sepolia wallet warning:', autoErr);
            }
          }
          return mapProfile(data);
        }
      }

      // 2. Query by email if provided
      if (cleanEmail) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .ilike('email', cleanEmail)
          .maybeSingle();

        if (data) {
          if (!data.wallet_address && data.id) {
            try {
              const autoWallet = await provisionSmartAccountAddress(String(data.id), String(data.email || cleanEmail));
              if (autoWallet) {
                await supabase.from('profiles').update({ wallet_address: autoWallet }).eq('id', data.id);
                data.wallet_address = autoWallet;
              }
            } catch (autoErr) {
              console.warn('Auto provision Sepolia wallet warning:', autoErr);
            }
          }
          return mapProfile(data);
        }
      }

      // 3. Fallback to Supabase Auth user session details
      const { data: authData } = await supabase.auth.getUser();
      const authUser = authData?.user;
      if (authUser) {
        if (authUser.id && authUser.id !== userId) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', authUser.id)
            .maybeSingle();
          if (data) return mapProfile(data);
        }

        const authEmail = authUser.email?.trim().toLowerCase();
        if (authEmail && authEmail !== cleanEmail) {
          const { data } = await supabase
            .from('profiles')
            .select('*')
            .ilike('email', authEmail)
            .maybeSingle();
          if (data) return mapProfile(data);
        }

        // 4. If user exists in Auth but is missing profile row in public.profiles (e.g. legacy/reset), auto-provision row
        const meta = authUser.user_metadata || {};
        const metaRole = normalizeRole(meta.role);
        const metaStatus = metaRole === 'dswd_admin' ? 'verified' : normalizeStatus(meta.status);
        const targetEmail = (authUser.email || cleanEmail || '').trim().toLowerCase();
        const fullName = meta.full_name || `${meta.first_name || ''} ${meta.last_name || ''}`.trim() || targetEmail;

        const { data: created } = await supabase
          .from('profiles')
          .upsert({
            id: authUser.id,
            email: targetEmail,
            full_name: fullName,
            first_name: meta.first_name || '',
            last_name: meta.last_name || '',
            phone_number: meta.phone_number || '',
            job_position: meta.job_position || '',
            work_id_url: meta.work_id_url || null,
            role: metaRole,
            truck_id: metaRole === 'receiver' ? meta.truck_id || null : null,
            wallet_address: meta.wallet_address || null,
            status: metaStatus
          })
          .select()
          .maybeSingle();

        if (created) {
          return mapProfile(created);
        }
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
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password });
    if (error) throw new Error(formatUserErrorMessage(error));

    if (data.user) {
      // Find user profile by user ID or email
      const profile = await this.getProfile(data.user.id, data.user.email || cleanEmail);

      if (profile) {
        if (profile.status === 'rejected') {
          await supabase.auth.signOut();
          throw new Error('ACCOUNT_REJECTED');
        }

        // Only block unverified accounts if strictly pending and not an administrator
        if (profile.role !== 'dswd_admin' && profile.status === 'pending') {
          await supabase.auth.signOut();
          throw new Error('ACCOUNT_PENDING');
        }
      } else {
        // Fallback to checking the database profiles table status by email
        const status = await this.checkProfileStatusByEmail(cleanEmail);
        if (status === 'rejected') {
          await supabase.auth.signOut();
          throw new Error('ACCOUNT_REJECTED');
        }
        if (status === 'pending') {
          await supabase.auth.signOut();
          throw new Error('ACCOUNT_PENDING');
        }
      }

      backendApi.logActivity({
        actorId: data.user.id,
        actorName: profile?.fullName || data.user.user_metadata?.full_name || cleanEmail,
        actorEmail: cleanEmail,
        actorRole: profile?.role || data.user.user_metadata?.role || 'user',
        actorWallet: profile?.walletAddress || data.user.user_metadata?.wallet_address || undefined,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: data.user.id,
        details: `User ${profile?.fullName || cleanEmail} logged into the system.`
      }).catch(() => {});
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

    // 2. Prevent linking the same Smart Account address to multiple accounts
    if (payload.walletAddress && payload.walletAddress.trim()) {
      const normalizedWallet = payload.walletAddress.trim().toLowerCase();
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .ilike('wallet_address', normalizedWallet)
        .maybeSingle();

      if (existing) {
        throw new Error('This Smart Account address has already been bound to another user.');
      }
    }

    // 3. Create the auth user with pending verification status
    // CRITICAL: NEVER pass workIdUrl (base64 image) into auth user_metadata!
    // Supabase embeds user_metadata into the JWT access token, and a 70KB header exceeds Cloudflare's HTTP header limit (causing HTTP 520 / 431).
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
      let finalWallet = payload.walletAddress || null;
      if (!finalWallet) {
        try {
          finalWallet = await provisionSmartAccountAddress(data.user.id, normalizedEmail);
        } catch (walletErr) {
          console.warn('Auto-provisioning Sepolia wallet error:', walletErr);
        }
      }

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
          wallet_address: finalWallet,
          lgu_name: null,
          status: 'pending'
        });
      } catch (profileError) {
        console.warn('Profile upsert warning:', profileError);
      }

      backendApi.logActivity({
        actorId: data.user.id,
        actorName: computedFullName,
        actorEmail: normalizedEmail,
        actorRole: payload.role,
        actorWallet: payload.walletAddress || undefined,
        action: 'USER_SIGNUP',
        entityType: 'User',
        entityId: data.user.id,
        details: `Account registration application submitted for ${computedFullName} (${payload.role === 'dswd_admin' ? 'DSWD Admin' : 'Receiver'}).`,
        metadata: {
          role: payload.role,
          jobPosition: payload.jobPosition,
          truckId: payload.truckId
        }
      }).catch(() => {});
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
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('truck_id, wallet_address')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.truck_id) {
        await supabase
          .from('truck_live_locations')
          .delete()
          .ilike('truck_id', profile.truck_id.trim());
      }
      if (profile?.wallet_address) {
        await supabase
          .from('truck_live_locations')
          .delete()
          .ilike('wallet_address', profile.wallet_address.trim());
      }
    } catch (cleanupErr) {
      console.warn('Failed to clean up associated truck live location on reject:', cleanupErr);
    }

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
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('truck_id, wallet_address')
        .eq('id', userId)
        .maybeSingle();

      if (profile?.truck_id) {
        await supabase
          .from('truck_live_locations')
          .delete()
          .ilike('truck_id', profile.truck_id.trim());
      }
      if (profile?.wallet_address) {
        await supabase
          .from('truck_live_locations')
          .delete()
          .ilike('wallet_address', profile.wallet_address.trim());
      }
    } catch (cleanupErr) {
      console.warn('Failed to clean up associated truck live location on delete:', cleanupErr);
    }

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
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, role, wallet_address')
          .eq('id', user.id)
          .maybeSingle();

        await backendApi.logActivity({
          actorId: user.id,
          actorName: profile?.full_name || user.user_metadata?.full_name || user.email || 'User',
          actorEmail: user.email || 'user@dswd.gov.ph',
          actorRole: profile?.role || user.user_metadata?.role || 'user',
          actorWallet: profile?.wallet_address || user.user_metadata?.wallet_address || undefined,
          action: 'USER_LOGOUT',
          entityType: 'User',
          entityId: user.id,
          details: `User ${profile?.full_name || user.user_metadata?.full_name || user.email} signed out of the system.`
        });
      }
    } catch (logErr) {
      console.warn('Could not log logout activity:', logErr);
    }

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

      backendApi.logActivity({
        actorId: userId,
        action: updates.avatarUrl !== undefined && Object.keys(updates).length === 1 ? 'UPDATE_AVATAR' : 'UPDATE_PROFILE',
        entityType: 'User',
        entityId: userId,
        details: updates.avatarUrl !== undefined && Object.keys(updates).length === 1
          ? 'Updated account profile avatar image.'
          : `Updated account profile information (${Object.keys(updates).join(', ')}).`,
        metadata: updates
      }).catch(() => {});
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
        throw new Error('This Smart Account address has already been bound to another user.');
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

    backendApi.logActivity({
      actorId: userId,
      actorWallet: trimmed || undefined,
      action: 'PROVISION_SMART_ACCOUNT',
      entityType: 'User',
      entityId: userId,
      details: trimmed
        ? `Bound gasless smart account ${trimmed} to user identity.`
        : 'Unlinked smart account address from user profile.',
      metadata: { walletAddress: trimmed }
    }).catch(() => {});

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

