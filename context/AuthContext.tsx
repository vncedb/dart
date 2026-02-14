import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { queueSyncItem } from '../lib/database'; // Added import for offline sync
import { getDB } from '../lib/db-client';
import { supabase } from '../lib/supabase';
import { clearAttendanceNotification } from '../utils/NotificationService';

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

  // Helper to get the specific key for a user
  const getUserOnboardKey = useCallback((userId: string) => `onboarded_${userId}`, []);

  // 1. IMPROVED CHECK: Per-User Offline Support
  const checkOnboardingStatus = useCallback(async (userId: string): Promise<boolean> => {
      try {
          const userKey = getUserOnboardKey(userId);

          // STEP A: Check Phone Storage (User Specific)
          const localStatus = await AsyncStorage.getItem(userKey);
          if (localStatus === 'true') return true;

          // STEP B: Check SQLite (Local DB)
          const db = await getDB();
          const localProfile: any = await db.getFirstAsync(
              'SELECT is_onboarded FROM profiles WHERE id = ?', 
              [userId]
          );
          if (localProfile?.is_onboarded) {
              await AsyncStorage.setItem(userKey, 'true'); // Sync to AsyncStorage
              return true;
          }

          // STEP C: Check Server (Only if online)
          const { data: remoteProfile } = await supabase
              .from('profiles')
              .select('is_onboarded')
              .eq('id', userId)
              .single();

          if (remoteProfile?.is_onboarded) {
              // Sync Server -> Local DB & Storage
              await db.runAsync(`UPDATE profiles SET is_onboarded = 1 WHERE id = ?`, [userId]);
              await AsyncStorage.setItem(userKey, 'true');
              return true;
          }

          return false;
      } catch (_) {
          // Default to false (show onboarding) if checks fail
          return false;
      }
  }, [getUserOnboardKey]);

  const refreshProfile = useCallback(async () => {
      if (!user) return;
      const status = await checkOnboardingStatus(user.id);
      setIsOnboarded(status);
      if (status) {
          await AsyncStorage.setItem(getUserOnboardKey(user.id), 'true');
      }
  }, [user, checkOnboardingStatus, getUserOnboardKey]);

  // UPDATED: Offline-First Complete Onboarding
  const completeOnboarding = useCallback(async () => {
    if (!user) return;

    try {
      // STEP 1: PRIORITIZE OFFLINE STORAGE
      // We save locally first so the user is immediately "Onboarded" in the app
      
      // A. Update User-Specific AsyncStorage (The "Specific User" Tag)
      const userKey = getUserOnboardKey(user.id);
      await AsyncStorage.setItem(userKey, 'true');

      // B. Update Local SQLite Database
      const db = await getDB();
      await db.runAsync(
          `UPDATE profiles SET is_onboarded = 1 WHERE id = ?`, 
          [user.id]
      );

      // STEP 2: UPDATE APP STATE
      // Do this immediately so the UI navigates to Home
      setIsOnboarded(true);

      // STEP 3: ATTEMPT SERVER SYNC (Non-blocking)
      // We try to update Supabase. If it fails, we queue it for later.
      const { error } = await supabase
          .from('profiles')
          .update({ is_onboarded: true })
          .eq('id', user.id);

      if (error) {
          console.log("Online update failed, queuing sync...");
          // Queue the sync so it happens when internet returns
          await queueSyncItem('profiles', user.id, 'UPDATE', { is_onboarded: true });
      }

    } catch (error) {
      console.error('Local onboarding update error:', error);
      // Fallback: Force state update so user isn't stuck
      setIsOnboarded(true); 
    }
  }, [user, getUserOnboardKey]);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await clearAttendanceNotification();
      await Notifications.cancelAllScheduledNotificationsAsync();

      const keys = ['active_ot_expiry', 'shift_start_time', 'last_break_time', 'local_notifications'];
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
  }, [checkOnboardingStatus]);

  return (
    <AuthContext.Provider value={{ session, user, isOnboarded, completeOnboarding, signOut, refreshProfile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};