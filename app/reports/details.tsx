import {
    Calendar03Icon,
    Clock01Icon,
    Delete02Icon,
    File02Icon,
    MoreVerticalCircle01Icon,
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
    Dimensions,
    Image,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    Extrapolation,
    interpolate,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// Components
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

const { width } = Dimensions.get("window");

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
  const [menuAnchor, setMenuAnchor] = useState<
    { x: number; y: number } | undefined
  >(undefined);

  // Refs for positioning
  const moreIconRef = useRef<View>(null);

  // Image Viewer
  const [viewerVisible, setViewerVisible] = useState(false);
  const [activeImageUri, setActiveImageUri] = useState<string | null>(null);

  // Scroll Animation
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  useFocusEffect(
    useCallback(() => {
      fetchReportDetails();
    }, [date]),
  );

  const fetchReportDetails = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user || !date) {
      setInitialLoading(false);
      return;
    }

    try {
      const db = await getDB();
      if (!db) return;

      const attendance: any = await db.getFirstAsync(
        "SELECT * FROM attendance WHERE user_id = ? AND date = ?",
        [user.id, date],
      );

      const tasks: any[] = await db.getAllAsync(
        "SELECT * FROM accomplishments WHERE user_id = ? AND date = ? ORDER BY created_at DESC",
        [user.id, date],
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
        date: date,
        clockIn: attendance
          ? new Date(attendance.clock_in).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "--:--",
        clockOut: attendance?.clock_out
          ? new Date(attendance.clock_out).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : "--:--",
        status: attendance?.status || "pending",
        attendanceId: attendance?.id,
        accomplishments: processedTasks,
      });
    } catch (e) {
      console.log("Error fetching details:", e);
    } finally {
      setInitialLoading(false);
    }
  };

  // --- ACTIONS ---
  const handleDelete = () => {
    setMenuVisible(false);
    const isToday = isSameDay(parseISO(date as string), new Date());
    const isPending = report?.status === "pending";

    let title = "Delete Report";
    let message =
      "This will permanently delete this daily report and all its tasks.";
    let confirmText = "Delete Forever";

    if (isToday && isPending) {
      title = "Cancel Active Session?";
      message =
        "⚠️ You are currently CHECKED IN.\n\nDeleting this report will CANCEL your current session. Are you sure?";
      confirmText = "End Session & Delete";
    }

    setAlertConfig({
      visible: true,
      type: "confirm",
      title: title,
      message: message,
      confirmText: confirmText,
      cancelText: "Cancel",
      onConfirm: async () => {
        setAlertConfig((prev: any) => ({ ...prev, visible: false }));
        executeDelete();
      },
      onCancel: () =>
        setAlertConfig((prev: any) => ({ ...prev, visible: false })),
    });
  };

  const executeDelete = async () => {
    setLoadingAction(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (user) {
        const db = await getDB();
        await db.runAsync(
          "DELETE FROM attendance WHERE user_id = ? AND date = ?",
          [user.id, date],
        );
        await db.runAsync(
          "DELETE FROM accomplishments WHERE user_id = ? AND date = ?",
          [user.id, date],
        );
        if (report.attendanceId) {
          await db.runAsync(
            "INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)",
            ["attendance", report.attendanceId, "DELETE", null],
          );
        }
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
      const message = `Report ${date}\nIn: ${report.clockIn}\nOut: ${report.clockOut}`;
      await Share.share({ message });
    } catch (e) {}
  };

  const handleMenuOpen = () => {
    if (moreIconRef.current) {
      moreIconRef.current.measure((x, y, width, height, pageX, pageY) => {
        // Anchor to the bottom-right of the icon button
        // pageX + width = right edge
        // pageY + height = bottom edge
        setMenuAnchor({ x: pageX + width, y: pageY + height });
        setMenuVisible(true);
      });
    }
  };

  // --- MORPH ANIMATION STYLES (Must be at top level) ---

  // Header Title Animations
  const defaultTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [20, 50], [1, 0], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [20, 50],
          [1, 0.9],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const dateTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [30, 60], [0, 1], Extrapolation.CLAMP),
    transform: [
      {
        scale: interpolate(
          scrollY.value,
          [30, 60],
          [0.95, 1],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  // Date Header Fade Animation (Moved from inline to here)
  const dateHeaderStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 40], [1, 0], Extrapolation.CLAMP),
  }));

  const renderTask = (acc: any, index: number) => (
    <View
      style={[
        styles.taskCard,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.taskHeader}>
        <View style={[styles.dot, { backgroundColor: theme.colors.primary }]} />
        <Text style={[styles.taskTime, { color: theme.colors.textSecondary }]}>
          {acc.created_at ? format(new Date(acc.created_at), "h:mm a") : "Task"}
        </Text>
      </View>
      <View style={styles.taskContent}>
        <Text style={[styles.taskTitle, { color: theme.colors.text }]}>
          {acc.description}
        </Text>
        {acc.remarks ? (
          <Text
            style={[styles.taskRemarks, { color: theme.colors.textSecondary }]}
          >
            {acc.remarks}
          </Text>
        ) : null}
      </View>
      {acc.images && acc.images.length > 0 && (
        <View style={styles.imageGrid}>
          {acc.images.map((imgUri: string, i: number) => (
            <TouchableOpacity
              key={i}
              onPress={() => {
                setActiveImageUri(imgUri);
                setViewerVisible(true);
              }}
              style={[
                styles.imageWrapper,
                { borderColor: theme.colors.border },
              ]}
            >
              <Image
                source={{ uri: imgUri }}
                style={styles.taskImage}
                resizeMode="cover"
              />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={loadingAction} message="Processing..." />
      <ImageViewer
        visible={viewerVisible}
        imageUri={activeImageUri}
        onClose={() => setViewerVisible(false)}
      />

      <Header
        title={
          <View style={styles.headerTitleContainer}>
            <Animated.Text
              style={[
                styles.headerTitleText,
                { color: theme.colors.text },
                defaultTitleStyle,
              ]}
            >
              Report Details
            </Animated.Text>
            <Animated.Text
              style={[
                styles.headerTitleText,
                { color: theme.colors.text },
                dateTitleStyle,
              ]}
            >
              {report ? format(new Date(report.date), "MMMM d, yyyy") : ""}
            </Animated.Text>
          </View>
        }
        rightElement={
          <View ref={moreIconRef} collapsable={false}>
            <TouchableOpacity onPress={handleMenuOpen} style={{ padding: 4 }}>
              <HugeiconsIcon
                icon={MoreVerticalCircle01Icon}
                size={24}
                color={theme.colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        }
      />

      <ActionMenu
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        actions={[
          {
            label: "Edit",
            icon: PencilEdit02Icon,
            onPress: () => {
              setMenuVisible(false);
              router.push({
                pathname: "/reports/edit",
                params: { date: date },
              });
            },
            color: theme.colors.text,
          },
          {
            label: "Share",
            icon: Share01Icon,
            onPress: handleShare,
            color: theme.colors.primary,
          },
          {
            label: "Generate Report",
            icon: File02Icon,
            onPress: () => {
              setMenuVisible(false);
              router.push({
                pathname: "/reports/generate",
                params: { date: date },
              });
            },
            color: "#f97316",
          },
          {
            label: "Delete",
            icon: Delete02Icon,
            onPress: handleDelete,
            color: theme.colors.danger,
          },
        ]}
        anchor={menuAnchor}
      />

      {initialLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : !report ? (
        <View style={[styles.center, { padding: 20 }]}>
          <HugeiconsIcon
            icon={Delete02Icon}
            size={48}
            color={theme.colors.border}
          />
          <Text
            style={{
              marginTop: 16,
              color: theme.colors.textSecondary,
              textAlign: "center",
            }}
          >
            Report not found. It may have been deleted.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 20 }}
          >
            <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>
              Go Back
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.ScrollView
          contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          showsVerticalScrollIndicator={false}
        >
          {/* Date Header Content - Uses pre-defined style now */}
          <Animated.View style={[styles.dateHeader, dateHeaderStyle]}>
            <View
              style={[
                styles.calendarIcon,
                { backgroundColor: theme.colors.primary + "15" },
              ]}
            >
              <HugeiconsIcon
                icon={Calendar03Icon}
                size={28}
                color={theme.colors.primary}
              />
            </View>
            <View>
              <Text style={[styles.dayText, { color: theme.colors.text }]}>
                {format(new Date(report.date), "EEEE")}
              </Text>
              <Text
                style={[styles.dateText, { color: theme.colors.textSecondary }]}
              >
                {format(new Date(report.date), "MMMM d, yyyy")}
              </Text>
            </View>
          </Animated.View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.statLabelRow}>
                <HugeiconsIcon
                  icon={Clock01Icon}
                  size={14}
                  color={theme.colors.success}
                />
                <Text
                  style={[
                    styles.statLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Clock In
                </Text>
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {report.clockIn}
              </Text>
            </View>
            <View
              style={[
                styles.statCard,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.statLabelRow}>
                <HugeiconsIcon
                  icon={Clock01Icon}
                  size={14}
                  color={theme.colors.warning}
                />
                <Text
                  style={[
                    styles.statLabel,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Clock Out
                </Text>
              </View>
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {report.clockOut}
              </Text>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <HugeiconsIcon
              icon={Task01Icon}
              size={18}
              color={theme.colors.text}
            />
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
              Activity Log
            </Text>
            <View
              style={[
                styles.badge,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.badgeText,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {report.accomplishments.length}
              </Text>
            </View>
          </View>

          {/* Animated List of Tasks */}
          {report.accomplishments.length === 0 ? (
            <View style={styles.emptyState}>
              <HugeiconsIcon
                icon={Time02Icon}
                size={40}
                color={theme.colors.icon}
              />
              <Text
                style={{ color: theme.colors.textSecondary, marginTop: 12 }}
              >
                No activity recorded.
              </Text>
            </View>
          ) : (
            <AnimatedList
              data={report.accomplishments}
              renderItem={renderTask}
              style={{ gap: 16 }}
            />
          )}
        </Animated.ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerTitleContainer: {
    height: 40,
    width: 220,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
    position: "absolute",
    width: "100%",
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  dateHeader: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  calendarIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
  },
  dayText: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5 },
  dateText: { fontSize: 16, fontWeight: "500", opacity: 0.8 },
  statsContainer: { flexDirection: "row", gap: 12, marginBottom: 32 },
  statCard: { flex: 1, padding: 16, borderRadius: 20, borderWidth: 1 },
  statLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  statValue: { fontSize: 20, fontWeight: "700" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 18, fontWeight: "700", flex: 1 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  badgeText: { fontSize: 12, fontWeight: "700" },
  emptyState: { alignItems: "center", padding: 40, opacity: 0.5 },
  taskCard: { borderRadius: 24, padding: 20, borderWidth: 1 },
  taskHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    gap: 8,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  taskTime: { fontSize: 12, fontWeight: "600", opacity: 0.8 },
  taskContent: { marginLeft: 16 },
  taskTitle: {
    fontSize: 16,
    fontWeight: "600",
    lineHeight: 22,
    marginBottom: 4,
  },
  taskRemarks: { fontSize: 14, lineHeight: 20, opacity: 0.7 },
  imageGrid: {
    marginTop: 16,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginLeft: 16,
  },
  imageWrapper: {
    width: "47%",
    aspectRatio: 4 / 3,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
  },
  taskImage: { width: "100%", height: "100%" },
});
