import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session } from '@supabase/supabase-js';
import { useRouter, useSegments } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { getDB } from '../lib/db-client';
import { supabase } from '../lib/supabase';

const generateGuestId = () => {
  return 'guest_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
};

type AuthContextType = {
  session: Session | null;
  user: any | null;
  isOnboarded: boolean;
  completeOnboarding: () => Promise<void>;
  signOut: () => Promise<void>;
  guestLogin: () => Promise<void>;
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isOnboarded: false,
  completeOnboarding: async () => {},
  signOut: async () => {},
  guestLogin: async () => {},
  isLoading: true,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<any | null>(null);
  const [isOnboarded, setIsOnboarded] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const router = useRouter();
  const segments = useSegments();

  // Helper: Get or Create Guest ID
  const getGuestId = async () => {
    let guestId = await AsyncStorage.getItem('guest_user_id');
    if (!guestId) {
        guestId = generateGuestId();
        await AsyncStorage.setItem('guest_user_id', guestId);
    }
    return guestId;
  };

  const completeOnboarding = useCallback(async () => {
    try {
      await AsyncStorage.setItem('isOnboarded', 'true');
      setIsOnboarded(true);
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('Failed to complete onboarding:', error);
    }
  }, [router]);

  // NEW: Explicit Guest Login
  const guestLogin = useCallback(async () => {
    setIsLoading(true);
    try {
        const guestId = await getGuestId();
        const guestUser = { id: guestId, is_guest: true, email: 'Guest User' };
        
        setUser(guestUser);
        setSession(null);
        
        // Check if this specific guest is already onboarded
        const localOnboarding = await AsyncStorage.getItem('isOnboarded');
        if (localOnboarding === 'true') {
            setIsOnboarded(true);
        } else {
            setIsOnboarded(false);
        }
    } catch (e) {
        console.error("Guest login failed", e);
    } finally {
        setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      
      // Clear State to force user back to Index/Auth flow
      setSession(null);
      setUser(null);
      
      router.replace('/auth'); 
    } catch (error) {
      console.error("Sign out failed:", error);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  const migrateGuestData = async (guestId: string, realUserId: string) => {
    console.log(`[Auth] Migrating data from Guest(${guestId}) to User(${realUserId})...`);
    const db = await getDB();
    try {
        await db.runAsync(`UPDATE profiles SET id = ? WHERE id = ?`, [realUserId, guestId]);
        await db.runAsync(`UPDATE job_positions SET user_id = ? WHERE user_id = ?`, [realUserId, guestId]);
        await db.runAsync(`UPDATE attendance SET user_id = ? WHERE user_id = ?`, [realUserId, guestId]);
        await db.runAsync(`UPDATE accomplishments SET user_id = ? WHERE user_id = ?`, [realUserId, guestId]);
        await db.runAsync(`UPDATE saved_reports SET user_id = ? WHERE user_id = ?`, [realUserId, guestId]);
        
        // Clear the used guest ID so next time they start fresh if they log out
        await AsyncStorage.removeItem('guest_user_id');
    } catch (e) {
        console.error("[Auth] Migration failed:", e);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        // Load onboarding state
        const localOnboarding = await AsyncStorage.getItem('isOnboarded');
        if (mounted && localOnboarding === 'true') {
          setIsOnboarded(true);
        }

        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (mounted) {
          if (currentSession?.user) {
            setSession(currentSession);
            setUser(currentSession.user);
          } else {
            // DO NOT auto-login as guest. Leave user null so Index screen shows.
            setSession(null);
            setUser(null);
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
        const currentGuestId = await AsyncStorage.getItem('guest_user_id');
        if (currentGuestId) {
            await migrateGuestData(currentGuestId, newSession.user.id);
        }
        setSession(newSession);
        setUser(newSession.user);
        
        // Assume verified users are onboarded or check DB (simplified here to storage)
        // You might want to fetch 'is_onboarded' from 'profiles' table here
      } 
      else if (event === 'SIGNED_OUT') {
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
    <AuthContext.Provider value={{ session, user, isOnboarded, completeOnboarding, signOut, guestLogin, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};