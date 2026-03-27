// filepath: services/ReportService.ts
import { addDays, endOfWeek, format, getWeek, startOfWeek, subDays } from 'date-fns';
import * as FileSystem from 'expo-file-system';
import { generateUUID, getUnreadReportsCount, queueSyncItem, saveReportLocal } from '../lib/database';
import { getDB } from '../lib/db-client';
import { scheduleReportNotification } from '../lib/notifications';
import { formatMinutesAsHours, summarizeAttendances } from '../lib/report-helpers';
import { buildReportStorageFileName, buildSavedReportRecord } from '../lib/reporting';
import { saveReportFileOffline } from '../lib/report-storage';
import { generateReport } from '../utils/reportGenerator';

export const ReportService = {
  getActiveJob: async (userId: string) => {
    const db = await getDB();
    const profile: any = await db.getFirstAsync('SELECT current_job_id, full_name, title FROM profiles WHERE id = ? AND deleted_at IS NULL', [userId]);
    if (!profile?.current_job_id) return null;
    
    const job: any = await db.getFirstAsync('SELECT * FROM job_positions WHERE id = ? AND deleted_at IS NULL', [profile.current_job_id]);
    if (!job) return null;
    return { ...job, userName: profile.full_name, userTitle: job.title || profile.title };
  },

  getDailyReport: async (userId: string, date: string) => {
    const db = await getDB();
    const attendance = await db.getAllAsync('SELECT * FROM attendance WHERE user_id = ? AND date = ? AND deleted_at IS NULL ORDER BY clock_in ASC', [userId, date]);
    const tasks = await db.getAllAsync('SELECT * FROM accomplishments WHERE user_id = ? AND date = ? AND deleted_at IS NULL', [userId, date]);
    return { attendance: attendance || [], tasks: tasks || [] };
  },

  getReportRange: async (userId: string, jobId: string | null, startDate: string, endDate: string) => {
    const db = await getDB();
    // Removed strict job_id requirement here to ensure offline/batch records are caught
    const attendance = await db.getAllAsync(
      'SELECT * FROM attendance WHERE user_id = ? AND date >= ? AND date <= ? AND deleted_at IS NULL ORDER BY date ASC', 
      [userId, startDate, endDate]
    );
    const tasks = await db.getAllAsync(
      'SELECT * FROM accomplishments WHERE user_id = ? AND date >= ? AND date <= ? AND deleted_at IS NULL', 
      [userId, startDate, endDate]
    );
    return { attendance, tasks };
  },

  deleteReportDay: async (userId: string, jobId: string, date: string) => {
    const db = await getDB();
    await db.withTransactionAsync(async () => {
      const att: any = await db.getFirstAsync('SELECT id FROM attendance WHERE user_id = ? AND date = ? AND deleted_at IS NULL', [userId, date]);
      const tasks: any[] = await db.getAllAsync('SELECT id FROM accomplishments WHERE user_id = ? AND date = ? AND deleted_at IS NULL', [userId, date]);

      const now = new Date().toISOString();

      if (att) {
         await db.runAsync('UPDATE attendance SET deleted_at = ?, is_synced = 0, updated_at = ? WHERE id = ?', [now, now, att.id]);
         await queueSyncItem('attendance', att.id, 'UPDATE', { deleted_at: now, updated_at: now });
      }

      for (const t of tasks) {
         await db.runAsync('UPDATE accomplishments SET deleted_at = ?, is_synced = 0, updated_at = ? WHERE id = ?', [now, now, t.id]);
         await queueSyncItem('accomplishments', t.id, 'UPDATE', { deleted_at: now, updated_at: now }); 
      }
    });
  },

  getUnreadCount: async (userId: string) => {
    return await getUnreadReportsCount(userId);
  },

  checkAndGenerateAutoReports: async (userId: string) => {
    try {
        const job = await ReportService.getActiveJob(userId);
        if (!job) return;

        const db = await getDB();
        const payoutType = job.payout_type || 'Semi-Monthly';
        
        const lastCheckRes: any = await db.getFirstAsync("SELECT value FROM app_settings WHERE key = 'last_auto_report_check'");
        const lastCheckDateStr = lastCheckRes?.value;
        const startDate = lastCheckDateStr ? new Date(lastCheckDateStr) : subDays(new Date(), 30);
        const today = new Date();

        let currentDate = new Date(startDate);
        const periodsToGenerate = new Map<string, any>();

        while (currentDate <= today) {
             let targetPeriod = null;
             
             if (payoutType === 'Semi-Monthly') {
                 if (currentDate.getDate() > 15) {
                     const year = currentDate.getFullYear();
                     const month = currentDate.getMonth(); 
                     const monthStr = (month + 1).toString().padStart(2, '0');
                     targetPeriod = { key: `${year}-${monthStr}-01_${year}-${monthStr}-15`, start: `${year}-${monthStr}-01`, end: `${year}-${monthStr}-15`, label: `1st Cutoff ${format(currentDate, 'MMM yyyy')}` };
                 } else {
                     const prevDate = subDays(currentDate, 15); 
                     const year = prevDate.getFullYear();
                     const month = prevDate.getMonth();
                     const monthStr = (month + 1).toString().padStart(2, '0');
                     const lastDay = new Date(year, month + 1, 0).getDate();
                     targetPeriod = { key: `${year}-${monthStr}-16_${year}-${monthStr}-${lastDay}`, start: `${year}-${monthStr}-16`, end: `${year}-${monthStr}-${lastDay}`, label: `2nd Cutoff ${format(prevDate, 'MMM yyyy')}` };
                 }
             } else if (payoutType === 'Monthly') {
                 if (currentDate.getDate() <= 5) { 
                     const prevDate = subDays(currentDate, 10);
                     const year = prevDate.getFullYear();
                     const month = prevDate.getMonth();
                     const monthStr = (month + 1).toString().padStart(2, '0');
                     const lastDay = new Date(year, month + 1, 0).getDate();
                     targetPeriod = { key: `${year}-${monthStr}-01_${year}-${monthStr}-${lastDay}`, start: `${year}-${monthStr}-01`, end: `${year}-${monthStr}-${lastDay}`, label: `Full Month ${format(prevDate, 'MMMM yyyy')}` };
                 }
             } else if (payoutType === 'Weekly') {
                 const dayOfWeek = currentDate.getDay(); 
                 if (dayOfWeek === 1 || dayOfWeek === 2) {
                     const prevWeekDate = subDays(currentDate, 7);
                     const start = startOfWeek(prevWeekDate, { weekStartsOn: 1 });
                     const end = endOfWeek(prevWeekDate, { weekStartsOn: 1 });
                     targetPeriod = { key: `${format(start, 'yyyy-MM-dd')}_${format(end, 'yyyy-MM-dd')}`, start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd'), label: `Week ${getWeek(prevWeekDate)} (${format(start, 'MMM d')} - ${format(end, 'MMM d')})` };
                 }
             }

             if (targetPeriod && !periodsToGenerate.has(targetPeriod.key)) {
                 periodsToGenerate.set(targetPeriod.key, targetPeriod);
             }
             
             currentDate = addDays(currentDate, 1);
        }

        for (const [key, period] of periodsToGenerate.entries()) {
            const existing = await db.getFirstAsync('SELECT id FROM saved_reports WHERE user_id = ? AND period_key = ? AND deleted_at IS NULL', [userId, period.key]);
            if (!existing) {
                const { attendance, tasks } = await ReportService.getReportRange(userId, job.id, period.start, period.end);
                if ((!attendance || attendance.length === 0) && (!tasks || tasks.length === 0)) continue; 
                
                const allDates = Array.from(new Set([
                  ...attendance.map((item: any) => item.date),
                  ...tasks.map((item: any) => item.date),
                ])).sort();
                const flatData = allDates.map((day) => {
                  const dailyAttendances = attendance
                    .filter((item: any) => item.date === day)
                    .sort((a: any, b: any) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());
                  const attendanceSummary = summarizeAttendances(dailyAttendances, 'exact_hm', { breakSchedule: job.break_schedule });
                  const dailyTasks = tasks
                    .filter((task: any) => task.date === day)
                    .sort((a: any, b: any) => new Date(a.created_at || a.updated_at || 0).getTime() - new Date(b.created_at || b.updated_at || 0).getTime())
                    .map((task: any) => {
                      let images: string[] = [];
                      if (task.image_url) {
                        try { images = JSON.parse(task.image_url); } catch { images = [task.image_url]; }
                        if (!Array.isArray(images)) images = [task.image_url];
                      }
                      return {
                        description: task.description,
                        remarks: task.remarks,
                        images,
                        doneAt: task.created_at ? format(new Date(task.created_at), 'h:mm a') : null,
                      };
                    });

                  return {
                    date: format(new Date(day), 'MMM d, yyyy\nEEEE'),
                    clockIn: attendanceSummary.earliestClockIn ? format(new Date(attendanceSummary.earliestClockIn), 'h:mm a') : '--:--',
                    clockOut: attendanceSummary.latestClockOut ? format(new Date(attendanceSummary.latestClockOut), 'h:mm a') : '--:--',
                    duration: attendanceSummary.durationText,
                    totalMinutes: attendanceSummary.totalMinutes,
                    summary: dailyTasks,
                  };
                });

                const totalMinutes = flatData.reduce((sum, item) => sum + (item.totalMinutes || 0), 0);
                const totalHours = formatMinutesAsHours(totalMinutes);

                const uri = await generateReport({
                  userName: job.userName || 'Employee',
                  userTitle: job.userTitle || 'Staff',
                  company: job.company,
                  department: job.department,
                  reportTitle: `Auto-Report: ${period.label}`,
                  period: period.label,
                  data: flatData,
                  paperSize: 'Letter',
                  style: 'minimal',
                  totals: { totalDays: flatData.length, totalHours: totalHours || `${Math.floor(totalMinutes / 60)}h` },
                });
                
                let fileSize = 0;
                try {
                    const fileInfo = await FileSystem.getInfoAsync(uri);
                    if (fileInfo.exists && 'size' in fileInfo) fileSize = fileInfo.size;
                } catch {}
                
                const reportId = generateUUID();
                const createdAt = new Date();
                const savedFile = await saveReportFileOffline({
                  sourceUri: uri,
                  fileName: buildReportStorageFileName({
                    generatedAt: createdAt,
                    format: 'pdf',
                  }),
                  fileType: 'pdf',
                });
                await FileSystem.deleteAsync(uri, { idempotent: true });
                const newReport = buildSavedReportRecord({
                  reportId,
                  userId,
                  title: `Auto: ${period.label}`,
                  filePath: savedFile.filePath,
                  fileSize: savedFile.fileSize || fileSize,
                  format: 'pdf',
                  createdAt,
                  periodKey: period.key,
                  metadata: {
                    source: 'auto',
                    format: 'pdf',
                    fileName: savedFile.fileName,
                    reportDate: period.label,
                    periodLabel: period.label,
                    startDate: new Date(period.start).toISOString(),
                    endDate: new Date(period.end).toISOString(),
                    generatedAt: createdAt.toISOString(),
                    totalDays: flatData.length,
                    totalMinutes,
                    totalHours,
                  },
                });

                await saveReportLocal(newReport, { queueSync: true, synced: false });
                await scheduleReportNotification(newReport.title);
            }
        }

        await db.runAsync("INSERT OR REPLACE INTO app_settings (key, value) VALUES ('last_auto_report_check', ?)", [today.toISOString()]);

    } catch (e) {
        console.error("Auto Report Gen Error:", e);
    }
  },

  groupReportsByPayout: (data: any[], payoutType: string) => {
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
            const month = format(date, 'MMMM');
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
