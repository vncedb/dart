import { endOfWeek, format, getWeek, startOfWeek, subDays } from 'date-fns';
import { generateUUID, getUnreadReportsCount, queueSyncItem, saveReportLocal } from '../lib/database';
import { getDB } from '../lib/db-client';
import { scheduleReportNotification } from '../lib/notifications';
import { generateReport } from '../utils/reportGenerator';

export const ReportService = {
  getActiveJob: async (userId: string) => {
    const db = await getDB();
    const profile: any = await db.getFirstAsync('SELECT current_job_id, full_name, title FROM profiles WHERE id = ?', [userId]);
    if (!profile?.current_job_id) return null;
    
    const job: any = await db.getFirstAsync('SELECT * FROM job_positions WHERE id = ?', [profile.current_job_id]);
    // Merge profile info for report generation context
    return { ...job, userName: profile.full_name, userTitle: profile.title };
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
    const att: any = await db.getFirstAsync('SELECT id FROM attendance WHERE user_id = ? AND job_id = ? AND date = ?', [userId, jobId, date]);
    const tasks: any[] = await db.getAllAsync('SELECT id, image_url FROM accomplishments WHERE user_id = ? AND job_id = ? AND date = ?', [userId, jobId, date]);

    if (att) await queueSyncItem('attendance', att.id, 'DELETE');
    for (const t of tasks) await queueSyncItem('accomplishments', t.id, 'DELETE', { image_url: t.image_url }); 

    await db.runAsync('DELETE FROM attendance WHERE user_id = ? AND job_id = ? AND date = ?', [userId, jobId, date]);
    await db.runAsync('DELETE FROM accomplishments WHERE user_id = ? AND job_id = ? AND date = ?', [userId, jobId, date]);
  },

  getUnreadCount: async (userId: string) => {
    return await getUnreadReportsCount(userId);
  },

  // --- AUTO GENERATION LOGIC ---
  checkAndGenerateAutoReports: async (userId: string) => {
    try {
        const job = await ReportService.getActiveJob(userId);
        if (!job) return;

        const db = await getDB();
        const today = new Date();
        const payoutType = job.payout_type || 'Semi-Monthly';
        
        let targetPeriod = null;

        // 1. Determine "Last Completed Period" based on payout type
        if (payoutType === 'Semi-Monthly') {
            // If today > 15th, previous period was 1st-15th of this month
            // If today is 1st-15th, previous period was 16th-End of LAST month
            if (today.getDate() > 15) {
                const year = today.getFullYear();
                const month = today.getMonth(); // 0-indexed
                const monthStr = (month + 1).toString().padStart(2, '0');
                targetPeriod = {
                    key: `${year}-${monthStr}-01_${year}-${monthStr}-15`,
                    start: `${year}-${monthStr}-01`,
                    end: `${year}-${monthStr}-15`,
                    label: `1st Cutoff ${format(today, 'MMM yyyy')}`
                };
            } else {
                // Previous Month
                const prevDate = subDays(today, 15); // Go back safely
                const year = prevDate.getFullYear();
                const month = prevDate.getMonth();
                const monthStr = (month + 1).toString().padStart(2, '0');
                const lastDay = new Date(year, month + 1, 0).getDate();
                targetPeriod = {
                    key: `${year}-${monthStr}-16_${year}-${monthStr}-${lastDay}`,
                    start: `${year}-${monthStr}-16`,
                    end: `${year}-${monthStr}-${lastDay}`,
                    label: `2nd Cutoff ${format(prevDate, 'MMM yyyy')}`
                };
            }
        } 
        else if (payoutType === 'Monthly') {
            // Last completed month
            if (today.getDate() <= 5) { // Run check in first 5 days of new month
                const prevDate = subDays(today, 10);
                const year = prevDate.getFullYear();
                const month = prevDate.getMonth();
                const monthStr = (month + 1).toString().padStart(2, '0');
                const lastDay = new Date(year, month + 1, 0).getDate();
                targetPeriod = {
                    key: `${year}-${monthStr}-01_${year}-${monthStr}-${lastDay}`,
                    start: `${year}-${monthStr}-01`,
                    end: `${year}-${monthStr}-${lastDay}`,
                    label: `Full Month ${format(prevDate, 'MMMM yyyy')}`
                };
            }
        }
        else if (payoutType === 'Weekly') {
            // Previous Week (Mon-Sun)
            const prevWeekDate = subDays(today, 7);
            const start = startOfWeek(prevWeekDate, { weekStartsOn: 1 });
            const end = endOfWeek(prevWeekDate, { weekStartsOn: 1 });
            const key = `${format(start, 'yyyy-MM-dd')}_${format(end, 'yyyy-MM-dd')}`;
            
            // Only generate if today is Mon/Tue of the new week
            const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon
            if (dayOfWeek === 1 || dayOfWeek === 2) {
                targetPeriod = {
                    key,
                    start: format(start, 'yyyy-MM-dd'),
                    end: format(end, 'yyyy-MM-dd'),
                    label: `Week ${getWeek(prevWeekDate)} (${format(start, 'MMM d')} - ${format(end, 'MMM d')})`
                };
            }
        }

        if (!targetPeriod) return;

        // 2. Check if already generated
        const existing = await db.getFirstAsync(
            'SELECT id FROM saved_reports WHERE user_id = ? AND period_key = ?', 
            [userId, targetPeriod.key]
        );

        if (existing) return; // Already done

        // 3. Generate Report
        const { attendance, tasks } = await ReportService.getReportRange(userId, job.id, targetPeriod.start, targetPeriod.end);
        
        if ((!attendance || attendance.length === 0) && (!tasks || tasks.length === 0)) return; // Empty period

        // Prep data for generator
        const groupedData = ReportService.groupReportsByPayout([...attendance, ...tasks].map((i:any) => ({...i, date: i.date})), payoutType);
        // Flatten grouped data for the specific range
        const flatData = Object.values(groupedData).flatMap((g: any) => g.data).map((item: any) => {
             // Reconstruct summary format expected by generator
             const dailyTasks = tasks.filter((t:any) => t.date === item.date).map((t:any) => ({
                 description: t.description,
                 remarks: t.remarks,
                 images: t.image_url ? JSON.parse(t.image_url) : []
             }));
             return {
                 date: format(new Date(item.date), 'MMM d, yyyy\nEEEE'),
                 clockIn: item.clock_in ? format(new Date(`1970-01-01T${item.clock_in}`), 'h:mm a') : '--:--',
                 clockOut: item.clock_out ? format(new Date(`1970-01-01T${item.clock_out}`), 'h:mm a') : '--:--',
                 duration: '--', // Calculate if needed
                 summary: dailyTasks
             };
        });

        const uri = await generateReport({
            userName: job.userName || 'Employee',
            userTitle: job.userTitle || 'Staff',
            company: job.company,
            department: job.department,
            reportTitle: `Auto-Report: ${targetPeriod.label}`,
            period: targetPeriod.label,
            data: flatData,
            paperSize: 'Letter',
            style: 'minimal' // Clean style for auto-reports
        });

        // 4. Save to DB
        const reportId = generateUUID();
        const fileInfo = await fetch(uri).then(r => r.blob()); // Mock size fetch
        
        const newReport = {
            id: reportId,
            user_id: userId,
            title: `Auto: ${targetPeriod.label}`,
            file_path: uri,
            file_type: 'application/pdf',
            file_size: fileInfo.size || 0,
            is_read: false, // UNREAD
            period_key: targetPeriod.key,
            created_at: new Date().toISOString()
        };

        await saveReportLocal(newReport);
        await queueSyncItem('saved_reports', reportId, 'INSERT', newReport);

        // 5. Notify
        await scheduleReportNotification(newReport.title);

    } catch (e) {
        console.error("Auto Report Gen Error:", e);
    }
  },

  groupReportsByPayout: (data: any[], payoutType: string) => {
    // ... existing implementation ...
    const today = new Date();
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
            const month = date.toLocaleString('default', { month: 'long' });
            const year = date.getFullYear();
            const monthNum = date.getMonth() + 1;
            const monthStr = monthNum < 10 ? `0${monthNum}` : monthNum;
            if (date.getDate() <= 15) {
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