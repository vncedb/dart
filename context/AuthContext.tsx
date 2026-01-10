import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import React, { createContext, useContext, useEffect, useState } from 'react';
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

  // Helper to update state AND local storage
  const setIsOnboarded = async (value: boolean) => {
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
  };

  // 1. Initialize Session & Check Profile
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // A. Fast Path: Check Local Storage first
        const localOnboarding = await AsyncStorage.getItem('isOnboarded');
        if (mounted && localOnboarding === 'true') {
          _setIsOnboarded(true);
        }

        // B. Check Supabase Session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          setSession(currentSession);
          setUser(currentSession?.user ?? null);

          if (currentSession?.user) {
            // Background verification with DB
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

    // Listen for Auth Changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);

        if (event === 'SIGNED_OUT') {
          await setIsOnboarded(false);
          setIsLoading(false);
        } else if (session?.user) {
          await checkOnboardingStatus(session.user.id);
          setIsLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // 2. Real-time Database Sync
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`public:profiles:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new) {
             const hasJob = !!payload.new.job_title;
             setIsOnboarded(hasJob);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  // 3. Helper: Check Database
  const checkOnboardingStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('job_title')
        .eq('id', userId)
        .single();
        
      if (!error && data && data.job_title) {
        await setIsOnboarded(true);
      } else {
        // Only force false if we are sure (optional: might want to keep true if offline)
         // await setIsOnboarded(false); 
      }
    } catch (e) {
      console.log('Error checking onboarding:', e);
      // Do not overwrite local true state on error to prevent blocking offline users
    }
  };

  // 4. Navigation Guard
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(tabs)';
    const inPublicGroup = segments[0] === 'auth' || segments[0] === 'index' || segments[0] === 'recover-account' || segments[0] === 'update-password';
    const inOnboardingGroup = segments[0] === 'introduction' || segments[0] === 'onboarding';

    if (!session) {
      // User NOT logged in
      if (inAuthGroup || inOnboardingGroup) {
        router.replace('/'); 
      }
    } else {
      // User IS logged in
      if (isOnboarded) {
        // Fully Setup -> Go Home
        if (inPublicGroup || inOnboardingGroup) {
          router.replace('/(tabs)/home');
        }
      } else {
        // Logged in but missing Job Info -> Force Onboarding Info (NOT Introduction)
        if (inAuthGroup || (segments[0] === 'index') || (segments[0] === 'introduction')) {
          router.replace('/onboarding/info');
        }
      }
    }
  }, [session, isOnboarded, segments, isLoading]);

  return (
    <AuthContext.Provider value={{ session, user, isOnboarded, setIsOnboarded, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};