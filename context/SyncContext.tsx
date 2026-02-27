import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
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
  
  // Use a ref to prevent overlapping sync operations
  const isSyncing = useRef(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const db = await getDB();
        const res: any = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['last_synced_at']);
        if (res?.value) setLastSyncedAt(res.value);
      } catch (e) {
        // Safe to ignore on fresh installs
      }
    };
    loadSettings();
  }, []);

  const triggerSync = async (): Promise<boolean> => {
    if (!user || isSyncing.current) return false;
    
    // Quick connection check
    const state = await NetInfo.fetch();
    if (!state.isConnected) return false; 

    try {
      isSyncing.current = true;
      setSyncStatus('syncing');
      
      // 1. PUSH local changes to Cloud
      const pushResult = await syncPush();
      
      // 2. PULL new data from Cloud
      const pullResult = await syncPull(user.id);
      
      // Update UI timestamp if successful
      if (pullResult.success) {
        const db = await getDB();
        const res: any = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['last_synced_at']);
        if (res?.value) setLastSyncedAt(res.value);
        
        setSyncStatus('success');
      } else {
        setSyncStatus('error');
      }

      // Reset UI state after 3 seconds
      setTimeout(() => setSyncStatus('idle'), 3000); 
      return true;

    } catch (e) {
      console.error("[SyncContext] Critical Sync Error:", e);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000); 
      return false;
    } finally {
      isSyncing.current = false; // Always release the lock
    }
  };

  // Trigger 1: When App comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') triggerSync();
    });
    return () => subscription.remove();
  }, [user]);

  // Trigger 2: When network is restored
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
         triggerSync();
      }
    });
    return () => unsubscribe();
  }, [user]);

  // Trigger 3: Initial load
  useEffect(() => {
    if (user) triggerSync();
  }, [user]);

  // Trigger 4: Background Interval (Every 2 Minutes)
  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => {
      triggerSync();
    }, 2 * 60 * 1000); 
    
    return () => clearInterval(intervalId);
  }, [user]);

  return (
    <SyncContext.Provider value={{ syncStatus, lastSyncedAt, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
};