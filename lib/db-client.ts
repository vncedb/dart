import * as SQLite from 'expo-sqlite';
import { type SQLiteDatabase } from 'expo-sqlite';

let dbInstance: SQLiteDatabase | null = null;
let dbPromise: Promise<SQLiteDatabase> | null = null;

export const getDB = async (): Promise<SQLiteDatabase> => {
  if (dbInstance) {
    try {
      await dbInstance.getFirstAsync('SELECT 1');
      return dbInstance;
    } catch {
      dbInstance = null;
      dbPromise = null;
    }
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    try {
      const db = await SQLite.openDatabaseAsync('dart_local.db');
      dbInstance = db;
      return db;
    } catch (error) {
      console.error("Critical DB Init Error:", error);
      dbPromise = null;
      throw error;
    }
  })();

  return dbPromise;
};

export const closeDB = async () => {
  if (dbInstance) {
    try { await dbInstance.closeAsync(); } catch { /* already closed */ }
  }
  dbInstance = null;
  dbPromise = null;
};