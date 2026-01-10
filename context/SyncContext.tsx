import NetInfo from '@react-native-community/netinfo';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { initDatabase } from '../lib/database'; // <--- THIS IS CORRECT (initDatabase is in database.ts)
import { syncPull, syncPush } from '../lib/sync';
import { useAuth } from './AuthContext';

type SyncContextType = {
  isSyncing: boolean;
  triggerSync: () => Promise<void>;
};

const SyncContext = createContext<SyncContextType>({
  isSyncing: false,
  triggerSync: async () => {},
});

export const useSync = () => useContext(SyncContext);

export const SyncProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    // Make sure initDatabase is awaited properly
    const startDB = async () => {
      try {
        await initDatabase();
        setDbReady(true);
      } catch (e) {
        console.error("DB Init Failed:", e);
      }
    };
    startDB();
  }, []);

  const triggerSync = async () => {
    if (!user || isSyncing) return;
    setIsSyncing(true);
    try {
      await syncPush();
      await syncPull(user.id);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    if (!dbReady || !user) return;

    const unsubscribe = NetInfo.addEventListener(state => {
      if (state.isConnected && state.isInternetReachable) {
        triggerSync();
      }
    });

    triggerSync(); 

    return () => unsubscribe();
  }, [user, dbReady]);

  return (
    <SyncContext.Provider value={{ isSyncing, triggerSync }}>
      {children}
    </SyncContext.Provider>
  );
};