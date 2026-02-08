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
  refreshProfile: () => Promise<void>; // New: Force refresh profile data
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

  // Helper: Check DB for onboarding status
  const checkDbOnboarding = async (userId: string) => {
      try {
          const db = await getDB();
          const profile: any = await db.getFirstAsync(
              'SELECT is_onboarded FROM profiles WHERE id = ?', 
              [userId]
          );
          // If profile exists, return its status. If not (rare), assume false.
          return profile ? Boolean(profile.is_onboarded) : false;
      } catch (e) {
          console.log("DB Check Error:", e);
          return false;
      }
  };

  const refreshProfile = useCallback(async () => {
      if (!user) return;
      // 1. Fetch latest from Supabase to ensure local DB is fresh
      const { data: remoteProfile } = await supabase.from('profiles').select('is_onboarded').eq('id', user.id).single();
      
      let status = false;
      if (remoteProfile) {
          status = remoteProfile.is_onboarded;
          // Sync to Local DB
          const db = await getDB();
          await db.runAsync('UPDATE profiles SET is_onboarded = ? WHERE id = ?', [status ? 1 : 0, user.id]);
      } else {
          // Fallback to local DB check
          status = await checkDbOnboarding(user.id);
      }

      // 2. Update State & Storage
      setIsOnboarded(status);
      await AsyncStorage.setItem(ONBOARDED_KEY, status ? 'true' : 'false');
  }, [user]);

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem(ONBOARDED_KEY, 'true');
      setIsOnboarded(true);
      if (user) {
          // Update DB
          await supabase.from('profiles').update({ is_onboarded: true }).eq('id', user.id);
          const db = await getDB();
          await db.runAsync('UPDATE profiles SET is_onboarded = 1 WHERE id = ?', [user.id]);
      }
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  }, [user]);

  // [SMART SIGN OUT]
  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Stop Background Processes
      await clearAttendanceNotification();
      await Notifications.cancelAllScheduledNotificationsAsync();

      // 2. Clear All Operational Storage
      const keys = ['active_ot_expiry', 'shift_start_time', 'last_break_time', ONBOARDED_KEY];
      await AsyncStorage.multiRemove(keys);

      // 3. Disable Biometrics
      const settings = await AsyncStorage.getItem(APP_SETTINGS_KEY);
      if (settings) {
          const parsed = JSON.parse(settings);
          parsed.biometricEnabled = false; 
          await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(parsed));
      }

      // 4. Supabase Sign Out
      const { error } = await supabase.auth.signOut();
      if (error) console.log("Supabase SignOut Warning:", error.message);

    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      // 5. Hard Reset State (Always happens)
      setSession(null);
      setUser(null);
      setIsOnboarded(false); // Critical: Reset this so next login checks again
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      try {
        // 1. Get Session
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        if (currentSession?.user) {
            // 2. [FIX] Check DB for Truth (Don't trust just AsyncStorage)
            const dbStatus = await checkDbOnboarding(currentSession.user.id);
            setIsOnboarded(dbStatus);
            await AsyncStorage.setItem(ONBOARDED_KEY, dbStatus ? 'true' : 'false');
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
          // On explicit sign-in event, check profile again
          const dbStatus = await checkDbOnboarding(newSession.user.id);
          setIsOnboarded(dbStatus);
      } else {
          setIsOnboarded(false);
      }
      
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  // [ROUTING LOGIC] - The Traffic Cop
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';

    if (session && user) {
        // User is logged in
        if (!isOnboarded) {
            // Must go to onboarding
            if (!inOnboarding) router.replace('/onboarding');
        } else {
            // Must go to home
            if (inAuthGroup || inOnboarding) router.replace('/');
        }
    } else {
        // User is logged out
        if (!inAuthGroup) router.replace('/auth');
    }
  }, [session, user, isOnboarded, segments, isLoading]);

  return (
    <AuthContext.Provider value={{ session, user, isOnboarded, completeOnboarding, signOut, refreshProfile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};