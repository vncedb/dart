import { eachDayOfInterval, format } from "date-fns";

import { getDB } from "./db-client";
import { summarizeAttendances } from "./report-helpers";

const DAILY_OVERTIME_THRESHOLD_MINUTES = 8 * 60;

export interface ReportAnalyticsDay {
  date: string;
  attendanceCount: number;
  outputCount: number;
  workedMinutes: number;
  overtimeMinutes: number;
  hasActivity: boolean;
}

export interface ReportAnalyticsBucket {
  label: string;
  startDate: string;
  endDate: string;
  workedMinutes: number;
  overtimeMinutes: number;
  outputCount: number;
  activeDays: number;
}

export interface ReportAnalyticsSummary {
  days: ReportAnalyticsDay[];
  buckets: ReportAnalyticsBucket[];
  startDate: string;
  endDate: string;
  periodDays: number;
  activeDays: number;
  totalWorkedMinutes: number;
  totalOvertimeMinutes: number;
  overtimeDays: number;
  totalOutputs: number;
  currentStreak: number;
  longestStreak: number;
  consistencyRatio: number;
  averageWorkedMinutesPerActiveDay: number;
  averageOutputsPerActiveDay: number;
  peakOutputDay: ReportAnalyticsDay | null;
  peakOvertimeDay: ReportAnalyticsDay | null;
}

export interface ReportAnalyticsSource {
  job: any;
  attendance: any[];
  accomplishments: any[];
}

const parseSchedule = (value: unknown) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const formatBucketLabel = (startDate: string, endDate: string) => {
  const start = new Date(startDate);
  const end = new Date(endDate);

  if (startDate === endDate) {
    return format(start, "MMM d");
  }

  const sameMonth = format(start, "MMM yyyy") === format(end, "MMM yyyy");
  return sameMonth
    ? `${format(start, "MMM d")} - ${format(end, "d")}`
    : `${format(start, "MMM d")} - ${format(end, "MMM d")}`;
};

const buildBuckets = (days: ReportAnalyticsDay[]): ReportAnalyticsBucket[] => {
  if (days.length === 0) return [];

  const chunkSize = days.length <= 10 ? 1 : Math.ceil(days.length / 8);
  const buckets: ReportAnalyticsBucket[] = [];

  for (let index = 0; index < days.length; index += chunkSize) {
    const slice = days.slice(index, index + chunkSize);
    const startDate = slice[0].date;
    const endDate = slice[slice.length - 1].date;

    buckets.push({
      label: formatBucketLabel(startDate, endDate),
      startDate,
      endDate,
      workedMinutes: slice.reduce((sum, day) => sum + day.workedMinutes, 0),
      overtimeMinutes: slice.reduce((sum, day) => sum + day.overtimeMinutes, 0),
      outputCount: slice.reduce((sum, day) => sum + day.outputCount, 0),
      activeDays: slice.filter((day) => day.hasActivity).length,
    });
  }

  return buckets;
};

const getStreakMetrics = (days: ReportAnalyticsDay[]) => {
  const flags = days.map((day) => day.hasActivity);
  let longestStreak = 0;
  let running = 0;

  for (const hasActivity of flags) {
    if (hasActivity) {
      running += 1;
      if (running > longestStreak) longestStreak = running;
    } else {
      running = 0;
    }
  }

  const latestActiveIndex = flags.lastIndexOf(true);
  let currentStreak = 0;

  if (latestActiveIndex >= 0) {
    for (let index = latestActiveIndex; index >= 0; index -= 1) {
      if (!flags[index]) break;
      currentStreak += 1;
    }
  }

  return { currentStreak, longestStreak };
};

