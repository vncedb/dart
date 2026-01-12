import NetInfo from '@react-native-community/netinfo';
import { getDB } from './db-client';
import { supabase } from './supabase';

export const syncPush = async () => {
  try {
    const db = await getDB();
    
    // Get pending items
    const queueItems = await db.getAllAsync('SELECT * FROM sync_queue ORDER BY created_at ASC');
    if (queueItems.length === 0) return { success: true, count: 0 };

    const state = await NetInfo.fetch();
    if (!state.isConnected) return { success: false, error: 'No internet connection' };

    let successCount = 0;

    for (const item of queueItems) {
      const { id, table_name, row_id, action, data } = item as any;
      let payload = {};
      try {
         payload = data ? JSON.parse(data) : {};
      } catch (e) {
         // Corrupt data in queue? Delete it to unblock.
         await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
         continue;
      }

      let error = null;

      try {
        if (action === 'INSERT') {
          // Robustness: Use upsert to prevent PK collisions
          const { error: insertError } = await supabase.from(table_name).upsert(payload);
          error = insertError;
        } else if (action === 'UPDATE') {
          const { error: updateError } = await supabase.from(table_name).update(payload).eq('id', row_id);
          error = updateError;
        } else if (action === 'DELETE') {
          const { error: deleteError } = await supabase.from(table_name).delete().eq('id', row_id);
          error = deleteError;

          // --- SELF-HEALING FOR FK VIOLATION (23503) ---
          if (error && error.code === '23503' && table_name === 'job_positions') {
             // 1. Unlink from profiles
             await supabase.from('profiles').update({ current_job_id: null }).eq('current_job_id', row_id);
             // 2. Retry delete
             const { error: retryError } = await supabase.from(table_name).delete().eq('id', row_id);
             error = retryError;
          }
        }

        // Success or Ignore harmless errors
        if (!error || error.code === 'PGRST116' || error.code === '23505') {
          await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
          successCount++;
        } else {
          console.error(`Sync error for item: ${id}`, error);
        }
      } catch (innerError) {
          console.error("Error processing sync item", innerError);
      }
    }
    return { success: true, count: successCount };
  } catch (e) {
    console.error('Sync Push Global Error:', e);
    return { success: false, error: e };
  }
};

export const syncPull = async (userId: string) => {
  try {
    const db = await getDB();
    const state = await NetInfo.fetch();
    if (!state.isConnected) return { success: false, message: 'Offline' };

    const result: any = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['last_synced_at']);
    const lastSyncedAt = result?.value || '1970-01-01T00:00:00.000Z';
    const newSyncTime = new Date().toISOString();

    // --- CRITICAL FIX: Get list of items currently pending in queue ---
    // We must NOT overwrite local data if there is a pending DELETE or UPDATE for it.
    const pendingRows = await db.getAllAsync('SELECT table_name, row_id FROM sync_queue');
    const pendingMap = new Set(pendingRows.map((r: any) => `${r.table_name}:${r.row_id}`));

    // 1. Pull Profile
    const { data: profileData } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (profileData && !pendingMap.has(`profiles:${profileData.id}`)) {
      await db.runAsync(
        `INSERT OR REPLACE INTO profiles (id, email, first_name, last_name, middle_name, title, professional_suffix, current_job_id, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            profileData.id, 
            profileData.email, 
            profileData.first_name, 
            profileData.last_name, 
            profileData.middle_name,
            profileData.title, 
            profileData.professional_suffix,
            profileData.current_job_id, 
            profileData.updated_at
        ]
      );
    }

    // 2. Pull Jobs
    const { data: jobData } = await supabase.from('job_positions').select('*').eq('user_id', userId);
    if (jobData) {
      for (const job of jobData) {
        // SKIP if we have pending changes for this job locally
        if (pendingMap.has(`job_positions:${job.id}`)) continue;

        await db.runAsync(
          `INSERT OR REPLACE INTO job_positions (id, user_id, title, company, department, employment_status, rate, rate_type, work_schedule, break_schedule, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            job.id, 
            job.user_id, 
            job.title, 
            job.company || job.company_name, 
            job.department, 
            job.employment_status, 
            job.rate, 
            job.rate_type, 
            typeof job.work_schedule === 'string' ? job.work_schedule : JSON.stringify(job.work_schedule),
            typeof job.break_schedule === 'string' ? job.break_schedule : JSON.stringify(job.break_schedule),
            job.created_at, 
            job.updated_at
          ]
        );
      }
    }

    // 3. Pull Attendance
    const { data: attendanceData } = await supabase.from('attendance').select('*').eq('user_id', userId).gt('updated_at', lastSyncedAt);
    if (attendanceData) {
      for (const row of attendanceData) {
        if (pendingMap.has(`attendance:${row.id}`)) continue;
        
        await db.runAsync(
          `INSERT OR REPLACE INTO attendance (id, user_id, date, clock_in, clock_out, status, remarks, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.user_id, row.date, row.clock_in, row.clock_out, row.status, row.remarks, row.updated_at || newSyncTime]
        );
      }
    }

    // 4. Pull Accomplishments
    const { data: taskData } = await supabase.from('accomplishments').select('*').eq('user_id', userId).gt('created_at', lastSyncedAt);
    if (taskData) {
      for (const row of taskData) {
        if (pendingMap.has(`accomplishments:${row.id}`)) continue;

        await db.runAsync(
          `INSERT OR REPLACE INTO accomplishments (id, user_id, date, description, remarks, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.user_id, row.date, row.description, row.remarks, row.image_url, row.created_at]
        );
      }
    }

    await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['last_synced_at', newSyncTime]);
    return { success: true, count: (attendanceData?.length || 0) + (taskData?.length || 0) };

  } catch (e) {
    console.error('Pull Sync Error:', e);
    return { success: false, error: e };
  }
};