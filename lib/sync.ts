import NetInfo from '@react-native-community/netinfo';
import { getDB } from './db-client'; //
import { supabase } from './supabase';

export const syncPush = async () => {
  try {
    const db = await getDB();
    
    // 1. Get all pending items from queue
    const queueItems = await db.getAllAsync('SELECT * FROM sync_queue ORDER BY created_at ASC');
    
    if (queueItems.length === 0) return;

    const state = await NetInfo.fetch();
    if (!state.isConnected) return;

    for (const item of queueItems) {
      const { id, table_name, row_id, action, data } = item as any;
      const payload = data ? JSON.parse(data) : {};

      let error = null;

      try {
        if (action === 'INSERT') {
          // Clean payload before sending to Supabase (remove local-only fields if needed)
          const { error: insertError } = await supabase.from(table_name).insert(payload);
          error = insertError;
        } else if (action === 'UPDATE') {
          const { error: updateError } = await supabase.from(table_name).update(payload).eq('id', row_id);
          error = updateError;
        } else if (action === 'DELETE') {
          const { error: deleteError } = await supabase.from(table_name).delete().eq('id', row_id);
          error = deleteError;
        }

        if (!error) {
          // Success: Remove from queue
          await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
        } else {
          console.error('Sync error for item:', id, error);
          // If row not found (already deleted) or duplicate, remove to prevent blocking
          if (error.code === 'PGRST116' || error.code === '23505') {
              await db.runAsync('DELETE FROM sync_queue WHERE id = ?', [id]);
          }
        }
      } catch (innerError) {
          console.error("Error processing sync item", innerError);
      }
    }
  } catch (e) {
    console.error('Sync Push Global Error:', e);
  }
};

export const syncPull = async (userId: string) => {
  try {
    const db = await getDB();
    const state = await NetInfo.fetch();
    if (!state.isConnected) return;

    // 1. Get last sync time
    const result: any = await db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['last_synced_at']);
    const lastSyncedAt = result?.value || '1970-01-01T00:00:00.000Z';
    const newSyncTime = new Date().toISOString();

    // 2. Pull Attendance
    const { data: attendanceData } = await supabase
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .gt('updated_at', lastSyncedAt);

    if (attendanceData) {
      for (const row of attendanceData) {
        await db.runAsync(
          `INSERT OR REPLACE INTO attendance (id, user_id, date, clock_in, clock_out, status, remarks, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.user_id, row.date, row.clock_in, row.clock_out, row.status, row.remarks, row.updated_at || newSyncTime]
        );
      }
    }

    // 3. Pull Accomplishments
    const { data: taskData } = await supabase
      .from('accomplishments')
      .select('*')
      .eq('user_id', userId)
      .gt('created_at', lastSyncedAt);

    if (taskData) {
      for (const row of taskData) {
        await db.runAsync(
          `INSERT OR REPLACE INTO accomplishments (id, user_id, date, description, remarks, image_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [row.id, row.user_id, row.date, row.description, row.remarks, row.image_url, row.created_at]
        );
      }
    }

    // 4. Update last sync time
    await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', ['last_synced_at', newSyncTime]);
    
  } catch (e) {
    console.error('Pull Sync Error:', e);
  }
};