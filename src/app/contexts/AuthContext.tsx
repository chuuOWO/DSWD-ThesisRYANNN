import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { authApi, UserProfile } from '../services/authApi';

interface AuthContextValue {
  session: Session | null;
  profile: UserProfile | null;
  isLoading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loadProfile = async (nextSession: Session | null) => {
    if (!nextSession?.user) {
      setProfile(null);
      return;
    }

    const nextProfile = await authApi.getProfile(nextSession.user.id);
    setProfile(nextProfile);
  };

  const refreshProfile = async () => {
    await loadProfile(session);
  };

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession()
      .then(async ({ data }) => {
        if (!isMounted) return;
        setSession(data.session);
        await loadProfile(data.session);
      })
      .catch((error) => {
        console.error('Failed to restore auth session', error);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadProfile(nextSession).catch((error) => {
        console.error('Failed to load profile after auth change', error);
        setProfile(null);
      });
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    profile,
    isLoading,
    refreshProfile,
    signOut: authApi.signOut
  }), [session, profile, isLoading]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider.');
  return context;
};
