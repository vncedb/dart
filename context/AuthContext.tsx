import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { queueSyncItem } from '../lib/database';
import { getDB } from '../lib/db-client';
import { supabase } from '../lib/supabase';
import { syncPull } from '../lib/sync'; // <-- ADDED: For initial hydration
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

  const getUserOnboardKey = useCallback((userId: string) => `onboarded_${userId}`, []);

  const checkOnboardingStatus = useCallback(async (userId: string): Promise<boolean> => {
      try {
          const userKey = getUserOnboardKey(userId);

          const localStatus = await AsyncStorage.getItem(userKey);
          if (localStatus === 'true') return true;

          const db = await getDB();
          const localProfile: any = await db.getFirstAsync(
              'SELECT is_onboarded FROM profiles WHERE id = ?', 
              [userId]
          );
          if (localProfile?.is_onboarded) {
              await AsyncStorage.setItem(userKey, 'true'); 
              return true;
          }

          // Only reaches here if local DB is empty/un-synced
          const { data: remoteProfile } = await supabase
              .from('profiles')
              .select('is_onboarded')
              .eq('id', userId)
              .single();

          if (remoteProfile?.is_onboarded) {
              await db.runAsync(`UPDATE profiles SET is_onboarded = 1 WHERE id = ?`, [userId]);
              await AsyncStorage.setItem(userKey, 'true');
              return true;
          }

          return false;
      } catch (_) {
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

  const completeOnboarding = useCallback(async () => {
    if (!user) return;

    try {
      const userKey = getUserOnboardKey(user.id);
      await AsyncStorage.setItem(userKey, 'true');

      const db = await getDB();
      await db.runAsync(`UPDATE profiles SET is_onboarded = 1 WHERE id = ?`, [user.id]);

      setIsOnboarded(true);

      const { error } = await supabase
          .from('profiles')
          .update({ is_onboarded: true })
          .eq('id', user.id);

      if (error) {
          console.log("Online update failed, queuing sync...");
          await queueSyncItem('profiles', user.id, 'UPDATE', { is_onboarded: true });
      }

    } catch (error) {
      console.error('Local onboarding update error:', error);
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
        setIsLoading(false); // Done loading initial state
      }
    };

    initAuth();

    // LISTEN FOR LOGIN EVENTS
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      
      // HYDRATION STEP: If the user just logged in, pause and pull their data
      if (event === 'SIGNED_IN' && newSession?.user) {
         setIsLoading(true); // Keep the loading state active while fetching
         try {
             console.log("[Auth] New login detected. Hydrating local database...");
             await syncPull(newSession.user.id);
         } catch (e) {
             console.error("[Auth] Initial hydration failed:", e);
         }
      }

      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      if (newSession?.user) {
          const status = await checkOnboardingStatus(newSession.user.id);
          setIsOnboarded(status);
      } else {
          setIsOnboarded(false);
      }
      
      setIsLoading(false); // Release the UI
    });

    return () => subscription.unsubscribe();
  }, [checkOnboardingStatus]);

  return (
    <AuthContext.Provider value={{ session, user, isOnboarded, completeOnboarding, signOut, refreshProfile, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};