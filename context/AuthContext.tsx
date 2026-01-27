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
  isLoading: boolean;
};

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  isOnboarded: false,
  completeOnboarding: async () => {},
  signOut: async () => {},
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

  const signOut = useCallback(async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
      
      const guestId = await getGuestId();
      setSession(null);
      setUser({ id: guestId, is_guest: true, email: 'Guest User' });
      
      // Keep them on the same screen (Settings) or go Home, don't kick to Index
      router.replace('/(tabs)/home'); 
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
    } catch (e) {
        console.error("[Auth] Migration failed:", e);
    }
  };

  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
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
            const guestId = await getGuestId();
            setSession(null);
            setUser({ id: guestId, is_guest: true, email: 'Guest User' });
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

      const currentGuestId = await AsyncStorage.getItem('guest_user_id');

      if (event === 'SIGNED_IN' && newSession?.user) {
        if (currentGuestId) {
            await migrateGuestData(currentGuestId, newSession.user.id);
        }
        setSession(newSession);
        setUser(newSession.user);
      } 
      else if (event === 'SIGNED_OUT') {
        const guestId = await getGuestId();
        setSession(null);
        setUser({ id: guestId, is_guest: true, email: 'Guest User' });
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