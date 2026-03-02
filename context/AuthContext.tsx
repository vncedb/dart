// filepath: context/AuthContext.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { Session, User } from '@supabase/supabase-js';
import * as Notifications from 'expo-notifications';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { clearAttendanceNotification } from '../utils/NotificationService';

const APP_SETTINGS_KEY = 'appSettings';
const DEVICE_ONBOARDED_KEY = 'device_onboarded'; // Device-bound offline key

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

  // Strictly checks if THIS specific device has seen the onboarding
  const checkOnboardingStatus = useCallback(async (): Promise<boolean> => {
      try {
          const localStatus = await AsyncStorage.getItem(DEVICE_ONBOARDED_KEY);
          return localStatus === 'true';
      } catch {
          return false;
      }
  }, []);

  const refreshProfile = useCallback(async () => {
      const status = await checkOnboardingStatus();
      setIsOnboarded(status);
  }, [checkOnboardingStatus]);

  const completeOnboarding = useCallback(async () => {
    try {
      // Save offline strictly for this device
      await AsyncStorage.setItem(DEVICE_ONBOARDED_KEY, 'true');
      setIsOnboarded(true);
    } catch (error) {
      console.error('Local onboarding update error:', error);
      setIsOnboarded(true); 
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      // 1. Force Google Sign-Out to clear active session and prompt account picker next time
      try {
          await GoogleSignin.hasPlayServices();
          await GoogleSignin.signOut();
      } catch (googleErr) {
          console.log('Google SignOut error', googleErr);
      }

      await clearAttendanceNotification();
      await Notifications.cancelAllScheduledNotificationsAsync();

      const keys = ['active_ot_expiry', 'shift_start_time', 'last_break_time', 'local_notifications'];
      await AsyncStorage.multiRemove(keys);
      // Notice we DO NOT remove DEVICE_ONBOARDED_KEY so it remains true for the device

      try {
        const settings = await AsyncStorage.getItem(APP_SETTINGS_KEY);
        if (settings) {
            const parsed = JSON.parse(settings);
            parsed.biometricEnabled = false; 
            await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(parsed));
        }
      } catch (settingsErr) {
        console.warn('Failed to update app settings during sign out:', settingsErr);
      }

      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setSession(null);
      setUser(null);
      
      try {
        const status = await checkOnboardingStatus();
        setIsOnboarded(status);
      } catch {
        // Preserve current onboarding state on failure
      }
      
      setIsLoading(false);
    }
  }, [checkOnboardingStatus]);

  useEffect(() => {
    let listenerTookOver = false;

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (listenerTookOver) return;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);

        const status = await checkOnboardingStatus();
        if (listenerTookOver) return;
        setIsOnboarded(status);
      } catch (error) {
        console.error('Auth Init Error:', error);
      } finally {
        if (!listenerTookOver) setIsLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      listenerTookOver = true;

      setSession(newSession);
      setUser(newSession?.user ?? null);
      
      try {
        const status = await checkOnboardingStatus();
        setIsOnboarded(status);
      } catch { /* preserve current state */ }
      
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