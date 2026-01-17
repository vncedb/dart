import NetInfo from '@react-native-community/netinfo';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system';
import { getDB } from './db-client';
import { supabase } from './supabase';

const MAX_RETRIES = 5;

// --- FILE HELPERS ---

// Extract "user_id/timestamp.jpg" from the full Supabase URL
const getPathFromUrl = (url: string) => {
    if (!url || !url.includes('/accomplishments/')) return null;
    const parts = url.split('/accomplishments/');
    if (parts.length < 2) return null;
    // Remove query params if any
    return parts[1].split('?')[0];
};

const deleteFileFromSupabase = async (fullUrl: string) => {
    const path = getPathFromUrl(fullUrl);
    if (!path) return;
    
    console.log(`[Sync] Deleting old file: ${path}`);
    await supabase.storage.from('accomplishments').remove([path]);
};

const uploadImageToSupabase = async (localUri: string, userId: string): Promise<string | null> => {
    try {
        if (!localUri || !localUri.startsWith('file://')) return localUri;

        const ext = localUri.split('.').pop();
        const fileName = `${userId}/${Date.now()}_${Math.floor(Math.random() * 1000)}.${ext}`;
        
        console.log(`[Sync] Uploading new file: ${fileName}`);
        
        const base64 = await FileSystem.readAsStringAsync(localUri, { 
            encoding: FileSystem.EncodingType.Base64 
        });
        
        const { error } = await supabase.storage
            .from('accomplishments')
            .upload(fileName, decode(base64), { 
                contentType: `image/${ext}`, 
                upsert: true 
            });

        if (error) throw error;

        const { data } = supabase.storage.from('accomplishments').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (e) {
        console.error("[Sync] Image Upload Failed:", e);
        throw new Error("Image upload failed");
    }
};

// --- SYNC ENGINE ---

export const syncPush = async () => {
  try {
    const db = await getDB();
    
    const queueItems = await db.getAllAsync(
        'SELECT * FROM sync_queue WHERE status = "PENDING" AND retry_count < ? ORDER BY created_at ASC', 
        [MAX_RETRIES]
    );
    
    if (queueItems.length === 0) return { success: true, count: 0 };

    const state = await NetInfo.fetch();
    if (!state.isConnected) return { success: false, error: 'No internet connection' };

    let successCount = 0;

    for (const item of queueItems) {
      const { id, table_name, row_id, action, data } = item as any;
      let payload: any = {};
      
      try {
         payload = data ? JSON.parse(data) : {};
         
         // 1. Strip local flags
         if ('is_synced' in payload) delete payload.is_synced;

         // 2. IMAGE REPLACEMENT LOGIC (GitHub-like replace)
         if (table_name === 'accomplishments') {
             
             // CASE A: INSERT or UPDATE with a new file
             if (payload.image_url && payload.image_url.startsWith('file://') && action !== 'DELETE') {
                 
                 // If UPDATE, try to delete the OLD file from cloud first
                 if (action === 'UPDATE') {
                     const { data: oldRecord } = await supabase
                        .from('accomplishments')
                        .select('image_url')
                        .eq('id', row_id)
                        .single();
                        
                     if (oldRecord && oldRecord.image_url && oldRecord.image_url !== payload.image_url) {
                         await deleteFileFromSupabase(oldRecord.image_url);
                     }
                 }

                 // Upload new file
                 const remoteUrl = await uploadImageToSupabase(payload.image_url, payload.user_id || 'unknown');
                 if (remoteUrl) payload.image_url = remoteUrl;
             }
             
             // CASE B: DELETE logic (Clean up cloud file)
             if (action === 'DELETE' && payload.image_url) {
                 await deleteFileFromSupabase(payload.image_url);
             }
         }

      } catch (e: any) {
         console.error(`[Sync] Pre-flight failed for ${id}:`, e);
         if (e.message === "Image upload failed") {
             // Keep in queue to retry upload later
             await db.runAsync('UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?', [id]);
             continue; 
         } else {
             // Data corruption, skip
             await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
             continue;
         }
      }

      let error = null;

      try {
        if (action === 'INSERT') {
          const { error: insertError } = await supabase.from(table_name).upsert(payload);
          error = insertError;
        } else if (action === 'UPDATE') {
          const { error: updateError } = await supabase.from(table_name).update(payload).eq('id', row_id);
          error = updateError;

          // Retry logic for schema mismatch
          if (error && (error.code === 'PGRST204' || error.code === '42703') && payload.updated_at) {
              const safePayload = { ...payload };
              delete safePayload.updated_at;
              const { error: retryError } = await supabase.from(table_name).update(safePayload).eq('id', row_id);
              error = retryError;
          }

        } else if (action === 'DELETE') {
          const { error: deleteError } = await supabase.from(table_name).delete().eq('id', row_id);
          error = deleteError;
        }

        // --- SUCCESS ---
        if (!error || error.code === 'PGRST116' || error.code === '23505') {
          // Remove from queue
          await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
          
          // Mark local record as synced
          if (action !== 'DELETE') {
             try {
               await db.runAsync(`UPDATE ${table_name} SET is_synced = 1 WHERE id = ?`, [row_id]);
               
               // Save the new remote URL locally to ensure consistency
               if (table_name === 'accomplishments' && payload.image_url && payload.image_url.startsWith('http')) {
                   await db.runAsync(`UPDATE accomplishments SET image_url = ? WHERE id = ?`, [payload.image_url, row_id]);
               }
             } catch (err) {}
          }
          successCount++;
        } else {
          console.error(`[Sync] DB Error:`, error);
          if (error.code === 'PGRST204' || error.code === '42703') {
              await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
          } else {
              await db.runAsync('UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?', [id]);
          }
        }
      } catch (innerError) {
          await db.runAsync('UPDATE sync_queue SET retry_count = retry_count + 1 WHERE id = ?', [id]);
      }
    }
    return { success: true, count: successCount };
  } catch (e) {
    return { success: false, error: e };
  }
};

export const syncPull = async (userId: string) => {
  // Pull logic remains same as previous accurate version...
  try {
    const db = await getDB();
    const state = await NetInfo.fetch();
    if (!state.isConnected) return { success: false, message: 'Offline' };

    const result: any = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['last_synced_at']);
    const lastSyncedAt = result?.value || '1970-01-01T00:00:00.000Z';
    const newSyncTime = new Date().toISOString();

    const pendingRows = await db.getAllAsync('SELECT table_name, row_id FROM sync_queue');
    const pendingMap = new Set(pendingRows.map((r: any) => `${r.table_name}:${r.row_id}`));

    // 1. Pull Attendance
    const { data: attendanceData } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userId)
        .gt('updated_at', lastSyncedAt);

    if (attendanceData && attendanceData.length > 0) {
      const statement = await db.prepareAsync(
         `INSERT OR REPLACE INTO attendance (id, user_id, job_id, date, clock_in, clock_out, status, remarks, updated_at, is_synced) VALUES ($id, $user_id, $job_id, $date, $clock_in, $clock_out, $status, $remarks, $updated_at, 1)`
      );
      try {
        for (const row of attendanceData) {
          if (pendingMap.has(`attendance:${row.id}`)) continue;
          await statement.executeAsync({
             $id: row.id,
             $user_id: row.user_id,
             $job_id: row.job_id || null,
             $date: row.date,
             $clock_in: row.clock_in,
             $clock_out: row.clock_out,
             $status: row.status,
             $remarks: row.remarks,
             $updated_at: row.updated_at || newSyncTime
          });
        }
      } finally {
        await statement.finalizeAsync();
      }
    }

    // 2. Pull Accomplishments
    const { data: taskData } = await supabase
        .from('accomplishments')
        .select('*')
        .eq('user_id', userId)
        .gt('created_at', lastSyncedAt);

    if (taskData && taskData.length > 0) {
      const statement = await db.prepareAsync(
         `INSERT OR REPLACE INTO accomplishments (id, user_id, job_id, date, description, remarks, image_url, created_at, is_synced) VALUES ($id, $user_id, $job_id, $date, $description, $remarks, $image_url, $created_at, 1)`
      );
      try {
        for (const row of taskData) {
           if (pendingMap.has(`accomplishments:${row.id}`)) continue;
           await statement.executeAsync({
              $id: row.id,
              $user_id: row.user_id,
              $job_id: row.job_id || null,
              $date: row.date,
              $description: row.description,
              $remarks: row.remarks,
              $image_url: row.image_url,
              $created_at: row.created_at
           });
        }
      } finally {
        await statement.finalizeAsync();
      }
    }

    await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['last_synced_at', newSyncTime]);
    return { success: true, count: (attendanceData?.length || 0) + (taskData?.length || 0) };

  } catch (e) {
    console.error('[Sync] Pull Error:', e);
    return { success: false, error: e };
  }
};