// filepath: vncedb/dart/dart-8346f6d6d3ba6721214d0c5b9d4684d9a2a9874e/context/SyncContext.tsx
import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { getDB } from '../lib/db-client';
import { syncPull, syncPush } from '../lib/sync';
import { useAuth } from './AuthContext';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

type SyncContextType = {
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  triggerSync: () => Promise<boolean>;
};

const SyncContext = createContext<SyncContextType>({
  syncStatus: 'idle',
  lastSyncedAt: null,
  triggerSync: async () => false,
});

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  
  const isSyncing = useRef(false);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const db = await getDB();
        const res: any = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['last_synced_at']);
        if (res?.value) setLastSyncedAt(res.value);
      } catch {
        // Safe to ignore on fresh installs
      }
    };
    loadSettings();
  }, []);

  const triggerSync = useCallback(async (): Promise<boolean> => {
    if (!user || isSyncing.current) return false;
    isSyncing.current = true;

    const state = await NetInfo.fetch();
    if (!state.isConnected) { isSyncing.current = false; return false; }

    if (resetTimerRef.current) { clearTimeout(resetTimerRef.current); resetTimerRef.current = null; }

    try {
      setSyncStatus('syncing');
      
      await syncPush();
      
      const pullResult = await syncPull(user.id);
      
      if (pullResult.success) {
        const db = await getDB();
        const res: any = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['last_synced_at']);
        if (res?.value) setLastSyncedAt(res.value);
        
        setSyncStatus('success');
        resetTimerRef.current = setTimeout(() => setSyncStatus('idle'), 3000);
        return true;
      } else {
        setSyncStatus('error');
        resetTimerRef.current = setTimeout(() => setSyncStatus('idle'), 3000);
        return false;
      }

    } catch (error) {
      console.error("[SyncContext] Critical Sync Error:", error);
      setSyncStatus('error');
      resetTimerRef.current = setTimeout(() => setSyncStatus('idle'), 3000);
      return false;
    } finally {
      isSyncing.current = false;
    }
  }, [user]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
  }, []);

  // Trigger 1: When App comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') triggerSync();
    });
    return () => subscription.remove();
  }, [triggerSync]);

  // Trigger 2: When network is restored (skip initial fire)
  useEffect(() => {
    let isInitial = true;
    const unsubscribe = NetInfo.addEventListener(state => {
      if (isInitial) { isInitial = false; return; }
      if (state.isConnected && state.isInternetReachable) {
         triggerSync();
      }
    });
    return () => unsubscribe();
  }, [triggerSync]);

  // Trigger 3: Initial load
  useEffect(() => {
    if (user) triggerSync();
  }, [user, triggerSync]);

  // Trigger 4: Background Interval (Every 2 Minutes)
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => {
      triggerSync();
    }, 2 * 60 * 1000); 
    
    return () => clearInterval(intervalId);
  }, [user, triggerSync]);

  return (
    <SyncContext.Provider value={{ syncStatus, lastSyncedAt, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
};