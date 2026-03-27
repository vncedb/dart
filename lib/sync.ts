// filepath: lib/sync.ts
import NetInfo from "@react-native-community/netinfo";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { getDB } from "./db-client";
import { getReportMimeType } from "./report-storage";
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

const uploadFileToSupabase = async (
  localUri: string,
  userId: string,
  bucket: string,
  folderPath: string = "",
  contentType?: string,
): Promise<string | null> => {
  try {
    if (!localUri || (!localUri.startsWith("file://") && !localUri.startsWith("content://"))) return localUri;

    const ext = localUri.split(".").pop() || (contentType?.includes("sheet") ? "xlsx" : "pdf");
    const prefix = folderPath ? `${folderPath}/` : "";
    const fileName = `${prefix}${userId}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;

    const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: "base64" });

    const { error } = await supabase.storage.from(bucket).upload(fileName, decode(base64), {
      contentType:
        contentType || (bucket === "reports" ? "application/pdf" : `image/${ext === "jpg" ? "jpeg" : ext}`),
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
export const syncPush = async (userId: string, progressCallback?: (progress: number) => void) => {
  try {
    const db = await getDB();

    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData?.session) {
      return { success: false, error: "No valid session" };
    }

    await db.runAsync(`DELETE FROM sync_queue WHERE retry_count >= ?`, [MAX_RETRIES]);

    const queueItems = await db.getAllAsync(
      'SELECT * FROM sync_queue WHERE status IN ("PENDING", "FAILED") ORDER BY created_at ASC'
    ) as any[];

    if (queueItems.length === 0) {
        if (progressCallback) progressCallback(100);
        return { success: true, count: 0, failedCount: 0 };
    }

    const state = await NetInfo.fetch();
    if (state.isConnected === false) return { success: false, error: "No internet connection" };

    let successCount = 0;
    let failedCount = 0;
    const batchGroups: Record<string, { tableName: string, action: string, items: any[], payloads: any[] }> = {};

    for (let index = 0; index < queueItems.length; index++) {
      const item = queueItems[index];
      const { id, table_name, row_id, action, data } = item;
      let payload: any = data ? JSON.parse(data) : {};

      try {
        // --- 1. Aggressive local cleanup ---
        if ("is_synced" in payload) delete payload.is_synced; 
        if ("local_avatar_path" in payload) delete payload.local_avatar_path;
        if ("snippet_desc" in payload) delete payload.snippet_desc;
        
        // --- 2. RLS Security Fix: Force User ID onto the payload ---
        if (action !== "DELETE") {
          if (table_name === "profiles") {
             payload.id = userId;
          } else {
             payload.user_id = userId;
          }
          if (!payload.id) payload.id = row_id;
        }

        // --- 3. Schema Data Normalization ---
        const reportLocalPath = table_name === "saved_reports" ? payload.file_path : null;
        const reportFileType = table_name === "saved_reports" ? payload.file_type : null;
        
        if (table_name === "notifications") {
          if (payload.date) {
             if (typeof payload.date === 'string') {
                 payload.date = new Date(payload.date).getTime();
             }
          } else {
             payload.date = payload.created_at ? new Date(payload.created_at).getTime() : Date.now();
          }
        }

        if (payload.job_id === "") payload.job_id = null;

        if (table_name === "attendance") {
            if (payload.clock_out === "") payload.clock_out = null;
            if (payload.job_id === "" || payload.job_id === undefined) payload.job_id = null;
            
            if (payload.status) {
                payload.status = payload.status.toLowerCase();
                if (!['pending', 'completed'].includes(payload.status)) {
                    payload.status = payload.clock_out ? 'completed' : 'pending';
                }
            } else {
                payload.status = payload.clock_out ? 'completed' : 'pending';
            }
            if (!payload.updated_at) payload.updated_at = new Date().toISOString();
        }

        // --- 4. Handle File Uploads before pushing the DB row ---
        if (
          table_name === "accomplishments" &&
          (payload.image_url?.startsWith("file://") || payload.image_url?.startsWith("content://")) &&
          action !== "DELETE"
        ) {
          const remoteUrl = await uploadFileToSupabase(payload.image_url, payload.user_id || "unknown", "entry-images", "entries");
          if (remoteUrl) payload.image_url = remoteUrl;
        }
        if (table_name === "saved_reports" && reportLocalPath && action !== "DELETE" && !payload.remote_url) {
          const remoteUrl = await uploadFileToSupabase(
            reportLocalPath,
            payload.user_id,
            "reports",
            "",
            getReportMimeType(reportFileType || "pdf"),
          );
          if (remoteUrl) {
            payload.remote_url = remoteUrl;
            payload.file_url = remoteUrl;
            try {
              await db.runAsync(
                "UPDATE saved_reports SET remote_url = ?, file_url = ?, updated_at = ? WHERE id = ?",
                [remoteUrl, remoteUrl, new Date().toISOString(), row_id || payload.id],
              );
            } catch {}
          }
        }
        if (
          table_name === "profiles" &&
          (payload.local_avatar_path?.startsWith("file://") || payload.local_avatar_path?.startsWith("content://")) &&
          action !== "DELETE"
        ) {
          const remoteUrl = await uploadFileToSupabase(payload.local_avatar_path, row_id || payload.id, "avatars");
          if (remoteUrl) {
            payload.avatar_url = remoteUrl;
            try { await db.runAsync(`UPDATE profiles SET avatar_url = ? WHERE id = ?`, [remoteUrl, row_id || payload.id]); } catch(e) {}
          }
        }

        if (table_name === "saved_reports") {
          if ("file_path" in payload) delete payload.file_path;
          if ("file_url" in payload) delete payload.file_url;
        }

        const groupKey = `${table_name}_${action}`;
        if (!batchGroups[groupKey]) batchGroups[groupKey] = { tableName: table_name, action, items: [], payloads: [] };
        
        if (action === "UPDATE" && Object.keys(payload).length === 0) {
            await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
            continue;
        }

        batchGroups[groupKey].items.push(item);
        batchGroups[groupKey].payloads.push(payload);

      } catch (e: any) {
        console.error(`[Sync] Pre-flight/Upload failed for queue id ${id}:`, e);
        await db.runAsync(`UPDATE sync_queue SET retry_count = retry_count + 1, status = 'FAILED' WHERE id = ?`, [id]);
        failedCount++;
        continue;
      }
      
      // PRE-FLIGHT PROGRESS (0% to 50% of the Push phase)
      if (progressCallback) progressCallback(Math.floor((index / queueItems.length) * 50));
    }

    // --- 5. Fix Execution Order for RLS dependencies ---
    const SYNC_ORDER = ["profiles", "job_positions", "attendance", "accomplishments", "saved_reports", "notifications"];
    const orderedKeys = Object.keys(batchGroups).sort((a, b) => {
        const indexA = SYNC_ORDER.indexOf(batchGroups[a].tableName);
        const indexB = SYNC_ORDER.indexOf(batchGroups[b].tableName);
        return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    });

    let keysProcessed = 0;

    for (const key of orderedKeys) {
        const { tableName, action, items, payloads } = batchGroups[key];

        try {
            if (action === "INSERT" || action === "UPSERT") {
                const seen = new Map<string, any>();
                for (let i = 0; i < payloads.length; i++) {
                    const pid = payloads[i].id || items[i].row_id;
                    seen.set(pid, { ...payloads[i], id: pid });
                }
                const deduped = Array.from(seen.values());

                const { error: batchErr } = await supabase.from(tableName).upsert(deduped);

                if (batchErr) {
                    for (let i = 0; i < items.length; i++) {
                        const p = { ...payloads[i], id: payloads[i].id || items[i].row_id };
                        const { error: singleErr } = await supabase.from(tableName).upsert(p);
                        if (!singleErr) {
                            await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [items[i].id]);
                            try { await db.runAsync(`UPDATE ${tableName} SET is_synced = 1 WHERE id = ?`, [items[i].row_id]); } catch(e) {}
                            successCount++;
                        } else {
                            await db.runAsync(`UPDATE sync_queue SET retry_count = retry_count + 1, status = 'FAILED' WHERE id = ?`, [items[i].id]);
                            failedCount++;
                        }
                    }
                    continue;
                }

                for (const item of items) {
                    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [item.id]);
                    try { await db.runAsync(`UPDATE ${tableName} SET is_synced = 1 WHERE id = ?`, [item.row_id]); } catch(e) {}
                }
                successCount += items.length;
            } else {
                for (let i = 0; i < items.length; i++) {
                    const rowId = items[i].row_id;
                    const payload = payloads[i];
                    
                    if (action === "UPDATE") {
                        const { error: err } = await supabase.from(tableName).update(payload).eq("id", rowId);
                        if (err) throw err;
                    } else if (action === "DELETE") {
                        if (tableName === 'saved_reports' && (payload.remote_url || payload.file_url || payload.public_url)) {
                          await deleteFileFromSupabase(payload.remote_url || payload.file_url || payload.public_url, "reports");
                        }
                        else if (tableName === 'accomplishments' && payload.image_url) {
                          const bucket = payload.image_url.includes('/entry-images/') ? 'entry-images' : 'accomplishments';
                          await deleteFileFromSupabase(payload.image_url, bucket);
                        }
                        const { error: err } = await supabase.from(tableName).delete().eq("id", rowId);
                        if (err) throw err;
                    }

                    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [items[i].id]);
                    if (action !== 'DELETE') {
                        try { await db.runAsync(`UPDATE ${tableName} SET is_synced = 1 WHERE id = ?`, [items[i].row_id]); } catch(e) {}
                    }
                    successCount++;
                }
            }
        } catch (e: any) {
            console.error(`[Sync] Supabase error on batch ${key}:`, e.message || e);
            for (const item of items) {
                await db.runAsync(`UPDATE sync_queue SET retry_count = retry_count + 1, status = 'FAILED' WHERE id = ?`, [item.id]);
            }
            failedCount += items.length;
        }
        
        keysProcessed++;
        // UPLOAD PROGRESS (50% to 100% of the Push phase)
        if (progressCallback) progressCallback(50 + Math.floor((keysProcessed / orderedKeys.length) * 50));
    }
    
    if (progressCallback) progressCallback(100);
    return { success: true, count: successCount, failedCount };
  } catch (e) {
    return { success: false, error: e };
  }
};

const safeUpsert = async (db: any, table: string, id: string, sql: string, params: any[]): Promise<boolean> => {
  try {
    const local: any = await db.getFirstAsync(`SELECT is_synced FROM ${table} WHERE id = ?`, [id]);
    if (local && local.is_synced === 0) return true; 
  } catch (e: any) {}
  await db.runAsync(sql, params);
  return false;
};

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

export const syncPull = async (userId: string, progressCallback?: (progress: number) => void) => {
  try {
    const db = await getDB();
    const state = await NetInfo.fetch();
    if (state.isConnected === false) return { success: false, message: "Offline" };

    const result: any = await db.getFirstAsync("SELECT value FROM app_settings WHERE key = ?", ["last_synced_at"]);
    const lastSyncedAt = result?.value || "1970-01-01T00:00:00.000Z";
    let conflicts = 0;

    // STEP 1: Jobs (16%)
    const jobsData = await fetchAllRows(
      supabase.from('job_positions').select('*').eq('user_id', userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const job of jobsData) {
      const isConflict = await safeUpsert(db, 'job_positions', job.id,
        `INSERT OR REPLACE INTO job_positions (id, user_id, title, company, department, employment_status, rate, rate_type, payout_type, period_target, work_schedule, break_schedule, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [job.id, job.user_id, job.title, job.company, job.department, job.employment_status, job.rate, job.rate_type, job.payout_type, job.period_target, typeof job.work_schedule === 'object' ? JSON.stringify(job.work_schedule) : job.work_schedule, typeof job.break_schedule === 'object' ? JSON.stringify(job.break_schedule) : job.break_schedule, job.created_at, job.updated_at, job.deleted_at || null]
      );
      if (isConflict) conflicts++;
    }
    if (progressCallback) progressCallback(16);

    // STEP 2: Profile (33%) - always fetch if no local profile (e.g. after account switch)
    const localProfile: any = await db.getFirstAsync("SELECT local_avatar_path FROM profiles WHERE id = ?", [userId]);
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).or(`updated_at.gt.${lastSyncedAt},updated_at.is.null`).maybeSingle();
    if (profileData) {
       await db.runAsync(
         `INSERT OR REPLACE INTO profiles (id, email, first_name, last_name, middle_name, title, professional_suffix, current_job_id, full_name, avatar_url, local_avatar_path, is_onboarded, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         [profileData.id, profileData.email || "", profileData.first_name || "", profileData.last_name || "", profileData.middle_name || "", profileData.title || "", profileData.professional_suffix || "", profileData.current_job_id, profileData.full_name || "", profileData.avatar_url, localProfile?.local_avatar_path || null, profileData.is_onboarded ? 1 : 0, profileData.updated_at || new Date().toISOString()]
       );
    }
    if (progressCallback) progressCallback(33);

    // STEP 3: Attendance (50%)
    const attendanceData = await fetchAllRows(
      supabase.from("attendance").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const row of attendanceData) {
      const isConflict = await safeUpsert(db, 'attendance', row.id,
        `INSERT OR REPLACE INTO attendance (id, user_id, job_id, date, title, clock_in, clock_out, status, remarks, updated_at, is_synced, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [row.id, row.user_id, row.job_id, row.date, row.title || null, row.clock_in, row.clock_out, row.status, row.remarks, row.updated_at || row.clock_in, row.deleted_at || null]
      );
      if (isConflict) conflicts++;
    }
    if (progressCallback) progressCallback(50);

    // STEP 4: Tasks/Accomplishments (66%)
    const taskData = await fetchAllRows(
      supabase.from("accomplishments").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const row of taskData) {
      const isConflict = await safeUpsert(db, 'accomplishments', row.id,
        `INSERT OR REPLACE INTO accomplishments (id, user_id, job_id, date, description, remarks, image_url, created_at, updated_at, is_synced, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [row.id, row.user_id, row.job_id, row.date, row.description || "", row.remarks || null, row.image_url || null, row.created_at, row.updated_at || row.created_at, row.deleted_at || null]
      );
      if (isConflict) conflicts++;
    }
    if (progressCallback) progressCallback(66);
    
    // STEP 5: Saved Reports (83%)
    const reportsData = await fetchAllRows(
      supabase.from("saved_reports").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const row of reportsData) {
      let isRead = 0;
      if (typeof row.is_read !== "undefined" && row.is_read != null) {
        isRead = row.is_read ? 1 : 0;
      } else {
        const local: any = await db.getFirstAsync("SELECT is_read FROM saved_reports WHERE id = ?", [row.id]);
        if (local != null) isRead = local.is_read ? 1 : 0;
      }
      const isConflict = await safeUpsert(db, 'saved_reports', row.id,
        `INSERT OR REPLACE INTO saved_reports (id, user_id, title, file_path, file_type, file_size, file_url, public_url, remote_url, metadata, created_at, updated_at, is_read, period_key, is_synced, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [row.id, row.user_id, row.title || "Untitled", "", row.file_type || "pdf", row.file_size || 0, row.file_url || row.remote_url || null, row.public_url || null, row.remote_url || null, row.metadata || null, row.created_at, row.updated_at || row.created_at, isRead, row.period_key || null, row.deleted_at || null]
      );
      if (isConflict) conflicts++;
    }
    if (progressCallback) progressCallback(83);

    // STEP 6: Notifications (100%)
    const notifData = await fetchAllRows(
      supabase.from("notifications").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const row of notifData) {
      const isConflict = await safeUpsert(db, 'notifications', row.id,
        `INSERT OR REPLACE INTO notifications (id, user_id, title, body, type, is_read, created_at, updated_at, is_synced, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [row.id, row.user_id, row.title, row.body, row.type, row.is_read ? 1 : 0, row.created_at, row.updated_at || row.created_at, row.deleted_at || null]
      );
      if (isConflict) conflicts++;
    }
    if (progressCallback) progressCallback(100);

    const newSyncTime = new Date().toISOString();
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", ["last_synced_at", newSyncTime]);
    
    return { success: true, conflictCount: conflicts };
  } catch (e) {
    console.error("[Sync] Pull Error:", e);
    return { success: false, error: e };
  }
};
