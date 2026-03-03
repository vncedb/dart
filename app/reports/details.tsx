// filepath: app/reports/details.tsx
import {
  ArrowLeft02Icon,
  Calendar03Icon,
  Cancel01Icon,
  Clock01Icon,
  Delete02Icon,
  File02Icon,
  MoreVerticalIcon,
  PencilEdit02Icon,
  Share01Icon,
  Task01Icon,
  Time02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { format, isSameDay, parseISO } from "date-fns";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  BackHandler,
  Image,
  LayoutAnimation,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import Animated, {
  runOnJS,
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import ActionMenu from "../../components/ActionMenu";
import { AnimatedList } from "../../components/AnimatedList";
import Button from "../../components/Button";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import ImageViewer from "../../components/ImageViewer";
import LoadingOverlay from "../../components/LoadingOverlay";
import ModernAlert from "../../components/ModernAlert";
import TimePicker from "../../components/TimePicker";
import { useAppTheme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useSync } from "../../context/SyncContext";
import { generateUUID, queueSyncItem, saveAttendanceLocal } from "../../lib/database";
import { getDB } from "../../lib/db-client";

export default function ReportDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useAppTheme();
  const { triggerSync } = useSync();
  const { date } = useLocalSearchParams();
  const { user } = useAuth();
  const dateStr = date as string;

  const [jobId, setJobId] = useState<string | null>(null);
  const [attendances, setAttendances] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [reportStatus, setReportStatus] = useState("pending");
  
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  const [menuVisible, setMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);
  const moreIconRef = useRef<View>(null);

  const [viewerVisible, setViewerVisible] = useState(false);
  const [activeImageUri, setActiveImageUri] = useState<string | null>(null);

  const [activePicker, setActivePicker] = useState<{ id: string, type: 'in' | 'out', current: string | null } | null>(null);

  const [isHeaderDate, setIsHeaderDate] = useState(false);
  const scrollY = useSharedValue(0);
  const scrollViewRef = useRef<Animated.ScrollView>(null);

  const handleScrollUpdate = (scrolled: boolean) => {
    if (isHeaderDate !== scrolled) setIsHeaderDate(scrolled);
  };

  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
    runOnJS(handleScrollUpdate)(event.contentOffset.y > 60);
  });

  const fetchReportDetails = useCallback(async () => {
    if (!user || !dateStr) {
      setLoading(false);
      return;
    }

    try {
      const db = await getDB();
      const profile: any = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [user.id]);
      setJobId(profile?.current_job_id || null);

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
      setIsDirty(false);
    } catch (e) {
      console.log("Error fetching details:", e);
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
                fetchReportDetails(); 
                toggleEditMode(false);
            },
            onCancel: () => setAlertConfig({ visible: false })
        });
    } else {
        toggleEditMode(false);
    }
  }, [isDirty, fetchReportDetails]);

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
        const now = new Date().toISOString();
        if (attendances.length > 0) {
            for (const att of attendances) {
                await db.runAsync("UPDATE attendance SET deleted_at = ?, is_synced = 0 WHERE id = ?", [now, att.id]);
                await queueSyncItem("attendance", att.id, "UPDATE", { deleted_at: now });
            }
        }
        if (tasks.length > 0) {
            for (const acc of tasks) {
                await db.runAsync("UPDATE accomplishments SET deleted_at = ?, is_synced = 0 WHERE id = ?", [now, acc.id]);
                await queueSyncItem("accomplishments", acc.id, "UPDATE", { deleted_at: now });
            }
        }
        triggerSync();
        router.back();
      }
    } catch (error) { console.log(error); } finally { setSaving(false); }
  };

  const handleTimeConfirm = (hours: number, minutes: number, period?: "AM" | "PM" | undefined) => {
      if (!activePicker) return;
      const newDate = new Date(dateStr);
      let h = hours;
      if (period === 'PM' && h < 12) h += 12;
      if (period === 'AM' && h === 12) h = 0;
      newDate.setHours(h, minutes, 0, 0);

      setAttendances(prev => prev.map(a => {
          if (a.id === activePicker.id) {
              const updated = { ...a, _isModified: true };
              if (activePicker.type === 'in') {
                  updated.clock_in = newDate.toISOString();
              } else {
                  const inDate = updated.clock_in ? new Date(updated.clock_in) : new Date(dateStr);
                  if (newDate < inDate) newDate.setDate(newDate.getDate() + 1); 
                  updated.clock_out = newDate.toISOString();
              }
              return updated;
          }
          return a;
      }));
      setIsDirty(true);
      setActivePicker(null);
  };

  const handleAddSession = () => {
      setMenuVisible(false);
      if (!user) return;
      const newId = generateUUID();
      const placeholderDate = new Date(dateStr);
      placeholderDate.setHours(8, 0, 0, 0); 
      
      setAttendances([...attendances, {
          id: newId, user_id: user.id, job_id: jobId, date: dateStr,
          clock_in: placeholderDate.toISOString(), clock_out: null, status: 'pending', remarks: 'Manual Entry',
          _isDeleted: false, _isModified: true 
      }]);
      setIsDirty(true);
  };

  const handleDeleteAttendance = (id: string) => {
      setAttendances(prev => prev.map(a => a.id === id ? { ...a, _isDeleted: true } : a));
      setIsDirty(true);
  };

  const handleDeleteTask = (id: string) => {
    setAlertConfig({
        visible: true, type: 'warning', title: 'Delete Task', message: 'Permanently delete this task?', confirmText: 'Delete', cancelText: 'Cancel',
        onConfirm: async () => {
            setAlertConfig({ visible: false });
            setLoading(true);
            try {
                const db = await getDB();
                const now = new Date().toISOString();
                await db.runAsync('UPDATE accomplishments SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [now, now, id]);
                await queueSyncItem('accomplishments', id, 'UPDATE', { deleted_at: now, updated_at: now });
                triggerSync();
                fetchReportDetails();
            } catch (error) { console.log(error); }
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

          for (const att of attendances) {
              if (att._isDeleted) {
                  const exists = await db.getFirstAsync("SELECT id FROM attendance WHERE id = ?", [att.id]);
                  if (exists) {
                      await db.runAsync("UPDATE attendance SET deleted_at = ?, is_synced = 0 WHERE id = ?", [now, att.id]);
                      await queueSyncItem("attendance", att.id, "UPDATE", { deleted_at: now });
                  }
              } else if (att._isModified) {
                  const exists = await db.getFirstAsync("SELECT id FROM attendance WHERE id = ?", [att.id]);
                  if (exists) {
                      await db.runAsync(
                          "UPDATE attendance SET clock_in = ?, clock_out = ?, status = ?, updated_at = ?, is_synced = 0 WHERE id = ?",
                          [att.clock_in, att.clock_out, att.clock_out ? 'completed' : 'pending', now, att.id]
                      );
                      await queueSyncItem("attendance", att.id, "UPDATE", { clock_in: att.clock_in, clock_out: att.clock_out, status: att.clock_out ? 'completed' : 'pending', updated_at: now });
                  } else {
                      const newAtt = { id: att.id, user_id: att.user_id, job_id: att.job_id, date: att.date, clock_in: att.clock_in, clock_out: att.clock_out, status: att.clock_out ? 'completed' : 'pending', remarks: att.remarks, updated_at: now };
                      await saveAttendanceLocal(newAtt);
                  }
              }
          }

          setIsDirty(false);
          triggerSync();
          fetchReportDetails();
          toggleEditMode(false);
      } catch (error: any) {
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

  const dynamicHeaderTitle = isHeaderDate && dateStr ? format(new Date(dateStr), "MMMM d, yyyy") : (isEditMode ? "Edit Session" : "Report Details");

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
      <LoadingOverlay visible={saving || loading} message={saving ? "Saving Report..." : "Loading..."} />
      <ImageViewer visible={viewerVisible} imageUri={activeImageUri} onClose={() => setViewerVisible(false)} />

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
                <TouchableOpacity onPress={handleDiscardEdits} style={{ padding: 8, marginLeft: -8 }}>
                    <HugeiconsIcon icon={ArrowLeft02Icon} size={24} color={theme.colors.text} />
                </TouchableOpacity>
            ) : undefined
        }
        rightElement={
          <View ref={moreIconRef} collapsable={false}>
            <TouchableOpacity onPress={handleMenuOpen} style={styles.headerMoreBtn}>
              <HugeiconsIcon icon={MoreVerticalIcon} size={24} color={theme.colors.text} />
            </TouchableOpacity>
          </View>
        }
      />

      <ActionMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        actions={isEditMode ? [
            { label: 'Add Session', icon: Clock01Icon, color: theme.colors.text, onPress: handleAddSession },
            { label: 'Add Entry', icon: Task01Icon, color: theme.colors.text, onPress: () => { setMenuVisible(false); router.push({ pathname: '/reports/add-entry', params: { date: dateStr, fixedDate: 'true' } }); } },
            { label: "Discard Edits", icon: Cancel01Icon, onPress: handleDiscardEdits, color: theme.colors.danger, destructive: true },
        ] : [
            { label: "Edit Report", icon: PencilEdit02Icon, onPress: () => toggleEditMode(true), color: theme.colors.text },
            { label: "Share Overview", icon: Share01Icon, onPress: handleShare, color: theme.colors.primary },
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

      <Animated.ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
            <View style={[styles.heroIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                <HugeiconsIcon icon={Calendar03Icon} size={32} color={theme.colors.primary} />
            </View>
            <View>
                <Text style={[styles.heroDate, { color: theme.colors.text }]}>
                    {format(new Date(dateStr), "MMMM d, yyyy")}
                </Text>
                <Text style={[styles.heroDay, { color: theme.colors.textSecondary }]}>
                    {format(new Date(dateStr), "EEEE")}
                </Text>
            </View>
        </View>

        <View style={styles.sectionHeader}>
          <HugeiconsIcon icon={Clock01Icon} size={20} color={theme.colors.text} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Attendance Overview</Text>
        </View>

        {visibleAttendances.length > 0 ? (
            <View style={{ marginBottom: 40 }}>
                <View style={styles.timeGrid}>
                    <View style={[styles.timeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <Text style={[styles.timeCardLabel, { color: theme.colors.textSecondary }]}>Earliest In</Text>
                        <Text style={[styles.timeCardValue, { color: theme.colors.text }]}>
                            {firstSession?.clock_in ? format(new Date(firstSession.clock_in), 'h:mm a') : '--:--'}
                        </Text>
                    </View>
                    <View style={[styles.timeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <Text style={[styles.timeCardLabel, { color: theme.colors.textSecondary }]}>Latest Out</Text>
                        <Text style={[styles.timeCardValue, { color: theme.colors.text }]}>
                            {lastSession?.clock_out ? format(new Date(lastSession.clock_out), 'h:mm a') : 'Now'}
                        </Text>
                    </View>
                </View>

                <View style={styles.sessionListContainer}>
                    {visibleAttendances.map((session: any, index: number) => (
                        <View key={session.id} style={[styles.sessionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={[styles.sessionCardHeader, { borderBottomColor: theme.colors.border }]}>
                                <View style={[styles.sessionBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                                    <Text style={[styles.sessionBadgeText, { color: theme.colors.primary }]}>Session {index + 1}</Text>
                                </View>
                                {isEditMode && (
                                    <TouchableOpacity onPress={() => handleDeleteAttendance(session.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                        <HugeiconsIcon icon={Delete02Icon} size={18} color={theme.colors.danger} />
                                    </TouchableOpacity>
                                )}
                            </View>

                            <View style={styles.sessionCardBody}>
                                <TouchableOpacity disabled={!isEditMode} activeOpacity={0.7} onPress={() => setActivePicker({ id: session.id, type: 'in', current: session.clock_in })} style={styles.sessionTimeCol}>
                                    <Text style={[styles.sessionTimeLabel, { color: theme.colors.textSecondary }]}>TIME IN</Text>
                                    <View style={styles.sessionValueRow}>
                                        <Text style={[styles.sessionTimeValue, { color: theme.colors.text }]}>
                                            {session.clock_in ? format(new Date(session.clock_in), 'h:mm a') : '--:--'}
                                        </Text>
                                        {isEditMode && <HugeiconsIcon icon={PencilEdit02Icon} size={14} color={theme.colors.primary} />}
                                    </View>
                                </TouchableOpacity>
                                
                                <View style={[styles.sessionCardDivider, { backgroundColor: theme.colors.border }]} />
                                
                                <TouchableOpacity disabled={!isEditMode} activeOpacity={0.7} onPress={() => setActivePicker({ id: session.id, type: 'out', current: session.clock_out })} style={styles.sessionTimeCol}>
                                    <Text style={[styles.sessionTimeLabel, { color: theme.colors.textSecondary }]}>TIME OUT</Text>
                                    <View style={styles.sessionValueRow}>
                                        <Text style={[styles.sessionTimeValue, { color: theme.colors.text }]}>
                                            {session.clock_out ? format(new Date(session.clock_out), 'h:mm a') : 'Now'}
                                        </Text>
                                        {isEditMode && <HugeiconsIcon icon={PencilEdit02Icon} size={14} color={theme.colors.primary} />}
                                    </View>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        ) : (
            <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginBottom: 40 }]}>
                <HugeiconsIcon icon={Time02Icon} size={28} color={theme.colors.icon} />
                <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium', marginTop: 12 }}>No attendance recorded.</Text>
            </View>
        )}

        <View style={styles.sectionHeader}>
          <HugeiconsIcon icon={Task01Icon} size={20} color={theme.colors.text} />
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Tasks</Text>
          <View style={[styles.badge, { backgroundColor: theme.colors.primary + '15' }]}>
            <Text style={[styles.badgeText, { color: theme.colors.primary }]}>{visibleTasks.length}</Text>
          </View>
        </View>

        {visibleTasks.length === 0 ? (
          <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginBottom: 24 }]}>
            <HugeiconsIcon icon={Task01Icon} size={32} color={theme.colors.icon} />
            <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium', marginTop: 12 }}>No activity logged.</Text>
          </View>
        ) : (
          <AnimatedList data={visibleTasks} renderItem={renderTask} />
        )}

      </Animated.ScrollView>

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
  headerMoreBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  
  heroSection: { flexDirection: "row", alignItems: "center", marginBottom: 40, gap: 16 },
  heroIconBox: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  heroDate: { fontSize: 24, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5, marginBottom: 4 },
  heroDay: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', flex: 1, letterSpacing: -0.3 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 13, fontFamily: 'Nunito_700Bold' },

  timeGrid: { flexDirection: "row", gap: 12, marginBottom: 20 },
  timeCard: { flex: 1, padding: 18, borderRadius: 20, borderWidth: 1 },
  timeCardLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 },
  timeCardValue: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold' },

  sessionListContainer: { gap: 12 },
  sessionCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  sessionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
  sessionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  sessionBadgeText: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', textTransform: 'uppercase', letterSpacing: 0.5 },
  sessionCardBody: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  sessionTimeCol: { flex: 1 },
  sessionTimeLabel: { fontSize: 11, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
  sessionValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sessionTimeValue: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold' },
  sessionCardDivider: { width: 1, height: 32, marginHorizontal: 16, opacity: 0.5 },

  emptyState: { alignItems: "center", padding: 40, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed' },
  
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
  taskTimeText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold' }
});