import * as SQLite from 'expo-sqlite';
import { type SQLiteDatabase } from 'expo-sqlite';

const DB_NAME = 'dart_local.db';

let rawDbInstance: SQLiteDatabase | null = null;
let rawDbPromise: Promise<SQLiteDatabase> | null = null;
let dbProxy: SQLiteDatabase | null = null;

const isRecoverableDbError = (error: unknown) => {
  const message = String((error as any)?.message || error || '').toLowerCase();
  return (
    message.includes('nativedatabase.prepareasync') ||
    message.includes('nullpointerexception') ||
    message.includes('access to closed resource') ||
    message.includes('database is closed')
  );
};

const resetRawDb = async () => {
  if (rawDbInstance) {
    try {
      await rawDbInstance.closeAsync();
    } catch {
      // ignore close errors while recovering
    }
  }

  rawDbInstance = null;
  rawDbPromise = null;
};

const openRawDb = async (): Promise<SQLiteDatabase> => {
  if (rawDbInstance) {
    return rawDbInstance;
  }

  if (rawDbPromise) {
    return rawDbPromise;
  }

  rawDbPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync(DB_NAME);
      rawDbInstance = db;
      return db;
    } catch (error) {
      rawDbPromise = null;
      console.error('Critical DB Init Error:', error);
      throw error;
    }
  })();

  return rawDbPromise;
};

const executeWithRecovery = async (methodName: PropertyKey, args: unknown[]) => {
  const run = async () => {
    const db = await openRawDb();
    const method = (db as any)[methodName];

    if (typeof method !== 'function') {
      return method;
    }

    return method.apply(db, args);
  };

  try {
    return await run();
  } catch (error) {
    if (!isRecoverableDbError(error)) {
      throw error;
    }

    console.warn(`[DB] Recovering from SQLite handle error on ${String(methodName)}...`);
    await resetRawDb();
    return run();
  }
};

const createDbProxy = () =>
  new Proxy(
    {},
    {
      get(_target, prop) {
        if (prop === 'then' || prop === 'catch' || prop === 'finally' || typeof prop === 'symbol') {
          return undefined;
        }

        if (prop === 'closeAsync') {
          return async () => {
            await resetRawDb();
          };
        }

        return (...args: unknown[]) => executeWithRecovery(prop, args);
      },
    },
  ) as SQLiteDatabase;

export const getDB = async (): Promise<SQLiteDatabase> => {
  if (!dbProxy) {
    dbProxy = createDbProxy();
  }

  await openRawDb();
  return dbProxy;
};

export const closeDB = async () => {
  await resetRawDb();
};
