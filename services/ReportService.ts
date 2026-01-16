import { endOfWeek, format, getWeek, startOfWeek } from 'date-fns';
import { queueSyncItem } from '../lib/database';
import { getDB } from '../lib/db-client';

export const ReportService = {
  getActiveJob: async (userId: string) => {
    const db = await getDB();
    const profile: any = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [userId]);
    if (!profile?.current_job_id) return null;
    return await db.getFirstAsync('SELECT * FROM job_positions WHERE id = ?', [profile.current_job_id]);
  },

  getDailyReport: async (userId: string, date: string) => {
    const db = await getDB();
    const attendance = await db.getFirstAsync('SELECT * FROM attendance WHERE user_id = ? AND date = ?', [userId, date]);
    const tasks = await db.getAllAsync('SELECT * FROM accomplishments WHERE user_id = ? AND date = ?', [userId, date]);
    return { attendance, tasks: tasks || [] };
  },

  getReportRange: async (userId: string, jobId: string, startDate: string, endDate: string) => {
    const db = await getDB();
    const attendance = await db.getAllAsync(
      'SELECT * FROM attendance WHERE user_id = ? AND job_id = ? AND date >= ? AND date <= ? ORDER BY date ASC', 
      [userId, jobId, startDate, endDate]
    );
    const tasks = await db.getAllAsync(
      'SELECT * FROM accomplishments WHERE user_id = ? AND job_id = ? AND date >= ? AND date <= ?', 
      [userId, jobId, startDate, endDate]
    );
    return { attendance, tasks };
  },

  deleteReportDay: async (userId: string, jobId: string, date: string) => {
    const db = await getDB();
    
    // Get IDs first for sync queue
    const att: any = await db.getFirstAsync('SELECT id FROM attendance WHERE user_id = ? AND job_id = ? AND date = ?', [userId, jobId, date]);
    const tasks: any[] = await db.getAllAsync('SELECT id FROM accomplishments WHERE user_id = ? AND job_id = ? AND date = ?', [userId, jobId, date]);

    if (att) await queueSyncItem('attendance', att.id, 'DELETE');
    for (const t of tasks) { await queueSyncItem('accomplishments', t.id, 'DELETE'); }

    // Delete
    await db.runAsync('DELETE FROM attendance WHERE user_id = ? AND job_id = ? AND date = ?', [userId, jobId, date]);
    await db.runAsync('DELETE FROM accomplishments WHERE user_id = ? AND job_id = ? AND date = ?', [userId, jobId, date]);
  },

  groupReportsByPayout: (data: any[], payoutType: string) => {
    const today = new Date();
    // Default to Semi-Monthly if not provided
    const type = payoutType || 'Semi-Monthly'; 
    
    return data.reduce((acc: any, curr) => {
        const [y, m, d] = curr.date.split('-').map(Number);
        const date = new Date(y, m - 1, d);
        let groupKey = "";
        let dateRange = {};
        let isCurrent = false;

        if (type === 'Weekly') {
            const weekNum = getWeek(date);
            const start = startOfWeek(date, { weekStartsOn: 1 });
            const end = endOfWeek(date, { weekStartsOn: 1 });
            groupKey = `Week ${weekNum} • ${format(start, 'MMM d')} - ${format(end, 'MMM d')}`;
            dateRange = { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
            if (weekNum === getWeek(today) && date.getFullYear() === today.getFullYear()) isCurrent = true;
        } else if (type === 'Monthly') {
            groupKey = format(date, 'MMMM yyyy');
            const start = new Date(date.getFullYear(), date.getMonth(), 1);
            const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
            dateRange = { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
            if (date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) isCurrent = true;
        } else {
            // Semi-Monthly (Handles 'Semi-Monthly', 'Bi-Weekly' as fallback, etc.)
            // Assumes 1st-15th and 16th-End of Month logic
            const day = date.getDate();
            const month = date.toLocaleString('default', { month: 'long' });
            const year = date.getFullYear();
            const monthNum = date.getMonth() + 1;
            const monthStr = monthNum < 10 ? `0${monthNum}` : monthNum;
            if (day <= 15) {
                groupKey = `1st Cutoff ${month} ${year}`;
                dateRange = { start: `${year}-${monthStr}-01`, end: `${year}-${monthStr}-15` };
                if (today.getFullYear() === year && today.getMonth() + 1 === monthNum && today.getDate() <= 15) isCurrent = true;
            } else {
                groupKey = `2nd Cutoff ${month} ${year}`;
                const lastDay = new Date(year, monthNum, 0).getDate();
                dateRange = { start: `${year}-${monthStr}-16`, end: `${year}-${monthStr}-${lastDay}` };
                if (today.getFullYear() === year && today.getMonth() + 1 === monthNum && today.getDate() > 15) isCurrent = true;
            }
        }

        if (!acc[groupKey]) { acc[groupKey] = { title: groupKey, data: [], ...dateRange, isCurrent }; }
        acc[groupKey].data.push(curr);
        return acc;
    }, {});
  }
};