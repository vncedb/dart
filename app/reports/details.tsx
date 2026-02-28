import {
  Calendar03Icon,
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedScrollHandler,
  useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import ActionMenu from "../../components/ActionMenu";
import { AnimatedList } from "../../components/AnimatedList";
import Header from "../../components/Header";
import ImageViewer from "../../components/ImageViewer";
import LoadingOverlay from "../../components/LoadingOverlay";
import ModernAlert from "../../components/ModernAlert";
import { useAppTheme } from "../../constants/theme";
import { useSync } from "../../context/SyncContext";
import { getDB } from "../../lib/db-client";
import { supabase } from "../../lib/supabase";

export default function ReportDetailsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { triggerSync } = useSync();
  const { date } = useLocalSearchParams();

  const [report, setReport] = useState<any>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);

  const moreIconRef = useRef<View>(null);
  const scrollViewRef = useRef<Animated.ScrollView>(null);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [activeImageUri, setActiveImageUri] = useState<string | null>(null);

  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const fetchReportDetails = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    const dateStr = date as string;

    if (!user || !dateStr) {
      setInitialLoading(false);
      return;
    }

    try {
      const db = await getDB();
      // Fetch ALL attendances for this date, sorted oldest to newest
      const attendances: any[] = await db.getAllAsync(
        "SELECT * FROM attendance WHERE user_id = ? AND date = ? ORDER BY clock_in ASC",
        [user.id, dateStr]
      );

      const tasks: any[] = await db.getAllAsync(
        "SELECT * FROM accomplishments WHERE user_id = ? AND date = ? ORDER BY created_at DESC",
        [user.id, dateStr]
      );

      const processedTasks = (tasks || []).map((t) => {
        let images: string[] = [];
        if (t.image_url) {
          try {
            const parsed = JSON.parse(t.image_url);
            images = Array.isArray(parsed) ? parsed : [t.image_url];
          } catch {
            images = [t.image_url];
          }
        }
        return { ...t, images };
      });

      setReport({
        date: dateStr,
        attendances: attendances || [],
        status: attendances && attendances.length > 0 ? attendances[attendances.length - 1].status : "pending",
        accomplishments: processedTasks || [],
      });
    } catch (e) {
      console.log("Error fetching details:", e);
    } finally {
      setInitialLoading(false);
    }
  }, [date]);

  useFocusEffect(
    useCallback(() => {
      fetchReportDetails();
    }, [fetchReportDetails])
  );

  const handleDelete = () => {
    setMenuVisible(false);
    const dateStr = date as string;
    const isToday = isSameDay(parseISO(dateStr), new Date());
    const isPending = report?.status === "pending";

    let title = "Delete Report";
    let message = "This will permanently delete this daily report and all its tasks.";
    let confirmText = "Delete Forever";

    if (isToday && isPending) {
      title = "Cancel Active Session?";
      message = "⚠️ You are currently TIMED IN.\n\nDeleting this report will CANCEL your current session. Are you sure?";
      confirmText = "End Session & Delete";
    }

    setAlertConfig({
      visible: true,
      type: "warning",
      title,
      message,
      confirmText,
      cancelText: "Cancel",
      onConfirm: async () => {
        setAlertConfig((prev: any) => ({ ...prev, visible: false }));
        executeDelete();
      },
      onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
    });
  };

  const executeDelete = async () => {
    setLoadingAction(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      const dateStr = date as string;
      
      if (user && dateStr) {
        const db = await getDB();
        if (report?.attendances?.length > 0) {
            for (const att of report.attendances) {
                await db.runAsync("INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)", ["attendance", att.id, "DELETE", null]);
            }
        }
        if (report?.accomplishments?.length > 0) {
            for (const acc of report.accomplishments) {
                await db.runAsync("INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)", ["accomplishments", acc.id, "DELETE", JSON.stringify({ image_url: acc.image_url })]);
            }
        }
        await db.runAsync("DELETE FROM attendance WHERE user_id = ? AND date = ?", [user.id, dateStr]);
        await db.runAsync("DELETE FROM accomplishments WHERE user_id = ? AND date = ?", [user.id, dateStr]);
        triggerSync();
        router.back();
      }
    } catch (error) {
      console.log(error);
    } finally {
      setLoadingAction(false);
    }
  };

  const handleShare = async () => {
    setMenuVisible(false);
    try {
      const firstIn = report?.attendances?.[0]?.clock_in ? format(new Date(report.attendances[0].clock_in), 'h:mm a') : '--:--';
      const lastOut = report?.attendances?.[report.attendances.length - 1]?.clock_out ? format(new Date(report.attendances[report.attendances.length - 1].clock_out), 'h:mm a') : 'In Progress';
      const message = `Report ${date as string}\nTime In: ${firstIn}\nTime Out: ${lastOut}\nTasks Completed: ${report?.accomplishments?.length || 0}`;
      await Share.share({ message });
    } catch { }
  };

  const handleMenuOpen = () => {
    if (moreIconRef.current) {
      moreIconRef.current.measure((x, y, width, height, pageX, pageY) => {
        setMenuAnchor({ x: pageX + width, y: pageY + height });
        setMenuVisible(true);
      });
    }
  };

  const renderTask = (acc: any) => (
    <View style={[styles.taskCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
      <View style={styles.taskHeader}>
          <Text style={[styles.taskTime, { color: theme.colors.primary }]}>
            {acc.created_at ? format(new Date(acc.created_at), "h:mm a") : "Log"}
          </Text>
      </View>
      <View style={styles.taskContent}>
        <Text style={[styles.taskTitle, { color: theme.colors.text }]}>{acc.description}</Text>
        {acc.remarks ? (
          <Text style={[styles.taskRemarks, { color: theme.colors.textSecondary }]}>{acc.remarks}</Text>
        ) : null}
      </View>
      {acc.images && acc.images.length > 0 && (
        <View style={styles.imageGrid}>
          {acc.images.map((imgUri: string, i: number) => (
            <TouchableOpacity key={i} onPress={() => { setActiveImageUri(imgUri); setViewerVisible(true); }} style={[styles.imageWrapper, { borderColor: theme.colors.border }]}>
              <Image source={{ uri: imgUri }} style={styles.taskImage} resizeMode="cover" />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const firstSession = report?.attendances?.[0];
  const lastSession = report?.attendances?.[report?.attendances?.length - 1];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={loadingAction} message="Processing..." />
      <ImageViewer visible={viewerVisible} imageUri={activeImageUri} onClose={() => setViewerVisible(false)} />

      <Header
        title="Session Overview"
        rightElement={
          <View ref={moreIconRef} collapsable={false}>
            <TouchableOpacity onPress={handleMenuOpen} style={styles.headerMoreBtn}>
              <HugeiconsIcon icon={MoreVerticalIcon} size={24} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        }
      />

      <ActionMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        actions={[
          { label: "Edit Report", icon: PencilEdit02Icon, onPress: () => { setMenuVisible(false); router.push({ pathname: "/reports/edit", params: { date } }); }, color: theme.colors.text },
          { label: "Share Details", icon: Share01Icon, onPress: handleShare, color: theme.colors.primary },
          { label: "Export as Document", icon: File02Icon, onPress: () => { setMenuVisible(false); router.push({ pathname: "/reports/generate", params: { date } }); }, color: "#f97316" },
          { label: "Delete Session", icon: Delete02Icon, onPress: handleDelete, color: theme.colors.danger },
        ]}
        anchor={menuAnchor}
      />

      {initialLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : !report ? (
        <View style={styles.center}>
          <HugeiconsIcon icon={Delete02Icon} size={48} color={theme.colors.border} />
          <Text style={{ marginTop: 16, color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium' }}>Report deleted or unavailable.</Text>
          <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20 }}>
            <Text style={{ color: theme.colors.primary, fontFamily: 'Nunito_700Bold' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.ScrollView
          ref={scrollViewRef}
          contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.heroSection}>
              <View style={[styles.heroIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                  <HugeiconsIcon icon={Calendar03Icon} size={28} color={theme.colors.primary} />
              </View>
              <View>
                  <Text style={[styles.heroDate, { color: theme.colors.text }]}>
                      {format(new Date(report.date), "MMMM d, yyyy")}
                  </Text>
                  <Text style={[styles.heroDay, { color: theme.colors.textSecondary }]}>
                      {format(new Date(report.date), "EEEE")}
                  </Text>
              </View>
          </View>

          {/* TOP SUMMARY */}
          <View style={{ marginBottom: 36 }}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 16 }]}>Attendance Summary</Text>
            
            {report?.attendances?.length > 0 ? (
                <>
                    <View style={[styles.timeGrid, { marginBottom: 16 }]}>
                        <View style={[styles.timeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={styles.timeCardHeader}>
                                <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.success} />
                                <Text style={[styles.timeCardLabel, { color: theme.colors.textSecondary }]}>EARLIEST IN</Text>
                            </View>
                            <Text style={[styles.timeCardValue, { color: theme.colors.text }]}>
                                {firstSession?.clock_in ? format(new Date(firstSession.clock_in), 'h:mm a') : '--:--'}
                            </Text>
                        </View>

                        <View style={[styles.timeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={styles.timeCardHeader}>
                                <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.warning} />
                                <Text style={[styles.timeCardLabel, { color: theme.colors.textSecondary }]}>LATEST OUT</Text>
                            </View>
                            <Text style={[styles.timeCardValue, { color: theme.colors.text }]}>
                                {lastSession?.clock_out ? format(new Date(lastSession.clock_out), 'h:mm a') : '--:--'}
                            </Text>
                        </View>
                    </View>

                    {/* SHOW ALL SESSIONS LINK */}
                    {report?.attendances?.length > 1 && (
                        <TouchableOpacity 
                            onPress={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
                            style={[styles.showAllBtn, { backgroundColor: theme.colors.primary + '10' }]}
                        >
                            <Text style={[styles.showAllText, { color: theme.colors.primary }]}>View all {report.attendances.length} sessions ↓</Text>
                        </TouchableOpacity>
                    )}
                </>
            ) : (
                <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 24 }]}>
                    <HugeiconsIcon icon={Time02Icon} size={28} color={theme.colors.icon} />
                    <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium', marginTop: 12 }}>No attendance recorded.</Text>
                </View>
            )}
          </View>

          <View style={styles.sectionHeader}>
            <HugeiconsIcon icon={Task01Icon} size={20} color={theme.colors.text} />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Activity Log</Text>
            <View style={[styles.badge, { backgroundColor: theme.colors.primary + '15' }]}>
              <Text style={[styles.badgeText, { color: theme.colors.primary }]}>{report?.accomplishments?.length || 0}</Text>
            </View>
          </View>

          {report?.accomplishments?.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginBottom: 24 }]}>
              <HugeiconsIcon icon={Time02Icon} size={32} color={theme.colors.icon} />
              <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium', marginTop: 12 }}>No activity logged.</Text>
            </View>
          ) : (
            <View style={{ marginBottom: 32 }}>
                <AnimatedList data={report?.accomplishments || []} renderItem={renderTask} />
            </View>
          )}

          {/* BOTTOM DETAILED LIST OF SESSIONS */}
          {report?.attendances?.length > 0 && (
            <View style={{ marginTop: 16 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text, marginBottom: 12 }]}>All Sessions Logged</Text>
                <View style={[styles.sessionListContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    {report.attendances.map((session: any, index: number) => (
                        <View key={session.id} style={[
                            styles.sessionListItem, 
                            index < report.attendances.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }
                        ]}>
                            <View style={styles.sessionItemLeft}>
                                <View style={[styles.sessionDot, { backgroundColor: theme.colors.primary }]} />
                                <Text style={[styles.sessionIndexText, { color: theme.colors.textSecondary }]}>Session {index + 1}</Text>
                            </View>
                            <View style={styles.sessionItemRight}>
                                <Text style={[styles.sessionTimeText, { color: theme.colors.text }]}>
                                    {session.clock_in ? format(new Date(session.clock_in), 'h:mm a') : '--:--'}
                                    <Text style={{ color: theme.colors.textSecondary }}>  →  </Text>
                                    {session.clock_out ? format(new Date(session.clock_out), 'h:mm a') : 'Now'}
                                </Text>
                            </View>
                        </View>
                    ))}
                </View>
            </View>
          )}

        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerMoreBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  heroSection: { flexDirection: "row", alignItems: "center", marginBottom: 32, gap: 16 },
  heroIconBox: { width: 56, height: 56, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  heroDate: { fontSize: 22, fontFamily: 'Nunito_700Bold', letterSpacing: -0.5, marginBottom: 2 },
  heroDay: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },
  
  timeGrid: { flexDirection: "row", gap: 12 },
  timeCard: { flex: 1, padding: 16, borderRadius: 20, borderWidth: 1 },
  timeCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  timeCardLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', textTransform: "uppercase", letterSpacing: 0.5 },
  timeCardValue: { fontSize: 18, fontFamily: 'Nunito_700Bold' },

  showAllBtn: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 100 },
  showAllText: { fontSize: 13, fontFamily: 'Nunito_700Bold' },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontFamily: 'Nunito_700Bold', flex: 1 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
  badgeText: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
  
  emptyState: { alignItems: "center", padding: 40, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed' },
  
  taskCard: { borderRadius: 20, padding: 20, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1, marginBottom: 16 },
  taskHeader: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  taskTime: { fontSize: 12, fontFamily: 'Nunito_700Bold' },
  taskContent: { paddingRight: 8 },
  taskTitle: { fontSize: 16, fontFamily: 'Nunito_700Bold', lineHeight: 22, marginBottom: 4 },
  taskRemarks: { fontSize: 14, fontFamily: 'Nunito_400Regular', lineHeight: 20, opacity: 0.8 },
  imageGrid: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  imageWrapper: { width: "47%", aspectRatio: 4 / 3, borderRadius: 12, overflow: "hidden", borderWidth: 1 },
  taskImage: { width: "100%", height: "100%" },

  // List Styles for Multiple Sessions at Bottom
  sessionListContainer: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  sessionListItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  sessionItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sessionDot: { width: 6, height: 6, borderRadius: 3 },
  sessionIndexText: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
  sessionItemRight: {},
  sessionTimeText: { fontSize: 14, fontFamily: 'Nunito_700Bold' },
});