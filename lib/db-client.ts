import * as SQLite from 'expo-sqlite';
import { type SQLiteDatabase } from 'expo-sqlite';

let db: SQLiteDatabase | null = null;

export const getDB = async () => {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('dart_local.db');
  return db;
};