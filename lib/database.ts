import { getDB } from "./db-client";

// --- INITIALIZATION ---
export const initDatabase = async () => {
  const database = await getDB();

  // 1. Create Tables (Updated with is_synced)
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY NOT NULL, 
      user_id TEXT NOT NULL, 
      job_id TEXT, 
      date TEXT NOT NULL, 
      clock_in TEXT NOT NULL, 
      clock_out TEXT, 
      status TEXT, 
      remarks TEXT, 
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS accomplishments (
      id TEXT PRIMARY KEY NOT NULL, 
      user_id TEXT NOT NULL, 
      job_id TEXT, 
      date TEXT NOT NULL, 
      description TEXT NOT NULL, 
      remarks TEXT, 
      image_url TEXT, 
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT,
      is_synced INTEGER DEFAULT 0
    );
    
    CREATE TABLE IF NOT EXISTS generated_reports (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      local_uri TEXT, -- Path on the device
      sync_status TEXT DEFAULT 'PENDING', -- PENDING, SYNCED, DELETE_PENDING, RENAME_PENDING
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, row_id TEXT, action TEXT NOT NULL, data TEXT, status TEXT DEFAULT 'PENDING', retry_count INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);

    CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY NOT NULL, email TEXT, first_name TEXT, last_name TEXT, middle_name TEXT, title TEXT, professional_suffix TEXT, current_job_id TEXT, full_name TEXT, avatar_url TEXT, local_avatar_path TEXT, updated_at TEXT);
    CREATE TABLE IF NOT EXISTS job_positions (id TEXT PRIMARY KEY NOT NULL, user_id TEXT, title TEXT, company TEXT, department TEXT, employment_status TEXT, rate REAL, rate_type TEXT, payout_type TEXT, work_schedule TEXT, break_schedule TEXT, created_at TEXT, updated_at TEXT);
    
    CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
  `);

  // --- MIGRATIONS ---
  const addColumn = async (table: string, col: string, type: string) => {
    try {
      await database.execAsync(
        `ALTER TABLE ${table} ADD COLUMN ${col} ${type};`,
      );
    } catch (e: any) {
      // Ignore "duplicate column" errors, meaning migration already ran
      if (
        !e.message?.includes("duplicate column") &&
        !e.message?.includes("no such column")
      ) {
        console.log(`Migration Note (${table}.${col}):`, e.message);
      }
    }
  };

  await addColumn("sync_queue", "retry_count", "INTEGER DEFAULT 0");

  await addColumn("profiles", "middle_name", "TEXT");
  await addColumn("profiles", "professional_suffix", "TEXT");
  await addColumn("profiles", "full_name", "TEXT");
  await addColumn("profiles", "avatar_url", "TEXT");
  await addColumn("profiles", "local_avatar_path", "TEXT");

  await addColumn("job_positions", "company", "TEXT");
  await addColumn("job_positions", "department", "TEXT");
  await addColumn("job_positions", "employment_status", "TEXT");
  await addColumn("job_positions", "rate", "REAL");
  await addColumn("job_positions", "rate_type", "TEXT");
  await addColumn("job_positions", "payout_type", "TEXT");

  await addColumn("accomplishments", "updated_at", "TEXT");

  await addColumn("attendance", "job_id", "TEXT");
  await addColumn("accomplishments", "job_id", "TEXT");

  // --- NEW CRITICAL MIGRATIONS FOR SYNC STATUS ---
  await addColumn("attendance", "is_synced", "INTEGER DEFAULT 0");
  await addColumn("accomplishments", "is_synced", "INTEGER DEFAULT 0");

  try {
    await database.execAsync(`
        CREATE INDEX IF NOT EXISTS idx_attendance_job ON attendance(job_id);
        CREATE INDEX IF NOT EXISTS idx_accomplishments_job ON accomplishments(job_id);
      `);
  } catch (e) {
    console.log("Index creation note:", e);
  }

  console.log("Database initialized and migrated.");
};

// --- HELPERS ---
export const generateUUID = () => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    let r = (Math.random() * 16) | 0,
      v = c == "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const queueSyncItem = async (
  tableName: string,
  rowId: string,
  action: string,
  data: any = null,
) => {
  const db = await getDB();
  if (!rowId) return;
  try {
    // When editing locally, mark as UNSYNCED (0) immediately
    if (tableName === "attendance" || tableName === "accomplishments") {
      try {
        await db.runAsync(
          `UPDATE ${tableName} SET is_synced = 0 WHERE id = ?`,
          [rowId],
        );
      } catch (e) {
        /* ignore if table doesn't have col yet */
      }
    }

    await db.runAsync(
      `INSERT INTO sync_queue (table_name, row_id, action, data, status, retry_count) VALUES (?, ?, ?, ?, 'PENDING', 0)`,
      [tableName, rowId, action, data ? JSON.stringify(data) : null],
    );
  } catch (error) {
    console.error("Error queuing sync item:", error);
  }
};

export const getPendingSyncCount = async () => {
  const db = await getDB();
  const res: any = await db.getFirstAsync(
    'SELECT COUNT(*) as count FROM sync_queue WHERE status = "PENDING"',
  );
  return res?.count || 0;
};

// --- LOCAL DATA FUNCTIONS ---

export const saveProfileLocal = async (profile: any) => {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO profiles (
            id, email, first_name, last_name, middle_name, title, professional_suffix, current_job_id, full_name, avatar_url, local_avatar_path, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      profile.id,
      profile.email || "",
      profile.first_name || "",
      profile.last_name || "",
      profile.middle_name || "",
      profile.title || "",
      profile.professional_suffix || "",
      profile.current_job_id,
      profile.full_name || "",
      profile.avatar_url || null,
      profile.local_avatar_path || null,
      profile.updated_at || new Date().toISOString(),
    ],
  );
};

export const saveJobLocal = async (job: any) => {
  const db = await getDB();
  await db.runAsync(
    `INSERT OR REPLACE INTO job_positions (id, user_id, title, company, department, employment_status, rate, rate_type, payout_type, work_schedule, break_schedule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      job.id,
      job.user_id,
      job.title,
      job.company || job.company_name || "",
      job.department || "",
      job.employment_status || "Regular",
      job.rate || 0,
      job.rate_type || "hourly",
      job.payout_type || "Semi-Monthly",
      typeof job.work_schedule === "string"
        ? job.work_schedule
        : JSON.stringify(job.work_schedule),
      typeof job.break_schedule === "string"
        ? job.break_schedule
        : JSON.stringify(job.break_schedule),
      job.created_at || new Date().toISOString(),
      job.updated_at || new Date().toISOString(),
    ],
  );
};

export const deleteJobLocal = async (id: string) => {
  const db = await getDB();
  await db.runAsync(
    `UPDATE profiles SET current_job_id = NULL WHERE current_job_id = ?`,
    [id],
  );

  const job: any = await db.getFirstAsync(
    "SELECT user_id FROM job_positions WHERE id = ?",
    [id],
  );
  if (job && job.user_id) {
    await queueSyncItem("profiles", job.user_id, "UPDATE", {
      current_job_id: null,
    });
  }

  await db.runAsync("DELETE FROM job_positions WHERE id = ?", [id]);
  await queueSyncItem("job_positions", id, "DELETE");
};
