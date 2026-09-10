import { supabase } from '../lib/supabase';

export type UserRole = 'dswd_admin' | 'receiver';

export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  truckId?: string | null;
  lguName?: string | null;
  createdAt?: string | null;
}

export interface SignUpPayload {
  email: string;
  password: string;
  fullName: string;
  role: UserRole;
  truckId?: string;
}

const roleLabels: Record<UserRole, string> = {
  dswd_admin: 'DSWD Admin',
  receiver: 'Receiver'
};

const normalizeRole = (role: unknown): UserRole => (
  role === 'admin' || role === 'dswd_admin' ? 'dswd_admin' : 'receiver'
);

const mapProfile = (row: Record<string, unknown>): UserProfile => ({
  id: String(row.id),
  email: String(row.email ?? ''),
  fullName: String(row.full_name ?? ''),
  role: normalizeRole(row.role),
  truckId: row.truck_id ? String(row.truck_id) : null,
  lguName: row.lgu_name ? String(row.lgu_name) : null,
  createdAt: row.created_at ? String(row.created_at) : null
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

      if (data) return mapProfile(data);
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
        createdAt: user.created_at
      };
    }

    return null;
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    return data;
  },

  async signUp(payload: SignUpPayload) {
    const { data, error } = await supabase.auth.signUp({
      email: payload.email,
      password: payload.password,
      options: {
        data: {
          full_name: payload.fullName,
          role: payload.role,
          truck_id: payload.role === 'receiver' ? payload.truckId || null : null,
          wallet_address: payload.walletAddress || null,
          lgu_name: null
        }
      }
    });

    if (error) throw new Error(error.message);

    if (data.user && data.session) {
      try {
        await supabase.from('profiles').upsert({
          id: data.user.id,
          email: payload.email,
          full_name: payload.fullName,
          role: payload.role,
          truck_id: payload.role === 'receiver' ? payload.truckId || null : null,
          wallet_address: payload.walletAddress || null,
          lgu_name: null
        });
      } catch (profileError) {
        console.warn('Profile upsert warning:', profileError);
      }
    }

    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }
};
