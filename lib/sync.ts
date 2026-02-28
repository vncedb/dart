// lib/sync.ts
import NetInfo from "@react-native-community/netinfo";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { getDB } from "./db-client";
import { supabase } from "./supabase";

const MAX_RETRIES = 5;

// --- FILE HELPERS ---
const getPathFromUrl = (url: string) => {
  if (!url) return null;
  if (url.includes("/entry-images/")) return url.split("/entry-images/")[1].split("?")[0];
  if (url.includes("/accomplishments/")) return url.split("/accomplishments/")[1].split("?")[0];
  if (url.includes("/reports/")) return url.split("/reports/")[1].split("?")[0];
  return null;
};

const deleteFileFromSupabase = async (fullUrl: string, bucket: string) => {
  const path = getPathFromUrl(fullUrl);
  if (!path) return;
  try { await supabase.storage.from(bucket).remove([path]); } 
  catch (e) { console.log('[Sync] Delete file error:', e); }
};

const uploadFileToSupabase = async (localUri: string, userId: string, bucket: string, folderPath: string = ""): Promise<string | null> => {
  try {
    if (!localUri || !localUri.startsWith("file://")) return localUri;

    const ext = localUri.split(".").pop();
    const prefix = folderPath ? `${folderPath}/` : "";
    const fileName = `${prefix}${userId}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;

    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: "base64" });

    const { error } = await supabase.storage.from(bucket).upload(fileName, decode(base64), {
      contentType: bucket === "reports" ? "application/pdf" : `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      upsert: true,
    });

    if (error) throw error;
    const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
    return data.publicUrl;
  } catch (e) {
    console.error("[Sync] File Upload Failed:", e);
    throw new Error("File upload failed");
  }
};

// --- SYNC PUSH (Local Queue -> Cloud) ---
export const syncPush = async () => {
  try {
    const db = await getDB();
    const queueItems = await db.getAllAsync(
      'SELECT * FROM sync_queue WHERE status = "PENDING" AND retry_count < ? ORDER BY created_at ASC',
      [MAX_RETRIES]
    );

    if (queueItems.length === 0) return { success: true, count: 0 };

    const state = await NetInfo.fetch();
    if (!state.isConnected) return { success: false, error: "No internet connection" };

    let successCount = 0;

    for (const item of queueItems) {
      const { id, table_name, row_id, action, data } = item as any;
      let payload: any = {};

      try {
        payload = data ? JSON.parse(data) : {};
        if ("is_synced" in payload) delete payload.is_synced; 
        
        // FIX: Prevent 'updated_at' schema cache errors for attendance
        if (table_name === "attendance" && "updated_at" in payload) {
            delete payload.updated_at;
        }

        // Handle File Uploads before pushing the DB row
        if (table_name === "accomplishments" && payload.image_url?.startsWith("file://") && action !== "DELETE") {
          const remoteUrl = await uploadFileToSupabase(payload.image_url, payload.user_id || "unknown", "entry-images", "entries");
          if (remoteUrl) payload.image_url = remoteUrl;
        }
        if (table_name === "saved_reports" && payload.file_path?.startsWith("file://") && action !== "DELETE") {
          const remoteUrl = await uploadFileToSupabase(payload.file_path, payload.user_id, "reports");
          if (remoteUrl) {
            payload.remote_url = remoteUrl;
            delete payload.file_path; 
          }
        }
        if (table_name === "profiles" && payload.local_avatar_path?.startsWith("file://") && action !== "DELETE") {
          const remoteUrl = await uploadFileToSupabase(payload.local_avatar_path, row_id || payload.id, "avatars");
          if (remoteUrl) {
            payload.avatar_url = remoteUrl;
            try { await db.runAsync(`UPDATE profiles SET avatar_url = ? WHERE id = ?`, [remoteUrl, row_id || payload.id]); } catch(e) { console.warn('[Sync] Failed to update avatar_url:', e); }
          }
          delete payload.local_avatar_path;
        }

      } catch (e: any) {
        console.error(`[Sync] Pre-flight/Upload failed for queue id ${id}:`, e);
        await db.runAsync("UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?", [id]);
        continue;
      }

      let error = null;
      try {
        if (action === "INSERT" || action === "UPSERT") {
          const { error: err } = await supabase.from(table_name).upsert(payload);
          error = err;
        } else if (action === "UPDATE") {
          const { error: err } = await supabase.from(table_name).update(payload).eq("id", row_id);
          error = err;
        } else if (action === "DELETE") {
          if (table_name === 'saved_reports' && payload.remote_url) await deleteFileFromSupabase(payload.remote_url, "reports");
          else if (table_name === 'accomplishments' && payload.image_url) {
            const bucket = payload.image_url.includes('/entry-images/') ? 'entry-images' : 'accomplishments';
            await deleteFileFromSupabase(payload.image_url, bucket);
          }
          const { error: err } = await supabase.from(table_name).delete().eq("id", row_id);
          error = err;
        }

        if (!error || error.code === "PGRST116") {
           await db.runAsync("DELETE FROM sync_queue WHERE id = ?", [id]);
           
           if (action !== 'DELETE') {
             try { await db.runAsync(`UPDATE ${table_name} SET is_synced = 1 WHERE id = ?`, [row_id]); } catch(e) { console.warn(`[Sync] Failed to mark ${table_name} as synced:`, e); }
           }
           successCount++;
        } else {
           console.error(`[Sync] Supabase error on ${table_name}:`, error.message);
           await db.runAsync("UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?", [id]);
        }
      } catch (e) {
         await db.runAsync("UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?", [id]);
      }
    }
    return { success: true, count: successCount };
  } catch (e) {
    return { success: false, error: e };
  }
};

