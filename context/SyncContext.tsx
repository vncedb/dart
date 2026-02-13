import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
// initDatabase import removed - handled in _layout.tsx
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

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const db = await getDB();
        const res: any = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['last_synced_at']);
        if (res?.value) setLastSyncedAt(res.value);
      } catch (e) {
        console.error("Sync Settings Load Failed:", e);
      }
    };
    loadSettings();
  }, []);

  const triggerSync = async (): Promise<boolean> => {
    if (!user || isSyncing.current) return false;
    
    const state = await NetInfo.fetch();
    if (!state.isConnected || !state.isInternetReachable) {
        return false; 
    }

    try {
      isSyncing.current = true;
      setSyncStatus('syncing');
      
      // 1. PUSH Local Changes -> Cloud
      const pushResult = await syncPush();
      if (pushResult.success === false) {
          throw new Error('Push failed');
      }
      
      // 2. PULL Cloud Changes -> Local
      await syncPull(user.id);
      
      const db = await getDB();
      const res: any = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['last_synced_at']);
      if (res?.value) setLastSyncedAt(res.value);
      
      setSyncStatus('success');
      setTimeout(() => setSyncStatus('idle'), 3000); 
      return true;

    } catch (e) {
      console.error("Sync Context Error:", e);
      setSyncStatus('error');
      setTimeout(() => setSyncStatus('idle'), 3000); 
      return false;
    } finally {
      isSyncing.current = false;
    }
  };

  // Auto-sync triggers
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') triggerSync();
    });
    return () => subscription.remove();
  }, [user]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) triggerSync();
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (user) triggerSync();
  }, [user]);

  return (
    <SyncContext.Provider value={{ syncStatus, lastSyncedAt, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
};