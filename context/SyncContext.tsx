// filepath: context/SyncContext.tsx
import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { generateUUID, getPendingSyncCount, saveNotificationLocal } from '../lib/database';
import { getDB } from '../lib/db-client';
import { syncPull, syncPush } from '../lib/sync';
import { useAuth } from './AuthContext';

type SyncStatus = 'idle' | 'syncing' | 'success' | 'error';

type SyncContextType = {
  syncStatus: SyncStatus;
  syncProgress: number; 
  lastSyncedAt: string | null;
  pendingCount: number;
  failedCount: number;
  conflictCount: number;
  isOffline: boolean;
  triggerSync: () => Promise<boolean>;
};

const SyncContext = createContext<SyncContextType>({
  syncStatus: 'idle',
  syncProgress: 0,
  lastSyncedAt: null,
  pendingCount: 0,
  failedCount: 0,
  conflictCount: 0,
  isOffline: false,
  triggerSync: async () => false,
});

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [conflictCount, setConflictCount] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  
  const isSyncing = useRef(false);
  const lastSyncTime = useRef(0);
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const SYNC_COOLDOWN = 10000;

  const updatePendingCount = useCallback(async () => {
    try { 
      const count = await getPendingSyncCount(); 
      setPendingCount(count); 
    } catch {
      // safely ignored
    }
  }, []);

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => { setIsOffline(state.isConnected === false); });
    return () => unsub();
  }, []);

  const loadSettings = useCallback(async () => {
      try {
        const db = await getDB();
        const res: any = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['last_synced_at']);
        if (res?.value) setLastSyncedAt(res.value);
      } catch {
        // Safe to ignore on fresh installs
      }
  }, []);

  useEffect(() => {
    loadSettings();
    updatePendingCount();
    const interval = setInterval(updatePendingCount, 30000);
    return () => clearInterval(interval);
  }, [updatePendingCount, loadSettings]);

  const triggerSync = useCallback(async (): Promise<boolean> => {
    if (!user || isSyncing.current) return false;

    const now = Date.now();
    if (now - lastSyncTime.current < SYNC_COOLDOWN) return false;

    isSyncing.current = true;
    lastSyncTime.current = now;

    if (isOffline) { isSyncing.current = false; return false; }
    if (resetTimerRef.current) { clearTimeout(resetTimerRef.current); resetTimerRef.current = null; }

    try {
      setSyncStatus('syncing');
      setSyncProgress(5); // Start Progress
      
      const pushRes = await syncPush(user.id, (progress) => {
         // Map push progress from 5% to 50%
         setSyncProgress(5 + Math.floor(progress * 0.45));
      });
      
      setFailedCount(pushRes.failedCount || 0);
      setSyncProgress(50); // Halfway
      
      const pullResult = await syncPull(user.id, (progress) => {
         // Map pull progress from 50% to 100%
         setSyncProgress(50 + Math.floor(progress * 0.5));
      });
      
      if (pullResult.success) {
        setSyncProgress(100);
        
        // Reload `lastSyncedAt` immediately after pull so the UI text updates
        await loadSettings();
        
        if (pullResult.conflictCount && pullResult.conflictCount > 0) {
            setConflictCount(pullResult.conflictCount);
            await saveNotificationLocal({
                id: generateUUID(), user_id: user.id, title: "Sync Conflicts Detected", 
                body: `${pullResult.conflictCount} items skipped because you have unsynced local changes. Push your changes to resolve.`, 
                created_at: new Date().toISOString(), is_read: false, type: 'sync_warning'
            });
        }

        setSyncStatus('success');
        updatePendingCount();
        resetTimerRef.current = setTimeout(() => {
          setSyncStatus('idle');
          setSyncProgress(0);
        }, 5000);
        return true;
      } else {
        setSyncStatus('error');
        resetTimerRef.current = setTimeout(() => {
          setSyncStatus('idle');
          setSyncProgress(0);
        }, 3000);
        return false;
      }

    } catch (error) {
      console.error("[SyncContext] Critical Sync Error:", error);
      setSyncStatus('error');
      resetTimerRef.current = setTimeout(() => {
        setSyncStatus('idle');
        setSyncProgress(0);
      }, 3000);
      return false;
    } finally {
      isSyncing.current = false;
    }
  }, [user, isOffline, updatePendingCount, loadSettings]);

  useEffect(() => {
    return () => { if (resetTimerRef.current) clearTimeout(resetTimerRef.current); };
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (nextAppState === 'active') triggerSync();
    });
    return () => subscription.remove();
  }, [triggerSync]);

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

  useEffect(() => {
    if (user) triggerSync();
  }, [user, triggerSync]);

  useEffect(() => {
    if (!user) return;
    const intervalId = setInterval(() => {
      triggerSync();
    }, 2 * 60 * 1000); 
    
    return () => clearInterval(intervalId);
  }, [user, triggerSync]);

  return (
    <SyncContext.Provider value={{ syncStatus, syncProgress, lastSyncedAt, pendingCount, failedCount, conflictCount, isOffline, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
};