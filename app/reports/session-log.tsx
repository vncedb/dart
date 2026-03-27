import {
  Cancel01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  PlusSignIcon,
  Time04Icon,
  TimeManagementCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { format } from "date-fns";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BackHandler, ScrollView, StatusBar, StyleSheet, Switch, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "../../components/Button";
import DurationPicker from "../../components/DurationPicker";
import FloatingAlert from "../../components/FloatingAlert";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import IconButton from "../../components/IconButton";
import LoadingOverlay from "../../components/LoadingOverlay";
import ModernAlert from "../../components/ModernAlert";
import TimePicker from "../../components/TimePicker";
import { useAppTheme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useSync } from "../../context/SyncContext";
import { remapTimestampToDay } from "../../lib/attendance-session";
import { generateUUID, queueSyncItem, saveAttendanceLocal } from "../../lib/database";
import { getDB } from "../../lib/db-client";
import { formatMinutesAsHours, getAttendanceBreakdown, summarizeAttendances } from "../../lib/report-helpers";
import { refreshWidgetSnapshot } from "../../lib/widgets";

const SHIFT_BREAK_DISABLED_TOKEN = "SkipShiftBreak:1";
const MANUAL_BREAK_TOKEN = "ManualBreak:1";
const DEFAULT_NEW_SESSION_MINUTES = 60;
const MIN_SESSION_MINUTES = 15;

const normalizeRemarks = (remarks?: string | null) =>
  String(remarks || "")
    .replace(/\s+/g, " ")
    .trim();

const stripPauseBreakToken = (remarks?: string | null) =>
  String(remarks || "").replace(/\s*BreakMs:\d+\s*/g, " ");

const stripShiftBreakToken = (remarks?: string | null) =>
  String(remarks || "").replace(/\s*SkipShiftBreak:1\s*/g, " ");

const stripManualBreakToken = (remarks?: string | null) =>
  String(remarks || "").replace(/\s*ManualBreak:1\s*/g, " ");

const extractPauseBreakMinutes = (remarks?: string | null) => {
  const raw = String(remarks || "");
  const match = raw.match(/BreakMs:(\d+)/);
  return match ? Math.max(0, Math.floor(parseInt(match[1], 10) / 60000)) : 0;
};

const isManualBreak = (remarks?: string | null) => String(remarks || "").includes(MANUAL_BREAK_TOKEN);

const mergePauseBreakMinutesIntoRemarks = (
  remarks: string | null | undefined,
  minutes: number,
  options?: { manual?: boolean },
) => {
  const sanitized = normalizeRemarks(stripManualBreakToken(stripPauseBreakToken(remarks)));

  if (!minutes) {
    return sanitized;
  }

  const tokens = [`BreakMs:${minutes * 60000}`];
  if (options?.manual) {
    tokens.push(MANUAL_BREAK_TOKEN);
  }

  return `${sanitized ? `${sanitized} ` : ""}${tokens.join(" ")}`.trim();
};

const isShiftBreakEnabled = (remarks?: string | null) => !String(remarks || "").includes(SHIFT_BREAK_DISABLED_TOKEN);

const mergeShiftBreakSettingIntoRemarks = (remarks: string | null | undefined, enabled: boolean) => {
  const sanitized = normalizeRemarks(stripShiftBreakToken(remarks));

  if (enabled) {
    return sanitized;
  }

  return `${sanitized ? `${sanitized} ` : ""}${SHIFT_BREAK_DISABLED_TOKEN}`.trim();
};

const createDayTime = (baseDate: Date, hours: number, minutes: number) => {
  const next = new Date(baseDate);
  next.setHours(hours, minutes, 0, 0);
  return next;
};

const sortAttendancesByClockIn = (items: any[], day: Date) =>
  [...items].sort((left, right) => {
    const leftTime = left.clock_in ? remapTimestampToDay(left.clock_in, day).getTime() : Number.MAX_SAFE_INTEGER;
    const rightTime = right.clock_in ? remapTimestampToDay(right.clock_in, day).getTime() : Number.MAX_SAFE_INTEGER;

    if (leftTime !== rightTime) {
      return leftTime - rightTime;
    }

    return String(left.id || "").localeCompare(String(right.id || ""));
  });

const getSessionDurationMinutes = (session: any, day: Date) => {
  if (!session?.clock_in || !session?.clock_out) {
    return 0;
  }

  const start = remapTimestampToDay(session.clock_in, day).getTime();
  const end = remapTimestampToDay(session.clock_out, day).getTime();
  return Math.max(0, Math.round((end - start) / 60000));
};

const getBestManualBreakTargetSession = (items: any[], day: Date) =>
  sortAttendancesByClockIn(
    items.filter((item) => !item?._isDeleted && getSessionDurationMinutes(item, day) > 0 && extractPauseBreakMinutes(item.remarks) <= 0),
    day,
  ).sort((left, right) => getSessionDurationMinutes(right, day) - getSessionDurationMinutes(left, day))[0] || null;

const validateAttendancesForDay = (items: any[], day: Date) => {
  const activeSessions = sortAttendancesByClockIn(
    items.filter((item) => !item?._isDeleted),
    day,
  );

  for (const session of activeSessions) {
    if (!session.clock_in || !session.clock_out) {
      return "Each session needs both Time In and Time Out before saving.";
    }

    const start = remapTimestampToDay(session.clock_in, day).getTime();
    const end = remapTimestampToDay(session.clock_out, day).getTime();
    if (end < start) {
      return "Time Out cannot be earlier than Time In.";
    }

    const sessionDuration = Math.round((end - start) / 60000);
    if (extractPauseBreakMinutes(session.remarks) > sessionDuration) {
      return "Pause break cannot be longer than the session itself.";
    }
  }

  for (let i = 1; i < activeSessions.length; i += 1) {
    const prev = activeSessions[i - 1];
    const current = activeSessions[i];
    const prevEnd = remapTimestampToDay(prev.clock_out, day).getTime();
    const currentStart = remapTimestampToDay(current.clock_in, day).getTime();

    if (currentStart < prevEnd) {
      return "Sessions cannot overlap. Please adjust the time range.";
    }
  }

  return null;
};

const getSuggestedSessionWindow = (items: any[], day: Date) => {
  const sorted = sortAttendancesByClockIn(
    items.filter((item) => !item?._isDeleted && item?.clock_in && item?.clock_out),
    day,
  );
  const dayEnd = createDayTime(day, 23, 59);
  let cursor = createDayTime(day, 9, 0);

  if (sorted.length === 0) {
    return {
      start: cursor,
      end: new Date(cursor.getTime() + DEFAULT_NEW_SESSION_MINUTES * 60000),
    };
  }

  for (const session of sorted) {
    const start = remapTimestampToDay(session.clock_in, day);
    const gapMinutes = Math.floor((start.getTime() - cursor.getTime()) / 60000);

    if (gapMinutes >= MIN_SESSION_MINUTES) {
      return {
        start: cursor,
        end: new Date(Math.min(start.getTime(), cursor.getTime() + DEFAULT_NEW_SESSION_MINUTES * 60000)),
      };
    }

    const end = remapTimestampToDay(session.clock_out, day);
    if (end.getTime() > cursor.getTime()) {
      cursor = end;
    }
  }

  const remainingMinutes = Math.floor((dayEnd.getTime() - cursor.getTime()) / 60000);
  if (remainingMinutes >= MIN_SESSION_MINUTES) {
    return {
      start: cursor,
      end: new Date(Math.min(dayEnd.getTime(), cursor.getTime() + DEFAULT_NEW_SESSION_MINUTES * 60000)),
    };
  }

  return null;
};

const normalizeRouteDate = (value: string | string[] | undefined) => {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw) return format(new Date(), "yyyy-MM-dd");

  const direct = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(direct)) {
    return direct;
  }

  const isoLike = direct.split("T")[0];
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoLike)) {
    return isoLike;
  }

  const parsed = new Date(direct);
  return Number.isNaN(parsed.getTime()) ? format(new Date(), "yyyy-MM-dd") : format(parsed, "yyyy-MM-dd");
};

