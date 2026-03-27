import { differenceInMinutes } from "date-fns";

type TimeFormat = "exact_hm" | "decimal" | "round_15" | "round_30" | "round_60";

type AttendanceMinutesOptions = {
  breakSchedule?: Array<{ start?: string; end?: string; title?: string }> | null;
  additionalBreakMs?: number;
};

const normalizeBreakSchedule = (
  breakSchedule?: Array<{ start?: string; end?: string; title?: string }> | string | null,
) => {
  if (!breakSchedule) return [];
  if (Array.isArray(breakSchedule)) return breakSchedule;
  if (typeof breakSchedule === "string") {
    try {
      const parsed = JSON.parse(breakSchedule);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const timeToMinutes = (timeStr?: string | null) => {
  if (!timeStr) return 0;
  const [h, m] = String(timeStr).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

const getSessionBreakMinutesFromRemarks = (remarks?: string | null) => {
  const raw = String(remarks || "");
  if (!raw.includes("BreakMs:")) return 0;
  const match = raw.match(/BreakMs:(\d+)/);
  return match ? Math.floor(parseInt(match[1], 10) / 60000) : 0;
};

const isScheduledBreakEnabled = (remarks?: string | null) => {
  return !String(remarks || "").includes("SkipShiftBreak:1");
};

const calculateScheduledBreakOverlapMinutes = (
  start: Date,
  end: Date,
  breakSchedule?: Array<{ start?: string; end?: string; title?: string }> | null,
) => {
  const normalizedBreaks = normalizeBreakSchedule(breakSchedule);
  if (!normalizedBreaks.length || end.getTime() <= start.getTime()) return 0;

  const sessionStartMinutes = start.getHours() * 60 + start.getMinutes();
  const sessionEndMinutes = end.getHours() * 60 + end.getMinutes();
  const crossesMidnight = end.toDateString() !== start.toDateString() || sessionEndMinutes < sessionStartMinutes;
  const normalizedSessionEnd = crossesMidnight ? sessionEndMinutes + 1440 : sessionEndMinutes;

  return normalizedBreaks.reduce((sum, currentBreak) => {
    const breakStart = timeToMinutes(currentBreak.start);
    const breakEnd = timeToMinutes(currentBreak.end);
    const normalizedBreakEnd = breakEnd <= breakStart ? breakEnd + 1440 : breakEnd;

    const overlapStart = Math.max(sessionStartMinutes, breakStart);
    const overlapEnd = Math.min(normalizedSessionEnd, normalizedBreakEnd);
    const overlap = Math.max(0, overlapEnd - overlapStart);

    return sum + overlap;
  }, 0);
};

export const getAttendanceMinutes = (attendance: any, options?: AttendanceMinutesOptions) => {
  if (!attendance?.clock_in) return 0;

  const start = new Date(attendance.clock_in);
  const end = attendance.clock_out ? new Date(attendance.clock_out) : new Date();
  let diff = differenceInMinutes(end, start);

  if (diff < 0) diff = 0;

  const scheduleBreakMinutes = isScheduledBreakEnabled(attendance?.remarks)
    ? calculateScheduledBreakOverlapMinutes(start, end, options?.breakSchedule)
    : 0;
  const sessionBreakMinutes = getSessionBreakMinutesFromRemarks(attendance.remarks);
  const extraBreakMinutes = Math.floor((options?.additionalBreakMs || 0) / 60000);

  return Math.max(0, diff - scheduleBreakMinutes - sessionBreakMinutes - extraBreakMinutes);
};

export const getAttendanceBreakdown = (attendance: any, options?: AttendanceMinutesOptions) => {
  if (!attendance?.clock_in) {
    return { workedMinutes: 0, scheduledBreakMinutes: 0, pausedMinutes: 0 };
  }

  const start = new Date(attendance.clock_in);
  const end = attendance.clock_out ? new Date(attendance.clock_out) : new Date();

  const scheduledBreakMinutes = isScheduledBreakEnabled(attendance?.remarks)
    ? calculateScheduledBreakOverlapMinutes(start, end, options?.breakSchedule)
    : 0;
  const pausedMinutes =
    getSessionBreakMinutesFromRemarks(attendance.remarks) +
    Math.floor((options?.additionalBreakMs || 0) / 60000);

  return {
    workedMinutes: getAttendanceMinutes(attendance, options),
    scheduledBreakMinutes,
    pausedMinutes,
  };
};

export const applyTimeRounding = (minutes: number, timeFormat: TimeFormat = "exact_hm") => {
  if (timeFormat === "round_15") return Math.round(minutes / 15) * 15;
  if (timeFormat === "round_30") return Math.round(minutes / 30) * 30;
  if (timeFormat === "round_60") return Math.round(minutes / 60) * 60;
  return minutes;
};

export const formatMinutesAsHours = (minutes: number, timeFormat: TimeFormat = "exact_hm") => {
  const roundedMinutes = applyTimeRounding(Math.max(0, minutes), timeFormat);

  if (timeFormat === "decimal") {
    return `${(roundedMinutes / 60).toFixed(2)}h`;
  }

  const hours = Math.floor(roundedMinutes / 60);
  const remainder = roundedMinutes % 60;
  return roundedMinutes > 0 ? `${hours}h ${remainder > 0 ? `${remainder}m` : ""}`.trim() : "0h";
};

export const summarizeAttendances = (
  attendances: any[],
  timeFormat: TimeFormat = "exact_hm",
  options?: AttendanceMinutesOptions,
) => {
  const ordered = [...(attendances || [])].sort(
    (a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime(),
  );

  const totalMinutes = ordered.reduce(
    (sum, attendance) => sum + getAttendanceMinutes(attendance, options),
    0,
  );
  const earliestClockIn = ordered[0]?.clock_in || null;

  const latestClockOut =
    ordered
      .filter((attendance) => attendance?.clock_out)
      .sort((a, b) => new Date(b.clock_out).getTime() - new Date(a.clock_out).getTime())[0]?.clock_out || null;

  const totalScheduledBreakMinutes = ordered.reduce(
    (sum, attendance) => sum + getAttendanceBreakdown(attendance, options).scheduledBreakMinutes,
    0,
  );
  const totalPausedMinutes = ordered.reduce(
    (sum, attendance) => sum + getAttendanceBreakdown(attendance, options).pausedMinutes,
    0,
  );

  return {
    totalMinutes,
    durationText: formatMinutesAsHours(totalMinutes, timeFormat),
    earliestClockIn,
    latestClockOut,
    totalScheduledBreakMinutes,
    totalPausedMinutes,
  };
};
