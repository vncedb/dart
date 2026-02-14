import { getDB } from "./db-client";

// --- INITIALIZATION ---
export const initDatabase = async () => {
  const database = await getDB();

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
    
    CREATE TABLE IF NOT EXISTS saved_reports (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_type TEXT NOT NULL,
      file_size INTEGER DEFAULT 0,
      remote_url TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0,
      is_read INTEGER DEFAULT 0,
      period_key TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, table_name TEXT NOT NULL, row_id TEXT, action TEXT NOT NULL, data TEXT, status TEXT DEFAULT 'PENDING', retry_count INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT);

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL, 
      email TEXT, 
      first_name TEXT, 
      last_name TEXT, 
      middle_name TEXT, 
      title TEXT, 
      professional_suffix TEXT, 
      current_job_id TEXT, 
      full_name TEXT, 
      avatar_url TEXT, 
      local_avatar_path TEXT, 
      is_onboarded INTEGER DEFAULT 0,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS job_positions (
      id TEXT PRIMARY KEY NOT NULL, 
      user_id TEXT, 
      title TEXT, 
      company TEXT, 
      department TEXT, 
      employment_status TEXT, 
      rate REAL, 
      rate_type TEXT, 
      payout_type TEXT, 
      period_target INTEGER,
      work_schedule TEXT, 
      break_schedule TEXT, 
      created_at TEXT, 
      updated_at TEXT
    );

    -- UPDATED: Notifications Table with updated_at
    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      date INTEGER NOT NULL,
      is_read INTEGER DEFAULT 0,
      type TEXT,
      data TEXT,
      updated_at TEXT
    );
    
    CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, date);
  `);

  // --- MIGRATIONS ---
  const addColumn = async (table: string, col: string, type: string) => {
    try {
      await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col} ${type};`);
    } catch (e: any) {
      // Ignore if column exists
    }
  };

  // ... (Previous migrations)
  await addColumn("sync_queue", "retry_count", "INTEGER DEFAULT 0");
  await addColumn("job_positions", "period_target", "INTEGER");
  await addColumn("notifications", "updated_at", "TEXT"); // Ensure updated_at exists

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
    // If updating/inserting, mark local row as not synced (optional logic depending on your flow)
    if (["attendance", "accomplishments", "saved_reports"].includes(tableName)) {
      try { await db.runAsync(`UPDATE ${tableName} SET is_synced = 0 WHERE id = ?`, [rowId]); } catch (e) {}
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
  const res: any = await db.getFirstAsync('SELECT COUNT(*) as count FROM sync_queue WHERE status = "PENDING"');
  return res?.count || 0;
};

// --- LOCAL DATA FUNCTIONS (Existing ones preserved...) ---
export const saveProfileLocal = async (profile: any) => { /* ... existing code ... */ };
export const saveJobLocal = async (job: any) => { /* ... existing code ... */ };
export const deleteJobLocal = async (id: string) => { /* ... existing code ... */ };

// --- NOTIFICATION FUNCTIONS (UPDATED) ---

export const saveNotificationLocal = async (notif: {
  id?: string;
  user_id: string;
  title: string;
  body: string;
  type?: string;
  data?: any;
}) => {
  const db = await getDB();
  const id = notif.id || generateUUID();
  const date = Date.now();
  const updated_at = new Date().toISOString();
  
  const record = {
    id,
    user_id: notif.user_id,
    title: notif.title,
    body: notif.body,
    date,
    is_read: 0,
    type: notif.type || 'general',
    data: notif.data,
    updated_at
  };

  // 1. Save to SQLite
  await db.runAsync(
    `INSERT INTO notifications (id, user_id, title, body, date, is_read, type, data, updated_at) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    [record.id, record.user_id, record.title, record.body, record.date, record.type, JSON.stringify(record.data), record.updated_at]
  );

  // 2. Queue for Sync
  await queueSyncItem('notifications', id, 'INSERT', record);
};

export const getUserNotifications = async (userId: string) => {
  const db = await getDB();
  return await db.getAllAsync(
    `SELECT * FROM notifications WHERE user_id = ? ORDER BY date DESC LIMIT 50`,
    [userId]
  );
};

export const markAllNotificationsRead = async (userId: string) => {
  const db = await getDB();
  const updated_at = new Date().toISOString();

  // 1. Get IDs of unread notifications to sync them individually
  const unread: any[] = await db.getAllAsync('SELECT id FROM notifications WHERE user_id = ? AND is_read = 0', [userId]);

  if (unread.length === 0) return;

  // 2. Update all locally
  await db.runAsync(
    `UPDATE notifications SET is_read = 1, updated_at = ? WHERE user_id = ? AND is_read = 0`,
    [updated_at, userId]
  );

  // 3. Queue Sync for each updated row
  for (const row of unread) {
      await queueSyncItem('notifications', row.id, 'UPDATE', { is_read: 1, updated_at });
  }
};

export const getUnreadNotificationCount = async (userId: string) => {
  const db = await getDB();
  const res: any = await db.getFirstAsync(
    `SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = 0`,
    [userId]
  );
  return res?.count || 0;
};

// ... (Report functions remain the same)