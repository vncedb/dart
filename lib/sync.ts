import NetInfo from "@react-native-community/netinfo";
import { decode } from "base64-arraybuffer";
// FIXED: Use legacy import
import * as FileSystem from "expo-file-system/legacy";
import { getDB } from "./db-client";
import { supabase } from "./supabase";

const MAX_RETRIES = 5;

// --- FILE HELPERS ---

const getPathFromUrl = (url: string) => {
  if (!url) return null;
  // Handle both accomplishments and reports buckets
  if (url.includes("/accomplishments/"))
    return url.split("/accomplishments/")[1].split("?")[0];
  if (url.includes("/reports/")) return url.split("/reports/")[1].split("?")[0];
  return null;
};

const deleteFileFromSupabase = async (
  fullUrl: string,
  bucket: string = "accomplishments",
) => {
  const path = getPathFromUrl(fullUrl);
  if (!path) return;
  console.log(`[Sync] Deleting old file from ${bucket}: ${path}`);
  await supabase.storage.from(bucket).remove([path]);
};

const uploadFileToSupabase = async (
  localUri: string,
  userId: string,
  bucket: string = "accomplishments",
): Promise<string | null> => {
  try {
    if (!localUri || !localUri.startsWith("file://")) return localUri;

    const ext = localUri.split(".").pop();
    const fileName = `${userId}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;

    console.log(`[Sync] Uploading file to ${bucket}: ${fileName}`);

    // FIXED: Use string 'base64' instead of Enum to avoid namespace errors
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

// --- SYNC ENGINE ---

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

        // --- ACCOMPLISHMENTS (IMAGES) ---
        if (table_name === "accomplishments") {
          if (
            payload.image_url &&
            payload.image_url.startsWith("file://") &&
            action !== "DELETE"
          ) {
            if (action === "UPDATE") {
              const { data: oldRecord } = await supabase
                .from("accomplishments")
                .select("image_url")
                .eq("id", row_id)
                .single();
              if (
                oldRecord?.image_url &&
                oldRecord.image_url !== payload.image_url
              )
                await deleteFileFromSupabase(oldRecord.image_url);
            }
            const remoteUrl = await uploadFileToSupabase(
              payload.image_url,
              payload.user_id || "unknown",
              "accomplishments",
            );
            if (remoteUrl) payload.image_url = remoteUrl;
          }
          if (action === "DELETE" && payload.image_url)
            await deleteFileFromSupabase(payload.image_url);
        }

        // --- SAVED REPORTS (PDF/EXCEL) ---
        if (table_name === "saved_reports") {
          if (
            payload.file_path &&
            payload.file_path.startsWith("file://") &&
            action !== "DELETE"
          ) {
            // Upload File
            const remoteUrl = await uploadFileToSupabase(
              payload.file_path,
              payload.user_id,
              "reports",
            );
            if (remoteUrl) {
              payload.remote_url = remoteUrl;
              // We don't send file_path (local URI) to Supabase
              delete payload.file_path;
            }
          }
          if (action === "DELETE" && payload.remote_url)
            await deleteFileFromSupabase(payload.remote_url, "reports");
        }
      } catch (e: any) {
        console.error(`[Sync] Pre-flight failed for ${id}:`, e);
        if (e.message === "File upload failed") {
          await db.runAsync(
            "UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?",
            [id],
          );
          continue;
        } else {
          await db.runAsync("DELETE FROM sync_queue WHERE id = ?", [id]);
          continue;
        }
      }

      let error = null;

      try {
        if (action === "INSERT") {
          const { error: insertError } = await supabase
            .from(table_name)
            .upsert(payload);
          error = insertError;
        } else if (action === "UPDATE") {
          const { error: updateError } = await supabase
            .from(table_name)
            .update(payload)
            .eq("id", row_id);
          error = updateError;
          // Retry for schema mismatch on updated_at
          if (
            error &&
            (error.code === "PGRST204" || error.code === "42703") &&
            payload.updated_at
          ) {
            const safePayload = { ...payload };
            delete safePayload.updated_at;
            const { error: retryError } = await supabase
              .from(table_name)
              .update(safePayload)
              .eq("id", row_id);
            error = retryError;
          }
        } else if (action === "DELETE") {
          const { error: deleteError } = await supabase
            .from(table_name)
            .delete()
            .eq("id", row_id);
          error = deleteError;
        }

        if (!error || error.code === "PGRST116" || error.code === "23505") {
          await db.runAsync("DELETE FROM sync_queue WHERE id = ?", [id]);
          if (action !== "DELETE") {
            try {
              await db.runAsync(
                `UPDATE ${table_name} SET is_synced = 1 WHERE id = ?`,
                [row_id],
              );
              // If it was a report upload, ensure local DB has the remote URL
              if (table_name === "saved_reports" && payload.remote_url) {
                await db.runAsync(
                  `UPDATE saved_reports SET remote_url = ? WHERE id = ?`,
                  [payload.remote_url, row_id],
                );
              }
            } catch (err) {
              /* FIXED: removed unused variable */
            }
          }
          successCount++;
        } else {
          console.error(`[Sync] DB Error (${table_name}):`, error);
          if (error.code === "PGRST204" || error.code === "42703") {
            await db.runAsync("DELETE FROM sync_queue WHERE id = ?", [id]);
          } else {
            await db.runAsync(
              "UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?",
              [id],
            );
          }
        }
      } catch (innerError) {
        /* FIXED: removed unused variable */
        await db.runAsync(
          "UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?",
          [id],
        );
      }
    }
    return { success: true, count: successCount };
  } catch (e) {
    return { success: false, error: e };
  }
};

export const syncPull = async (userId: string) => {
  try {
    const db = await getDB();
    const state = await NetInfo.fetch();
    if (!state.isConnected) return { success: false, message: "Offline" };

    const result: any = await db.getFirstAsync(
      "SELECT value FROM app_settings WHERE key = ?",
      ["last_synced_at"],
    );
    const lastSyncedAt = result?.value || "1970-01-01T00:00:00.000Z";
    const newSyncTime = new Date().toISOString();

    const pendingRows = await db.getAllAsync(
      "SELECT table_name, row_id FROM sync_queue",
    );
    const pendingMap = new Set(
      pendingRows.map((r: any) => `${r.table_name}:${r.row_id}`),
    );

    // 1. Pull Attendance
    const { data: attendanceData } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .gt("updated_at", lastSyncedAt);
    if (attendanceData) {
      const stmt = await db.prepareAsync(
        `INSERT OR REPLACE INTO attendance (id, user_id, job_id, date, clock_in, clock_out, status, remarks, updated_at, is_synced) VALUES ($id, $user_id, $job_id, $date, $clock_in, $clock_out, $status, $remarks, $updated_at, 1)`,
      );
      try {
        for (const row of attendanceData) {
          if (!pendingMap.has(`attendance:${row.id}`))
            await stmt.executeAsync({
              $id: row.id,
              $user_id: row.user_id,
              $job_id: row.job_id,
              $date: row.date,
              $clock_in: row.clock_in,
              $clock_out: row.clock_out,
              $status: row.status,
              $remarks: row.remarks,
              $updated_at: row.updated_at,
            });
        }
      } finally {
        await stmt.finalizeAsync();
      }
    }

    // 2. Pull Accomplishments
    const { data: taskData } = await supabase
      .from("accomplishments")
      .select("*")
      .eq("user_id", userId)
      .gt("created_at", lastSyncedAt);
    if (taskData) {
      const stmt = await db.prepareAsync(
        `INSERT OR REPLACE INTO accomplishments (id, user_id, job_id, date, description, remarks, image_url, created_at, is_synced) VALUES ($id, $user_id, $job_id, $date, $description, $remarks, $image_url, $created_at, 1)`,
      );
      try {
        for (const row of taskData) {
          if (!pendingMap.has(`accomplishments:${row.id}`))
            await stmt.executeAsync({
              $id: row.id,
              $user_id: row.user_id,
              $job_id: row.job_id,
              $date: row.date,
              $description: row.description,
              $remarks: row.remarks,
              $image_url: row.image_url,
              $created_at: row.created_at,
            });
        }
      } finally {
        await stmt.finalizeAsync();
      }
    }

    // 3. Pull Saved Reports
    const { data: reportsData } = await supabase
      .from("saved_reports")
      .select("*")
      .eq("user_id", userId)
      .gt("created_at", lastSyncedAt);

    if (reportsData && reportsData.length > 0) {
      const statement = await db.prepareAsync(
        `INSERT OR REPLACE INTO saved_reports (id, user_id, title, file_path, file_type, file_size, remote_url, created_at, updated_at, is_synced) VALUES ($id, $user_id, $title, $file_path, $file_type, $file_size, $remote_url, $created_at, $updated_at, 1)`,
      );
      try {
        for (const row of reportsData) {
          if (pendingMap.has(`saved_reports:${row.id}`)) continue;
          await statement.executeAsync({
            $id: row.id,
            $user_id: row.user_id,
            $title: row.title,
            $file_path: row.remote_url, // Fallback to remote if pulling fresh
            $file_type: row.file_type,
            $file_size: row.file_size,
            $remote_url: row.remote_url,
            $created_at: row.created_at,
            $updated_at: row.updated_at,
          });
        }
      } finally {
        await statement.finalizeAsync();
      }
    }

    await db.runAsync(
      "INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)",
      ["last_synced_at", newSyncTime],
    );
    return { success: true, count: 1 };
  } catch (e) {
    console.error("[Sync] Pull Error:", e);
    return { success: false, error: e };
  }
};
