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
  role === 'dswd_admin' ? 'dswd_admin' : 'receiver'
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
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw new Error(`Failed to load user profile: ${error.message}`);
    return data ? mapProfile(data) : null;
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
          lgu_name: null
        }
      }
    });

    if (error) throw new Error(error.message);

    if (data.user && data.session) {
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        email: payload.email,
        full_name: payload.fullName,
        role: payload.role,
        truck_id: payload.role === 'receiver' ? payload.truckId || null : null,
        lgu_name: null
      });

      if (profileError) throw new Error(`Account created, but profile save failed: ${profileError.message}`);
    }

    return data;
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }
};