// Skip overwriting rows that have unsynced local changes
const safeUpsert = async (db: any, table: string, id: string, sql: string, params: any[]) => {
  const local: any = await db.getFirstAsync(`SELECT is_synced FROM ${table} WHERE id = ?`, [id]);
  if (local && local.is_synced === 0) return;
  await db.runAsync(sql, params);
};

// Paginated fetch to avoid Supabase's default 1000-row limit
const fetchAllRows = async (query: any): Promise<any[]> => {
  const PAGE_SIZE = 1000;
  let allData: any[] = [];
  let from = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await query.range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    if (data) allData = allData.concat(data);
    hasMore = data && data.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }
  return allData;
};

// --- SYNC PULL (Cloud -> Local) ---
export const syncPull = async (userId: string) => {
  try {
    const db = await getDB();
    const state = await NetInfo.fetch();
    if (!state.isConnected) return { success: false, message: "Offline" };

    const result: any = await db.getFirstAsync("SELECT value FROM app_settings WHERE key = ?", ["last_synced_at"]);
    const lastSyncedAt = result?.value || "1970-01-01T00:00:00.000Z";

    const jobsData = await fetchAllRows(
      supabase.from('job_positions').select('*').eq('user_id', userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const job of jobsData) {
      await db.runAsync(
        `INSERT OR REPLACE INTO job_positions (id, user_id, title, company, department, employment_status, rate, rate_type, payout_type, period_target, work_schedule, break_schedule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [job.id, job.user_id, job.title, job.company, job.department, job.employment_status, job.rate, job.rate_type, job.payout_type, job.period_target, typeof job.work_schedule === 'object' ? JSON.stringify(job.work_schedule) : job.work_schedule, typeof job.break_schedule === 'object' ? JSON.stringify(job.break_schedule) : job.break_schedule, job.created_at, job.updated_at]
      );
    }

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).gt('updated_at', lastSyncedAt).maybeSingle();
    if (profileData) {
       const existing: any = await db.getFirstAsync("SELECT local_avatar_path FROM profiles WHERE id = ?", [userId]);
       await db.runAsync(
         `INSERT OR REPLACE INTO profiles (id, email, first_name, last_name, middle_name, title, professional_suffix, current_job_id, full_name, avatar_url, local_avatar_path, is_onboarded, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         [profileData.id, profileData.email || "", profileData.first_name || "", profileData.last_name || "", profileData.middle_name || "", profileData.title || "", profileData.professional_suffix || "", profileData.current_job_id, profileData.full_name || "", profileData.avatar_url, existing?.local_avatar_path || null, profileData.is_onboarded ? 1 : 0, profileData.updated_at]
       );
    }

    const attendanceData = await fetchAllRows(
      supabase.from("attendance").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},clock_in.gt.${lastSyncedAt}`)
    );
    for (const row of attendanceData) {
      await safeUpsert(db, 'attendance', row.id,
        `INSERT OR REPLACE INTO attendance (id, user_id, job_id, date, title, clock_in, clock_out, status, remarks, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [row.id, row.user_id, row.job_id, row.date, row.title || null, row.clock_in, row.clock_out, row.status, row.remarks, row.updated_at || row.clock_in]
      );
    }

    const taskData = await fetchAllRows(
      supabase.from("accomplishments").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const row of taskData) {
      await safeUpsert(db, 'accomplishments', row.id,
        `INSERT OR REPLACE INTO accomplishments (id, user_id, job_id, date, description, remarks, image_url, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [row.id, row.user_id, row.job_id, row.date, row.description || "", row.remarks || null, row.image_url || null, row.created_at, row.updated_at || row.created_at]
      );
    }
    
    const reportsData = await fetchAllRows(
      supabase.from("saved_reports").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const row of reportsData) {
      await safeUpsert(db, 'saved_reports', row.id,
        `INSERT OR REPLACE INTO saved_reports (id, user_id, title, file_path, file_type, file_size, remote_url, created_at, updated_at, is_read, period_key, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [row.id, row.user_id, row.title || "Untitled", "", row.file_type || "pdf", row.file_size || 0, row.remote_url || null, row.created_at, row.updated_at || row.created_at, row.is_read ? 1 : 0, row.period_key || null]
      );
    }

    const notifData = await fetchAllRows(
      supabase.from("notifications").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const row of notifData) {
      await safeUpsert(db, 'notifications', row.id,
        `INSERT OR REPLACE INTO notifications (id, user_id, title, body, type, is_read, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [row.id, row.user_id, row.title, row.body, row.type, row.is_read ? 1 : 0, row.created_at, row.updated_at || row.created_at]
      );
    }

    const newSyncTime = new Date().toISOString();
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", ["last_synced_at", newSyncTime]);
    return { success: true };
  } catch (e) {
    console.error("[Sync] Pull Error:", e);
    return { success: false, error: e };
  }
};