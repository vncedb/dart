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
        // A. Fast Path: Check Local Storage first for immediate UI feedback
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
            // Background verification with DB to ensure local storage isn't stale
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
        } else if (event === 'SIGNED_IN' && session?.user) {
           // On explicit sign-in, check status
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

  // 2. Real-time Database Sync (Optional but good for multi-device sync)
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
        // If DB says incomplete, update state (but be careful of offline mode)
        // For production, if data is successfully fetched and job_title is missing, it IS incomplete.
        if (data && !data.job_title) {
            await setIsOnboarded(false);
        }
      }
    } catch (e) {
      console.log('Error checking onboarding:', e);
    }
  };

  // 4. Navigation Guard (The Gatekeeper)
  useEffect(() => {
    if (isLoading) return;

    // Define Route Groups
    const inAuthGroup = segments[0] === 'auth';
    const inTabsGroup = segments[0] === '(tabs)';
    const inPublicGroup = segments[0] === 'index' || segments[0] === 'recover-account' || segments[0] === 'update-password';
    
    // Explicitly list onboarding routes so we don't redirect users OUT of them
    const inOnboardingFlow = 
        segments[0] === 'introduction' || 
        segments[0] === 'onboarding' || 
        segments[0] === 'job'; // Job selection is part of onboarding

    if (!session) {
      // SCENARIO 1: Not Logged In
      // Prevent access to Tabs or Onboarding (except maybe intro if you want it public, but usually intro is post-signup here)
      if (inTabsGroup || inOnboardingFlow) {
        router.replace('/'); 
      }
    } else {
      // SCENARIO 2: Logged In
      if (isOnboarded) {
        // 2a. Fully Setup -> Should be Home
        // Redirect away from Auth, Public, or Onboarding screens back to Home
        if (inAuthGroup || inPublicGroup || inOnboardingFlow) {
          router.replace('/(tabs)/home');
        }
      } else {
        // 2b. Profile Incomplete -> Must finish Onboarding
        // If they are in Tabs (Home), kick them back to start of flow
        if (inTabsGroup) {
          router.replace('/introduction');
        }
        // If they are in Auth or Index (Public), kick them to start of flow
        if (inAuthGroup || inPublicGroup) {
            router.replace('/introduction');
        }
        // If they are ALREADY in 'introduction', 'onboarding', or 'job', DO NOTHING.
        // Let them navigate strictly within that flow.
      }
    }
  }, [session, isOnboarded, segments, isLoading]);

  return (
    <AuthContext.Provider value={{ session, user, isOnboarded, setIsOnboarded, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};