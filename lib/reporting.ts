import { format, isValid, parse } from "date-fns";

import { generateUUID, saveReportLocal } from "./database";
import { getDB } from "./db-client";
import { formatMinutesAsHours, summarizeAttendances } from "./report-helpers";
import { getReportFileExtension, getReportMimeType, getSafeFileInfo, scanStoredReportFiles } from "./report-storage";

export type ReportFormat = "pdf" | "xlsx";

export type ReportColumns = {
  time?: boolean;
  duration?: boolean;
  remarks?: boolean;
};

export type SavedReportMetadata = {
  version: number;
  source: "generated" | "auto" | "imported";
  format: ReportFormat;
  fileName: string;
  reportDate: string;
  startDate?: string | null;
  endDate?: string | null;
  periodLabel?: string | null;
  generatedAt: string;
  totalDays?: number;
  totalMinutes?: number;
  totalHours?: string;
  totalEntries?: number;
  totalImages?: number;
  includedDates?: string[];
  style?: string | null;
  paperSize?: string | null;
  company?: string | null;
  department?: string | null;
  generatedBy?: string | null;
  scannedFromFolder?: boolean;
};

type BuildProcessedReportDataInput = {
  attendance: any[];
  tasks: any[];
  job?: any;
  selectedDates?: string[];
  includeDocs?: boolean;
  includeRemarks?: boolean;
  includeDay?: boolean;
  dateFormat?: string;
  timeFormat?: "exact_hm" | "decimal" | "round_15" | "round_30" | "round_60";
};

const DEFAULT_REPORT_VERSION = 2;

export const normalizeReportFormat = (value?: string | null): ReportFormat => {
  const normalized = String(value || "").toLowerCase();
  return normalized.includes("xls") ? "xlsx" : "pdf";
};

