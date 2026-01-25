import * as SQLite from 'expo-sqlite';
import { type SQLiteDatabase } from 'expo-sqlite';

let dbInstance: SQLiteDatabase | null = null;
let dbPromise: Promise<SQLiteDatabase> | null = null;

export const getDB = async (): Promise<SQLiteDatabase> => {
  if (dbInstance) {
    return dbInstance;
  }

  if (dbPromise) {
    return dbPromise;
  }

  dbPromise = (async () => {
    try {
      // Use openDatabaseAsync for newer expo-sqlite versions
      // Using 'default' directory to ensure persistence
      const db = await SQLite.openDatabaseAsync('dart_local.db');
      dbInstance = db;
      return db;
    } catch (error) {
      console.error("Critical DB Init Error:", error);
      dbPromise = null; // Reset promise to allow retry
      throw error;
    }
  })();

  return dbPromise;
};