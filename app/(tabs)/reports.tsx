import {
    Cancel01Icon,
    Delete02Icon,
    File02Icon,
    FileVerifiedIcon,
    PlusSignIcon,
    RefreshIcon,
    Search01Icon,
    WifiOff01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import NetInfo from "@react-native-community/netinfo";
import { endOfMonth, format } from "date-fns";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    BackHandler,
    Platform,
    RefreshControl,
    SectionList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View,
} from "react-native";
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

// Components
import ActionMenu from "../../components/ActionMenu";
import DatePicker from "../../components/DatePicker";
import FloatingAlert from "../../components/FloatingAlert";
import LoadingOverlay from "../../components/LoadingOverlay";
import ModernAlert from "../../components/ModernAlert";
import ReportFilterBar from "../../components/ReportFilterBar";
import ReportFilterModal, {
    DateRange,
} from "../../components/ReportFilterModal";
import ReportItem from "../../components/ReportItem";
import TabHeader from "../../components/TabHeader";
import { useAppTheme } from "../../constants/theme";
import { useSync } from "../../context/SyncContext";
import { getDB } from "../../lib/db-client";
import { supabase } from "../../lib/supabase";
import { ReportService } from "../../services/ReportService";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  if (typeof UIManager.setLayoutAnimationEnabledExperimental === "function") {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }
}

const OfflineIndicator = ({
  isOffline,
  theme,
}: {
  isOffline: boolean;
  theme: any;
}) => {
  if (!isOffline) return null;
  return (
    <View
      style={[
        styles.offlineStatus,
        {
          backgroundColor: theme.colors.danger + "10",
          borderColor: theme.colors.danger + "20",
        },
      ]}
    >
      <HugeiconsIcon
        icon={WifiOff01Icon}
        size={14}
        color={theme.colors.danger}
      />
      <Text
        style={{
          fontSize: 11,
          fontWeight: "700",
          color: theme.colors.danger,
          marginLeft: 6,
        }}
      >
        You are offline. Data may be unsynced.
      </Text>
    </View>
  );
};

