// filepath: app/reports/details.tsx
import {
    Activity01Icon,
    Cancel01Icon,
    Delete02Icon,
    File02Icon,
    MoreVerticalIcon,
    PencilEdit02Icon,
    PlusSignIcon,
    Share08Icon,
    Task01Icon,
    Time02Icon,
    Time04Icon,
    TimeManagementCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { format } from "date-fns";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    BackHandler,
    Image,
    LayoutAnimation,
    Modal,
    NativeScrollEvent,
    NativeSyntheticEvent,
    Platform,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from "react-native";
import Animated, {
    Easing,
    FadeInDown,
    FadeOutDown
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import ActionMenu from "../../components/ActionMenu";
import { AnimatedList } from "../../components/AnimatedList";
import Button from "../../components/Button";
import DatePicker from "../../components/DatePicker";
import DurationPicker from "../../components/DurationPicker";
import FloatingAlert from "../../components/FloatingAlert";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import IconButton from "../../components/IconButton";
import ImageViewer from "../../components/ImageViewer";
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

const DEFAULT_NEW_SESSION_MINUTES = 60;
const MIN_SESSION_MINUTES = 15;

const extractManualBreakMinutes = (remarks?: string | null) => {
  const raw = String(remarks || "");
  const match = raw.match(/BreakMs:(\d+)/);
  return match ? Math.max(0, Math.floor(parseInt(match[1], 10) / 60000)) : 0;
};

const mergeBreakMinutesIntoRemarks = (remarks: string | null | undefined, minutes: number) => {
  const sanitized = String(remarks || "")
    .replace(/\s*BreakMs:\d+\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!minutes) {
    return sanitized;
  }

  return `${sanitized ? `${sanitized} ` : ""}BreakMs:${minutes * 60000}`.trim();
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
    if (extractManualBreakMinutes(session.remarks) > sessionDuration) {
      return "Break time cannot be longer than the session itself.";
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

export default function ReportDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useAppTheme();
  const { triggerSync } = useSync();
  const { date } = useLocalSearchParams();
  const { user } = useAuth();
  const dateStr = normalizeRouteDate(date as string | string[] | undefined);

  const [attendances, setAttendances] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [jobSettings, setJobSettings] = useState<any>(null);
  const [reportStatus, setReportStatus] = useState("pending");
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [floatingAlert, setFloatingAlert] = useState({ visible: false, message: "", type: "warning" });

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
  const moreIconRef = useRef<View>(null);

  const [logModalVisible, setLogModalVisible] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [activeImageUri, setActiveImageUri] = useState<string | null>(null);

  const [activePicker, setActivePicker] = useState<{ id: string, type: 'in' | 'out', current: string | null } | null>(null);
  const [breakEditor, setBreakEditor] = useState<{ id: string; initialMinutes: number; maxHours: number } | null>(null);

  const [activeDate, setActiveDate] = useState<Date>(() => {
      const [y, m, d] = dateStr.split('-').map(Number);
      return new Date(y, m - 1, d);
  });
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isHeaderDate, setIsHeaderDate] = useState(false);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const isScrolled = event.nativeEvent.contentOffset.y > 60;
    if (isHeaderDate !== isScrolled) {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setIsHeaderDate(isScrolled);
    }
  };

  const fetchReportDetails = useCallback(async () => {
    if (!user || !dateStr) {
      setLoading(false);
      return;
    }

    try {
      const db = await getDB();
      const dbAtts: any[] = await db.getAllAsync(
        "SELECT * FROM attendance WHERE user_id = ? AND date = ? AND deleted_at IS NULL ORDER BY clock_in ASC",
        [user.id, dateStr]
      );

      const dbTasks: any[] = await db.getAllAsync(
        "SELECT * FROM accomplishments WHERE user_id = ? AND date = ? AND deleted_at IS NULL ORDER BY created_at DESC",
        [user.id, dateStr]
      );
      const relatedJobId = dbAtts[0]?.job_id || dbTasks[0]?.job_id || null;
      if (relatedJobId) {
        const job: any = await db.getFirstAsync('SELECT * FROM job_positions WHERE id = ? AND deleted_at IS NULL', [relatedJobId]);
        if (job) {
          setJobSettings({
            ...job,
            work_schedule: typeof job.work_schedule === 'string' ? JSON.parse(job.work_schedule) : job.work_schedule,
            break_schedule: typeof job.break_schedule === 'string' ? JSON.parse(job.break_schedule) : job.break_schedule,
          });
        } else {
          setJobSettings(null);
        }
      } else {
        setJobSettings(null);
      }

      const processedTasks = (dbTasks || []).map((t) => {
        let images: string[] = [];
        if (t.image_url) {
          try {
            const parsed = JSON.parse(t.image_url);
            images = Array.isArray(parsed) ? parsed : [t.image_url];
          } catch { images = [t.image_url]; }
        }
        return { ...t, images, _isDeleted: false };
      });

      setAttendances(dbAtts.map(a => ({ ...a, _isDeleted: false, _isModified: false })));
      setTasks(processedTasks);
      setReportStatus(dbAtts.length > 0 ? String(dbAtts[dbAtts.length - 1].status || 'pending').toLowerCase() : "pending");
      
      const [y, m, d] = dateStr.split('-').map(Number);
      setActiveDate(new Date(y, m - 1, d));
      
      setIsDirty(false);
    } catch (err) {
      console.log("Error fetching details:", err);
    } finally {
      setLoading(false);
    }
  }, [dateStr, user]);

  useFocusEffect(useCallback(() => { fetchReportDetails(); }, [fetchReportDetails]));

  const handleDiscardEdits = useCallback(() => {
    setMenuVisible(false);
    if (isDirty) {
        setAlertConfig({
            visible: true, type: 'warning', title: 'Discard Changes?', message: 'Are you sure you want to discard your session edits?',
            confirmText: 'Discard', cancelText: 'Keep Editing',
            onConfirm: () => {
                setAlertConfig({ visible: false });
                const [y, m, d] = dateStr.split('-').map(Number);
                setActiveDate(new Date(y, m - 1, d));
                fetchReportDetails(); 
                toggleEditMode(false);
            },
            onCancel: () => setAlertConfig({ visible: false })
        });
    } else {
        toggleEditMode(false);
    }
  }, [isDirty, fetchReportDetails, dateStr]);

  useEffect(() => {
      const unsubscribe = navigation.addListener('beforeRemove', (e) => {
          if (saving || !isDirty) return;
          e.preventDefault();
          setAlertConfig({
              visible: true, type: 'warning', title: 'Discard Changes?', message: 'You have unsaved session edits. Are you sure you want to leave?',
              confirmText: 'Discard', cancelText: 'Keep Editing',
              onConfirm: () => {
                  setAlertConfig({ visible: false });
                  setIsDirty(false); 
                  navigation.dispatch(e.data.action);
              },
              onCancel: () => setAlertConfig({ visible: false })
          });
      });
      return unsubscribe;
  }, [navigation, saving, isDirty]);

  useEffect(() => {
      const onBackPress = () => {
          if (isEditMode) {
              handleDiscardEdits();
              return true; 
          }
          return false;
      };
      const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
      return () => subscription.remove();
  }, [isEditMode, handleDiscardEdits]);

  const toggleEditMode = (mode: boolean) => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsEditMode(mode);
      setMenuVisible(false);
  };

  const handleMenuOpen = () => {
    if (moreIconRef.current) {
      moreIconRef.current.measure((x, y, width, height, pageX, pageY) => {
        setMenuAnchor({ x: pageX + width, y: pageY + height });
        setMenuVisible(true);
      });
    }
  };

  const handleShare = async () => {
    setMenuVisible(false);
    try {
      const visibleAtts = attendances.filter(a => !a._isDeleted);
      const firstIn = visibleAtts[0]?.clock_in ? format(new Date(visibleAtts[0].clock_in), 'h:mm a') : '--:--';
      const lastOut = visibleAtts[visibleAtts.length - 1]?.clock_out ? format(new Date(visibleAtts[visibleAtts.length - 1].clock_out), 'h:mm a') : 'In Progress';
      const visibleTasks = tasks.filter(t => !t._isDeleted);
      const message = `Report ${dateStr}\nTime In: ${firstIn}\nTime Out: ${lastOut}\nTasks Completed: ${visibleTasks.length}`;
      await Share.share({ message });
    } catch { }
  };

  const executeDeleteReport = async () => {
    setSaving(true);
    try {
      if (user && dateStr) {
        const db = await getDB();
        
        // HARD DELETE FOR ATTENDANCE
        if (attendances.length > 0) {
            for (const att of attendances) {
                await db.runAsync("DELETE FROM attendance WHERE id = ?", [att.id]);
                await queueSyncItem("attendance", att.id, "DELETE");
            }
        }
        // HARD DELETE FOR TASKS
        if (tasks.length > 0) {
            for (const acc of tasks) {
                await db.runAsync("DELETE FROM accomplishments WHERE id = ?", [acc.id]);
                await queueSyncItem("accomplishments", acc.id, "DELETE");
            }
        }
        triggerSync();
        if (user?.id) await refreshWidgetSnapshot(user.id, { force: true });
        router.back();
      }
    } catch (err) { console.log(err); } finally { setSaving(false); }
  };

  const handleTimePress = (id: string, type: 'in' | 'out', current: string | null) => {
      if (reportStatus === 'pending') {
          setFloatingAlert({ visible: true, message: "Cannot edit attendance while session is in progress.", type: "warning" });
          return;
      }
      setActivePicker({ id, type, current });
  };

  const updateAttendancesDraft = (updater: (items: any[]) => any[]) => {
      const nextAttendances = updater(attendances);
      const validationMessage = validateAttendancesForDay(nextAttendances, activeDate);

      if (validationMessage) {
          setFloatingAlert({ visible: true, message: validationMessage, type: "warning" });
          return false;
      }

      setAttendances(nextAttendances);
      setIsDirty(true);
      return true;
  };

  const handleTimeConfirm = (hours: number, minutes: number, period?: "AM" | "PM" | undefined) => {
      if (!activePicker) return;

      const session = attendances.find(a => a.id === activePicker.id);
      if (!session) return;

      const targetDateStr = format(activeDate, 'yyyy-MM-dd');
      const [y, m, d] = targetDateStr.split('-').map(Number);
      
      let h = hours;
      if (period === 'PM' && h < 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;

      const newDate = new Date(y, m - 1, d);
      newDate.setHours(h, minutes, 0, 0);

      if (activePicker.type === 'in' && session.clock_out) {
          const outDate = remapTimestampToDay(session.clock_out, activeDate);
          if (newDate > outDate) {
              setFloatingAlert({ visible: true, message: "Time In cannot be later than Time Out.", type: "warning" });
              setActivePicker(null);
              return;
          }
      }

      if (activePicker.type === 'out') {
          const inDate = session.clock_in ? remapTimestampToDay(session.clock_in, activeDate) : new Date(y, m - 1, d);
          if (newDate < inDate) {
              setFloatingAlert({ visible: true, message: "Time Out must stay within the same day and cannot be earlier than Time In.", type: "warning" });
              setActivePicker(null);
              return;
          }
      }

      updateAttendancesDraft((prev) => prev.map(a => {
          if (a.id === activePicker.id) {
              return {
                  ...a,
                  _isModified: true,
                  clock_in: activePicker.type === 'in' ? newDate.toISOString() : a.clock_in,
                  clock_out: activePicker.type === 'out' ? newDate.toISOString() : a.clock_out
              };
          }
          return a;
      }));
      setActivePicker(null);
  };

  const handleDeleteTask = (id: string) => {
    setAlertConfig({
        visible: true, type: 'warning', title: 'Delete Task', message: 'Permanently delete this task?', confirmText: 'Delete', cancelText: 'Cancel',
        onConfirm: async () => {
            setAlertConfig({ visible: false });
            setLoading(true);
            try {
                const db = await getDB();
                // HARD DELETE TASK
                await db.runAsync('DELETE FROM accomplishments WHERE id = ?', [id]);
                await queueSyncItem('accomplishments', id, 'DELETE');
                
                triggerSync();
                fetchReportDetails();
            } catch (err) { console.log(err); }
            setLoading(false);
        },
        onCancel: () => setAlertConfig({ visible: false })
    });
  };

  const handleBreakPress = (session: any) => {
    if (reportStatus === 'pending') {
      setFloatingAlert({ visible: true, message: "Cannot edit attendance while session is in progress.", type: "warning" });
      return;
    }

    const sessionDurationMinutes = getSessionDurationMinutes(session, activeDate);
    setBreakEditor({
      id: session.id,
      initialMinutes: extractManualBreakMinutes(session.remarks),
      maxHours: Math.max(1, Math.min(24, Math.floor(sessionDurationMinutes / 60) + 1)),
    });
  };

  const handleBreakSave = (hours: number, minutes: number) => {
    if (!breakEditor) return;
    const parsedMinutes = Math.max(0, (hours * 60) + minutes);
    const session = attendances.find((attendance) => attendance.id === breakEditor.id);

    if (!session) {
      setBreakEditor(null);
      return;
    }

    const sessionDurationMinutes = getSessionDurationMinutes(session, activeDate);
    if (parsedMinutes > sessionDurationMinutes) {
      setFloatingAlert({ visible: true, message: "Break time cannot be longer than the session itself.", type: "warning" });
      return;
    }

    updateAttendancesDraft((prev) =>
      prev.map((attendance) =>
        attendance.id === breakEditor.id
          ? {
              ...attendance,
              _isModified: true,
              remarks: mergeBreakMinutesIntoRemarks(attendance.remarks, parsedMinutes),
            }
          : attendance,
      ),
    );
    setBreakEditor(null);
  };

  const handleAddSession = () => {
      if (reportStatus === 'pending') {
          setFloatingAlert({ visible: true, message: "Cannot edit attendance while session is in progress.", type: "warning" });
          return;
      }

      if (!user?.id) {
          setFloatingAlert({ visible: true, message: "Unable to add a session right now.", type: "warning" });
          return;
      }

      const jobId = jobSettings?.id || attendances.find((item) => !item._isDeleted)?.job_id || tasks.find((item) => !item._isDeleted)?.job_id;
      if (!jobId) {
          setFloatingAlert({ visible: true, message: "A job must be linked before adding a session.", type: "warning" });
          return;
      }

      const suggestion = getSuggestedSessionWindow(attendances, activeDate);
      if (!suggestion) {
          setFloatingAlert({ visible: true, message: "No open time slot is available for another session on this day.", type: "warning" });
          return;
      }

      const targetDateStr = format(activeDate, 'yyyy-MM-dd');
      const nextSession = {
          id: generateUUID(),
          user_id: user.id,
          job_id: jobId,
          date: targetDateStr,
          title: null,
          clock_in: suggestion.start.toISOString(),
          clock_out: suggestion.end.toISOString(),
          status: 'completed',
          remarks: '',
          _isDeleted: false,
          _isModified: true,
      };

      updateAttendancesDraft((prev) => [...prev, nextSession]);
  };

  const handleDeleteSession = (session: any) => {
      if (reportStatus === 'pending') {
          setFloatingAlert({ visible: true, message: "Cannot edit attendance while session is in progress.", type: "warning" });
          return;
      }

      setAlertConfig({
          visible: true,
          type: 'warning',
          title: 'Delete Session',
          message: 'Remove this session from the report? This action will be saved once you confirm your report changes.',
          confirmText: 'Remove',
          cancelText: 'Cancel',
          onConfirm: () => {
              setAlertConfig({ visible: false });
              setAttendances((prev) =>
                  prev.map((attendance) =>
                      attendance.id === session.id
                          ? { ...attendance, _isDeleted: true, _isModified: true }
                          : attendance,
                  ),
              );
              setIsDirty(true);
          },
          onCancel: () => setAlertConfig({ visible: false }),
      });
  };

  const saveChanges = async () => {
      setSaving(true);
      try {
          const db = await getDB();
          const now = new Date().toISOString();
          const targetDateStr = format(activeDate, 'yyyy-MM-dd');
          const sessionValidationError = validateAttendancesForDay(attendances, activeDate);

          if (sessionValidationError) {
              setAlertConfig({ visible: true, type: 'warning', title: 'Invalid Session Time', message: sessionValidationError, confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
              setSaving(false);
              return;
          }

          for (const att of attendances) {
              if (att._isDeleted) {
                  // HARD DELETE SPECIFIC SESSION
                  await db.runAsync("DELETE FROM attendance WHERE id = ?", [att.id]);
                  await queueSyncItem("attendance", att.id, "DELETE");
              } else if (att._isModified || targetDateStr !== dateStr) {
                  const mappedClockIn = att.clock_in ? remapTimestampToDay(att.clock_in, activeDate).toISOString() : att.clock_in;
                  const mappedClockOut = att.clock_out ? remapTimestampToDay(att.clock_out, activeDate).toISOString() : att.clock_out;

                  if (mappedClockIn && mappedClockOut && new Date(mappedClockOut).getTime() < new Date(mappedClockIn).getTime()) {
                      setAlertConfig({ visible: true, type: 'warning', title: 'Invalid Session Time', message: 'Each session must stay within the selected day. Please adjust Time In and Time Out before saving.', confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
                      setSaving(false);
                      return;
                  }

                  const exists: any = await db.getFirstAsync("SELECT * FROM attendance WHERE id = ?", [att.id]);
                  if (exists) {
                      await db.runAsync(
                          "UPDATE attendance SET clock_in = ?, clock_out = ?, status = ?, remarks = ?, date = ?, updated_at = ?, is_synced = 0 WHERE id = ?",
                          [mappedClockIn, mappedClockOut, mappedClockOut ? 'completed' : 'pending', att.remarks || null, targetDateStr, now, att.id]
                      );
                      const payload = {
                          ...exists,
                          clock_in: mappedClockIn,
                          clock_out: mappedClockOut,
                          status: mappedClockOut ? 'completed' : 'pending',
                          remarks: att.remarks || null,
                          date: targetDateStr,
                          updated_at: now,
                          is_synced: 0
                      };
                      await queueSyncItem("attendance", att.id, "UPDATE", payload);
                  } else {
                      const newAtt = { id: att.id, user_id: att.user_id, job_id: att.job_id, date: targetDateStr, clock_in: mappedClockIn, clock_out: mappedClockOut, status: mappedClockOut ? 'completed' : 'pending', remarks: att.remarks, updated_at: now };
                      await saveAttendanceLocal(newAtt);
                  }
              }
          }

          if (targetDateStr !== dateStr) {
              for (const task of tasks) {
                  if (!task._isDeleted) {
                      const exists: any = await db.getFirstAsync("SELECT * FROM accomplishments WHERE id = ?", [task.id]);
                      if (exists) {
                          await db.runAsync("UPDATE accomplishments SET date = ?, updated_at = ?, is_synced = 0 WHERE id = ?", [targetDateStr, now, task.id]);
                          const payload = { ...exists, date: targetDateStr, updated_at: now, is_synced: 0 };
                          await queueSyncItem("accomplishments", task.id, "UPDATE", payload);
                      }
                  }
              }
          }

          setIsDirty(false);
          triggerSync();
          if (user?.id) await refreshWidgetSnapshot(user.id, { force: true });
          
          if (targetDateStr !== dateStr) {
              router.setParams({ date: targetDateStr });
          } else {
              fetchReportDetails();
          }
          toggleEditMode(false);
      } catch {
          setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'Failed to save session.', confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
      } finally {
          setSaving(false);
      }
  };

  const getInitialTime = (): { h: number; m: number; p: "AM" | "PM" } => {
      if (!activePicker?.current) return { h: 12, m: 0, p: 'AM' };
      const dateObj = new Date(activePicker.current);
      let h = dateObj.getHours();
      const m = dateObj.getMinutes();
      const p: "AM" | "PM" = h >= 12 ? 'PM' : 'AM';
      h = h % 12 || 12;
      return { h, m, p };
  };

  const initialPickerVals = getInitialTime();
  const visibleAttendances = sortAttendancesByClockIn(attendances.filter(a => !a._isDeleted), activeDate);
  const visibleTasks = tasks.filter(t => !t._isDeleted);
  const firstSession = visibleAttendances[0];
  const lastSession = visibleAttendances[visibleAttendances.length - 1];
  const attendanceSummary = summarizeAttendances(visibleAttendances, 'exact_hm', { breakSchedule: jobSettings?.break_schedule });
  const totalManualBreakMinutes = visibleAttendances.reduce((sum, session) => sum + extractManualBreakMinutes(session.remarks), 0);
  const totalScheduledBreakMinutes = visibleAttendances.reduce((sum, session) => {
      const breakdown = getAttendanceBreakdown(session, { breakSchedule: jobSettings?.break_schedule });
      return sum + breakdown.scheduledBreakMinutes;
  }, 0);
  const totalMinutes = attendanceSummary.totalMinutes;
  const workHours = Math.floor(totalMinutes / 60);
  const workMins = Math.floor(totalMinutes % 60);
  const workHoursStr = totalMinutes > 0 ? `${workHours}h ${workMins > 0 ? workMins + 'm' : ''}`.trim() : '0h';

  const dynamicHeaderTitle = isEditMode 
      ? "Edit Report" 
      : (isHeaderDate ? format(activeDate, "MMMM d, yyyy") : "Report Details");
      
  const taskSectionTitle = visibleTasks.length >= 2 ? "Tasks & Activities" : "Task & Activity";

  const hasOutTime = !!lastSession?.clock_out;
  const outText = hasOutTime ? format(new Date(lastSession.clock_out), 'h:mm a') : (reportStatus === 'pending' ? 'In Progress' : '--:--');
  const outColor = hasOutTime ? theme.colors.text : (reportStatus === 'pending' ? theme.colors.warning : theme.colors.danger);

  const renderTask = (task: any) => {
      const isSingleImage = task.images?.length === 1;

      return (
          <View key={task.id} style={[styles.taskCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View style={styles.taskCardHeader}>
                  <View style={styles.taskHeaderLeft}>
                      <Text style={[styles.taskTitle, { color: theme.colors.text }]}>{task.description}</Text>
                      {task.remarks ? (
                          <Text style={[styles.taskRemarks, { color: theme.colors.textSecondary }]}>{task.remarks}</Text>
                      ) : null}
                  </View>
              </View>

              {task.images && task.images.length > 0 && (
                  <View style={styles.imageGrid}>
                      {task.images.map((imgUri: string, i: number) => (
                          <TouchableOpacity 
                              key={i} 
                              onPress={() => { setActiveImageUri(imgUri); setViewerVisible(true); }} 
                              style={[styles.imageGridItem, { borderColor: theme.colors.border, width: isSingleImage ? '100%' : '48%' }]}
                          >
                              <Image source={{ uri: imgUri }} style={styles.taskImage} resizeMode="cover" />
                          </TouchableOpacity>
                      ))}
                  </View>
              )}

              <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

              <View style={styles.taskFooter}>
                  <View style={styles.taskFooterMeta}>
                      <HugeiconsIcon icon={Time02Icon} size={14} color={theme.colors.textSecondary} />
                      <Text style={[styles.taskTimeText, { color: theme.colors.textSecondary }]}>
                          {task.created_at ? `Done at ${format(new Date(task.created_at), "h:mm a")}` : "New"}
                      </Text>
                  </View>
                  {isEditMode ? (
                      <View style={styles.taskFooterActions}>
                          <IconButton
                              icon={PencilEdit02Icon}
                              onPress={() => router.push({ pathname: '/reports/add-entry', params: { id: task.id, fixedDate: 'true' } })}
                              backgroundColor={theme.colors.iconBg}
                              borderColor={theme.colors.border}
                              color={theme.colors.primary}
                              size={16}
                              style={styles.taskFooterIconButton}
                          />
                          <IconButton
                              icon={Delete02Icon}
                              onPress={() => handleDeleteTask(task.id)}
                              backgroundColor={theme.colors.danger + '10'}
                              borderColor={theme.colors.danger + '22'}
                              color={theme.colors.danger}
                              size={16}
                              style={styles.taskFooterIconButton}
                          />
                      </View>
                  ) : null}
              </View>
          </View>
      );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      <ModernAlert {...alertConfig} />
      
      <FloatingAlert 
          visible={floatingAlert.visible} 
          message={floatingAlert.message} 
          type={floatingAlert.type as any} 
          onHide={() => setFloatingAlert(prev => ({ ...prev, visible: false }))} 
      />
      
      <LoadingOverlay visible={saving || loading} message={saving ? "Saving Report..." : "Loading..."} />
      <ImageViewer visible={viewerVisible} imageUri={activeImageUri} onClose={() => setViewerVisible(false)} context={{ reportDate: activeDate }} />

      <DatePicker 
          visible={showDatePicker} 
          onClose={() => setShowDatePicker(false)} 
          onSelect={(d) => { setActiveDate(d); setIsDirty(true); setShowDatePicker(false); }} 
          selectedDate={activeDate} 
          title="Edit Report Date" 
      />

      <Modal visible={logModalVisible} transparent animationType="fade" onRequestClose={() => setLogModalVisible(false)}>
          <TouchableWithoutFeedback onPress={() => setLogModalVisible(false)}>
              <View style={styles.bottomSheetOverlay}>
                  <TouchableWithoutFeedback>
                      <Animated.View 
                          entering={FadeInDown.duration(250).easing(Easing.out(Easing.quad))} 
                          exiting={FadeOutDown.duration(200).easing(Easing.in(Easing.quad))} 
                          style={[styles.floatingSheet, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                      >
                          <View style={styles.modalHeader}>
                              <View style={styles.modalHeaderLeft}>
                                  <View style={[styles.modalIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                                      <HugeiconsIcon icon={TimeManagementCircleIcon} size={20} color={theme.colors.primary} />
                                  </View>
                                  <View>
                                      <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Session Log</Text>
                                      <Text style={[styles.modalSubtitle, { color: theme.colors.textSecondary }]}>Manage worked sessions and break duration</Text>
                                  </View>
                              </View>
                              <View style={styles.modalHeaderActions}>
                                  {isEditMode ? (
                                      <TouchableOpacity
                                          activeOpacity={0.8}
                                          onPress={handleAddSession}
                                          style={[styles.addSessionButton, { backgroundColor: theme.colors.primary + '14', borderColor: theme.colors.primary + '28' }]}
                                      >
                                          <HugeiconsIcon icon={PlusSignIcon} size={14} color={theme.colors.primary} />
                                          <Text style={[styles.addSessionText, { color: theme.colors.primary }]}>Add Session</Text>
                                      </TouchableOpacity>
                                  ) : null}
                                  <TouchableOpacity onPress={() => setLogModalVisible(false)} style={[styles.modalCloseBtn, { backgroundColor: theme.colors.background }]}>
                                      <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.textSecondary} />
                                  </TouchableOpacity>
                              </View>
                          </View>

                          <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                              <View style={styles.modalBody}>
                                  <View style={styles.logSummaryRow}>
                                      <View style={[styles.logSummaryCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                                          <Text style={[styles.logSummaryValue, { color: theme.colors.text }]}>{visibleAttendances.length}</Text>
                                          <Text style={[styles.logSummaryLabel, { color: theme.colors.textSecondary }]}>Sessions</Text>
                                      </View>
                                      <View style={[styles.logSummaryCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                                          <Text style={[styles.logSummaryValue, { color: theme.colors.text }]}>{workHoursStr}</Text>
                                          <Text style={[styles.logSummaryLabel, { color: theme.colors.textSecondary }]}>Worked</Text>
                                      </View>
                                      <View style={[styles.logSummaryCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                                          <Text style={[styles.logSummaryValue, { color: theme.colors.text }]}>{formatMinutesAsHours(totalManualBreakMinutes + totalScheduledBreakMinutes)}</Text>
                                          <Text style={[styles.logSummaryLabel, { color: theme.colors.textSecondary }]}>Breaks</Text>
                                      </View>
                                  </View>
                                  {visibleAttendances.length > 0 ? (
                                          visibleAttendances.map((session, idx) => {
                                          const inTime = session.clock_in ? format(new Date(session.clock_in), 'h:mm a') : '--:--';
                                          const outTime = session.clock_out ? format(new Date(session.clock_out), 'h:mm a') : 'In Progress';
                                          const breakdown = getAttendanceBreakdown(session, { breakSchedule: jobSettings?.break_schedule });
                                          const manualBreakMinutes = extractManualBreakMinutes(session.remarks);
                                          return (
                                              <View key={session.id} style={[styles.sessionCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                                                  <View style={styles.sessionCardHeader}>
                                                      <View>
                                                          <Text style={[styles.sessionLabel, { color: theme.colors.textSecondary }]}>Session {idx + 1}</Text>
                                                          <Text style={[styles.sessionRange, { color: theme.colors.text }]}>{inTime} - {outTime}</Text>
                                                      </View>
                                                      {isEditMode ? (
                                                          <View style={styles.sessionActionRow}>
                                                              <TouchableOpacity
                                                                  activeOpacity={0.8}
                                                                  onPress={() => handleTimePress(session.id, 'in', session.clock_in)}
                                                                  style={[styles.sessionIconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                                              >
                                                                  <HugeiconsIcon icon={Time02Icon} size={14} color={theme.colors.primary} />
                                                                  <Text style={[styles.sessionIconText, { color: theme.colors.text }]}>In</Text>
                                                              </TouchableOpacity>
                                                              <TouchableOpacity
                                                                  activeOpacity={0.8}
                                                                  onPress={() => handleTimePress(session.id, 'out', session.clock_out)}
                                                                  style={[styles.sessionIconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                                              >
                                                                  <HugeiconsIcon icon={Time04Icon} size={14} color={theme.colors.primary} />
                                                                  <Text style={[styles.sessionIconText, { color: theme.colors.text }]}>Out</Text>
                                                              </TouchableOpacity>
                                                              <TouchableOpacity
                                                                  activeOpacity={0.8}
                                                                  onPress={() => handleDeleteSession(session)}
                                                                  style={[styles.sessionIconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                                                              >
                                                                  <HugeiconsIcon icon={Delete02Icon} size={14} color={theme.colors.danger} />
                                                                  <Text style={[styles.sessionIconText, { color: theme.colors.danger }]}>Remove</Text>
                                                              </TouchableOpacity>
                                                          </View>
                                                      ) : null}
                                                  </View>

                                                  <View style={styles.sessionTimeGrid}>
                                                      <View style={[styles.sessionTimeCard, { backgroundColor: theme.colors.card }]}>
                                                          <Text style={[styles.sessionTimeLabel, { color: theme.colors.textSecondary }]}>Time In</Text>
                                                          <Text style={[styles.sessionTimeValue, { color: theme.colors.text }]}>{inTime}</Text>
                                                      </View>
                                                      <View style={[styles.sessionTimeCard, { backgroundColor: theme.colors.card }]}>
                                                          <Text style={[styles.sessionTimeLabel, { color: theme.colors.textSecondary }]}>Time Out</Text>
                                                          <Text style={[styles.sessionTimeValue, { color: theme.colors.text }]}>{outTime}</Text>
                                                      </View>
                                                  </View>

                                                  <View style={styles.sessionMetricsRow}>
                                                      <View style={[styles.sessionMetric, { backgroundColor: theme.colors.card }]}>
                                                          <Text style={[styles.sessionMetricLabel, { color: theme.colors.textSecondary }]}>Worked</Text>
                                                          <Text style={[styles.sessionMetricValue, { color: theme.colors.text }]}>{formatMinutesAsHours(breakdown.workedMinutes)}</Text>
                                                      </View>
                                                      <View style={[styles.sessionMetric, { backgroundColor: theme.colors.card }]}>
                                                          <Text style={[styles.sessionMetricLabel, { color: theme.colors.textSecondary }]}>Shift Break</Text>
                                                          <Text style={[styles.sessionMetricValue, { color: theme.colors.text }]}>{formatMinutesAsHours(breakdown.scheduledBreakMinutes)}</Text>
                                                      </View>
                                                      <View style={[styles.sessionMetric, { backgroundColor: theme.colors.card }]}>
                                                          <View style={styles.sessionMetricHeader}>
                                                              <Text style={[styles.sessionMetricLabel, { color: theme.colors.textSecondary }]}>Manual Break</Text>
                                                              {isEditMode ? (
                                                                  <TouchableOpacity
                                                                      activeOpacity={0.75}
                                                                      onPress={() => handleBreakPress(session)}
                                                                      style={[styles.metricEditButton, { backgroundColor: theme.colors.primary + '12' }]}
                                                                  >
                                                                      <HugeiconsIcon icon={PencilEdit02Icon} size={12} color={theme.colors.primary} />
                                                                  </TouchableOpacity>
                                                              ) : null}
                                                          </View>
                                                          <Text style={[styles.sessionMetricValue, { color: theme.colors.text }]}>{formatMinutesAsHours(manualBreakMinutes)}</Text>
                                                      </View>
                                                  </View>
                                              </View>
                                          )
                                      })
                                  ) : (
                                      <Text style={{ color: theme.colors.textSecondary, textAlign: 'center', paddingVertical: 20, fontFamily: 'Nunito_500Medium' }}>
                                          No sessions recorded.
                                      </Text>
                                  )}
                              </View>
                          </ScrollView>
                      </Animated.View>
                  </TouchableWithoutFeedback>
              </View>
          </TouchableWithoutFeedback>
      </Modal>

      <TimePicker 
          visible={!!activePicker} 
          onClose={() => setActivePicker(null)} 
          onConfirm={handleTimeConfirm} 
          title={activePicker?.type === 'in' ? "Select Time In" : "Select Time Out"} 
          initialHours={initialPickerVals.h}
          initialMinutes={initialPickerVals.m}
          initialPeriod={initialPickerVals.p}
      />

      <DurationPicker
          visible={!!breakEditor}
          onClose={() => setBreakEditor(null)}
          onConfirm={handleBreakSave}
          title="Edit Break Duration"
          initialHours={Math.floor((breakEditor?.initialMinutes || 0) / 60)}
          initialMinutes={(breakEditor?.initialMinutes || 0) % 60}
          maxHours={breakEditor?.maxHours || 1}
      />

      <Header
        title={dynamicHeaderTitle}
        leftElement={
            isEditMode ? (
                <TouchableOpacity onPress={handleDiscardEdits} style={{ paddingLeft: 10, paddingVertical: 10, paddingRight: 8 }} activeOpacity={0.7}>
                    <HugeiconsIcon icon={Cancel01Icon} size={24} color={theme.colors.text} />
                </TouchableOpacity>
            ) : undefined
        }
        rightElement={
          !isEditMode ? (
            <View ref={moreIconRef} collapsable={false}>
              <TouchableOpacity onPress={handleMenuOpen} style={{ padding: 8, marginRight: -8 }}>
                <HugeiconsIcon icon={MoreVerticalIcon} size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
          ) : <View style={{ width: 40 }} />
        }
      />

      <ActionMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        actions={[
            { label: "Edit Report", icon: PencilEdit02Icon, onPress: () => toggleEditMode(true), color: theme.colors.text },
            { label: "Share Overview", icon: Share08Icon, onPress: handleShare, color: theme.colors.primary },
            { label: "Generate Document", icon: File02Icon, onPress: () => { setMenuVisible(false); router.push({ pathname: "/reports/generate", params: { date } }); }, color: "#f97316" },
                        { label: "Delete Report", icon: Delete02Icon, onPress: () => {
                setMenuVisible(false);
                const isPending = reportStatus === "pending";
                if (isPending) {
                    setFloatingAlert({
                        visible: true,
                        message: "Time out first before deleting this report.",
                        type: "warning"
                    });
                    return;
                }
                setAlertConfig({
                    visible: true, type: "warning", 
                    title: "Delete Report", 
                    message: "This will permanently delete this daily report and all its tasks.", 
                    confirmText: "Delete", 
                    cancelText: "Cancel",
                    onConfirm: async () => { setAlertConfig({ visible: false }); executeDeleteReport(); },
                    onCancel: () => setAlertConfig({ visible: false }),
                });
            }, color: theme.colors.danger, destructive: true },
        ]}
        anchor={menuAnchor}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
            <TouchableOpacity 
                disabled={!isEditMode} 
                activeOpacity={0.7} 
                onPress={() => setShowDatePicker(true)}
            >
                <View style={styles.heroDateRow}>
                    <Text style={[styles.heroDate, { color: theme.colors.text }]}>
                        {format(activeDate, "MMMM d, yyyy")}
                    </Text>
                    {isEditMode && <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.primary} style={{ marginBottom: 1 }} />}
                </View>
                <Text style={[styles.heroDay, { color: theme.colors.textSecondary }]}>
                    {format(activeDate, "EEEE")}
                </Text>
            </TouchableOpacity>
        </View>

        <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <HugeiconsIcon icon={Time04Icon} size={20} color={theme.colors.text} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Attendance</Text>
                <View style={[styles.badge, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Text style={[styles.badgeText, { color: theme.colors.primary }]}>{workHoursStr}</Text>
                </View>
            </View>
            <IconButton
                icon={TimeManagementCircleIcon}
                onPress={() =>
                    router.push({
                        pathname: "/reports/session-log",
                        params: { date: format(activeDate, "yyyy-MM-dd") },
                    })
                }
                backgroundColor={theme.colors.iconBg}
                borderColor={theme.colors.border}
                color={theme.colors.primary}
                size={18}
            />
        </View>

        {visibleAttendances.length > 0 ? (
            <View style={[styles.mainTimeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                
                <View style={styles.timeSection}>
                    <Text style={[styles.timeLabel, { color: theme.colors.textSecondary }]}>TIME IN</Text>
                    <View style={styles.timeValueContainer}>
                        <Text style={[styles.timeValue, { color: theme.colors.text }]}>
                            {firstSession?.clock_in ? format(new Date(firstSession.clock_in), 'h:mm a') : '--:--'}
                        </Text>
                    </View>
                </View>

                <View style={[styles.verticalDivider, { backgroundColor: theme.colors.border }]} />

                <View style={styles.timeSection}>
                    <Text style={[styles.timeLabel, { color: theme.colors.textSecondary }]}>TIME OUT</Text>
                    <View style={styles.timeValueContainer}>
                        <Text style={[styles.timeValue, { color: outColor }]}>
                            {outText}
                        </Text>
                    </View>
                </View>
            </View>
        ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginBottom: 40 }]}>
                <HugeiconsIcon icon={Time02Icon} size={28} color={theme.colors.icon} />
                <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium', marginTop: 12 }}>No attendance recorded.</Text>
            </View>
        )}

        <View style={styles.sectionHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <HugeiconsIcon icon={Activity01Icon} size={20} color={theme.colors.text} />
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{taskSectionTitle}</Text>
                <View style={[styles.badge, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Text style={[styles.badgeText, { color: theme.colors.primary }]}>{visibleTasks.length}</Text>
                </View>
            </View>
            <IconButton 
                icon={PlusSignIcon} 
                onPress={() => router.push({ pathname: '/reports/add-entry', params: { date: dateStr, fixedDate: 'true' } })} 
                backgroundColor={theme.colors.iconBg} 
                color={theme.colors.primary} 
                size={20} 
            />
        </View>

        {visibleTasks.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginBottom: 24 }]}>
            <HugeiconsIcon icon={Task01Icon} size={32} color={theme.colors.icon} />
            <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium', marginTop: 12 }}>No activity logged.</Text>
          </View>
        ) : (
          <AnimatedList data={visibleTasks} renderItem={renderTask} />
        )}

      </ScrollView>

      {isEditMode && isDirty && (
          <Footer>
              <Button title="Save Changes" onPress={saveChanges} isLoading={saving} disabled={saving} style={{ width: '100%' }} />
          </Footer>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: { padding: 24, paddingBottom: 120 },
  
  heroSection: { marginBottom: 32 },
  heroDateRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: 14 },
  heroDate: { fontSize: 24, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5, marginBottom: 2 },
  heroDay: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },

  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.3, flex: 0 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
  mainTimeCard: { 
      flexDirection: 'row', 
      borderRadius: 20, 
      borderWidth: 1, 
      padding: 24, 
      alignItems: 'center',
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.02,
      shadowRadius: 8,
      elevation: 1,
      marginBottom: 40 
  },
  timeSection: { flex: 1, paddingVertical: 8 },
  timeLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  timeValueContainer: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeValue: { fontSize: 20, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5 },
  verticalDivider: { width: 1, height: '100%', marginHorizontal: 20, opacity: 0.5 },

  emptyState: { 
      alignItems: "center", 
      padding: 40, 
      borderRadius: 20, 
      borderWidth: 1, 
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.02,
      shadowRadius: 8,
      elevation: 1 
  },
  
  taskCard: { borderRadius: 20, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1, marginBottom: 16, overflow: 'hidden' },
  taskCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingBottom: 16 },
  taskHeaderLeft: { flex: 1, paddingRight: 8 },
  taskHeaderRight: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
  taskTitle: { fontSize: 16, fontFamily: 'Nunito_700Bold', lineHeight: 24, marginBottom: 6 },
  taskRemarks: { fontSize: 15, fontFamily: 'Nunito_500Medium', lineHeight: 22, opacity: 0.8 },
  
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20, paddingBottom: 16 },
  imageGridItem: { aspectRatio: 4 / 3, borderRadius: 12, overflow: "hidden", borderWidth: 1 },
  taskImage: { width: "100%", height: "100%" },

  divider: { height: 1, opacity: 0.5 },
  taskFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 20, paddingVertical: 12 },
  taskFooterMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 },
  taskFooterActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  taskFooterIconButton: { width: 34, height: 34, borderRadius: 17 },
  taskTimeText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold' },

  bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', paddingHorizontal: 20 },
  floatingSheet: { width: '100%', marginBottom: Platform.OS === 'ios' ? 40 : 24, borderRadius: 24, borderWidth: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.3 },
  modalSubtitle: { fontSize: 12, fontFamily: 'Nunito_600SemiBold', marginTop: 2 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  addSessionButton: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  addSessionText: { fontSize: 12, fontFamily: 'Nunito_700Bold' },
  modalBody: { gap: 12, paddingBottom: 4 },
  logSummaryRow: { flexDirection: 'row', gap: 10, marginBottom: 2 },
  logSummaryCard: { flex: 1, borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12 },
  logSummaryValue: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold', marginBottom: 4, letterSpacing: -0.3 },
  logSummaryLabel: { fontSize: 10, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 0.8 },
  sessionCard: { borderRadius: 20, borderWidth: 1, padding: 16, gap: 14 },
  sessionCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sessionLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 1 },
  sessionRange: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.3, marginTop: 4 },
  sessionActionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' },
  sessionIconButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1 },
  sessionIconText: { fontSize: 12, fontFamily: 'Nunito_700Bold' },
  sessionTimeGrid: { flexDirection: 'row', gap: 10 },
  sessionTimeCard: { flex: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 11 },
  sessionTimeLabel: { fontSize: 10, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 5 },
  sessionTimeValue: { fontSize: 15, fontFamily: 'Nunito_800ExtraBold' },
  sessionMetricsRow: { flexDirection: 'row', gap: 10 },
  sessionMetric: { flex: 1, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  sessionMetricHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 },
  metricEditButton: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  sessionMetricLabel: { fontSize: 10, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  sessionMetricValue: { fontSize: 14, fontFamily: 'Nunito_800ExtraBold' },
  label: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', flex: 1 },
  value: { fontSize: 14, fontFamily: 'Nunito_700Bold', maxWidth: '65%', textAlign: 'right', lineHeight: 20 },
});