export const parseSavedReportMetadata = (raw?: string | null): Partial<SavedReportMetadata> => {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

export const serializeSavedReportMetadata = (metadata: Partial<SavedReportMetadata>) =>
  JSON.stringify({
    version: DEFAULT_REPORT_VERSION,
    source: "generated",
    format: "pdf",
    generatedAt: new Date().toISOString(),
    reportDate: "",
    fileName: "",
    ...metadata,
  } satisfies SavedReportMetadata);

export const formatReportPeriod = ({
  date,
  startDate,
  endDate,
  fallback,
}: {
  date?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  fallback?: string | null;
}) => {
  if (date) {
    return format(new Date(date), "MMM dd, yyyy");
  }

  if (startDate && endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const sameYear = start.getFullYear() === end.getFullYear();
    const sameMonth = sameYear && start.getMonth() === end.getMonth();
    const monthEnd = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();

    if (sameMonth && start.getDate() === 1 && end.getDate() === monthEnd) {
      return format(start, "MMMM yyyy");
    }

    if (sameMonth) {
      return `${format(start, "MMM dd")} - ${format(end, "dd, yyyy")}`;
    }

    if (sameYear) {
      return `${format(start, "MMM dd")} - ${format(end, "MMM dd, yyyy")}`;
    }

    return `${format(start, "MMM dd, yyyy")} - ${format(end, "MMM dd, yyyy")}`;
  }

  return fallback || "Report";
};

export const buildReportDisplayTitle = ({
  generatedAt,
}: {
  generatedAt: Date;
}) => `DART Report - ${format(generatedAt, "MMM d yyyy - h.mm.ss a")}`;

export const buildReportStorageFileName = ({
  generatedAt,
  format: reportFormat,
}: {
  generatedAt: Date;
  format: ReportFormat;
}) => `DART Report - ${format(generatedAt, "MMM d yyyy - h.mm.ss a")}.${getReportFileExtension(reportFormat)}`;

export const inferReportMetadataFromFileName = (fileName?: string | null) => {
  const baseName = String(fileName || "").replace(/\.[^.]+$/, "").trim();
  if (!baseName) return null;

  const dartReportPrefix = "DART Report - ";
  if (baseName.startsWith(dartReportPrefix)) {
    const parsedDate = parse(baseName.slice(dartReportPrefix.length), "MMM d yyyy - h.mm.ss a", new Date());
    if (isValid(parsedDate)) {
      return {
        title: baseName,
        generatedAt: parsedDate.toISOString(),
        reportDate: format(parsedDate, "MMM dd, yyyy"),
      };
    }
  }

  return null;
};

export const buildProcessedReportData = ({
  attendance,
  tasks,
  job,
  selectedDates,
  includeDocs = true,
  includeRemarks = true,
  includeDay = true,
  dateFormat = "MM/dd/yyyy",
  timeFormat = "exact_hm",
}: BuildProcessedReportDataInput) => {
  const selectedDateSet = new Set(selectedDates || []);
  const includedDates = Array.from(
    new Set([...(attendance || []).map((item: any) => item.date), ...(tasks || []).map((item: any) => item.date)]),
  )
    .filter((day) => selectedDateSet.size === 0 || selectedDateSet.has(day))
    .sort();

  const processedData = includedDates.map((day) => {
    const dayAttendances = (attendance || [])
      .filter((item: any) => item.date === day)
      .sort((left: any, right: any) => new Date(left.clock_in).getTime() - new Date(right.clock_in).getTime());

    const attendanceSummary = summarizeAttendances(dayAttendances, timeFormat, {
      breakSchedule: job?.break_schedule,
    });

    const dayTasks = (tasks || [])
      .filter((item: any) => item.date === day)
      .sort(
        (left: any, right: any) =>
          new Date(left.created_at || left.updated_at || 0).getTime() -
          new Date(right.created_at || right.updated_at || 0).getTime(),
      )
      .map((item: any) => {
        let images: string[] = [];
        if (includeDocs && item.image_url) {
          try {
            const raw = String(item.image_url).trim();
            if (raw.startsWith("[")) {
              const parsed = JSON.parse(raw);
              images = Array.isArray(parsed) ? parsed : [raw];
            } else {
              images = [raw];
            }
          } catch {
            images = [item.image_url];
          }
        }

        return {
          ...item,
          remarks: includeRemarks ? item.remarks : "",
          images,
          doneAt: item.created_at ? format(new Date(item.created_at), "h:mm a") : null,
        };
      });

    const dateObject = new Date(day);
    let formattedDate = day;

    try {
      formattedDate = format(dateObject, dateFormat);
      if (includeDay) {
        formattedDate += `\n${format(dateObject, "EEEE")}`;
      }
    } catch {
      formattedDate = day;
    }

    return {
      rawDate: day,
      date: formattedDate,
      clockIn: attendanceSummary.earliestClockIn ? format(new Date(attendanceSummary.earliestClockIn), "h:mm a") : "--:--",
      clockOut: attendanceSummary.latestClockOut ? format(new Date(attendanceSummary.latestClockOut), "h:mm a") : "--:--",
      duration: attendanceSummary.durationText,
      totalMinutes: attendanceSummary.totalMinutes,
      status: dayAttendances[dayAttendances.length - 1]?.status,
      remarks: dayAttendances[dayAttendances.length - 1]?.remarks,
      summary: dayTasks,
    };
  });

  const totalMinutes = processedData.reduce((sum, item) => sum + (item.totalMinutes || 0), 0);
  const totalEntries = processedData.reduce((sum, item) => sum + ((item.summary || []).length as number), 0);
  const totalImages = processedData.reduce(
    (sum, item) =>
      sum +
      (item.summary || []).reduce(
        (taskSum: number, task: any) => taskSum + (Array.isArray(task.images) ? task.images.length : 0),
        0,
      ),
    0,
  );

  return {
    processedData,
    includedDates,
    totalDays: processedData.length,
    totalMinutes,
    totalHoursText: formatMinutesAsHours(totalMinutes, timeFormat),
    totalEntries,
    totalImages,
  };
};

export const buildSavedReportRecord = ({
  reportId,
  userId,
  title,
  filePath,
  fileSize,
  format: reportFormat,
  createdAt,
  periodKey,
  metadata,
  isRead = false,
  remoteUrl = null,
  isSynced = false,
}: {
  reportId: string;
  userId: string;
  title: string;
  filePath: string;
  fileSize: number;
  format: ReportFormat;
  createdAt: Date;
  periodKey: string;
  metadata: Partial<SavedReportMetadata>;
  isRead?: boolean;
  remoteUrl?: string | null;
  isSynced?: boolean;
}) => ({
  id: reportId,
  user_id: userId,
  title,
  file_path: filePath,
  file_type: reportFormat,
  file_size: fileSize,
  created_at: createdAt.toISOString(),
  updated_at: createdAt.toISOString(),
  remote_url: remoteUrl,
  file_url: remoteUrl,
  metadata: serializeSavedReportMetadata(metadata),
  is_read: isRead ? 1 : 0,
  period_key: periodKey,
  is_synced: isSynced ? 1 : 0,
});

export const reconcileStoredReportFiles = async (userId: string) => {
  const db = await getDB();
  const scannedFiles = await scanStoredReportFiles();
  const existingReports: any[] = await db.getAllAsync(
    "SELECT * FROM saved_reports WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
    [userId],
  );

  const fileNameFromUri = (uri: string) => {
    const decoded = decodeURIComponent(uri || "");
    return decoded.split("/").pop() || "";
  };

  const findExistingReport = (file: { uri: string; fileName: string }) =>
    existingReports.find((report) => {
      if (report.file_path === file.uri) return true;
      const meta = parseSavedReportMetadata(report.metadata);
      if (meta.fileName === file.fileName) return true;
      return fileNameFromUri(report.file_path) === file.fileName;
    });

  for (const file of scannedFiles) {
    const existing = findExistingReport(file);
    const nowIso = new Date().toISOString();

    if (existing) {
      const existingMeta = parseSavedReportMetadata(existing.metadata);
      await db.runAsync(
        "UPDATE saved_reports SET file_path = ?, file_type = ?, file_size = ?, metadata = ?, updated_at = ? WHERE id = ?",
        [
          file.uri,
          normalizeReportFormat(file.fileType),
          file.size,
          serializeSavedReportMetadata({
            ...existingMeta,
            format: normalizeReportFormat(file.fileType),
            fileName: file.fileName,
            generatedAt: existingMeta.generatedAt || existing.created_at || nowIso,
            reportDate: existingMeta.reportDate || existing.period_key || format(new Date(existing.created_at || nowIso), "MMM dd, yyyy"),
          }),
          nowIso,
          existing.id,
        ],
      );
      continue;
    }

    const createdAt = file.modificationTime
      ? new Date(file.modificationTime * 1000)
      : new Date();
    const inferred = inferReportMetadataFromFileName(file.fileName);
    const title = inferred?.title || file.fileName.replace(/\.[^.]+$/, "").replace(/_/g, " ").trim();
    const reportFormat = normalizeReportFormat(file.fileType);

    await saveReportLocal(
      buildSavedReportRecord({
        reportId: generateUUID(),
        userId,
        title: title || `Saved Report ${format(createdAt, "MMM d, yyyy")}`,
        filePath: file.uri,
        fileSize: file.size,
        format: reportFormat,
        createdAt,
        periodKey: inferred?.reportDate || format(createdAt, "MMM dd, yyyy"),
        metadata: {
          source: "imported",
          format: reportFormat,
          fileName: file.fileName,
          reportDate: inferred?.reportDate || format(createdAt, "MMM dd, yyyy"),
          generatedAt: inferred?.generatedAt || createdAt.toISOString(),
          scannedFromFolder: true,
        },
        isRead: true,
        isSynced: false,
      }),
      { queueSync: true, synced: false },
    );
  }

  const refreshedReports: any[] = await db.getAllAsync(
    "SELECT * FROM saved_reports WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
    [userId],
  );

  const verifiedReports = await Promise.all(
    refreshedReports.map(async (report) => {
      const fileInfo = await getSafeFileInfo(report.file_path);
      const metadata = parseSavedReportMetadata(report.metadata);
      return {
        ...report,
        metadata: serializeSavedReportMetadata({
          ...metadata,
          format: normalizeReportFormat(report.file_type),
          fileName: metadata.fileName || fileNameFromUri(report.file_path),
          reportDate:
            metadata.reportDate ||
            inferReportMetadataFromFileName(metadata.fileName || fileNameFromUri(report.file_path))?.reportDate ||
            report.period_key ||
            format(new Date(report.created_at), "MMM dd, yyyy"),
          generatedAt:
            metadata.generatedAt ||
            inferReportMetadataFromFileName(metadata.fileName || fileNameFromUri(report.file_path))?.generatedAt ||
            report.created_at,
        }),
        isLocal: fileInfo.exists,
        localPath: fileInfo.exists ? report.file_path : null,
        hasCloudCopy: !!(report.remote_url || report.file_url || report.public_url),
      };
    }),
  );

  return verifiedReports;
};
