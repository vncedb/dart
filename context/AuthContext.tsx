import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
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

  // Check Database for 'is_onboarded' flag
  const checkOnboardingStatus = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_onboarded') // Changed from job_title to explicit flag
        .eq('id', userId)
        .single();
        
      if (!error && data?.is_onboarded) {
        await setIsOnboarded(true);
      } else {
        await setIsOnboarded(false);
      }
    } catch (e) {
      console.log('Error checking onboarding:', e);
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

  // Real-time listener for profile updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`public:profiles:${user.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${user.id}` }, 
      (payload) => {
          if (payload.new) {
             setIsOnboarded(!!payload.new.is_onboarded);
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
    const inPublicGroup = segments.length === 0 || segments[0] === 'recover-account' || segments[0] === 'introduction';
    
    // Allowed routes for incomplete profiles (Sign Up Flow)
    const inOnboardingFlow = 
        segments[0] === 'onboarding' || 
        segments[0] === 'job' || 
        segments[0] === 'update-password'; // Allow setting password during onboarding

    if (!session) {
      // Not Logged In: Block access to protected areas
      if (inTabsGroup || inOnboardingFlow) {
        router.replace('/'); 
      }
    } else {
      // Logged In
      if (isOnboarded) {
        // Fully Setup -> Go Home
        if (inAuthGroup || inPublicGroup || inOnboardingFlow) {
          router.replace('/(tabs)/home');
        }
      } else {
        // Profile Incomplete -> Go to Onboarding Welcome
        // Allow them to stay in 'update-password' or 'onboarding' logic
        if (!inOnboardingFlow) {
            router.replace('/onboarding/welcome');
        }
      }
    }
  }, [session, isOnboarded, segments, isLoading, router]);

  return (
    <AuthContext.Provider value={{ session, user, isOnboarded, setIsOnboarded, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};