export const fetchReportAnalyticsSource = async (
  userId: string,
  jobId: string,
  startDate: string,
  endDate: string
): Promise<ReportAnalyticsSource> => {
  const db = await getDB();

  const [job, attendance, accomplishments] = await Promise.all([
    db.getFirstAsync(
      "SELECT id, title, company, department, break_schedule FROM job_positions WHERE id = ? AND deleted_at IS NULL",
      [jobId]
    ),
    db.getAllAsync(
      "SELECT id, date, clock_in, clock_out, remarks FROM attendance WHERE user_id = ? AND job_id = ? AND date >= ? AND date <= ? AND deleted_at IS NULL ORDER BY date ASC, clock_in ASC",
      [userId, jobId, startDate, endDate]
    ),
    db.getAllAsync(
      "SELECT id, date, description FROM accomplishments WHERE user_id = ? AND job_id = ? AND date >= ? AND date <= ? AND deleted_at IS NULL ORDER BY date ASC, created_at ASC",
      [userId, jobId, startDate, endDate]
    ),
  ]);

  return {
    job: job ? { ...job, break_schedule: parseSchedule((job as any).break_schedule) } : null,
    attendance: attendance as any[],
    accomplishments: accomplishments as any[],
  };
};

export const buildReportAnalyticsSummary = (
  source: ReportAnalyticsSource,
  startDate: string,
  endDate: string
): ReportAnalyticsSummary => {
  const dayKeys = eachDayOfInterval({
    start: new Date(startDate),
    end: new Date(endDate),
  }).map((day) => format(day, "yyyy-MM-dd"));

  const attendanceByDate = new Map<string, any[]>();
  const accomplishmentsByDate = new Map<string, any[]>();

  for (const row of source.attendance || []) {
    const bucket = attendanceByDate.get(row.date) || [];
    bucket.push(row);
    attendanceByDate.set(row.date, bucket);
  }

  for (const row of source.accomplishments || []) {
    const bucket = accomplishmentsByDate.get(row.date) || [];
    bucket.push(row);
    accomplishmentsByDate.set(row.date, bucket);
  }

  const days = dayKeys.map((date) => {
    const attendances = (attendanceByDate.get(date) || []).sort(
      (left, right) => new Date(left.clock_in).getTime() - new Date(right.clock_in).getTime()
    );
    const outputs = accomplishmentsByDate.get(date) || [];
    const workedMinutes = summarizeAttendances(attendances, "exact_hm", {
      breakSchedule: source.job?.break_schedule || [],
    }).totalMinutes;
    const overtimeMinutes = Math.max(0, workedMinutes - DAILY_OVERTIME_THRESHOLD_MINUTES);
    const hasActivity = attendances.length > 0 || outputs.length > 0;

    return {
      date,
      attendanceCount: attendances.length,
      outputCount: outputs.length,
      workedMinutes,
      overtimeMinutes,
      hasActivity,
    };
  });

  const totalWorkedMinutes = days.reduce((sum, day) => sum + day.workedMinutes, 0);
  const totalOvertimeMinutes = days.reduce((sum, day) => sum + day.overtimeMinutes, 0);
  const totalOutputs = days.reduce((sum, day) => sum + day.outputCount, 0);
  const activeDays = days.filter((day) => day.hasActivity).length;
  const overtimeDays = days.filter((day) => day.overtimeMinutes > 0).length;
  const { currentStreak, longestStreak } = getStreakMetrics(days);
  const peakOutputDay =
    days
      .filter((day) => day.outputCount > 0)
      .sort((left, right) => right.outputCount - left.outputCount || left.date.localeCompare(right.date))[0] || null;
  const peakOvertimeDay =
    days
      .filter((day) => day.overtimeMinutes > 0)
      .sort((left, right) => right.overtimeMinutes - left.overtimeMinutes || left.date.localeCompare(right.date))[0] || null;

  return {
    days,
    buckets: buildBuckets(days),
    startDate,
    endDate,
    periodDays: dayKeys.length,
    activeDays,
    totalWorkedMinutes,
    totalOvertimeMinutes,
    overtimeDays,
    totalOutputs,
    currentStreak,
    longestStreak,
    consistencyRatio: dayKeys.length > 0 ? activeDays / dayKeys.length : 0,
    averageWorkedMinutesPerActiveDay: activeDays > 0 ? totalWorkedMinutes / activeDays : 0,
    averageOutputsPerActiveDay: activeDays > 0 ? totalOutputs / activeDays : 0,
    peakOutputDay,
    peakOvertimeDay,
  };
};
