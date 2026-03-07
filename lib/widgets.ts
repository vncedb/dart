import AsyncStorage from '@react-native-async-storage/async-storage';
import { addDays, format, set } from 'date-fns';
import { NativeModules, Platform } from 'react-native';

import { getSameDayClockOut } from './attendance-session';
import { getDB } from './db-client';

const WIDGET_SETTINGS_KEY = 'widgetSettings';

export type WidgetKind = 'daily' | 'quick';
export type WidgetSupportState = 'ready' | 'android-native-missing' | 'unsupported-platform';

export type WidgetSettings = {
  dailySummaryEnabled: boolean;
  quickActionEnabled: boolean;
  showTargetEndTime: boolean;
  showJobName: boolean;
  autoRefresh: boolean;
};

export type WidgetSnapshot = {
  enabled: WidgetSettings;
  dateLabel: string;
  statusText: string;
  statusColor: string;
  totalHoursText: string;
  goalText: string;
  targetEndText: string;
  jobTitle: string;
  progressPercent: number;
  actionLabel: string;
  actionHint: string;
  lastUpdatedText: string;
};

type NativeWidgetModule = {
  updateWidgetSnapshot: (snapshotJson: string) => Promise<boolean>;
  requestPinWidget: (kind: WidgetKind) => Promise<boolean>;
  consumePendingWidgetAction: () => Promise<string | null>;
};

const nativeWidgetModule = NativeModules.DartWidgetModule as NativeWidgetModule | undefined;

export const DEFAULT_WIDGET_SETTINGS: WidgetSettings = {
  dailySummaryEnabled: true,
  quickActionEnabled: true,
  showTargetEndTime: true,
  showJobName: true,
  autoRefresh: true,
};

const WIDGET_OFF_DUTY = '#4F46E5';
const WIDGET_ACTIVE = '#10B981';
const WIDGET_OVERTIME = '#F59E0B';

const timeToMinutes = (timeStr?: string | null) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return (h * 60) + m;
};

