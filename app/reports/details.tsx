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
import { format, isSameDay, parseISO } from "date-fns";
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
import { queueSyncItem, saveAttendanceLocal } from "../../lib/database";
import { getDB } from "../../lib/db-client";

export default function ReportDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useAppTheme();
  const { triggerSync } = useSync();
  const { date } = useLocalSearchParams();
  const { user } = useAuth();
  const dateStr = date as string;

  const [attendances, setAttendances] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
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
      setReportStatus(dbAtts.length > 0 ? dbAtts[dbAtts.length - 1].status : "pending");
      
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

  const handleTimeConfirm = (hours: number, minutes: number, period?: "AM" | "PM" | undefined) => {
      if (!activePicker) return;

      const session = attendances.find(a => a.id === activePicker.id);
      if (!session) return;

      const targetDateStr = format(activeDate, 'yyyy-MM-dd');
      const [y, m, d] = targetDateStr.split('-').map(Number);
      
      let h = hours;
      if (period === 'PM' && h < 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;

      let newDate: Date;

      if (activePicker.type === 'in') {
          newDate = new Date(y, m - 1, d);
          newDate.setHours(h, minutes, 0, 0);

          if (session.clock_out) {
              const outDate = new Date(session.clock_out);
              if (newDate > outDate) {
                  setFloatingAlert({ visible: true, message: "Time In cannot be later than Time Out.", type: "warning" });
                  setActivePicker(null);
                  return;
              }
          }
      } else {
          const inDate = session.clock_in ? new Date(session.clock_in) : new Date(y, m - 1, d);
          newDate = new Date(inDate);
          newDate.setHours(h, minutes, 0, 0);

          if (newDate < inDate) {
              newDate.setDate(newDate.getDate() + 1);
          }
      }

      setAttendances(prev => prev.map(a => {
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
      setIsDirty(true);
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

  const saveChanges = async () => {
      setSaving(true);
      try {
          const db = await getDB();
          const now = new Date().toISOString();
          const targetDateStr = format(activeDate, 'yyyy-MM-dd');

          for (const att of attendances) {
              if (att._isDeleted) {
                  // HARD DELETE SPECIFIC SESSION
                  await db.runAsync("DELETE FROM attendance WHERE id = ?", [att.id]);
                  await queueSyncItem("attendance", att.id, "DELETE");
              } else if (att._isModified || targetDateStr !== dateStr) {
                  const exists: any = await db.getFirstAsync("SELECT * FROM attendance WHERE id = ?", [att.id]);
                  if (exists) {
                      await db.runAsync(
                          "UPDATE attendance SET clock_in = ?, clock_out = ?, status = ?, date = ?, updated_at = ?, is_synced = 0 WHERE id = ?",
                          [att.clock_in, att.clock_out, att.clock_out ? 'completed' : 'pending', targetDateStr, now, att.id]
                      );
                      const payload = { 
                          ...exists, 
                          clock_in: att.clock_in, 
                          clock_out: att.clock_out, 
                          status: att.clock_out ? 'completed' : 'pending', 
                          date: targetDateStr, 
                          updated_at: now, 
                          is_synced: 0 
                      };
                      await queueSyncItem("attendance", att.id, "UPDATE", payload);
                  } else {
                      const newAtt = { id: att.id, user_id: att.user_id, job_id: att.job_id, date: targetDateStr, clock_in: att.clock_in, clock_out: att.clock_out, status: att.clock_out ? 'completed' : 'pending', remarks: att.remarks, updated_at: now };
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
  const visibleAttendances = attendances.filter(a => !a._isDeleted);
  const visibleTasks = tasks.filter(t => !t._isDeleted);
  const firstSession = visibleAttendances[0];
  const lastSession = visibleAttendances[visibleAttendances.length - 1];

  const totalMinutes = visibleAttendances.reduce((acc, curr) => {
      if (curr.clock_in && curr.clock_out) {
          const start = new Date(curr.clock_in).getTime();
          const end = new Date(curr.clock_out).getTime();
          return acc + Math.max(0, (end - start) / 60000);
      }
      return acc;
  }, 0);
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
                  {isEditMode && (
                      <View style={styles.taskHeaderRight}>
                          <TouchableOpacity onPress={() => router.push({ pathname: '/reports/add-entry', params: { id: task.id, fixedDate: 'true' } })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                              <HugeiconsIcon icon={PencilEdit02Icon} size={18} color={theme.colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteTask(task.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginLeft: 16 }}>
                              <HugeiconsIcon icon={Delete02Icon} size={18} color={theme.colors.danger} />
                          </TouchableOpacity>
                      </View>
                  )}
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
                  <HugeiconsIcon icon={Time02Icon} size={14} color={theme.colors.textSecondary} />
                  <Text style={[styles.taskTimeText, { color: theme.colors.textSecondary }]}>
                      {task.created_at ? format(new Date(task.created_at), "h:mm a") : "New"}
                  </Text>
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
      <ImageViewer visible={viewerVisible} imageUri={activeImageUri} onClose={() => setViewerVisible(false)} />

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
                                  <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Session Log</Text>
                              </View>
                              <TouchableOpacity onPress={() => setLogModalVisible(false)} style={[styles.modalCloseBtn, { backgroundColor: theme.colors.background }]}>
                                  <HugeiconsIcon icon={Cancel01Icon} size={20} color={theme.colors.textSecondary} />
                              </TouchableOpacity>
                          </View>

                          <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                              <View style={styles.modalBody}>
                                  {visibleAttendances.length > 0 ? (
                                      visibleAttendances.map((session, idx) => {
                                          const inTime = session.clock_in ? format(new Date(session.clock_in), 'h:mm a') : '--:--';
                                          const outTime = session.clock_out ? format(new Date(session.clock_out), 'h:mm a') : 'In Progress';
                                          return (
                                              <View key={session.id} style={styles.propertyRow}>
                                                  <Text style={[styles.label, { color: theme.colors.textSecondary }]}>Session {idx + 1}</Text>
                                                  <Text style={[styles.value, { color: theme.colors.text }]}>{inTime} - {outTime}</Text>
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
                const isToday = isSameDay(parseISO(dateStr), new Date());
                const isPending = reportStatus === "pending";
                setAlertConfig({
                    visible: true, type: "warning", 
                    title: isToday && isPending ? "Cancel Active Session?" : "Delete Report", 
                    message: isToday && isPending ? "⚠️ You are currently TIMED IN.\n\nDeleting this report will CANCEL your current session. Are you sure?" : "This will permanently delete this daily report and all its tasks.", 
                    confirmText: isToday && isPending ? "End Session & Delete" : "Delete Forever", 
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
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.heroDate, { color: theme.colors.text }]}>
                        {format(activeDate, "MMMM d, yyyy")}
                    </Text>
                    {isEditMode && <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.primary} style={{ marginLeft: 8, marginBottom: 2 }} />}
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
                onPress={() => setLogModalVisible(true)} 
                backgroundColor={theme.colors.iconBg} 
                color={theme.colors.primary} 
                size={20} 
            />
        </View>

        {visibleAttendances.length > 0 ? (
            <View style={[styles.mainTimeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                
                <View style={styles.timeSection}>
                    <Text style={[styles.timeLabel, { color: theme.colors.textSecondary }]}>TIME IN</Text>
                    <TouchableOpacity 
                        disabled={!isEditMode} 
                        activeOpacity={0.7} 
                        onPress={() => firstSession && handleTimePress(firstSession.id, 'in', firstSession.clock_in)}
                    >
                        <View style={styles.timeValueContainer}>
                            <Text style={[styles.timeValue, { color: theme.colors.text }]}>
                                {firstSession?.clock_in ? format(new Date(firstSession.clock_in), 'h:mm a') : '--:--'}
                            </Text>
                            {isEditMode && <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.primary} />}
                        </View>
                    </TouchableOpacity>
                </View>

                <View style={[styles.verticalDivider, { backgroundColor: theme.colors.border }]} />

                <View style={styles.timeSection}>
                    <Text style={[styles.timeLabel, { color: theme.colors.textSecondary }]}>TIME OUT</Text>
                    <TouchableOpacity 
                        disabled={!isEditMode} 
                        activeOpacity={0.7} 
                        onPress={() => lastSession && handleTimePress(lastSession.id, 'out', lastSession.clock_out)}
                    >
                        <View style={styles.timeValueContainer}>
                            <Text style={[styles.timeValue, { color: outColor }]}>
                                {outText}
                            </Text>
                            {isEditMode && <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.primary} />}
                        </View>
                    </TouchableOpacity>
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
  taskFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12 },
  taskTimeText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold' },

  bottomSheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', paddingHorizontal: 20 },
  floatingSheet: { width: '100%', marginBottom: Platform.OS === 'ios' ? 40 : 24, borderRadius: 24, borderWidth: 1, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  modalIconBox: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.3 },
  modalCloseBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modalBody: { gap: 2 },
  propertyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(150, 150, 150, 0.15)' },
  label: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', flex: 1 },
  value: { fontSize: 14, fontFamily: 'Nunito_700Bold', maxWidth: '65%', textAlign: 'right', lineHeight: 20 },
});