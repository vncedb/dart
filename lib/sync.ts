// filepath: lib/sync.ts
import NetInfo from "@react-native-community/netinfo";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";
import { getDB } from "./db-client";
import { supabase } from "./supabase";

const MAX_RETRIES = 5;

// --- GLOBAL SYNC LOCK ---
let isSyncing = false;

export const performFullSync = async (userId: string, progressCallback?: (progress: number) => void) => {
  if (isSyncing) return { success: false, message: "Sync already in progress" };
  isSyncing = true;
  try {
    if (progressCallback) progressCallback(10);
    const pushRes = await syncPush(userId, (p) => progressCallback?.(10 + Math.floor(p * 0.4)));
    
    if (progressCallback) progressCallback(50);
    const pullRes = await syncPull(userId, (p) => progressCallback?.(50 + Math.floor(p * 0.5)));

    return { success: true, push: pushRes, pull: pullRes };
  } catch (error) {
    console.error("[Sync] Full sync failed", error);
    return { success: false, error };
  } finally {
    isSyncing = false;
    if (progressCallback) progressCallback(100);
  }
};

// --- FILE HELPERS ---
const getPathFromUrl = (url: string) => {
  if (!url) return null;
  if (url.includes("/entry-images/")) return url.split("/entry-images/")[1].split("?")[0];
  if (url.includes("/accomplishments/")) return url.split("/accomplishments/")[1].split("?")[0];
  if (url.includes("/reports/")) return url.split("/reports/")[1].split("?")[0];
  if (url.includes("/avatars/")) return url.split("/avatars/")[1].split("?")[0];
  return null;
};

