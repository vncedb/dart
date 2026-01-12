import { getDB } from './db-client';

// --- INITIALIZATION ---
export const initDatabase = async () => {
  const database = await getDB();

  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    
    -- OFFLINE TABLES
    CREATE TABLE IF NOT EXISTS attendance (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, date TEXT NOT NULL, clock_in TEXT NOT NULL, clock_out TEXT, status TEXT, remarks TEXT, updated_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS accomplishments (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, date TEXT NOT NULL, description TEXT NOT NULL, remarks TEXT, image_url TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, row_id TEXT, action TEXT NOT NULL, data TEXT, status TEXT DEFAULT 'PENDING', created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);

    -- CACHE TABLES
    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY NOT NULL, email TEXT, first_name TEXT, last_name TEXT, middle_name TEXT, title TEXT, professional_suffix TEXT, current_job_id TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS job_positions (id TEXT PRIMARY KEY NOT NULL, user_id TEXT, title TEXT, company TEXT, department TEXT, employment_status TEXT, rate REAL, rate_type TEXT, work_schedule TEXT, break_schedule TEXT, created_at TEXT, updated_at TEXT);
  `);

  // --- MIGRATIONS ---
  const addColumn = async (table: string, col: string, type: string) => {
    try { await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col} ${type};`); } 
    catch (e: any) { if (!e.message?.includes('duplicate column')) console.log(`Migration Note (${table}.${col}):`, e.message); }
  };
  
  await addColumn('profiles', 'middle_name', 'TEXT');
  await addColumn('profiles', 'professional_suffix', 'TEXT');
  await addColumn('job_positions', 'company', 'TEXT');
  await addColumn('job_positions', 'department', 'TEXT');
  await addColumn('job_positions', 'employment_status', 'TEXT');
  await addColumn('job_positions', 'rate', 'REAL');
  await addColumn('job_positions', 'rate_type', 'TEXT');

  console.log("Database initialized.");
};

// --- HELPERS ---
export const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    let r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const queueSyncItem = async (tableName: string, rowId: string, action: string, data: any = null) => {
  const db = await getDB();
  if (!rowId) return;
  try {
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, row_id, action, data, status) VALUES (?, ?, ?, ?, 'PENDING')`,
      [tableName, rowId, action, data ? JSON.stringify(data) : null]
    );
  } catch (error) {
    console.error('Error queuing sync item:', error);
  }
};

// --- LOCAL DATA FUNCTIONS ---

export const saveProfileLocal = async (profile: any) => {
    const db = await getDB();
    await db.runAsync(
        `INSERT OR REPLACE INTO profiles (id, email, first_name, last_name, middle_name, title, professional_suffix, current_job_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            profile.id, 
            profile.email || '', 
            profile.first_name || '', 
            profile.last_name || '', 
            profile.middle_name || '',
            profile.title || '', 
            profile.professional_suffix || '',
            profile.current_job_id, 
            profile.updated_at || new Date().toISOString()
        ]
    );
};

export const saveJobLocal = async (job: any) => {
    const db = await getDB();
    await db.runAsync(
        `INSERT OR REPLACE INTO job_positions (id, user_id, title, company, department, employment_status, rate, rate_type, work_schedule, break_schedule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            job.id, 
            job.user_id, 
            job.title, 
            job.company || job.company_name || '', 
            job.department || '', 
            job.employment_status || 'Regular',
            job.rate || 0,
            job.rate_type || 'hourly',
            typeof job.work_schedule === 'string' ? job.work_schedule : JSON.stringify(job.work_schedule),
            typeof job.break_schedule === 'string' ? job.break_schedule : JSON.stringify(job.break_schedule),
            job.created_at || new Date().toISOString(), 
            job.updated_at || new Date().toISOString()
        ]
    );
};

// --- FIX: UPDATED DELETE LOGIC ---
export const deleteJobLocal = async (id: string) => {
    const db = await getDB();

    // 1. Unlink from local profiles
    // We search for any profile using this job and set it to null
    await db.runAsync(`UPDATE profiles SET current_job_id = NULL WHERE current_job_id = ?`, [id]);
    
    // 2. Queue the profile update so Supabase knows we unlinked it
    // Note: We need the user_id to queue a profile update. We can fetch it first.
    const job: any = await db.getFirstAsync('SELECT user_id FROM job_positions WHERE id = ?', [id]);
    if (job && job.user_id) {
        await queueSyncItem('profiles', job.user_id, 'UPDATE', { current_job_id: null });
    }

    // 3. Delete the job locally
    await db.runAsync('DELETE FROM job_positions WHERE id = ?', [id]);

    // 4. Queue the job deletion
    await queueSyncItem('job_positions', id, 'DELETE');
};