const formatDuration = (minutes: number) => {
  const safe = Math.max(0, Math.floor(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
};

const calculateDailyGoal = (jobSettings: any) => {
  if (!jobSettings?.work_schedule) return 8;
  const startMins = timeToMinutes(jobSettings.work_schedule.start);
  const endMins = timeToMinutes(jobSettings.work_schedule.end);
  let workDuration = endMins - startMins;
  if (workDuration < 0) workDuration += 24 * 60;

  let breakDuration = 0;
  if (Array.isArray(jobSettings.break_schedule)) {
    jobSettings.break_schedule.forEach((entry: any) => {
      const breakStart = timeToMinutes(entry.start);
      const breakEnd = timeToMinutes(entry.end);
      let duration = breakEnd - breakStart;
      if (duration < 0) duration += 24 * 60;
      breakDuration += duration;
    });
  }

  return Number((Math.max(0, workDuration - breakDuration) / 60).toFixed(2));
};

const parseMaybeJson = (value: any) => {
  if (!value) return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const getWidgetSupportState = (): WidgetSupportState => {
  if (Platform.OS !== 'android') return 'unsupported-platform';
  if (!nativeWidgetModule) return 'android-native-missing';
  return 'ready';
};

export const isWidgetSupported = () => getWidgetSupportState() === 'ready';

export const getWidgetSettings = async (): Promise<WidgetSettings> => {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_SETTINGS_KEY);
    if (!raw) return DEFAULT_WIDGET_SETTINGS;
    return { ...DEFAULT_WIDGET_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_WIDGET_SETTINGS;
  }
};

export const saveWidgetSettings = async (partial: Partial<WidgetSettings>): Promise<WidgetSettings> => {
  const current = await getWidgetSettings();
  const next = { ...current, ...partial };
  await AsyncStorage.setItem(WIDGET_SETTINGS_KEY, JSON.stringify(next));
  return next;
};

export const buildWidgetSnapshot = async (userId: string): Promise<WidgetSnapshot> => {
  const settings = await getWidgetSettings();
  const db = await getDB();
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const profile: any = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [userId]);
  const currentJobId = profile?.current_job_id;

  if (!currentJobId) {
    return {
      enabled: settings,
      dateLabel: format(today, 'EEE, MMM d'),
      statusText: 'Off Duty',
      statusColor: WIDGET_OFF_DUTY,
      totalHoursText: '0h 00m',
      goalText: 'No active job selected',
      targetEndText: 'Add an active job to enable tracking.',
      jobTitle: 'No active job',
      progressPercent: 0,
      actionLabel: 'TIME IN',
      actionHint: 'Open DART after setting an active job.',
      lastUpdatedText: `Updated ${format(today, 'h:mm a')}`,
    };
  }

  const jobRow: any = await db.getFirstAsync('SELECT * FROM job_positions WHERE id = ? AND deleted_at IS NULL', [currentJobId]);
  const job = jobRow
    ? {
        ...jobRow,
        work_schedule: parseMaybeJson(jobRow.work_schedule),
        break_schedule: parseMaybeJson(jobRow.break_schedule),
      }
    : null;

  const attendance = (await db.getAllAsync(
    'SELECT * FROM attendance WHERE user_id = ? AND job_id = ? AND date = ? AND deleted_at IS NULL ORDER BY clock_in DESC',
    [userId, currentJobId, todayStr]
  )) as any[];

  const latestRecord = attendance[0] || null;
  const isClockedIn = !!latestRecord && ['pending', 'active'].includes((latestRecord.status || '').toLowerCase()) && !latestRecord.clock_out;
  const isOvertime = !!latestRecord?.remarks?.includes('Overtime');

  let totalMs = 0;
  for (const record of attendance) {
    const start = new Date(record.clock_in).getTime();
    const end = record.clock_out ? new Date(record.clock_out).getTime() : Date.now();
    let recordMs = Math.max(0, end - start);

    if (record.remarks && record.remarks.includes('BreakMs:')) {
      const match = record.remarks.match(/BreakMs:(\d+)/);
      if (match) recordMs -= parseInt(match[1], 10);
    }

    if (latestRecord && record.id === latestRecord.id) {
      const breakTotal = await AsyncStorage.getItem(`break_total_${latestRecord.id}`);
      const breakStart = await AsyncStorage.getItem(`break_start_${latestRecord.id}`);
      if (breakTotal) recordMs -= parseInt(breakTotal, 10) || 0;
      if (breakStart) recordMs -= Math.max(0, Date.now() - (parseInt(breakStart, 10) || 0));
    }

    totalMs += Math.max(0, recordMs);
  }

  const workedMinutes = totalMs / (1000 * 60);
  const dailyGoal = calculateDailyGoal(job);
  const goalMinutes = dailyGoal * 60;
  const progressPercent = goalMinutes > 0 ? Math.max(0, Math.min(100, Math.round((workedMinutes / goalMinutes) * 100))) : 0;

  let statusText = 'Off Duty';
  let statusColor = WIDGET_OFF_DUTY;
  if (isOvertime && isClockedIn) {
    statusText = 'Overtime';
    statusColor = WIDGET_OVERTIME;
  } else if (isClockedIn) {
    statusText = 'Active Session';
    statusColor = WIDGET_ACTIVE;
  }

  let targetEndText = 'No active session';
  if (isClockedIn && latestRecord?.clock_in) {
    const otExpiry = await AsyncStorage.getItem('active_ot_expiry');
    if (isOvertime && otExpiry) {
      targetEndText = `Time Out ${format(getSameDayClockOut(latestRecord.clock_in, new Date(otExpiry)), 'h:mm a')}`;
    } else if (job?.work_schedule?.start && job?.work_schedule?.end) {
      const [endH, endM] = String(job.work_schedule.end).split(':').map(Number);
      const [startH, startM] = String(job.work_schedule.start).split(':').map(Number);
      let shiftEnd = set(new Date(latestRecord.clock_in), { hours: endH, minutes: endM, seconds: 0, milliseconds: 0 });
      const shiftStart = set(new Date(latestRecord.clock_in), { hours: startH, minutes: startM, seconds: 0, milliseconds: 0 });
      if (shiftEnd <= shiftStart) shiftEnd = addDays(shiftEnd, 1);
      targetEndText = `Time Out ${format(getSameDayClockOut(latestRecord.clock_in, shiftEnd), 'h:mm a')}`;
    }
  }

  const titleParts = [job?.title, job?.company].filter(Boolean);
  const jobTitle = titleParts.length > 0 ? titleParts.join(' • ') : 'Active job';

  return {
    enabled: settings,
    dateLabel: format(today, 'EEE, MMM d'),
    statusText,
    statusColor,
    totalHoursText: formatDuration(workedMinutes),
    goalText: `Daily Goal ${formatDuration(goalMinutes)}`,
    targetEndText,
    jobTitle,
    progressPercent,
    actionLabel: isClockedIn ? 'TIME OUT' : 'TIME IN',
    actionHint: isClockedIn ? 'Open DART to end today\'s session.' : 'Open DART to start today\'s session.',
    lastUpdatedText: `Updated ${format(today, 'h:mm a')}`,
  };
};

export const refreshWidgetSnapshot = async (userId: string, options?: { force?: boolean }) => {
  const snapshot = await buildWidgetSnapshot(userId);
  if (!isWidgetSupported()) return snapshot;
  if (!options?.force && snapshot.enabled.autoRefresh === false) return snapshot;
  await nativeWidgetModule!.updateWidgetSnapshot(JSON.stringify(snapshot));
  return snapshot;
};

export const requestPinWidget = async (kind: WidgetKind) => {
  if (!isWidgetSupported()) return false;
  return nativeWidgetModule!.requestPinWidget(kind);
};

export const consumePendingWidgetAction = async () => {
  if (!isWidgetSupported()) return null;
  return nativeWidgetModule!.consumePendingWidgetAction();
};
