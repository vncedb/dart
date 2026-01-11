import { getDB } from './db-client'; //

// --- INITIALIZATION ---
export const initDatabase = async () => {
  const database = await getDB();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    
    -- OFFLINE TABLES (Reports & Settings)
    CREATE TABLE IF NOT EXISTS attendance (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, date TEXT NOT NULL, clock_in TEXT NOT NULL, clock_out TEXT, status TEXT, remarks TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS accomplishments (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, date TEXT NOT NULL, description TEXT NOT NULL, remarks TEXT, image_url TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, row_id TEXT, action TEXT NOT NULL, data TEXT, status TEXT DEFAULT 'PENDING', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);
  `);

  // --- MIGRATIONS ---
  const addColumn = async (table: string, col: string, type: string) => {
    try { 
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col} ${type};`); 
    } catch (e: any) {
        if (!e.message?.includes('duplicate column name')) {
             console.log(`Migration Note (${table}.${col}):`, e.message);
        }
    }
  };
  
  await addColumn('sync_queue', 'status', "TEXT DEFAULT 'PENDING'");
  await addColumn('sync_queue', 'row_id', 'TEXT');

  console.log("Database initialized (Reports Offline / Profile & Job Online).");
};

// --- HELPERS ---
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const queueSyncItem = async (tableName: string, rowId: string, action: string, data: any) => {
  const db = await getDB();
  if (!rowId) return;
  try {
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, row_id, action, data, status) VALUES (?, ?, ?, ?, 'PENDING')`,
      [tableName, rowId, action, JSON.stringify(data)]
    );
  } catch (error) {
    console.error('Error queuing sync item:', error);
  }
};