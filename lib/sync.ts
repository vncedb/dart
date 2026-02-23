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
  if (url.includes("/entry-images/"))
    return url.split("/entry-images/")[1].split("?")[0];
  if (url.includes("/accomplishments/"))
    return url.split("/accomplishments/")[1].split("?")[0];
  if (url.includes("/reports/")) 
    return url.split("/reports/")[1].split("?")[0];
  return null;
};

const deleteFileFromSupabase = async (
  fullUrl: string,
  bucket: string,
) => {
  const path = getPathFromUrl(fullUrl);
  if (!path) return;
  try {
    await supabase.storage.from(bucket).remove([path]);
  } catch (e) {
    console.log('[Sync] Delete file error:', e);
  }
};

const uploadFileToSupabase = async (
  localUri: string,
  userId: string,
  bucket: string,
  folderPath: string = ""
): Promise<string | null> => {
  try {
    if (!localUri || !localUri.startsWith("file://")) return localUri;

    const ext = localUri.split(".").pop();
    const prefix = folderPath ? `${folderPath}/` : "";
    const fileName = `${prefix}${userId}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;

    const base64 = await FileSystem.readAsStringAsync(localUri, {
      encoding: "base64",
    });

    const { error } = await supabase.storage
      .from(bucket)
      .upload(fileName, decode(base64), {
        contentType: bucket === "reports" ? "application/pdf" : `image/${ext}`,
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

// --- SYNC PUSH (Local -> Cloud) ---
export const syncPush = async () => {
  try {
    const db = await getDB();

    const queueItems = await db.getAllAsync(
      'SELECT * FROM sync_queue WHERE status = "PENDING" AND retry_count < ? ORDER BY created_at ASC',
      [MAX_RETRIES],
    );

    if (queueItems.length === 0) return { success: true, count: 0 };

    const state = await NetInfo.fetch();
    if (!state.isConnected)
      return { success: false, error: "No internet connection" };

    let successCount = 0;

    for (const item of queueItems) {
      const { id, table_name, row_id, action, data } = item as any;
      let payload: any = {};

      try {
        payload = data ? JSON.parse(data) : {};
        if ("is_synced" in payload) delete payload.is_synced;

        if (table_name === "accomplishments") {
          if (payload.image_url && payload.image_url.startsWith("file://") && action !== "DELETE") {
             const remoteUrl = await uploadFileToSupabase(payload.image_url, payload.user_id || "unknown", "entry-images", "entries");
             if (remoteUrl) payload.image_url = remoteUrl;
          }
        }
        
        if (table_name === "saved_reports") {
           if (payload.file_path && payload.file_path.startsWith("file://") && action !== "DELETE") {
             const remoteUrl = await uploadFileToSupabase(payload.file_path, payload.user_id, "reports");
             if (remoteUrl) {
               payload.remote_url = remoteUrl;
               delete payload.file_path; 
             }
           }
        }
        
        // --- NEW: AVATAR SYNC UPLOAD ---
        if (table_name === "profiles") {
            if (payload.local_avatar_path && payload.local_avatar_path.startsWith("file://") && action !== "DELETE") {
                const remoteUrl = await uploadFileToSupabase(payload.local_avatar_path, row_id || payload.id, "avatars");
                if (remoteUrl) {
                    payload.avatar_url = remoteUrl;
                    // Silently sync the successful link back into SQLite
                    try {
                        const localDb = await getDB();
                        await localDb.runAsync(`UPDATE profiles SET avatar_url = ? WHERE id = ?`, [remoteUrl, row_id || payload.id]);
                    } catch(e) {}
                }
            }
            // Ensure local-only columns are not pushed to Supabase Schema
            delete payload.local_avatar_path;
        }

      } catch (e: any) {
        console.error(`[Sync] Pre-flight failed for ${id}:`, e);
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
          if (table_name === 'saved_reports' && payload.remote_url) {
             await deleteFileFromSupabase(payload.remote_url, "reports");
          } else if (table_name === 'accomplishments' && payload.image_url) {
             const bucket = payload.image_url.includes('/entry-images/') ? 'entry-images' : 'accomplishments';
             await deleteFileFromSupabase(payload.image_url, bucket);
          }
          const { error: err } = await supabase.from(table_name).delete().eq("id", row_id);
          error = err;
        }

        if (!error || error.code === "PGRST116" || error.code === "23505") {
           await db.runAsync("DELETE FROM sync_queue WHERE id = ?", [id]);
           if (action !== 'DELETE') {
             try { await db.runAsync(`UPDATE ${table_name} SET is_synced = 1 WHERE id = ?`, [row_id]); } catch(e) {}
           }
           successCount++;
        } else {
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

// --- SYNC PULL (Cloud -> Local) ---
export const syncPull = async (userId: string) => {
  try {
    const db = await getDB();
    const state = await NetInfo.fetch();
    if (!state.isConnected) return { success: false, message: "Offline" };

    const result: any = await db.getFirstAsync("SELECT value FROM app_settings WHERE key = ?", ["last_synced_at"]);
    const lastSyncedAt = result?.value || "1970-01-01T00:00:00.000Z";
    const newSyncTime = new Date().toISOString();

    // 1. PULL JOBS
    const { data: jobsData } = await supabase.from('job_positions').select('*').eq('user_id', userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`);
    if (jobsData && jobsData.length > 0) {
      for (const job of jobsData) {
        await db.runAsync(
          `INSERT OR REPLACE INTO job_positions (id, user_id, title, company, department, employment_status, rate, rate_type, payout_type, work_schedule, break_schedule, created_at, updated_at) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            job.id, job.user_id, job.title, job.company, job.department, job.employment_status, 
            job.rate, job.rate_type, job.payout_type, 
            typeof job.work_schedule === 'object' ? JSON.stringify(job.work_schedule) : job.work_schedule,
            typeof job.break_schedule === 'object' ? JSON.stringify(job.break_schedule) : job.break_schedule,
            job.created_at, job.updated_at
          ]
        );
      }
    }

    // 2. PULL PROFILE
    const { data: profileData, error: profileErr } = await supabase.from('profiles').select('*').eq('id', userId).gt('updated_at', lastSyncedAt).maybeSingle();
    
    if (profileData && !profileErr) {
       const existing: any = await db.getFirstAsync("SELECT local_avatar_path FROM profiles WHERE id = ?", [userId]);
       
       await db.runAsync(
         `INSERT OR REPLACE INTO profiles (id, email, first_name, last_name, middle_name, title, professional_suffix, current_job_id, full_name, avatar_url, local_avatar_path, is_onboarded, updated_at) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
         [
             profileData.id, 
             profileData.email || "", 
             profileData.first_name || "", 
             profileData.last_name || "", 
             profileData.middle_name || "", 
             profileData.title || "", 
             profileData.professional_suffix || "", 
             profileData.current_job_id, 
             profileData.full_name || "", 
             profileData.avatar_url, 
             existing?.local_avatar_path || null,
             profileData.is_onboarded ? 1 : 0, 
             profileData.updated_at
         ]
       );
    }

    // 3. PULL Attendance
    const { data: attendanceData } = await supabase.from("attendance").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},date.gt.${lastSyncedAt}`);
    if (attendanceData) {
       for (const row of attendanceData) {
         await db.runAsync(
           `INSERT OR REPLACE INTO attendance (id, user_id, job_id, date, clock_in, clock_out, status, remarks, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
           [row.id, row.user_id, row.job_id, row.date, row.clock_in, row.clock_out, row.status, row.remarks, row.updated_at || row.clock_in]
         );
       }
    }

    // 4. PULL Accomplishments
    const { data: taskData } = await supabase.from("accomplishments").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`);
    if (taskData) {
      for (const row of taskData) {
         await db.runAsync(
           `INSERT OR REPLACE INTO accomplishments (id, user_id, job_id, date, description, remarks, image_url, created_at, updated_at, is_synced) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
           [row.id, row.user_id, row.job_id, row.date, row.description || "", row.remarks || null, row.image_url || null, row.created_at, row.updated_at || row.created_at]
         );
      }
    }
    
    // 5. PULL Reports 
    const { data: reportsData } = await supabase.from("saved_reports").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`);
    if (reportsData) {
        for (const row of reportsData) {
            await db.runAsync(
                `INSERT OR REPLACE INTO saved_reports (id, user_id, title, file_path, file_type, file_size, remote_url, created_at, updated_at, is_read, period_key, is_synced) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
                [
                  row.id, 
                  row.user_id, 
                  row.title || "Untitled", 
                  "", 
                  row.file_type || "pdf", 
                  row.file_size || 0, 
                  row.remote_url || null, 
                  row.created_at, 
                  row.updated_at || row.created_at,
                  row.is_read ? 1 : 0,
                  row.period_key || null
                ]
            );
        }
    }

    // 6. PULL NOTIFICATIONS
    const { data: notifData } = await supabase.from("notifications").select("*").eq("user_id", userId).or(`updated_at.gt.${lastSyncedAt},created_at.gt.${lastSyncedAt}`);

    if (notifData) {
      for (const row of notifData) {
         await db.runAsync(
           `INSERT OR REPLACE INTO notifications (id, user_id, title, body, type, is_read, created_at, updated_at, is_synced) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
           [
             row.id, 
             row.user_id, 
             row.title, 
             row.body, 
             row.type, 
             row.is_read ? 1 : 0, 
             row.created_at, 
             row.updated_at || row.created_at
           ]
         );
      }
    }

    await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)", ["last_synced_at", newSyncTime]);
    return { success: true };
  } catch (e) {
    console.error("[Sync] Pull Error:", e);
    return { success: false, error: e };
  }
};