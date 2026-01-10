import { getDB } from './db-client'; //

// --- INITIALIZATION ---
export const initDatabase = async () => {
  const database = await getDB();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS attendance (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, date TEXT NOT NULL, clock_in TEXT NOT NULL, clock_out TEXT, status TEXT, remarks TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS accomplishments (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, date TEXT NOT NULL, description TEXT NOT NULL, remarks TEXT, image_url TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, row_id TEXT, action TEXT NOT NULL, data TEXT, status TEXT DEFAULT 'PENDING', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);
    CREATE TABLE IF NOT EXISTS job_positions (id TEXT PRIMARY KEY, user_id TEXT, title TEXT NOT NULL, company TEXT, department TEXT, employment_status TEXT, rate REAL, rate_type TEXT, start_date TEXT, work_schedule TEXT, break_schedule TEXT, cutoff_config TEXT, description TEXT, is_custom INTEGER DEFAULT 0, created_at INTEGER);

    -- 1. Profiles Table (Updated with History and Suffix)
    CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        first_name TEXT,
        last_name TEXT,
        job_title TEXT,
        title TEXT,         
        professional_suffix TEXT, 
        avatar_url TEXT,
        cover_url TEXT,
        theme_color TEXT,
        avatar_history TEXT, 
        is_onboarded INTEGER DEFAULT 0,
        updated_at INTEGER
    );
  `);

  // --- MIGRATIONS ---
  const addColumn = async (table: string, col: string, type: string) => {
    try { 
        // Attempt to select the column first to check existence (SQLite workaround)
        // Or simply run alter and catch the specific 'duplicate column' error
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col} ${type};`); 
    } catch (e: any) {
        // If error is "duplicate column name", we are good.
        // Otherwise, log it.
        if (!e.message?.includes('duplicate column name')) {
             console.log(`Migration Note (${table}.${col}):`, e.message);
        }
    }
  };

  await addColumn('profiles', 'title', 'TEXT');
  await addColumn('profiles', 'professional_suffix', 'TEXT'); // Critical Migration
  await addColumn('profiles', 'cover_url', 'TEXT');
  await addColumn('profiles', 'theme_color', 'TEXT');
  await addColumn('profiles', 'avatar_history', 'TEXT');
  
  await addColumn('sync_queue', 'status', "TEXT DEFAULT 'PENDING'");
  await addColumn('sync_queue', 'row_id', 'TEXT');
  await addColumn('job_positions', 'user_id', 'TEXT');
  await addColumn('job_positions', 'company', 'TEXT');
  await addColumn('job_positions', 'department', 'TEXT');
  await addColumn('job_positions', 'employment_status', 'TEXT');
  await addColumn('job_positions', 'rate', 'REAL');
  await addColumn('job_positions', 'rate_type', 'TEXT');
  await addColumn('job_positions', 'start_date', 'TEXT');
  await addColumn('job_positions', 'work_schedule', 'TEXT');
  await addColumn('job_positions', 'break_schedule', 'TEXT');
  await addColumn('job_positions', 'cutoff_config', 'TEXT');

  console.log("Database initialized (with Suffix).");
};

// --- HELPERS ---
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Updated Save Profile Helper
export const saveProfileLocal = async (profile: any) => {
  const db = await getDB();
  try {
    const current = await db.getFirstAsync('SELECT avatar_url, avatar_history FROM profiles WHERE id = ?', [profile.id]);
    
    let history: string[] = [];
    
    if (profile.avatar_history && Array.isArray(profile.avatar_history)) {
       history = profile.avatar_history;
    } else if (current && (current as any).avatar_history) {
        try { history = JSON.parse((current as any).avatar_history); } catch (e) { history = []; }
    }

    if (!profile.avatar_history && current && (current as any).avatar_url && (current as any).avatar_url !== profile.avatar_url && profile.avatar_url) {
        if (!history.includes((current as any).avatar_url)) {
            history.unshift((current as any).avatar_url); 
            history = history.slice(0, 6); 
        }
    }

    await db.runAsync(
      `INSERT OR REPLACE INTO profiles (id, first_name, last_name, job_title, title, professional_suffix, avatar_url, cover_url, theme_color, avatar_history, is_onboarded, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        profile.id,
        profile.first_name,
        profile.last_name,
        profile.job_title,
        profile.title || null,
        profile.professional_suffix || null,
        profile.avatar_url,
        profile.cover_url || null,
        profile.theme_color || null,
        JSON.stringify(history), 
        profile.is_onboarded ? 1 : 0,
        Date.now()
      ]
    );
  } catch (error) {
    console.error('Error saving profile locally:', error);
  }
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