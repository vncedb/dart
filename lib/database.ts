// filepath: lib/database.ts
import { getDB } from "./db-client";

// --- INITIALIZATION ---
export const initDatabase = async () => {
  const database = await getDB();

  // 1. Create Tables (Base Schema)
  await database.execAsync(`
    PRAGMA journal_mode = WAL;
    
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY NOT NULL, 
      user_id TEXT NOT NULL, 
      job_id TEXT, 
      date TEXT NOT NULL, 
      title TEXT, 
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
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
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

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT, 
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0
    );

    -- The core of the Offline-First architecture
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT, 
      table_name TEXT NOT NULL, 
      row_id TEXT NOT NULL, 
      action TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
      data TEXT, -- JSON payload of the row
      status TEXT DEFAULT 'PENDING', 
      retry_count INTEGER DEFAULT 0, 
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

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
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      is_synced INTEGER DEFAULT 0
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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP, 
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        is_synced INTEGER DEFAULT 0
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS accomplishments_fts USING fts5(
        id UNINDEXED, 
        description, 
        remarks, 
        content='accomplishments', 
        content_rowid='id'
    );

    CREATE TRIGGER IF NOT EXISTS accomplishments_ai AFTER INSERT ON accomplishments BEGIN
      INSERT INTO accomplishments_fts(rowid, id, description, remarks) VALUES (new.rowid, new.id, new.description, new.remarks);
    END;
    
    CREATE TRIGGER IF NOT EXISTS accomplishments_ad AFTER DELETE ON accomplishments BEGIN
      INSERT INTO accomplishments_fts(accomplishments_fts, rowid, id, description, remarks) VALUES('delete', old.rowid, old.id, old.description, old.remarks);
    END;
    
    CREATE TRIGGER IF NOT EXISTS accomplishments_au AFTER UPDATE ON accomplishments BEGIN
      INSERT INTO accomplishments_fts(accomplishments_fts, rowid, id, description, remarks) VALUES('delete', old.rowid, old.id, old.description, old.remarks);
      INSERT INTO accomplishments_fts(rowid, id, description, remarks) VALUES (new.rowid, new.id, new.description, new.remarks);
    END;
  `);

  // 2. Run Migrations (Safe column additions for existing users)
  const addColumn = async (table: string, col: string, type: string) => {
    try {
      await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${col} ${type};`);
    } catch (e: any) {
      if (!e.message?.includes("duplicate column") && !e.message?.includes("no such column")) {
        console.log(`Migration Note (${table}.${col}):`, e.message);
      }
    }
  };

  await addColumn("sync_queue", "retry_count", "INTEGER DEFAULT 0");
  await addColumn("sync_queue", "created_at", "TEXT"); 
  await addColumn("profiles", "middle_name", "TEXT");
  await addColumn("profiles", "professional_suffix", "TEXT");
  await addColumn("profiles", "full_name", "TEXT");
  await addColumn("profiles", "avatar_url", "TEXT");
  await addColumn("profiles", "local_avatar_path", "TEXT");
  await addColumn("profiles", "is_onboarded", "INTEGER DEFAULT 0");
  await addColumn("profiles", "is_synced", "INTEGER DEFAULT 0");
  await addColumn("job_positions", "company", "TEXT");
  await addColumn("job_positions", "department", "TEXT");
  await addColumn("job_positions", "employment_status", "TEXT");
  await addColumn("job_positions", "rate", "REAL");
  await addColumn("job_positions", "rate_type", "TEXT");
  await addColumn("job_positions", "payout_type", "TEXT");
  await addColumn("job_positions", "period_target", "INTEGER"); 
  await addColumn("job_positions", "created_at", "TEXT");
  await addColumn("job_positions", "updated_at", "TEXT");
  await addColumn("job_positions", "is_synced", "INTEGER DEFAULT 0");
  await addColumn("accomplishments", "updated_at", "TEXT");
  await addColumn("attendance", "job_id", "TEXT");
  await addColumn("accomplishments", "job_id", "TEXT");
  await addColumn("attendance", "is_synced", "INTEGER DEFAULT 0");
  await addColumn("accomplishments", "is_synced", "INTEGER DEFAULT 0");
  await addColumn("saved_reports", "is_read", "INTEGER DEFAULT 0");
  await addColumn("saved_reports", "period_key", "TEXT");
  await addColumn("notifications", "created_at", "TEXT"); 
  await addColumn("notifications", "updated_at", "TEXT");
  await addColumn("notifications", "type", "TEXT");
  await addColumn("notifications", "is_read", "INTEGER DEFAULT 0");
  await addColumn("attendance", "title", "TEXT");

  // 3. Create Indexes for fast querying
  await database.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, date);
    CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
  `);

  // FIX: Clean up zombie items that got stuck during previous bugs
  await database.execAsync(`
    UPDATE sync_queue SET status = 'FAILED' WHERE retry_count >= 5 AND status = 'PENDING';
  `);
};

// --- UTILS ---
export const generateUUID = () => {
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
};

// Feature 3: Search Function
export const searchAccomplishments = async (userId: string, query: string, limit: number = 20) => {
  if (!query.trim()) return [];
  const db = await getDB();
  // Using FTS MATCH operator
  const sql = `
    SELECT a.*, snippet(accomplishments_fts, 1, '<b>', '</b>', '...', 64) as snippet_desc 
    FROM accomplishments_fts fts
    JOIN accomplishments a ON a.id = fts.id
    WHERE accomplishments_fts MATCH ? AND a.user_id = ?
    ORDER BY a.date DESC
    LIMIT ?
  `;
  // Sanitize query for FTS MATCH
  const sanitizedQuery = query.replace(/[^a-zA-Z0-9 ]/g, '') + '*';
  return await db.getAllAsync(sql, [sanitizedQuery, userId, limit]);
};

// --- SYNC ENGINE QUEUE ---
export const queueSyncItem = async (tableName: string, rowId: string, action: string, data: any = null) => {
  const db = await getDB();
  if (!rowId) return;
  try {
    // Mark local row as dirty
    if (["attendance", "accomplishments", "saved_reports", "notifications", "profiles", "job_positions"].includes(tableName)) {
      try {
        await db.runAsync(`UPDATE ${tableName} SET is_synced = 0 WHERE id = ?`, [rowId]);
      } catch (e: any) {
        if (!e.message?.includes('no such column')) console.warn(`[Sync Queue] Unexpected error marking ${tableName} dirty:`, e);
      }
    }
    // Queue the payload for the background sync engine
    await db.runAsync(
      `INSERT INTO sync_queue (table_name, row_id, action, data, status, retry_count) VALUES (?, ?, ?, ?, 'PENDING', 0)`,
      [tableName, rowId, action, data ? JSON.stringify(data) : null],
    );
  } catch (error) {
    console.error(`[Sync Queue] Error queuing ${action} for ${tableName}:`, error);
  }
};

export const getPendingSyncCount = async () => {
  const db = await getDB();
  const res: any = await db.getFirstAsync("SELECT COUNT(*) as count FROM sync_queue WHERE status = 'PENDING' AND retry_count < 5");
  return res?.count || 0;
};

// --- PROFILES & ONBOARDING ---
export const saveProfileLocal = async (profile: any) => {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO profiles (id, email, first_name, last_name, middle_name, title, professional_suffix, current_job_id, full_name, avatar_url, local_avatar_path, is_onboarded, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      profile.id, profile.email || "", profile.first_name || "", profile.last_name || "", profile.middle_name || "", profile.title || "", profile.professional_suffix || "", profile.current_job_id, profile.full_name || "", profile.avatar_url || null, profile.local_avatar_path || null, profile.is_onboarded ? 1 : 0, profile.updated_at || now,
    ]
  );
  await queueSyncItem("profiles", profile.id, "UPSERT", profile);
};

