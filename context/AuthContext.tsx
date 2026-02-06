// AuthContext with Biometric Reset on SignOut
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import { useRouter } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const ONBOARDED_KEY = 'isOnboarded';
const APP_SETTINGS_KEY = 'appSettings';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isOnboarded: boolean;
  isLoading: boolean;
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isOnboarded: false,
  isLoading: true,
  completeOnboarding: async () => {},
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const router = useRouter();

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
      setIsOnboarded(true);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Sign out from Supabase
      await supabase.auth.signOut();
      
      // 2. Reset Local State
      setSession(null);
      setUser(null);
      
      // 3. Disable Biometric Unlock in Settings (Reset to Off)
      const storedSettings = await AsyncStorage.getItem(APP_SETTINGS_KEY);
      if (storedSettings) {
          const parsed = JSON.parse(storedSettings);
          parsed.biometricEnabled = false; // Force disable
          await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(parsed));
      }

    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const localOnboarding = await AsyncStorage.getItem(ONBOARDED_KEY);
        if (mounted && localOnboarding === 'true') {
          setIsOnboarded(true);
        }

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (currentSession?.user) {
            setSession(currentSession);
            setUser(currentSession.user);
          }
        }
      } catch (error) {
        console.error('Auth Init Error:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;

      if (event === 'SIGNED_IN' && newSession?.user) {
        setSession(newSession);
        setUser(newSession.user);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, user, isOnboarded, completeOnboarding, signOut, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};