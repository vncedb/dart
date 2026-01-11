import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { initDatabase } from '../lib/database';
import { getDB } from '../lib/db-client';
import { syncPull, syncPush } from '../lib/sync';
import { useAuth } from './AuthContext';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

type SyncContextType = {
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  triggerSync: () => Promise<void>;
};

const SyncContext = createContext<SyncContextType>({
  syncStatus: 'idle',
  lastSyncedAt: null,
  triggerSync: async () => {},
});

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState(false);
  
  // Use a ref to prevent overlapping syncs
  const isSyncing = useRef(false);

  useEffect(() => {
    const startDB = async () => {
      try {
        await initDatabase();
        const db = await getDB();
        const res: any = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['last_synced_at']);
        if (res?.value) setLastSyncedAt(res.value);
        setDbReady(true);
      } catch (e) {
        console.error("DB Init Failed:", e);
      }
    };
    startDB();
  }, []);

  const triggerSync = async () => {
    if (!user || !dbReady || isSyncing.current) return;
    
    const state = await NetInfo.fetch();
    if (!state.isConnected || !state.isInternetReachable) {
        // We are offline, just stay idle/pending
        return; 
    }

    try {
      isSyncing.current = true;
      setSyncStatus('syncing');
      
      // 1. PUSH Local Changes -> Cloud
      const pushResult = await syncPush();
      
      // 2. PULL Cloud Changes -> Local
      await syncPull(user.id);
      
      const db = await getDB();
      const res: any = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['last_synced_at']);
      if (res?.value) setLastSyncedAt(res.value);
      
      setSyncStatus('success');
      
      // Reset status after a delay so user sees "Success" briefly
      setTimeout(() => setSyncStatus('idle'), 3000); 

    } catch (e) {
      console.error("Sync Context Error:", e);
      setSyncStatus('error');
    } finally {
      isSyncing.current = false;
    }
  };

  // --- AUTO SYNC TRIGGERS ---

  // 1. Auto-sync when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') {
        triggerSync();
      }
    });
    return () => subscription.remove();
  }, [user, dbReady]);

  // 2. Auto-sync when internet reconnects
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        triggerSync();
      }
    });
    return () => unsubscribe();
  }, [user, dbReady]);

  // 3. Initial Sync on Load
  useEffect(() => {
    if (user && dbReady) {
        triggerSync();
    }
  }, [user, dbReady]);

  return (
    <SyncContext.Provider value={{ syncStatus, lastSyncedAt, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
};