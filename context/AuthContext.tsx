import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { usePathname, useRouter, useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getDB } from '../lib/db-client';
import { supabase } from '../lib/supabase';

type AuthContextType = {
  session: Session | null;
  user: any | null;
  isOnboarded: boolean;
  setIsOnboarded: (value: boolean) => void;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isOnboarded: false,
  setIsOnboarded: () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isOnboarded, _setIsOnboarded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const router = useRouter();
  const segments = useSegments();
  const pathname = usePathname();

  const setIsOnboarded = useCallback(async (value: boolean) => {
    _setIsOnboarded(value);
    try {
      if (value) {
        await AsyncStorage.setItem('isOnboarded', 'true');
      } else {
        await AsyncStorage.removeItem('isOnboarded');
      }
    } catch (error) {
      console.error('Failed to persist onboarding state:', error);
    }
  }, []);

  const checkOnboardingStatus = useCallback(async (userId: string) => {
    try {
      const db = await getDB();
      
      // 1. Check Local DB first (Faster & Offline friendly)
      const localProfile: any = await db.getFirstAsync('SELECT is_onboarded FROM profiles WHERE id = ?', [userId]);
      if (localProfile) {
        await setIsOnboarded(!!localProfile.is_onboarded);
      }

      // 2. Check Supabase (Source of Truth)
      const { data, error } = await supabase
        .from('profiles')
        .select('is_onboarded')
        .eq('id', userId)
        .single();
        
      if (!error && data) {
        const serverStatus = !!data.is_onboarded;
        await setIsOnboarded(serverStatus);
        
        // 3. Update Local DB to match server
        await db.runAsync('UPDATE profiles SET is_onboarded = ? WHERE id = ?', [serverStatus ? 1 : 0, userId]);
      } 
    } catch (e) {
      console.log('Error checking onboarding (falling back to local):', e);
    }
  }, [setIsOnboarded]);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const localOnboarding = await AsyncStorage.getItem('isOnboarded');
        if (mounted && localOnboarding === 'true') {
          _setIsOnboarded(true);
        }

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          if (currentSession?.user) {
            checkOnboardingStatus(currentSession.user.id);
          }
        }
      } catch (error) {
        console.error('Auth Init Error:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_OUT') {
          await setIsOnboarded(false);
          setIsLoading(false);
        } else if (event === 'SIGNED_IN' && session?.user) {
          await checkOnboardingStatus(session.user.id);
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [setIsOnboarded, checkOnboardingStatus]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`public:profiles:${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, 
      async (payload) => {
          if (payload.new) {
             const newVal = !!payload.new.is_onboarded;
             setIsOnboarded(newVal);
             try {
                const db = await getDB();
                await db.runAsync('UPDATE profiles SET is_onboarded = ? WHERE id = ?', [newVal ? 1 : 0, user.id]);
             } catch(e) { console.error("Realtime update local db error:", e); }
          }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, setIsOnboarded]);

  // --- NAVIGATION GUARD ---
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inTabsGroup = segments[0] === '(tabs)';
    
    // "Strict" Onboarding is ONLY the initial setup screens.
    // We REMOVE 'job' from here because 'job' is used by both new users (setup) and existing users (managing jobs).
    const inStrictOnboarding = segments[0] === 'onboarding'; 
    const inJobRoute = segments[0] === 'job';

    const isPasswordResetFlow = pathname.includes('update-password') || pathname.includes('forgot-password');
    
    // FIX: Explicitly cast 'segments' to 'string[]' to resolve the TS error
    const isRootIndex = (segments as string[]).length === 0;

    if (!session) {
      // Not Logged In
      // Allow auth routes, password reset, and root
      // Redirect if user tries to access tabs, job pages, or strict onboarding without being logged in
      if (inTabsGroup || (inStrictOnboarding && !isPasswordResetFlow) || inJobRoute) {
        router.replace('/'); 
      }
    } else {
      // Logged In
      if (isPasswordResetFlow) return;

      if (isOnboarded) {
        // Fully Setup -> Go Home
        // Redirect ONLY if trying to access Auth, Introduction, or STRICT Onboarding (welcome/info)
        // We explicitly ALLOW 'job' and '(tabs)' here.
        if (inAuthGroup || segments[0] === 'introduction' || inStrictOnboarding || isRootIndex) {
          router.replace('/(tabs)/home');
        }
      } else {
        // Profile Incomplete -> Go to Onboarding
        // Allow access to 'onboarding' AND 'job' (to create first job)
        if (!inStrictOnboarding && !inJobRoute) {
            router.replace('/onboarding/welcome');
        }
      }
    }
  }, [session, isOnboarded, segments, isLoading, router, pathname]);

  return (
    <AuthContext.Provider value={{ session, user, isOnboarded, setIsOnboarded, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};