export default function SessionLogScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useAppTheme();
  const { triggerSync } = useSync();
  const { user } = useAuth();
  const { date } = useLocalSearchParams<{ date?: string }>();

  const sessionDate = normalizeRouteDate(date);
  const activeDate = useMemo(() => {
    const [year, month, day] = sessionDate.split("-").map(Number);
    return new Date(year, (month || 1) - 1, day || 1);
  }, [sessionDate]);

  const [attendances, setAttendances] = useState<any[]>([]);
  const [jobSettings, setJobSettings] = useState<any>(null);
  const [reportStatus, setReportStatus] = useState("pending");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [floatingAlert, setFloatingAlert] = useState({ visible: false, message: "", type: "warning" });

  const [activePicker, setActivePicker] = useState<{ id: string; type: "in" | "out"; current: string | null } | null>(null);
  const [pauseEditor, setPauseEditor] = useState<{
    id: string;
    initialMinutes: number;
    maxHours: number;
    title: string;
    kind: "manual" | "pause";
  } | null>(null);

  const fetchSessionLog = useCallback(async () => {
    if (!user?.id || !sessionDate) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const db = await getDB();
      const [dbAtts, dbTasks] = await Promise.all([
        db.getAllAsync(
          "SELECT * FROM attendance WHERE user_id = ? AND date = ? AND deleted_at IS NULL ORDER BY clock_in ASC",
          [user.id, sessionDate],
        ),
        db.getAllAsync(
          "SELECT * FROM accomplishments WHERE user_id = ? AND date = ? AND deleted_at IS NULL ORDER BY created_at DESC",
          [user.id, sessionDate],
        ),
      ]);

      const relatedJobId = (dbAtts as any[])[0]?.job_id || (dbTasks as any[])[0]?.job_id || null;
      if (relatedJobId) {
        const job: any = await db.getFirstAsync(
          "SELECT * FROM job_positions WHERE id = ? AND deleted_at IS NULL",
          [relatedJobId],
        );
        if (job) {
          setJobSettings({
            ...job,
            work_schedule: typeof job.work_schedule === "string" ? JSON.parse(job.work_schedule) : job.work_schedule,
            break_schedule: typeof job.break_schedule === "string" ? JSON.parse(job.break_schedule) : job.break_schedule,
          });
        } else {
          setJobSettings(null);
        }
      } else {
        setJobSettings(null);
      }

      const nextAttendances = (dbAtts as any[]).map((item) => ({
        ...item,
        _isDeleted: false,
        _isModified: false,
      }));

      setAttendances(nextAttendances);
      setReportStatus(
        nextAttendances.length > 0
          ? String(nextAttendances[nextAttendances.length - 1].status || "pending").toLowerCase()
          : "pending",
      );
      setIsDirty(false);
      setActivePicker(null);
      setPauseEditor(null);
    } catch (error) {
      console.log("Error fetching session log:", error);
      setFloatingAlert({
        visible: true,
        message: "Unable to load the session log right now.",
        type: "warning",
      });
    } finally {
      setLoading(false);
    }
  }, [sessionDate, user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchSessionLog();
    }, [fetchSessionLog]),
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (saving || !isDirty) {
        return;
      }

      event.preventDefault();
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Discard Changes?",
        message: "You have unsaved session updates. Leave this screen anyway?",
        confirmText: "Discard",
        cancelText: "Keep Editing",
        onConfirm: () => {
          setAlertConfig({ visible: false });
          setIsDirty(false);
          navigation.dispatch(event.data.action);
        },
        onCancel: () => setAlertConfig({ visible: false }),
      });
    });

    return unsubscribe;
  }, [isDirty, navigation, saving]);

  useEffect(() => {
    const onBackPress = () => {
      if (!isDirty || saving) {
        return false;
      }

      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Discard Changes?",
        message: "You have unsaved session updates. Leave this screen anyway?",
        confirmText: "Discard",
        cancelText: "Keep Editing",
        onConfirm: () => {
          setAlertConfig({ visible: false });
          setIsDirty(false);
          router.back();
        },
        onCancel: () => setAlertConfig({ visible: false }),
      });
      return true;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [isDirty, router, saving]);

  const isLocked = reportStatus === "pending";

  const getManualBreakWorkedLimitMinutes = useCallback(
    (items: any[]) => {
      const activeSessions = sortAttendancesByClockIn(
        items.filter((item) => !item?._isDeleted),
        activeDate,
      );

      return summarizeAttendances(activeSessions, "exact_hm", {
        breakSchedule: jobSettings?.break_schedule,
      }).totalMinutes;
    },
    [activeDate, jobSettings?.break_schedule],
  );

  const validateManualBreakLimit = useCallback(
    (items: any[]) => {
      const activeSessions = items.filter((item) => !item?._isDeleted);
      const totalManualBreakMinutes = activeSessions.reduce(
        (sum, session) => sum + extractPauseBreakMinutes(session.remarks),
        0,
      );
      const workedLimitMinutes = getManualBreakWorkedLimitMinutes(items);

      if (totalManualBreakMinutes > workedLimitMinutes) {
        return "Manual breaks cannot be longer than total worked hours.";
      }

      return null;
    },
    [getManualBreakWorkedLimitMinutes],
  );

  const updateAttendancesDraft = (updater: (items: any[]) => any[]) => {
    const nextAttendances = updater(attendances);
    const validationMessage = validateAttendancesForDay(nextAttendances, activeDate);

    if (validationMessage) {
      setFloatingAlert({ visible: true, message: validationMessage, type: "warning" });
      return false;
    }

    const manualBreakValidationMessage = validateManualBreakLimit(nextAttendances);
    if (manualBreakValidationMessage) {
      setFloatingAlert({ visible: true, message: manualBreakValidationMessage, type: "warning" });
      return false;
    }

    setAttendances(nextAttendances);
    setIsDirty(true);
    return true;
  };

  const handleTimePress = (id: string, type: "in" | "out", current: string | null) => {
    if (isLocked) {
      setFloatingAlert({
        visible: true,
        message: "Time out first before editing the session log.",
        type: "warning",
      });
      return;
    }

    setActivePicker({ id, type, current });
  };

  const handleTimeConfirm = (hours: number, minutes: number, period?: "AM" | "PM") => {
    if (!activePicker) {
      return;
    }

    const session = attendances.find((attendance) => attendance.id === activePicker.id);
    if (!session) {
      setActivePicker(null);
      return;
    }

    let nextHours = hours;
    if (period === "PM" && nextHours < 12) nextHours += 12;
    if (period === "AM" && nextHours === 12) nextHours = 0;

    const nextDate = new Date(activeDate);
    nextDate.setHours(nextHours, minutes, 0, 0);

    if (activePicker.type === "in" && session.clock_out) {
      const outDate = remapTimestampToDay(session.clock_out, activeDate);
      if (nextDate > outDate) {
        setFloatingAlert({ visible: true, message: "Time In cannot be later than Time Out.", type: "warning" });
        setActivePicker(null);
        return;
      }
    }

    if (activePicker.type === "out") {
      const inDate = session.clock_in ? remapTimestampToDay(session.clock_in, activeDate) : new Date(activeDate);
      if (nextDate < inDate) {
        setFloatingAlert({
          visible: true,
          message: "Time Out must stay within the same day and cannot be earlier than Time In.",
          type: "warning",
        });
        setActivePicker(null);
        return;
      }
    }

    const didUpdate = updateAttendancesDraft((prev) =>
      prev.map((attendance) =>
        attendance.id === activePicker.id
          ? {
              ...attendance,
              _isModified: true,
              clock_in: activePicker.type === "in" ? nextDate.toISOString() : attendance.clock_in,
              clock_out: activePicker.type === "out" ? nextDate.toISOString() : attendance.clock_out,
            }
          : attendance,
      ),
    );

    if (didUpdate) {
      setActivePicker(null);
    }
  };

  const handlePausePress = (session: any) => {
    if (isLocked) {
      setFloatingAlert({
        visible: true,
        message: "Time out first before editing the session log.",
        type: "warning",
      });
      return;
    }

    const sessionDurationMinutes = getSessionDurationMinutes(session, activeDate);
    const workedLimitMinutes = getManualBreakWorkedLimitMinutes(attendances);
    const currentBreakMinutes = extractPauseBreakMinutes(session.remarks);
    setPauseEditor({
      id: session.id,
      initialMinutes: extractPauseBreakMinutes(session.remarks),
      title: isManualBreak(session.remarks) ? "Edit Manual Break" : "Edit Pause Break",
      kind: isManualBreak(session.remarks) ? "manual" : "pause",
      maxHours: Math.max(
        1,
        Math.min(
          24,
          Math.ceil(Math.max(currentBreakMinutes, Math.min(sessionDurationMinutes, workedLimitMinutes)) / 60) || 1,
        ),
      ),
    });
  };

  const handleAddSession = () => {
    if (isLocked) {
      setFloatingAlert({
        visible: true,
        message: "Time out first before editing the session log.",
        type: "warning",
      });
      return;
    }

    if (!user?.id) {
      setFloatingAlert({
        visible: true,
        message: "Unable to add a worked session right now.",
        type: "warning",
      });
      return;
    }

    const jobId = jobSettings?.id || attendances.find((item) => !item._isDeleted)?.job_id;
    if (!jobId) {
      setFloatingAlert({
        visible: true,
        message: "A job must be linked before adding a worked session.",
        type: "warning",
      });
      return;
    }

    const suggestion = getSuggestedSessionWindow(attendances, activeDate);
    if (!suggestion) {
      setFloatingAlert({
        visible: true,
        message: "No open time slot is available for another worked session on this day.",
        type: "warning",
      });
      return;
    }

    const nextSession = {
      id: generateUUID(),
      user_id: user.id,
      job_id: jobId,
      date: sessionDate,
      title: null,
      clock_in: suggestion.start.toISOString(),
      clock_out: suggestion.end.toISOString(),
      status: "completed",
      remarks: "",
      _isDeleted: false,
      _isModified: true,
    };

    const didUpdate = updateAttendancesDraft((prev) => [...prev, nextSession]);
    if (!didUpdate) return;
  };

  const handleDeleteSession = (session: any) => {
    if (isLocked) {
      setFloatingAlert({
        visible: true,
        message: "Time out first before editing the session log.",
        type: "warning",
      });
      return;
    }

    setAlertConfig({
      visible: true,
      type: "warning",
      title: "Delete Worked Session",
      message: "Remove this worked session and its attached break from the session log?",
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: () => {
        setAlertConfig({ visible: false });
        const didUpdate = updateAttendancesDraft((prev) =>
          prev.map((attendance) =>
            attendance.id === session.id
              ? {
                  ...attendance,
                  _isDeleted: true,
                  _isModified: true,
                }
              : attendance,
          ),
        );

        if (didUpdate) {
          if (activePicker?.id === session.id) {
            setActivePicker(null);
          }
          if (pauseEditor?.id === session.id) {
            setPauseEditor(null);
          }
        }
      },
      onCancel: () => setAlertConfig({ visible: false }),
    });
  };

  const handlePauseSave = (hours: number, minutes: number) => {
    if (!pauseEditor) {
      return;
    }

    const parsedMinutes = Math.max(0, (hours * 60) + minutes);
    const session = attendances.find((attendance) => attendance.id === pauseEditor.id);

    if (!session) {
      setPauseEditor(null);
      return;
    }

    const sessionDurationMinutes = getSessionDurationMinutes(session, activeDate);
    if (parsedMinutes > sessionDurationMinutes) {
      setFloatingAlert({ visible: true, message: "Pause break cannot be longer than the session itself.", type: "warning" });
      return;
    }

    const workedLimitMinutes = getManualBreakWorkedLimitMinutes(attendances);
    if (parsedMinutes > workedLimitMinutes) {
      setFloatingAlert({ visible: true, message: "Manual breaks cannot be longer than total worked hours.", type: "warning" });
      return;
    }

    const shouldMarkManual = parsedMinutes > 0
      && (pauseEditor.kind === "manual" || (extractPauseBreakMinutes(session.remarks) > 0 ? isManualBreak(session.remarks) : true));

    const didUpdate = updateAttendancesDraft((prev) =>
      prev.map((attendance) =>
        attendance.id === pauseEditor.id
          ? {
              ...attendance,
              _isModified: true,
              remarks: mergePauseBreakMinutesIntoRemarks(attendance.remarks, parsedMinutes, { manual: shouldMarkManual }),
            }
          : attendance,
      ),
    );

    if (didUpdate) {
      setPauseEditor(null);
    }
  };

  const handleAddPause = () => {
    if (isLocked) {
      setFloatingAlert({
        visible: true,
        message: "Time out first before editing the session log.",
        type: "warning",
      });
      return;
    }

    const targetSession = getBestManualBreakTargetSession(visibleAttendances, activeDate);

    if (!targetSession) {
      setFloatingAlert({
        visible: true,
        message: visibleAttendances.length === 0
          ? "Add a work session first before adding a manual break."
          : "All worked sessions already have a break. Edit an existing break instead.",
        type: "warning",
      });
      return;
    }

    const sessionDurationMinutes = getSessionDurationMinutes(targetSession, activeDate);
    const workedLimitMinutes = getManualBreakWorkedLimitMinutes(attendances);
    setPauseEditor({
      id: targetSession.id,
      initialMinutes: extractPauseBreakMinutes(targetSession.remarks),
      title: "Add Manual Break",
      kind: "manual",
      maxHours: Math.max(
        1,
        Math.min(24, Math.ceil(Math.min(sessionDurationMinutes, workedLimitMinutes) / 60) || 1),
      ),
    });
  };

  const handleDeletePause = (session: any) => {
    if (isLocked) {
      setFloatingAlert({
        visible: true,
        message: "Time out first before editing the session log.",
        type: "warning",
      });
      return;
    }

    setAlertConfig({
      visible: true,
      type: "warning",
      title: isManualBreak(session.remarks) ? "Delete Manual Break" : "Delete Pause Break",
      message: isManualBreak(session.remarks)
        ? "Remove this manual break from the worked session?"
        : "Remove this pause break from the worked session?",
      confirmText: "Remove",
      cancelText: "Cancel",
      onConfirm: () => {
        setAlertConfig({ visible: false });
        updateAttendancesDraft((prev) =>
          prev.map((attendance) =>
            attendance.id === session.id
              ? {
                  ...attendance,
                  _isModified: true,
                  remarks: mergePauseBreakMinutesIntoRemarks(attendance.remarks, 0),
                }
              : attendance,
          ),
        );
      },
      onCancel: () => setAlertConfig({ visible: false }),
    });
  };

  const handleShiftBreakToggle = (enabled: boolean) => {
    updateAttendancesDraft((prev) =>
      prev.map((attendance) =>
        !attendance._isDeleted
          ? {
              ...attendance,
              _isModified: true,
              remarks: mergeShiftBreakSettingIntoRemarks(attendance.remarks, enabled),
            }
          : attendance,
      ),
    );
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const validationError = validateAttendancesForDay(attendances, activeDate);
      if (validationError) {
        setAlertConfig({
          visible: true,
          type: "warning",
          title: "Invalid Session Time",
          message: validationError,
          confirmText: "Okay",
          onConfirm: () => setAlertConfig({ visible: false }),
        });
        setSaving(false);
        return;
      }

      const db = await getDB();
      const now = new Date().toISOString();

      for (const attendance of attendances) {
        if (!attendance._isModified) {
          continue;
        }

        if (attendance._isDeleted) {
          const existing: any = await db.getFirstAsync("SELECT * FROM attendance WHERE id = ?", [attendance.id]);
          if (existing) {
            await db.runAsync("DELETE FROM attendance WHERE id = ?", [attendance.id]);
            await queueSyncItem("attendance", attendance.id, "DELETE");
          }
          continue;
        }

        const mappedClockIn = attendance.clock_in ? remapTimestampToDay(attendance.clock_in, activeDate).toISOString() : attendance.clock_in;
        const mappedClockOut = attendance.clock_out ? remapTimestampToDay(attendance.clock_out, activeDate).toISOString() : attendance.clock_out;

        const existing: any = await db.getFirstAsync("SELECT * FROM attendance WHERE id = ?", [attendance.id]);
        if (existing) {
          await db.runAsync(
            "UPDATE attendance SET clock_in = ?, clock_out = ?, status = ?, remarks = ?, date = ?, updated_at = ?, is_synced = 0 WHERE id = ?",
            [mappedClockIn, mappedClockOut, mappedClockOut ? "completed" : "pending", attendance.remarks || null, sessionDate, now, attendance.id],
          );

          const payload = {
            ...existing,
            clock_in: mappedClockIn,
            clock_out: mappedClockOut,
            status: mappedClockOut ? "completed" : "pending",
            remarks: attendance.remarks || null,
            date: sessionDate,
            updated_at: now,
            is_synced: 0,
          };
          await queueSyncItem("attendance", attendance.id, "UPDATE", payload);
        } else {
          const nextAttendance = {
            id: attendance.id,
            user_id: attendance.user_id,
            job_id: attendance.job_id,
            date: sessionDate,
            title: attendance.title || null,
            clock_in: mappedClockIn,
            clock_out: mappedClockOut,
            status: mappedClockOut ? "completed" : "pending",
            remarks: attendance.remarks || null,
            updated_at: now,
          };
          await saveAttendanceLocal(nextAttendance);
        }
      }

      setIsDirty(false);
      setActivePicker(null);
      setPauseEditor(null);
      triggerSync();
      if (user?.id) {
        await refreshWidgetSnapshot(user.id, { force: true });
      }

      setFloatingAlert({
        visible: true,
        message: "Session log updated successfully.",
        type: "success",
      });
      fetchSessionLog();
    } catch (error) {
      console.log("Error saving session log:", error);
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Save Failed",
        message: "Failed to save session changes.",
        confirmText: "Okay",
        onConfirm: () => setAlertConfig({ visible: false }),
      });
    } finally {
      setSaving(false);
    }
  };

  const getInitialTime = () => {
    if (!activePicker?.current) {
      return { h: 12, m: 0, p: "AM" as const };
    }

    const dateObj = new Date(activePicker.current);
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    const period = hours >= 12 ? "PM" : "AM";
    hours = hours % 12 || 12;
    return { h: hours, m: minutes, p: period as "AM" | "PM" };
  };

  const initialPickerVals = getInitialTime();
  const visibleAttendances = sortAttendancesByClockIn(attendances.filter((item) => !item._isDeleted), activeDate);
  const attendanceSummary = summarizeAttendances(visibleAttendances, "exact_hm", { breakSchedule: jobSettings?.break_schedule });
  const totalPauseBreakMinutes = visibleAttendances.reduce((sum, session) => sum + extractPauseBreakMinutes(session.remarks), 0);
  const totalScheduledBreakMinutes = visibleAttendances.reduce((sum, session) => {
    const breakdown = getAttendanceBreakdown(session, { breakSchedule: jobSettings?.break_schedule });
    return sum + breakdown.scheduledBreakMinutes;
  }, 0);
  const shiftBreakEnabled = visibleAttendances.length > 0
    ? visibleAttendances.every((session) => isShiftBreakEnabled(session.remarks))
    : true;
  const pauseSessions = visibleAttendances.filter((session) => extractPauseBreakMinutes(session.remarks) > 0);

  const totalMinutes = attendanceSummary.totalMinutes;
  const totalHoursDisplay = totalMinutes > 0 ? formatMinutesAsHours(totalMinutes) : "0h";
  const totalBreakDisplay = formatMinutesAsHours(totalPauseBreakMinutes);

  const handleDiscard = () => {
    if (isDirty) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Discard Changes?",
        message: "Your unsaved session updates will be lost.",
        confirmText: "Discard",
        cancelText: "Cancel",
        onConfirm: () => {
          setAlertConfig({ visible: false });
          setActivePicker(null);
          setPauseEditor(null);
          fetchSessionLog();
        },
        onCancel: () => setAlertConfig({ visible: false }),
      });
      return;
    }

    setActivePicker(null);
    setPauseEditor(null);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      <ModernAlert {...alertConfig} />
      <FloatingAlert
        visible={floatingAlert.visible}
        message={floatingAlert.message}
        type={floatingAlert.type as any}
        onHide={() => setFloatingAlert((prev) => ({ ...prev, visible: false }))}
      />
      <LoadingOverlay visible={loading || saving} message={saving ? "Saving Session Log..." : "Loading..."} />

      <TimePicker
        visible={!!activePicker}
        onClose={() => setActivePicker(null)}
        onConfirm={handleTimeConfirm}
        title={activePicker?.type === "in" ? "Select Time In" : "Select Time Out"}
        initialHours={initialPickerVals.h}
        initialMinutes={initialPickerVals.m}
        initialPeriod={initialPickerVals.p}
      />

      <DurationPicker
        visible={!!pauseEditor}
        onClose={() => setPauseEditor(null)}
        onConfirm={handlePauseSave}
        title={pauseEditor?.title || "Manual Break Duration"}
        initialHours={Math.floor((pauseEditor?.initialMinutes || 0) / 60)}
        initialMinutes={(pauseEditor?.initialMinutes || 0) % 60}
        maxHours={pauseEditor?.maxHours || 1}
      />

      <Header
        title="Session Log"
        leftElement={
          isDirty ? (
            <TouchableOpacity onPress={handleDiscard} style={styles.headerCloseButton} activeOpacity={0.8}>
              <HugeiconsIcon icon={Cancel01Icon} size={22} color={theme.colors.text} />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
          <View style={styles.summaryHeader}>
            <View style={styles.summaryTitleBlock}>
              {jobSettings?.title ? (
                <Text style={[styles.summaryJob, { color: theme.colors.textSecondary }]} numberOfLines={2}>
                  {jobSettings.title}
                </Text>
              ) : null}
              <Text style={[styles.summaryDate, { color: theme.colors.text }]}>{format(activeDate, "MMMM d, yyyy")}</Text>
              <Text style={[styles.summaryDay, { color: theme.colors.textSecondary }]}>{format(activeDate, "EEEE")}</Text>
            </View>
          </View>

          <View style={[styles.summaryStatsRow, { borderTopColor: theme.colors.border }]}>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryStatLabel, { color: theme.colors.textSecondary }]}>Worked</Text>
              <Text style={[styles.summaryStatValue, { color: theme.colors.text }]}>{totalHoursDisplay}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryStatLabel, { color: theme.colors.textSecondary }]}>Breaks</Text>
              <Text style={[styles.summaryStatValue, { color: theme.colors.text }]}>{totalBreakDisplay}</Text>
            </View>
            <View style={styles.summaryStat}>
              <Text style={[styles.summaryStatLabel, { color: theme.colors.textSecondary }]}>Sessions</Text>
              <Text style={[styles.summaryStatValue, { color: theme.colors.text }]}>{visibleAttendances.length}</Text>
            </View>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <HugeiconsIcon icon={TimeManagementCircleIcon} size={20} color={theme.colors.text} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Worked Sessions</Text>
          </View>
          <IconButton
            icon={PlusSignIcon}
            onPress={handleAddSession}
            backgroundColor={theme.colors.card}
            borderColor={theme.colors.border}
            color={isLocked ? theme.colors.textSecondary : theme.colors.primary}
            size={18}
            disabled={isLocked}
          />
        </View>

        {visibleAttendances.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.emptyIconBox, { backgroundColor: theme.colors.background }]}>
              <HugeiconsIcon icon={TimeManagementCircleIcon} size={24} color={theme.colors.icon} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No sessions recorded yet</Text>
            <Text style={[styles.emptySubtitle, { color: theme.colors.textSecondary }]}>
              No worked sessions were recorded for this day.
            </Text>
          </View>
        ) : (
          visibleAttendances.map((session, index) => {
            const timeInText = session.clock_in ? format(new Date(session.clock_in), "h:mm a") : "--:--";
            const timeOutText = session.clock_out ? format(new Date(session.clock_out), "h:mm a") : "In Progress";

            return (
              <View key={session.id} style={[styles.sessionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.sessionCardHeader}>
                  <View style={styles.sessionTitleBlock}>
                    <Text style={[styles.sessionEyebrow, { color: theme.colors.textSecondary }]}>Session {index + 1}</Text>
                    <Text style={[styles.sessionRange, { color: theme.colors.text }]}>{timeInText} - {timeOutText}</Text>
                  </View>
                  {!isLocked ? (
                    <IconButton
                      icon={Delete02Icon}
                      onPress={() => handleDeleteSession(session)}
                      backgroundColor={theme.colors.danger + "10"}
                      borderColor={theme.colors.danger + "24"}
                      color={theme.colors.danger}
                      size={15}
                      style={styles.sessionDeleteButton}
                    />
                  ) : (
                    <View style={styles.headerSpacer} />
                  )}
                </View>

                <View style={[styles.timeGrid, { borderTopColor: theme.colors.border }]}>
                  <TouchableOpacity
                    activeOpacity={0.82}
                    disabled={isLocked}
                    onPress={() => handleTimePress(session.id, "in", session.clock_in)}
                    style={[styles.timeCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                  >
                    <View style={styles.timeCardHeader}>
                      <Text style={[styles.timeCardLabel, { color: theme.colors.textSecondary }]}>Time In</Text>
                      {!isLocked ? <HugeiconsIcon icon={PencilEdit02Icon} size={14} color={theme.colors.primary} /> : null}
                    </View>
                    <Text style={[styles.timeCardValue, { color: theme.colors.text }]}>{timeInText}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    activeOpacity={0.82}
                    disabled={isLocked}
                    onPress={() => handleTimePress(session.id, "out", session.clock_out)}
                    style={[styles.timeCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                  >
                    <View style={styles.timeCardHeader}>
                      <Text style={[styles.timeCardLabel, { color: theme.colors.textSecondary }]}>Time Out</Text>
                      {!isLocked ? <HugeiconsIcon icon={PencilEdit02Icon} size={14} color={theme.colors.primary} /> : null}
                    </View>
                    <Text style={[styles.timeCardValue, { color: theme.colors.text }]}>{timeOutText}</Text>
                  </TouchableOpacity>
                </View>

              </View>
            );
          })
        )}

        {visibleAttendances.length > 0 ? (
          <>
            <View style={styles.breaksSectionHeader}>
              <View style={styles.sectionTitleRow}>
                <HugeiconsIcon icon={Time04Icon} size={20} color={theme.colors.text} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Work Breaks</Text>
              </View>
              <IconButton
                icon={PlusSignIcon}
                onPress={handleAddPause}
                backgroundColor={theme.colors.card}
                borderColor={theme.colors.border}
                color={isLocked ? theme.colors.textSecondary : theme.colors.primary}
                size={18}
                disabled={isLocked}
              />
            </View>

            <View style={[styles.shiftBreakRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.shiftBreakTextBlock}>
                <Text style={[styles.shiftBreakLabel, { color: theme.colors.text }]}>Shift Break</Text>
                <Text style={[styles.shiftBreakHint, { color: theme.colors.textSecondary }]}>
                  {shiftBreakEnabled
                    ? `Deduct ${formatMinutesAsHours(totalScheduledBreakMinutes)} from worked hours`
                    : "Do not deduct scheduled break"}
                </Text>
              </View>
              <Switch
                value={shiftBreakEnabled}
                onValueChange={handleShiftBreakToggle}
                disabled={isLocked}
                trackColor={{ false: theme.colors.border, true: theme.colors.primary + "66" }}
                thumbColor={shiftBreakEnabled ? theme.colors.primary : "#f4f4f5"}
                ios_backgroundColor={theme.colors.border}
              />
            </View>

            {totalPauseBreakMinutes > totalMinutes ? (
              <View style={[styles.inlineErrorNote, { backgroundColor: theme.colors.danger + "10", borderColor: theme.colors.danger + "24" }]}>
                <Text style={[styles.inlineErrorTitle, { color: theme.colors.danger }]}>Manual break limit reached</Text>
                <Text style={[styles.inlineErrorText, { color: theme.colors.textSecondary }]}>
                  Manual breaks cannot be longer than total worked hours. Reduce break time or extend worked sessions.
                </Text>
              </View>
            ) : null}

            <View style={styles.breaksList}>
              {pauseSessions.length === 0 ? (
                <View style={[styles.breakEmptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <Text style={[styles.breakEmptyTitle, { color: theme.colors.text }]}>No work breaks yet</Text>
                  <Text style={[styles.breakEmptySubtitle, { color: theme.colors.textSecondary }]}>
                    Use the add button to record a manual break for this day.
                  </Text>
                </View>
              ) : pauseSessions.map((session) => {
                const pauseMinutes = extractPauseBreakMinutes(session.remarks);
                const sessionIndex = visibleAttendances.findIndex((item) => item.id === session.id);
                const breakTypeLabel = isManualBreak(session.remarks) ? "Manual Break" : "Pause Break";

                return (
                  <View
                    key={`break-${session.id}`}
                    style={[
                      styles.breakCard,
                      {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                        opacity: 1,
                      },
                    ]}
                  >
                    <View style={styles.breakCardHeader}>
                      <View style={styles.breakCardTitleBlock}>
                        <Text style={[styles.breakCardEyebrow, { color: theme.colors.textSecondary }]}>
                          BREAK {sessionIndex + 1}
                        </Text>
                      </View>
                      {!isLocked ? (
                        <View style={styles.breakCardActions}>
                          <IconButton
                            icon={PencilEdit02Icon}
                            onPress={() => handlePausePress(session)}
                            backgroundColor={theme.colors.background}
                            borderColor={theme.colors.border}
                            color={theme.colors.primary}
                            size={15}
                            style={styles.breakActionButton}
                          />
                          <IconButton
                            icon={Delete02Icon}
                            onPress={() => handleDeletePause(session)}
                            backgroundColor={theme.colors.background}
                            borderColor={theme.colors.border}
                            color={theme.colors.danger}
                            size={15}
                            style={styles.breakActionButton}
                          />
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.breakCardValue, { color: theme.colors.text }]}>{formatMinutesAsHours(pauseMinutes)}</Text>
                    <Text style={[styles.breakCardCategory, { color: theme.colors.text }]}>{breakTypeLabel.toUpperCase()}</Text>
                  </View>
                );
              })}
            </View>
          </>
        ) : null}
      </ScrollView>

      {isDirty ? (
        <Footer>
          <Button title="Save Changes" onPress={saveChanges} isLoading={saving} style={{ width: "100%" }} />
        </Footer>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 24,
    paddingBottom: 120,
  },
  headerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerSpacer: {
    width: 40,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 20,
    marginBottom: 24,
  },
  summaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 10,
  },
  summaryTitleBlock: {
    flex: 1,
  },
  summaryDate: {
    fontSize: 23,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.4,
    marginBottom: 2,
  },
  summaryDay: {
    fontSize: 14,
    fontFamily: "Nunito_700Bold",
  },
  summaryJob: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    lineHeight: 21,
    marginBottom: 10,
  },
  summaryStatsRow: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 16,
    gap: 10,
  },
  summaryStat: {
    flex: 1,
  },
  summaryStatLabel: {
    fontSize: 10,
    fontFamily: "Nunito_800ExtraBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 5,
  },
  summaryStatValue: {
    fontSize: 18,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.3,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  breaksSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  sectionTitle: {
    fontSize: 19,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.3,
  },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  emptyIconBox: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Nunito_800ExtraBold",
    marginBottom: 8,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  emptySubtitle: {
    fontSize: 14,
    fontFamily: "Nunito_600SemiBold",
    lineHeight: 22,
    textAlign: "center",
  },
  sessionCard: {
    borderWidth: 1,
    borderRadius: 22,
    padding: 18,
    gap: 14,
    marginBottom: 14,
  },
  sessionCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },
  sessionTitleBlock: {
    flex: 1,
  },
  sessionDeleteButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  sessionEyebrow: {
    fontSize: 10,
    fontFamily: "Nunito_800ExtraBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 5,
  },
  sessionRange: {
    fontSize: 19,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.4,
  },
  timeGrid: {
    flexDirection: "row",
    gap: 12,
    borderTopWidth: 1,
    paddingTop: 14,
  },
  shiftBreakRow: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  breaksList: {
    gap: 12,
    marginBottom: 24,
  },
  breakCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  breakEmptyCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  breakEmptyTitle: {
    fontSize: 15,
    fontFamily: "Nunito_800ExtraBold",
    marginBottom: 4,
  },
  breakEmptySubtitle: {
    fontSize: 13,
    fontFamily: "Nunito_600SemiBold",
    lineHeight: 20,
  },
  inlineErrorNote: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  inlineErrorTitle: {
    fontSize: 13,
    fontFamily: "Nunito_800ExtraBold",
    marginBottom: 4,
  },
  inlineErrorText: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    lineHeight: 18,
  },
  breakCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 2,
  },
  breakCardTitleBlock: {
    flex: 1,
  },
  breakCardEyebrow: {
    fontSize: 10,
    fontFamily: "Nunito_800ExtraBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 0,
  },
  breakCardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  breakActionButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  breakCardTitle: {
    fontSize: 16,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.2,
  },
  breakCardMeta: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    marginTop: 4,
  },
  breakCardValue: {
    fontSize: 15,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.2,
  },
  breakCardCategory: {
    fontSize: 10,
    fontFamily: "Nunito_800ExtraBold",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginTop: 3,
  },
  shiftBreakTextBlock: {
    flex: 1,
  },
  shiftBreakLabel: {
    fontSize: 12,
    fontFamily: "Nunito_800ExtraBold",
    marginBottom: 4,
    letterSpacing: 0.2,
  },
  shiftBreakHint: {
    fontSize: 12,
    fontFamily: "Nunito_600SemiBold",
    lineHeight: 18,
  },
  timeCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  timeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  timeCardLabel: {
    fontSize: 10,
    fontFamily: "Nunito_800ExtraBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  timeCardValue: {
    fontSize: 17,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.2,
  },
  metricGrid: {
    gap: 12,
  },
  metricCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 6,
  },
  metricLabel: {
    fontSize: 10,
    fontFamily: "Nunito_800ExtraBold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 15,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.2,
  },
});
