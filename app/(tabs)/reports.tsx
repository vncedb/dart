// filepath: app/(tabs)/reports.tsx
import {
  File02Icon,
  FileVerifiedIcon,
  Message01Icon,
  PlusSignIcon,
  Search01Icon,
  WifiOff01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import NetInfo from "@react-native-community/netinfo";
import { endOfMonth, format } from "date-fns";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  RefreshControl,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import ActionMenu from "../../components/ActionMenu";
import DatePicker from "../../components/DatePicker";
import FloatingAlert from "../../components/FloatingAlert";
import LoadingScreen from "../../components/LoadingScreen";
import ModernAlert from "../../components/ModernAlert";
import ReportFilterBar from "../../components/ReportFilterBar";
import ReportFilterModal, { DateRange } from "../../components/ReportFilterModal";
import ReportItem from "../../components/ReportItem";
import TabHeader from "../../components/TabHeader";
import { useAppTheme } from "../../constants/theme";
import { useSync } from "../../context/SyncContext";
import { getDB } from "../../lib/db-client";
import { supabase } from "../../lib/supabase";
import { ReportService } from "../../services/ReportService";

type ExtendedDateRange = DateRange & { type?: "period" | "custom" | "day" };

const OfflineIndicator = ({ isOffline, theme }: { isOffline: boolean; theme: any; }) => {
  if (!isOffline) return null;
  return (
    <View style={[styles.offlineStatus, { backgroundColor: theme.colors.danger + "10", borderColor: theme.colors.danger + "20" }]}>
      <HugeiconsIcon icon={WifiOff01Icon} size={14} color={theme.colors.danger} />
      <Text style={{ fontSize: 11, fontFamily: 'Nunito_500Medium', color: theme.colors.danger, marginLeft: 6 }}>
        You are offline. Data may be unsynced.
      </Text>
    </View>
  );
};

export default function ReportsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { lastSyncedAt } = useSync();

  const filterBarRef = useRef<View>(null);

  const [allSections, setAllSections] = useState<any[]>([]);
  const [filteredSections, setFilteredSections] = useState<any[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [markedDates, setMarkedDates] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);

  const [modalVisible, setModalVisible] = useState(false);
  const [currentRange, setCurrentRange] = useState<ExtendedDateRange | null>(null);
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);

  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [floatingAlert, setFloatingAlert] = useState({ visible: false, message: "", type: "success" });
  const [showDatePicker, setShowDatePicker] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsOffline(!(state.isConnected && state.isInternetReachable));
    });
    return unsubscribe;
  }, []);

  const handleCalendarPress = () => {
    setCalendarLoading(true);
    setTimeout(() => {
        setShowDatePicker(true);
        setCalendarLoading(false);
    }, 100);
  };

  const applyFilter = useCallback((range: DateRange, data: any[]) => {
    if (!range || !data) return;
    const startStr = range.start.split("T")[0];
    const endStr = range.end.split("T")[0];
    const filtered = data
      .map((section) => {
        const matchingItems = section.data.filter((item: any) => item.date >= startStr && item.date <= endStr);
        if (matchingItems.length > 0) return { ...section, data: matchingItems };
        return null;
      })
      .filter(Boolean);
    setFilteredSections(filtered);
  }, []);

  const fetchReports = useCallback(async () => {
    try {
      const db = await getDB();
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;
      if (!userId) {
        setIsLoading(false);
        return;
      }

      const count = await ReportService.getUnreadCount(userId);
      setUnreadCount(count);

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
        [userId, job.id]
      );
      const tasks = await db.getAllAsync(
        "SELECT * FROM accomplishments WHERE user_id = ? AND job_id = ?",
        [userId, job.id]
      );

      const allDatesSet = new Set([
        ...(attendance?.map((a: any) => a.date) || []),
        ...(tasks?.map((t: any) => t.date) || []),
      ]);
      setAvailableDates(Array.from(allDatesSet));
      setMarkedDates(Array.from(allDatesSet));

      const sortedDates = Array.from(allDatesSet).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

      const merged = sortedDates.map((dateStr) => {
        const dayAtts = attendance
          ?.filter((a: any) => a.date === dateStr)
          .sort((a: any, b: any) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime()) || [];
        const taskList: any = tasks?.filter((t: any) => t.date === dateStr) || [];
        
        let synced = true;
        if (dayAtts.length > 0 && dayAtts.some((a: any) => !a.is_synced || a.is_synced === 0)) synced = false;
        if (taskList.some((t: any) => !t.is_synced || t.is_synced === 0)) synced = false;

        return {
          id: dateStr,
          date: dateStr,
          attendances: dayAtts, 
          status: dayAtts.length > 0 ? dayAtts[dayAtts.length - 1].status : "no-attendance",
          accomplishments: taskList,
          is_synced: synced ? 1 : 0,
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
        
        let start: Date;
        let end: Date;
        let label: string;
        
        if (day <= 15) {
          start = new Date(year, month, 1);
          end = new Date(year, month, 15);
          label = `${format(start, "MMM 1")} - ${format(end, "15, yyyy")}`;
        } else {
          start = new Date(year, month, 16);
          end = endOfMonth(now);
          label = `${format(start, "MMM 16")} - ${format(end, "d, yyyy")}`;
        }
        const defaultRange: ExtendedDateRange = { start: format(start, "yyyy-MM-dd"), end: format(end, "yyyy-MM-dd"), label, type: "period" };
        setCurrentRange(defaultRange);
        applyFilter(defaultRange, sectionsArray);
      } else {
        applyFilter(currentRange, sectionsArray);
      }
    } catch (error) { 
      console.log("Fetch Error", error);
    } finally {
      setRefreshing(false);
      setIsLoading(false);
    }
  }, [currentRange, applyFilter]);

  useFocusEffect(useCallback(() => { fetchReports(); }, [fetchReports]));

  useEffect(() => {
    if (lastSyncedAt) fetchReports();
  }, [lastSyncedAt, fetchReports]);

  const handleExactDateSelect = (date: Date) => {
    if (date) {
      const dateStr = format(date, "yyyy-MM-dd");
      const range: ExtendedDateRange = { start: dateStr, end: dateStr, label: format(date, "MMMM d, yyyy"), type: "day" };
      setCurrentRange(range);
      applyFilter(range, allSections);
    }
  };

  const handleRangeSelect = (range: ExtendedDateRange) => {
    setCurrentRange(range);
    applyFilter(range, allSections);
  };

  const renderItem = ({ item, index }: any) => (
    <ReportItem
      item={item}
      index={index}
      onPress={() => router.push({ pathname: "/reports/details", params: { date: item.date } })}
    />
  );

  const getEmptyStateProps = () => {
    if (allSections.length === 0) {
      return {
        title: "No Activity Yet",
        description: "You haven't logged any hours or tasks. Add a new entry to get started."
      };
    }
    if (currentRange?.type === "day") {
      return {
        title: "No Entries Today",
        description: `There are no activities logged for ${currentRange?.label}. Try selecting a different date.`
      };
    }
    return {
      title: "No Reports Found",
      description: `No data found for ${currentRange?.label}. Try adjusting your date filter.`
    };
  };

  const emptyStateProps = getEmptyStateProps();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      <FloatingAlert visible={floatingAlert.visible} message={floatingAlert.message} type={floatingAlert.type as any} onHide={() => setFloatingAlert({ ...floatingAlert, visible: false })} />
      <ModernAlert {...alertConfig} />

      <ReportFilterModal visible={modalVisible} onClose={() => setModalVisible(false)} availableDates={availableDates} currentRange={currentRange} onSelect={handleRangeSelect as any} />

      <DatePicker visible={showDatePicker} onClose={() => setShowDatePicker(false)} onSelect={handleExactDateSelect} selectedDate={currentRange && currentRange.type === "day" ? new Date(currentRange.start) : new Date()} title="Select Specific Date" markedDates={markedDates} />

      <ActionMenu
        visible={actionMenuVisible}
        onClose={() => setActionMenuVisible(false)}
        anchor={menuAnchor}
        actions={[
          { label: "Add Entry", icon: PlusSignIcon, onPress: () => router.push("/reports/add-entry") },
          { 
              label: "Generate Report", 
              icon: File02Icon, 
              onPress: () => { 
                  setActionMenuVisible(false); 
                  if (filteredSections.length > 0) { 
                      router.push({ 
                          pathname: "/reports/generate", 
                          params: { 
                              startDate: currentRange?.start || "", 
                              endDate: currentRange?.end || "", 
                              date: currentRange?.type === "day" ? currentRange.start : "" 
                          } 
                      }); 
                  } else { 
                      setFloatingAlert({ visible: true, message: "No data to generate", type: "error" }); 
                  } 
              } 
          },
          {
              label: "Summary",
              icon: Message01Icon,
              onPress: () => {
                  setActionMenuVisible(false);
                  router.push({
                      pathname: "/reports/ai-summary",
                      params: {
                          startDate: currentRange?.start || "",
                          endDate: currentRange?.end || "",
                          periodLabel: currentRange?.label || "",
                      },
                  });
              },
          },
        ]}
      />

      <TabHeader
        title="Reports"
        rightElement={
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <TouchableOpacity onPress={() => router.push("/reports/saved-reports")} style={[styles.headerBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
              <View>
                <HugeiconsIcon icon={FileVerifiedIcon} size={20} color={theme.colors.text} />
                {unreadCount > 0 ? (
                  <View style={[styles.badge, { backgroundColor: theme.colors.danger, borderColor: theme.colors.card }]}>
                    <Text style={{ color: "#fff", fontSize: 9, fontFamily: 'Nunito_500Medium', lineHeight: 12 }}>
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </Text>
                  </View>
                ) : null}
              </View>
            </TouchableOpacity>
          </View>
        }
      />

      <OfflineIndicator isOffline={isOffline} theme={theme} />

      {isLoading ? (
        <LoadingScreen message="Loading Reports..." />
      ) : (
        <View style={{ flex: 1 }}>
          <View ref={filterBarRef} collapsable={false} style={{ zIndex: 10 }}>
            <ReportFilterBar
              onPress={() => setModalVisible(true)}
              onCalendarPress={handleCalendarPress}
              onMorePress={() => {
                if (filterBarRef.current) {
                  filterBarRef.current.measure((x, y, width, height, pageX, pageY) => {
                    setMenuAnchor({ x: pageX + width - 16, y: pageY + height + 4 });
                    setActionMenuVisible(true);
                  });
                }
              }}
              currentRange={currentRange}
              isCalendarLoading={calendarLoading}
            />
          </View>

          <View style={[styles.separator, { backgroundColor: theme.colors.border }]} />

          <SectionList
            sections={filteredSections}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            renderSectionHeader={({ section }: any) => {
              if (filteredSections.length === 1 && currentRange?.type !== "custom" && currentRange?.type !== "day") return null;
              return (
                <View style={[styles.sectionHeader, { backgroundColor: theme.colors.background }]}>
                  <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>{section.title}</Text>
                </View>
              );
            }}
            contentContainerStyle={{ paddingBottom: 120, paddingTop: 4 }}
            showsVerticalScrollIndicator={false}
            stickySectionHeadersEnabled={true}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} tintColor={theme.colors.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                  <View style={[styles.emptyIconContainer, { backgroundColor: theme.dark ? '#1F2937' : '#F3F4F6' }]}>
                      <HugeiconsIcon icon={Search01Icon} size={36} color={theme.colors.textSecondary} />
                  </View>
                  <View style={styles.emptyTextContainer}>
                      <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
                          {emptyStateProps.title}
                      </Text>
                      <Text style={[styles.emptyDescription, { color: theme.colors.textSecondary }]}>
                          {emptyStateProps.description}
                      </Text>
                  </View>
              </View>
            }
          />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBtn: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  badge: { position: "absolute", top: -6, right: -6, borderRadius: 10, minWidth: 16, height: 16, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  offlineStatus: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 8, borderBottomWidth: 1 },
  separator: { height: 1, marginHorizontal: 20, opacity: 0.5, marginBottom: 8 },
  sectionHeader: { paddingHorizontal: 20, paddingVertical: 12 },
  sectionTitle: { fontSize: 12, fontFamily: 'Nunito_500Medium', letterSpacing: 0.8, textTransform: "uppercase" },

  emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 24 },
  emptyIconContainer: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTextContainer: { alignItems: 'center', marginBottom: 8 },
  emptyTitle: { fontFamily: 'Nunito_800ExtraBold', fontSize: 22, marginBottom: 10, textAlign: 'center', letterSpacing: -0.3 },
  emptyDescription: { fontFamily: 'Nunito_500Medium', fontSize: 15, lineHeight: 24, textAlign: 'center', opacity: 0.9, paddingHorizontal: 8 },
});