export default function ReportsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { triggerSync, syncStatus, lastSyncedAt } = useSync();
  const isSyncing = syncStatus === "syncing";

  // Refs
  const filterBarRef = useRef<View>(null);

  // Data & UI
  const [allSections, setAllSections] = useState<any[]>([]);
  const [filteredSections, setFilteredSections] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  // Modals
  const [modalVisible, setModalVisible] = useState(false);
  const [currentRange, setCurrentRange] = useState<DateRange | null>(null);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<
    { x: number; y: number } | undefined
  >(undefined);

  // Alerts
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [floatingAlert, setFloatingAlert] = useState({
    visible: false,
    message: "",
    type: "success",
  });

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(false);
  const syncButtonRotation = useSharedValue(0);

  // Network Listener
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable));
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isSyncing) {
      syncButtonRotation.value = withRepeat(
        withTiming(360, { duration: 1000 }),
        -1,
      );
    } else {
      cancelAnimation(syncButtonRotation);
      syncButtonRotation.value = withTiming(0);
    }
  }, [isSyncing, syncButtonRotation]);

  const syncButtonStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${syncButtonRotation.value}deg` }],
  }));

  useEffect(() => {
    const onBackPress = () => {
      if (selectionMode) {
        setSelectionMode(false);
        setSelectedIds(new Set());
        return true;
      }
      return false;
    };
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      onBackPress,
    );
    return () => subscription.remove();
  }, [selectionMode]);

  const handleManualSync = async () => {
    if (isSyncing) return;
    try {
      const success = await triggerSync();
      if (success) {
        setFloatingAlert({
          visible: true,
          message: "Sync complete",
          type: "success",
        });
        await fetchReports();
      } else {
        if (isOffline) {
          setFloatingAlert({
            visible: true,
            message: "Offline: Cannot sync",
            type: "error",
          });
        } else {
          setAlertConfig({
            visible: true,
            type: "error",
            title: "Sync Failed",
            message:
              "Could not sync data. Please check your connection and try again.",
            confirmText: "OK",
            onConfirm: () =>
              setAlertConfig((prev: any) => ({ ...prev, visible: false })),
          });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const applyFilter = useCallback((range: DateRange, data: any[]) => {
    if (!range || !data) return;
    const startStr = range.start.split("T")[0];
    const endStr = range.end.split("T")[0];
    const filtered = data
      .map((section) => {
        const matchingItems = section.data.filter(
          (item: any) => item.date >= startStr && item.date <= endStr,
        );
        if (matchingItems.length > 0)
          return { ...section, data: matchingItems };
        return null;
      })
      .filter(Boolean);
    setFilteredSections(filtered);
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const db = await getDB();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setIsLoading(false);
        return;
      }

      const job: any = await ReportService.getActiveJob(userId);
      if (!job) {
        setAllSections([]);
        setFilteredSections([]);
        setIsLoading(false);
        return;
      }

      const payoutType = job.payout_type || "Semi-Monthly";
      const attendance = await db.getAllAsync(
        "SELECT * FROM attendance WHERE user_id = ? AND job_id = ? ORDER BY date DESC",
        [userId, job.id],
      );
      const tasks = await db.getAllAsync(
        "SELECT * FROM accomplishments WHERE user_id = ? AND job_id = ?",
        [userId, job.id],
      );

      const allDatesSet = new Set([
        ...(attendance?.map((a: any) => a.date) || []),
        ...(tasks?.map((t: any) => t.date) || []),
      ]);
      setAvailableDates(Array.from(allDatesSet));

      const sortedDates = Array.from(allDatesSet).sort(
        (a, b) => new Date(b).getTime() - new Date(a).getTime(),
      );

      const merged = sortedDates.map((dateStr) => {
        const att: any = attendance?.find((a: any) => a.date === dateStr);
        const taskList: any =
          tasks?.filter((t: any) => t.date === dateStr) || [];
        return {
          id: dateStr,
          date: dateStr,
          clock_in: att?.clock_in,
          clock_out: att?.clock_out,
          status: att?.status || "no-attendance",
          accomplishments: taskList,
          is_synced: att ? (att.is_synced ?? 0) : 0,
        };
      });

      const grouped = ReportService.groupReportsByPayout(merged, payoutType);
      const sectionsArray = Object.values(grouped);
      setAllSections(sectionsArray);

      if (!currentRange) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        let start, end, label;
        if (day <= 15) {
          start = new Date(year, month, 1);
          end = new Date(year, month, 15);
          label = `${format(start, "MMM 1")} - ${format(end, "15, yyyy")}`;
        } else {
          start = new Date(year, month, 16);
          end = endOfMonth(now);
          label = `${format(start, "MMM 16")} - ${format(end, "d, yyyy")}`;
        }
        const defaultRange: DateRange = {
          start: format(start, "yyyy-MM-dd"),
          end: format(end, "yyyy-MM-dd"),
          label,
          type: "period",
        };
        setCurrentRange(defaultRange);
        applyFilter(defaultRange, sectionsArray);
      } else {
        applyFilter(currentRange, sectionsArray);
      }
    } catch (e) {
      console.log("Fetch Error", e);
    } finally {
      setRefreshing(false);
      setIsLoading(false);
    }
  }, [currentRange, applyFilter]);

  useFocusEffect(
    useCallback(() => {
      fetchReports();
    }, [fetchReports]),
  );

  useEffect(() => {
    if (lastSyncedAt) fetchReports();
  }, [lastSyncedAt, fetchReports]);

  const handleExactDateSelect = (date: Date) => {
    if (date) {
      const dateStr = format(date, "yyyy-MM-dd");
      const range: DateRange = {
        start: dateStr,
        end: dateStr,
        label: format(date, "MMMM d, yyyy"),
        type: "day" as any,
      };
      setCurrentRange(range);
      applyFilter(range, allSections);
    }
  };

  const handleRangeSelect = (range: DateRange) => {
    setCurrentRange(range);
    applyFilter(range, allSections);
  };

  const handleDeleteSelected = () => {
    if (selectedIds.size === 0) return;
    setAlertConfig({
      visible: true,
      type: "confirm",
      title: "Delete Reports",
      message: `Delete ${selectedIds.size} selected items?`,
      confirmText: "Delete",
      cancelText: "Cancel",
      onConfirm: async () => {
        setAlertConfig((p: any) => ({ ...p, visible: false }));
        setLoadingAction(true);
        try {
          const {
            data: { session },
          } = await supabase.auth.getSession();
          const userId = session?.user?.id;
          if (userId) {
            const job = await ReportService.getActiveJob(userId);
            if (job) {
              for (const date of selectedIds)
                await ReportService.deleteReportDay(userId, job.id, date);
              triggerSync();
              fetchReports();
              setSelectionMode(false);
              setSelectedIds(new Set());
              setFloatingAlert({
                visible: true,
                message: "Deleted.",
                type: "success",
              });
            }
          }
        } catch {
          setFloatingAlert({
            visible: true,
            message: "Failed.",
            type: "error",
          });
        } finally {
          setLoadingAction(false);
        }
      },
      onCancel: () => setAlertConfig((p: any) => ({ ...p, visible: false })),
    });
  };

  const toggleSelection = (date: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(date)) newSet.delete(date);
    else newSet.add(date);
    setSelectedIds(newSet);
    if (newSet.size === 0) setSelectionMode(false);
  };

  const renderItem = ({ item, index }: any) => (
    <ReportItem
      item={item}
      index={index}
      selectionMode={selectionMode}
      isSelected={selectedIds.has(item.date)}
      onPress={() =>
        selectionMode
          ? toggleSelection(item.date)
          : router.push({
              pathname: "/reports/details",
              params: { date: item.date },
            })
      }
      onLongPress={() => {
        setSelectionMode(true);
        toggleSelection(item.date);
      }}
    />
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: theme.colors.background }}
      edges={["top"]}
    >
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      <FloatingAlert
        visible={floatingAlert.visible}
        message={floatingAlert.message}
        type={floatingAlert.type as any}
        onHide={() => setFloatingAlert({ ...floatingAlert, visible: false })}
      />
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={loadingAction} message="Processing..." />

      <ReportFilterModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        availableDates={availableDates}
        currentRange={currentRange}
        onSelect={handleRangeSelect}
      />

      <DatePicker
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onSelect={handleExactDateSelect}
        selectedDate={
          (currentRange?.type as any) === "day"
            ? new Date(currentRange.start)
            : new Date()
        }
        title="Select Specific Date"
      />

      <ActionMenu
        visible={actionMenuVisible}
        onClose={() => setActionMenuVisible(false)}
        anchor={menuAnchor}
        actions={[
          {
            label: "Add Entry",
            icon: PlusSignIcon,
            onPress: () => router.push("/reports/add-entry"),
          },
          {
            label: "Generate Report",
            icon: File02Icon,
            onPress: () => {
              setActionMenuVisible(false);
              if (filteredSections.length > 0) {
                router.push({
                  pathname: "/reports/generate",
                  params: {
                    startDate: currentRange?.start,
                    endDate: currentRange?.end,
                    date:
                      (currentRange?.type as any) === "day"
                        ? currentRange.start
                        : undefined,
                  },
                });
              } else {
                setFloatingAlert({
                  visible: true,
                  message: "No data to generate",
                  type: "error",
                });
              }
            },
          },
        ]}
      />

      <TabHeader
        title={selectionMode ? `${selectedIds.size} Selected` : "Reports"}
        rightElement={
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            {!selectionMode && (
              <>
                <TouchableOpacity
                  onPress={handleManualSync}
                  disabled={isSyncing}
                  style={[
                    styles.headerBtn,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <Animated.View style={syncButtonStyle}>
                    <HugeiconsIcon
                      icon={RefreshIcon}
                      size={20}
                      color={theme.colors.text}
                    />
                  </Animated.View>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => router.push("/reports/saved-reports")}
                  style={[
                    styles.headerBtn,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <HugeiconsIcon
                    icon={FileVerifiedIcon}
                    size={20}
                    color={theme.colors.text}
                  />
                </TouchableOpacity>
              </>
            )}
            {selectionMode && (
              <TouchableOpacity
                onPress={handleDeleteSelected}
                disabled={selectedIds.size === 0}
                style={{
                  backgroundColor: theme.colors.danger + "15",
                  padding: 10,
                  borderRadius: 22,
                }}
              >
                <HugeiconsIcon
                  icon={Delete02Icon}
                  size={20}
                  color={theme.colors.danger}
                />
              </TouchableOpacity>
            )}
          </View>
        }
        leftElement={
          selectionMode ? (
            <TouchableOpacity
              onPress={() => {
                setSelectionMode(false);
                setSelectedIds(new Set());
              }}
              style={{ padding: 10 }}
            >
              <HugeiconsIcon
                icon={Cancel01Icon}
                size={24}
                color={theme.colors.text}
              />
            </TouchableOpacity>
          ) : undefined
        }
      />

      <OfflineIndicator isOffline={isOffline} theme={theme} />

      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          <View
            ref={filterBarRef}
            collapsable={false}
            onLayout={() => {}}
            style={{ zIndex: 10 }}
          >
            <ReportFilterBar
              onPress={() => setModalVisible(true)}
              onCalendarPress={() => setShowDatePicker(true)}
              onMorePress={() => {
                if (filterBarRef.current) {
                  filterBarRef.current.measure(
                    (x, y, width, height, pageX, pageY) => {
                      setMenuAnchor({
                        x: pageX + width - 16,
                        y: pageY + height + 4,
                      });
                      setActionMenuVisible(true);
                    },
                  );
                }
              }}
              currentRange={currentRange}
            />
          </View>

          <View
            style={[styles.separator, { backgroundColor: theme.colors.border }]}
          />

          <SectionList
            sections={filteredSections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={({ section }: any) => {
              if (
                filteredSections.length === 1 &&
                (currentRange?.type as any) !== "custom" &&
                (currentRange?.type as any) !== "day"
              )
                return null;
              return (
                <View
                  style={[
                    styles.sectionHeader,
                    { backgroundColor: theme.colors.background },
                  ]}
                >
                  <Text
                    style={[
                      styles.sectionTitle,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {section.title}
                  </Text>
                </View>
              );
            }}
            contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => {
                  setRefreshing(true);
                  fetchReports();
                }}
                tintColor={theme.colors.primary}
              />
            }
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View
                  style={[
                    styles.emptyIcon,
                    {
                      backgroundColor: theme.colors.card,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  <HugeiconsIcon
                    icon={Search01Icon}
                    size={32}
                    color={theme.colors.textSecondary}
                  />
                </View>
                <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                  No reports found
                </Text>
                <Text
                  style={[
                    styles.emptySub,
                    { color: theme.colors.textSecondary },
                  ]}
                >
                  Try changing the date filter.
                </Text>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  centerContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  offlineStatus: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  separator: { height: 1, marginHorizontal: 20, opacity: 0.5, marginBottom: 8 },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 12 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  emptySub: { fontSize: 14 },
});