// --- JOBS ---
export const saveJobLocal = async (job: any) => {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO job_positions (id, user_id, title, company, department, employment_status, rate, rate_type, payout_type, period_target, work_schedule, break_schedule, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [
      job.id, job.user_id, job.title, job.company || job.company_name || "", job.department || "", job.employment_status || "Regular", job.rate || 0, job.rate_type || "hourly", job.payout_type || "Semi-Monthly", job.period_target !== undefined ? job.period_target : null, typeof job.work_schedule === "string" ? job.work_schedule : JSON.stringify(job.work_schedule), typeof job.break_schedule === "string" ? job.break_schedule : JSON.stringify(job.break_schedule), job.created_at || now, now,
    ]
  );
  await queueSyncItem("job_positions", job.id, "UPSERT", job);
};

export const deleteJobLocal = async (id: string) => {
  const db = await getDB();
  await db.runAsync(`UPDATE profiles SET current_job_id = NULL WHERE current_job_id = ?`, [id]);
  const job: any = await db.getFirstAsync("SELECT user_id FROM job_positions WHERE id = ?", [id]);
  if (job && job.user_id) {
    await queueSyncItem("profiles", job.user_id, "UPDATE", { current_job_id: null });
  }
  await db.runAsync("DELETE FROM job_positions WHERE id = ?", [id]);
  await queueSyncItem("job_positions", id, "DELETE");
};

/** Clears all user data from local DB. Call on sign out so the next user gets a clean slate. */
export const clearLocalUserData = async () => {
  try {
    const db = await getDB();
    await db.runAsync('DELETE FROM attendance');
    await db.runAsync('DELETE FROM accomplishments');
    await db.runAsync('DELETE FROM saved_reports');
    await db.runAsync('DELETE FROM job_positions');
    await db.runAsync('DELETE FROM profiles');
    await db.runAsync('DELETE FROM notifications');
    await db.runAsync('DELETE FROM sync_queue');
    await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['last_synced_at', '1970-01-01T00:00:00.000Z']);
  } catch (e) {
    console.error('[DB] clearLocalUserData error:', e);
  }
};

// --- ATTENDANCE & TRACKING ---
export const saveAttendanceLocal = async (attendance: any) => {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO attendance (id, user_id, job_id, date, title, clock_in, clock_out, status, remarks, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [attendance.id, attendance.user_id, attendance.job_id, attendance.date, attendance.title || null, attendance.clock_in, attendance.clock_out || null, attendance.status || 'Active', attendance.remarks || '', now]
  );
  await queueSyncItem("attendance", attendance.id, "UPSERT", attendance);
};

