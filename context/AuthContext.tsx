import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import { useRouter, useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getDB } from '../lib/db-client';
import { supabase } from '../lib/supabase';
import { clearAttendanceNotification } from '../utils/NotificationService';

const ONBOARDED_KEY = 'isOnboarded';
const APP_SETTINGS_KEY = 'appSettings';

type AuthContextType = {
  session: Session | null;
  user: User | null;
  isOnboarded: boolean;
  isLoading: boolean;
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isOnboarded: false,
  isLoading: true,
  completeOnboarding: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const segments = useSegments();
  const router = useRouter();

  // [FIX] Improved Onboarding Check: Local DB -> Fallback to Supabase -> Sync
  const checkOnboardingStatus = async (userId: string): Promise<boolean> => {
      try {
          const db = await getDB();
          
          // 1. Check Local DB
          const localProfile: any = await db.getFirstAsync(
              'SELECT is_onboarded FROM profiles WHERE id = ?', 
              [userId]
          );

          if (localProfile) {
              // If we have a local record that says TRUE, trust it.
              if (localProfile.is_onboarded) return true;
          }

          // 2. Fallback: Check Supabase (Crucial for fresh installs/logins)
          // If local is false/missing, verify with server before forcing onboarding
          const { data: remoteProfile, error } = await supabase
              .from('profiles')
              .select('is_onboarded')
              .eq('id', userId)
              .single();

          if (remoteProfile && remoteProfile.is_onboarded) {
              // Server says TRUE. Sync Local DB and return TRUE.
              await db.runAsync(
                  `INSERT OR REPLACE INTO profiles (id, is_onboarded) VALUES (?, 1)`,
                  [userId]
              );
              return true;
          }

          return false;
      } catch (e) {
          console.log("Onboarding Check Error:", e);
          return false;
      }
  };

  const refreshProfile = useCallback(async () => {
      if (!user) return;
      const status = await checkOnboardingStatus(user.id);
      setIsOnboarded(status);
      await AsyncStorage.setItem(ONBOARDED_KEY, status ? 'true' : 'false');
  }, [user]);

  const completeOnboarding = useCallback(async () => {
    try {
      if (user) {
          // 1. Update Supabase
          await supabase.from('profiles').update({ is_onboarded: true }).eq('id', user.id);
          
          // 2. Update Local DB
          const db = await getDB();
          await db.runAsync(
              `UPDATE profiles SET is_onboarded = 1 WHERE id = ?`, 
              [user.id]
          );
      }
      // 3. Update State
      await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
      setIsOnboarded(true);
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  }, [user]);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await clearAttendanceNotification();
      await Notifications.cancelAllScheduledNotificationsAsync();

      const keys = ['active_ot_expiry', 'shift_start_time', 'last_break_time', ONBOARDED_KEY];
      await AsyncStorage.multiRemove(keys);

      const settings = await AsyncStorage.getItem(APP_SETTINGS_KEY);
      if (settings) {
          const parsed = JSON.parse(settings);
          parsed.biometricEnabled = false; 
          await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(parsed));
      }

      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setSession(null);
      setUser(null);
      setIsOnboarded(false);
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
            const status = await checkOnboardingStatus(currentSession.user.id);
            setIsOnboarded(status);
            await AsyncStorage.setItem(ONBOARDED_KEY, status ? 'true' : 'false');
        } else {
            setIsOnboarded(false);
        }
      } catch (error) {
        console.error('Auth Init Error:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (newSession?.user) {
          const status = await checkOnboardingStatus(newSession.user.id);
          setIsOnboarded(status);
      } else {
          setIsOnboarded(false);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // [ROUTING GUARD]
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';
    const inTabsGroup = segments[0] === '(tabs)';

    if (session && user) {
        // User is logged in
        if (!isOnboarded) {
            // Force Onboarding
            if (!inOnboarding) router.replace('/onboarding');
        } else {
            // User is Ready -> Go Home
            // If they are in Auth or Onboarding or Root, send to Home
            if (inAuthGroup || inOnboarding || segments.length === 0) {
                router.replace('/(tabs)/home');
            }
        }
    } else {
        // User is NOT logged in
        // If they try to access Tabs or Onboarding, send to Auth (or Index)
        if (inTabsGroup || inOnboarding) {
            router.replace('/'); 
        }
    }
  }, [session, user, isOnboarded, segments, isLoading]);

  return (
    <AuthContext.Provider value={{ session, user, isOnboarded, completeOnboarding, signOut, refreshProfile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};