const downloadFile = async (url: string, folder: string, filename: string) => {
  try {
    if (!url || !url.startsWith('http')) return url;
    const dir = `${FileSystem.documentDirectory}${folder}/`;
    const dirInfo = await FileSystem.getInfoAsync(dir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
    const localUri = `${dir}${filename}`;
    const fileInfo = await FileSystem.getInfoAsync(localUri);
    if (!fileInfo.exists) {
        const downloadRes = await FileSystem.downloadAsync(url, localUri);
        return downloadRes.uri;
    }
    return localUri;
  } catch (err) {
    console.error('[Sync] Download error:', err);
    return url; 
  }
};

const deleteFileFromSupabase = async (fullUrl: string, bucket: string) => {
  const path = getPathFromUrl(fullUrl);
  if (!path) return;
  try { 
      await supabase.storage.from(bucket).remove([path]); 
  } catch (err) { 
      console.log('[Sync] Delete file error:', err); 
  }
};

// --- STRICT UPLOAD LOGIC ---
const uploadFileToSupabase = async (localUri: string, userId: string, bucket: string, folderPath: string = ""): Promise<string | null> => {
  if (!localUri || !localUri.startsWith("file://")) return localUri;

  const fileInfo = await FileSystem.getInfoAsync(localUri);
  if (!fileInfo.exists) {
      console.warn(`[Sync] File physically missing on device: ${localUri}`);
      return null; 
  }

  const ext = localUri.split(".").pop()?.toLowerCase() || 'jpg';
  const prefix = folderPath ? `${folderPath}/` : "";
  const fileName = `${prefix}${userId}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;

  let contentType = 'image/jpeg';
  if (ext === 'png') contentType = 'image/png';
  else if (ext === 'webp') contentType = 'image/webp';
  else if (ext === 'pdf') contentType = 'application/pdf';

  let base64 = "";
  try {
      base64 = await FileSystem.readAsStringAsync(localUri, { encoding: "base64" });
  } catch (err) {
      throw new Error(`File read error (too large or corrupted): ${localUri}`);
  }

  const { error } = await supabase.storage.from(bucket).upload(fileName, decode(base64), {
    contentType: contentType,
    upsert: true,
  });

  if (error) {
      throw new Error(`Supabase Storage rejection: ${error.message}`);
  }
  
  const { data } = supabase.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
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

    const tablesToSweep = ["accomplishments", "attendance", "saved_reports"];
    for (const table of tablesToSweep) {
        try {
            const unsyncedRows = await db.getAllAsync(`SELECT * FROM ${table} WHERE is_synced = 0`) as any[];
            for (const row of unsyncedRows) {
                const inQueue: any = await db.getFirstAsync(`SELECT id FROM sync_queue WHERE table_name = ? AND row_id = ?`, [table, row.id]);
                if (!inQueue) {
                    await db.runAsync(
                        `INSERT INTO sync_queue (table_name, row_id, action, data, status, retry_count) VALUES (?, ?, 'UPSERT', ?, 'PENDING', 0)`,
                        [table, row.id, JSON.stringify(row)]
                    );
                }
            }
        } catch(err) { 
            console.log("Sweep error", err); 
        }
    }

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
        if ("is_synced" in payload) delete payload.is_synced; 
        if ("local_avatar_path" in payload) delete payload.local_avatar_path;
        if ("snippet_desc" in payload) delete payload.snippet_desc;
        
        if (action !== "DELETE") {
          if (table_name === "profiles") payload.id = userId;
          else payload.user_id = userId;
          if (!payload.id) payload.id = row_id;
        }

        if (table_name === "saved_reports") {
          if ("file_path" in payload) delete payload.file_path;
          
          if ("is_read" in payload) {
             payload.is_read = payload.is_read === 1 || payload.is_read === true;
          }
        }
        
        if (table_name === "notifications") {
          if (payload.date) {
             payload.date = typeof payload.date === 'string' ? new Date(payload.date).getTime() : payload.date;
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

        if (table_name === "accomplishments" && payload.image_url && action !== "DELETE") {
            let imagesArray: string[] = [];
            
            if (typeof payload.image_url === 'string') {
                if (payload.image_url.startsWith('[')) {
                    imagesArray = JSON.parse(payload.image_url);
                } else if (payload.image_url.startsWith('file://')) {
                    imagesArray = [payload.image_url];
                }
            } else if (Array.isArray(payload.image_url)) {
                imagesArray = payload.image_url;
            }

            if (imagesArray.length > 0) {
                let updatedImages: string[] = [];
                let hasChanges = false;

                for (const uri of imagesArray) {
                    if (uri && uri.startsWith("file://")) {
                        const remoteUrl = await uploadFileToSupabase(uri, payload.user_id || "unknown", "entry-images", "entries");
                        
                        if (remoteUrl === null) {
                            hasChanges = true; 
                        } 
                        else if (typeof remoteUrl === 'string') {
                            updatedImages.push(remoteUrl);
                            hasChanges = true;
                        } 
                    } else {
                        updatedImages.push(uri);
                    }
                }

                if (hasChanges) {
                    payload.image_url = JSON.stringify(updatedImages);
                    try {
                        await db.runAsync(`UPDATE accomplishments SET image_url = ? WHERE id = ?`, [payload.image_url, row_id || payload.id]);
                    } catch { /* ignore safe errors */ }
                }
            }
        }

        if (table_name === "saved_reports" && payload.file_path?.startsWith("file://") && action !== "DELETE") {
          const remoteUrl = await uploadFileToSupabase(payload.file_path, payload.user_id, "reports");
          if (remoteUrl) payload.remote_url = remoteUrl;
        }
        
        if (table_name === "profiles" && payload.local_avatar_path?.startsWith("file://") && action !== "DELETE") {
          const remoteUrl = await uploadFileToSupabase(payload.local_avatar_path, row_id || payload.id, "avatars");
          if (remoteUrl) {
            payload.avatar_url = remoteUrl;
            try { await db.runAsync(`UPDATE profiles SET avatar_url = ? WHERE id = ?`, [remoteUrl, row_id || payload.id]); } catch { /* ignore */ }
          }
        }

        const groupKey = `${table_name}_${action}`;
        if (!batchGroups[groupKey]) batchGroups[groupKey] = { tableName: table_name, action, items: [], payloads: [] };
        
        if (action === "UPDATE" && Object.keys(payload).length === 0) {
            await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [id]);
            continue;
        }

        batchGroups[groupKey].items.push(item);
        batchGroups[groupKey].payloads.push(payload);

      } catch (err: any) {
        console.error(`[Sync] Pre-flight/Upload failed for queue id ${id}:`, err);
        await db.runAsync(`UPDATE sync_queue SET retry_count = retry_count + 1, status = 'FAILED' WHERE id = ?`, [id]);
        failedCount++;
        continue;
      }
      
      if (progressCallback) progressCallback(Math.floor((index / queueItems.length) * 50));
    }

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
                            try { await db.runAsync(`UPDATE ${tableName} SET is_synced = 1 WHERE id = ?`, [items[i].row_id]); } catch { /* ignore */ }
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
                    try { await db.runAsync(`UPDATE ${tableName} SET is_synced = 1 WHERE id = ?`, [item.row_id]); } catch { /* ignore */ }
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
                        if (tableName === 'saved_reports' && payload.remote_url) await deleteFileFromSupabase(payload.remote_url, "reports");
                        else if (tableName === 'accomplishments' && payload.image_url) {
                            try {
                                const urlsToDelete = payload.image_url.startsWith('[') ? JSON.parse(payload.image_url) : [payload.image_url];
                                for (const url of urlsToDelete) {
                                    if (url && url.startsWith('http')) {
                                        const bucket = url.includes('/entry-images/') ? 'entry-images' : 'accomplishments';
                                        await deleteFileFromSupabase(url, bucket);
                                    }
                                }
                            } catch { /* ignore */ }
                        }
                        const { error: err } = await supabase.from(tableName).delete().eq("id", rowId);
                        if (err) throw err;
                    }

                    await db.runAsync(`DELETE FROM sync_queue WHERE id = ?`, [items[i].id]);
                    if (action !== 'DELETE') {
                        try { await db.runAsync(`UPDATE ${tableName} SET is_synced = 1 WHERE id = ?`, [items[i].row_id]); } catch { /* ignore */ }
                    }
                    successCount++;
                }
            }
        } catch (err: any) {
            console.error(`[Sync] Supabase error on batch ${key}:`, err.message || err);
            for (const item of items) {
                await db.runAsync(`UPDATE sync_queue SET retry_count = retry_count + 1, status = 'FAILED' WHERE id = ?`, [item.id]);
            }
            failedCount += items.length;
        }
        
        keysProcessed++;
        if (progressCallback) progressCallback(50 + Math.floor((keysProcessed / orderedKeys.length) * 50));
    }
    
    if (progressCallback) progressCallback(100);
    return { success: true, count: successCount, failedCount };
  } catch (err) {
    return { success: false, error: err };
  }
};

const safeUpsert = async (db: any, table: string, id: string, sql: string, params: any[]): Promise<boolean> => {
  try {
    const pendingDelete: any = await db.getFirstAsync(
      `SELECT id FROM sync_queue WHERE table_name = ? AND row_id = ? AND action = 'DELETE'`, 
      [table, id]
    );
    if (pendingDelete) return true;

    const local: any = await db.getFirstAsync(`SELECT is_synced FROM ${table} WHERE id = ?`, [id]);
    if (local && local.is_synced === 0) return true; 
  } catch { /* ignore */ }
  
  await db.runAsync(sql, params);
  return false;
};

const fetchAllRows = async (query: any): Promise<any[]> => {
  const { data, error } = await query.limit(5000);
  if (error) throw error;
  return data || [];
};

export const syncPull = async (userId: string, progressCallback?: (progress: number) => void) => {
  try {
    const db = await getDB();
    const state = await NetInfo.fetch();
    if (state.isConnected === false) return { success: false, message: "Offline" };

    const result: any = await db.getFirstAsync("SELECT value FROM app_settings WHERE key = ?", ["last_synced_at"]);
    const lastSyncedAt = result?.value || "1970-01-01T00:00:00.000Z";
    let conflicts = 0;

    const jobsData = await fetchAllRows(
      supabase.from('job_positions').select('*').eq('user_id', userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const job of jobsData) {
      const isConflict = await safeUpsert(db, 'job_positions', job.id,
        `INSERT OR REPLACE INTO job_positions (id, user_id, title, company, department, employment_status, rate, rate_type, payout_type, period_target, work_schedule, break_schedule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [job.id, job.user_id, job.title, job.company, job.department, job.employment_status, job.rate, job.rate_type, job.payout_type, job.period_target, typeof job.work_schedule === 'object' ? JSON.stringify(job.work_schedule) : job.work_schedule, typeof job.break_schedule === 'object' ? JSON.stringify(job.break_schedule) : job.break_schedule, job.created_at, job.updated_at]
      );
      if (isConflict) conflicts++;
    }
    if (progressCallback) progressCallback(16);

    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).gt('updated_at', lastSyncedAt).maybeSingle();
    if (profileData) {
       const existing: any = await db.getFirstAsync("SELECT local_avatar_path FROM profiles WHERE id = ?", [userId]);
       
       let localAvatarPath = existing?.local_avatar_path || null;
       if (profileData.avatar_url && profileData.avatar_url.startsWith('http')) {
           const ext = profileData.avatar_url.split('.').pop()?.split('?')[0] || 'jpg';
           localAvatarPath = await downloadFile(profileData.avatar_url, 'avatars', `${userId}_avatar.${ext}`);
       }

       await db.runAsync(
         `INSERT OR REPLACE INTO profiles (id, email, first_name, last_name, middle_name, title, professional_suffix, current_job_id, full_name, avatar_url, local_avatar_path, is_onboarded, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         [profileData.id, profileData.email || "", profileData.first_name || "", profileData.last_name || "", profileData.middle_name || "", profileData.title || "", profileData.professional_suffix || "", profileData.current_job_id, profileData.full_name || "", profileData.avatar_url, localAvatarPath, profileData.is_onboarded ? 1 : 0, profileData.updated_at]
       );
    }
    if (progressCallback) progressCallback(33);

    const attendanceData = await fetchAllRows(
      supabase.from("attendance").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const row of attendanceData) {
      const isConflict = await safeUpsert(db, 'attendance', row.id,
        `INSERT OR REPLACE INTO attendance (id, user_id, job_id, date, title, clock_in, clock_out, status, remarks, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [row.id, row.user_id, row.job_id, row.date, row.title || null, row.clock_in, row.clock_out, row.status, row.remarks, row.updated_at || row.clock_in]
      );
      if (isConflict) conflicts++;
    }
    if (progressCallback) progressCallback(50);

    const taskData = await fetchAllRows(
      supabase.from("accomplishments").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const row of taskData) {
      let finalImageUrl = row.image_url;

      if (row.image_url && row.image_url.startsWith('[')) {
          try {
              const parsedUrls = JSON.parse(row.image_url);
              const localUrls = [];
              for (let i = 0; i < parsedUrls.length; i++) {
                  const url = parsedUrls[i];
                  if (url.startsWith('http')) {
                      const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
                      const localPath = await downloadFile(url, 'accomplishments', `${row.id}_${i}.${ext}`);
                      localUrls.push(localPath || url);
                  } else {
                      localUrls.push(url);
                  }
              }
              finalImageUrl = JSON.stringify(localUrls);
          } catch (err) {
              console.log("[Sync] Array parse error on pull", err);
          }
      } else if (row.image_url && row.image_url.startsWith('http')) {
          const ext = row.image_url.split('.').pop()?.split('?')[0] || 'jpg';
          const localPath = await downloadFile(row.image_url, 'accomplishments', `${row.id}.${ext}`);
          finalImageUrl = localPath ? JSON.stringify([localPath]) : JSON.stringify([row.image_url]);
      }

      const isConflict = await safeUpsert(db, 'accomplishments', row.id,
        `INSERT OR REPLACE INTO accomplishments (id, user_id, job_id, date, description, remarks, image_url, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [row.id, row.user_id, row.job_id, row.date, row.description || "", row.remarks || null, finalImageUrl, row.created_at, row.updated_at || row.created_at]
      );
      if (isConflict) conflicts++;
    }
    if (progressCallback) progressCallback(66);
    
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
      
      let localFilePath = "";
      if (row.remote_url && row.remote_url.startsWith('http')) {
          const ext = row.file_type || 'pdf';
          localFilePath = await downloadFile(row.remote_url, 'reports', `${row.id}.${ext}`) || "";
      }

      const isConflict = await safeUpsert(db, 'saved_reports', row.id,
        `INSERT OR REPLACE INTO saved_reports (id, user_id, title, file_path, file_type, file_size, remote_url, created_at, updated_at, is_read, period_key, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [row.id, row.user_id, row.title || "Untitled", localFilePath, row.file_type || "pdf", row.file_size || 0, row.remote_url || null, row.created_at, row.updated_at || row.created_at, isRead, row.period_key || null]
      );
      if (isConflict) conflicts++;
    }
    if (progressCallback) progressCallback(83);

    const notifData = await fetchAllRows(
      supabase.from("notifications").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`)
    );
    for (const row of notifData) {
      const isConflict = await safeUpsert(db, 'notifications', row.id,
        `INSERT OR REPLACE INTO notifications (id, user_id, title, body, type, is_read, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [row.id, row.user_id, row.title, row.body, row.type, row.is_read ? 1 : 0, row.created_at, row.updated_at || row.created_at]
      );
      if (isConflict) conflicts++;
    }
    if (progressCallback) progressCallback(100);

    const newSyncTime = new Date().toISOString();
    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", ["last_synced_at", newSyncTime]);
    
    return { success: true, conflictCount: conflicts };
  } catch (err) {
    console.error("[Sync] Pull Error:", err);
    return { success: false, error: err };
  }
};