// --- ACCOMPLISHMENTS ---
export const saveAccomplishmentLocal = async (acc: any) => {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO accomplishments (id, user_id, job_id, date, description, remarks, image_url, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [acc.id, acc.user_id, acc.job_id, acc.date, acc.description, acc.remarks || '', acc.image_url || null, now]
  );
  await queueSyncItem("accomplishments", acc.id, "UPSERT", acc);
};

// --- REPORTS ---
export const saveReportLocal = async (report: any) => {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO saved_reports (id, user_id, title, file_path, file_type, file_size, remote_url, created_at, updated_at, is_synced, is_read, period_key) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [report.id, report.user_id, report.title, report.file_path, report.file_type, report.file_size, report.remote_url, report.created_at || now, now, report.is_read ? 1 : 0, report.period_key || null],
  );
  await queueSyncItem("saved_reports", report.id, "UPSERT", report);
};

export const markReportReadLocal = async (id: string) => {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.runAsync("UPDATE saved_reports SET is_read = 1, is_synced = 0, updated_at = ? WHERE id = ?", [now, id]);
  await queueSyncItem("saved_reports", id, "UPDATE", { is_read: true, updated_at: now });
};

export const deleteReportLocal = async (id: string) => {
  const db = await getDB();
  await db.runAsync("DELETE FROM saved_reports WHERE id = ?", [id]);
  await queueSyncItem("saved_reports", id, "DELETE");
};

export const renameReportLocal = async (id: string, newTitle: string, newPath?: string) => {
  const db = await getDB();
  const now = new Date().toISOString();
  if (newPath) {
    await db.runAsync("UPDATE saved_reports SET title = ?, file_path = ?, updated_at = ?, is_synced = 0 WHERE id = ?", [newTitle, newPath, now, id]);
  } else {
    await db.runAsync("UPDATE saved_reports SET title = ?, updated_at = ?, is_synced = 0 WHERE id = ?", [newTitle, now, id]);
  }
  await queueSyncItem("saved_reports", id, "UPDATE", { title: newTitle, file_path: newPath, updated_at: now });
};

export const checkReportTitleExists = async (title: string, fileType: string, userId: string) => {
  const db = await getDB();
  const res: any = await db.getFirstAsync("SELECT COUNT(*) as count FROM saved_reports WHERE user_id = ? AND title = ? AND file_type = ?", [userId, title, fileType]);
  return (res?.count || 0) > 0;
};

// --- NOTIFICATIONS ---
export const saveNotificationLocal = async (notif: any) => {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT OR REPLACE INTO notifications (id, user_id, title, body, type, is_read, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
    [notif.id, notif.user_id, notif.title, notif.body, notif.type || 'general', notif.is_read ? 1 : 0, notif.created_at || now, now]
  );
  await queueSyncItem('notifications', notif.id, 'UPSERT', notif);
};

export const getNotificationsLocal = async (userId: string) => {
  const db = await getDB();
  try {
    const rows = await db.getAllAsync(`SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`, [userId]);
    return rows.map((r: any) => ({ id: r.id, title: r.title, body: r.body, read: !!r.is_read, date: new Date(r.created_at).getTime(), type: r.type }));
  } catch (e: any) {
    if (e.message?.includes('no such column')) return [];
    throw e;
  }
};

export const deleteNotificationLocal = async (id: string) => {
  const db = await getDB();
  await db.runAsync("DELETE FROM notifications WHERE id = ?", [id]);
  await queueSyncItem("notifications", id, "DELETE");
};

export const markNotificationReadLocal = async (id: string) => {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.runAsync(`UPDATE notifications SET is_read = 1, is_synced = 0, updated_at = ? WHERE id = ?`, [now, id]);
  await queueSyncItem('notifications', id, 'UPDATE', { is_read: true, updated_at: now });
};

export const markAllNotificationsReadLocal = async (userId: string) => {
  const db = await getDB();
  const now = new Date().toISOString();
  await db.withTransactionAsync(async () => {
    const unread: any[] = await db.getAllAsync(`SELECT id FROM notifications WHERE user_id = ? AND is_read = 0`, [userId]);
    await db.runAsync(`UPDATE notifications SET is_read = 1, is_synced = 0, updated_at = ? WHERE user_id = ? AND is_read = 0`, [now, userId]);
    for (const item of unread) {
      await queueSyncItem('notifications', item.id, 'UPDATE', { is_read: true, updated_at: now });
    }
  });
};

// --- UNREAD COUNTS ---
export const getUnreadReportsCount = async (userId: string) => {
  if (!userId) return 0;
  try {
    const db = await getDB();
    const res: any = await db.getFirstAsync(
      "SELECT COUNT(*) as count FROM saved_reports WHERE user_id = ? AND is_read = 0", 
      [userId]
    );
    return res?.count || 0;
  } catch (e: any) {
    if (e.message?.includes('no such column')) return 0;
    console.error("[DB] Error getting unread reports:", e);
    return 0;
  }
};