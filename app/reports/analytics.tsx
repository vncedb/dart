import {
  Activity01Icon,
  Alert01Icon,
  Calendar03Icon,
  Clock01Icon,
  DashboardSquare03Icon,
  File02Icon,
  Target02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { format } from "date-fns";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "../../components/Button";
import Header from "../../components/Header";
import LoadingScreen from "../../components/LoadingScreen";
import { useAppTheme } from "../../constants/theme";
import { useAuth } from "../../context/AuthContext";
import { useActiveJob } from "../../hooks/useActiveJob";
import {
  buildReportAnalyticsSummary,
  fetchReportAnalyticsSource,
  type ReportAnalyticsBucket,
  type ReportAnalyticsSummary,
} from "../../lib/report-analytics";
import { formatMinutesAsHours } from "../../lib/report-helpers";

const formatCompactDate = (value?: string | null) =>
  value ? format(new Date(value), "MMM d, yyyy") : "No data";

const formatAverage = (value: number) => value.toFixed(value >= 10 ? 1 : 2);

const MetricCard = ({
  title,
  value,
  helper,
  icon,
  color,
  theme,
}: {
  title: string;
  value: string;
  helper: string;
  icon: any;
  color: string;
  theme: ReturnType<typeof useAppTheme>;
}) => (
  <View style={[styles.metricCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
    <View style={[styles.metricIcon, { backgroundColor: color + "14" }]}>
      <HugeiconsIcon icon={icon} size={18} color={color} />
    </View>
    <Text style={[styles.metricTitle, { color: theme.colors.textSecondary }]}>{title}</Text>
    <Text style={[styles.metricValue, { color: theme.colors.text }]}>{value}</Text>
    <Text style={[styles.metricHelper, { color: theme.colors.textSecondary }]}>{helper}</Text>
  </View>
);

const TrendRow = ({
  bucket,
  value,
  maxValue,
  accent,
  valueLabel,
  theme,
}: {
  bucket: ReportAnalyticsBucket;
  value: number;
  maxValue: number;
  accent: string;
  valueLabel: string;
  theme: ReturnType<typeof useAppTheme>;
}) => {
  const width = maxValue > 0 ? `${Math.max(10, (value / maxValue) * 100)}%` : "0%";

  return (
    <View style={styles.trendRow}>
      <View style={styles.trendHeader}>
        <Text style={[styles.trendLabel, { color: theme.colors.text }]}>{bucket.label}</Text>
        <Text style={[styles.trendValue, { color: theme.colors.textSecondary }]}>{valueLabel}</Text>
      </View>
      <View style={[styles.trendTrack, { backgroundColor: theme.colors.background }]}>
        {value > 0 ? <View style={[styles.trendFill, { width, backgroundColor: accent }]} /> : null}
      </View>
    </View>
  );
};

const InsightPill = ({
  icon,
  label,
  value,
  accent,
  theme,
}: {
  icon: any;
  label: string;
  value: string;
  accent: string;
  theme: ReturnType<typeof useAppTheme>;
}) => (
  <View style={[styles.insightPill, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
    <View style={[styles.insightIcon, { backgroundColor: accent + "14" }]}>
      <HugeiconsIcon icon={icon} size={16} color={accent} />
    </View>
    <View style={{ flex: 1 }}>
      <Text style={[styles.insightLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.insightValue, { color: theme.colors.text }]}>{value}</Text>
    </View>
  </View>
);

export default function ReportAnalyticsScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { user } = useAuth();
  const { activeJob } = useActiveJob();
  const params = useLocalSearchParams();

  const startDate = String(params.startDate || format(new Date(), "yyyy-MM-01"));
  const endDate = String(params.endDate || format(new Date(), "yyyy-MM-dd"));
  const periodLabel = String(params.periodLabel || `${formatCompactDate(startDate)} - ${formatCompactDate(endDate)}`);

  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<ReportAnalyticsSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadAnalytics = async () => {
      if (!user?.id || !activeJob?.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setLoadError(null);

      try {
        const source = await fetchReportAnalyticsSource(user.id, activeJob.id, startDate, endDate);
        if (cancelled) return;
        setAnalytics(buildReportAnalyticsSummary(source, startDate, endDate));
      } catch {
        if (cancelled) return;
        setLoadError("We couldn't load report analytics right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadAnalytics();
    return () => {
      cancelled = true;
    };
  }, [activeJob?.id, endDate, startDate, user?.id]);

  const overtimeMax = useMemo(
    () => Math.max(...(analytics?.buckets.map((bucket) => bucket.overtimeMinutes) || [0])),
    [analytics?.buckets]
  );
  const outputMax = useMemo(
    () => Math.max(...(analytics?.buckets.map((bucket) => bucket.outputCount) || [0])),
    [analytics?.buckets]
  );

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
        <Header title="Report Analytics" />
        <LoadingScreen variant="reports" message="Analyzing local report data..." />
      </SafeAreaView>
    );
  }

  if (!user?.id || !activeJob?.id) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
        <Header title="Report Analytics" />
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.warningLight }]}>
              <HugeiconsIcon icon={Alert01Icon} size={24} color={theme.colors.warning} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Active Job</Text>
            <Text style={[styles.emptyBody, { color: theme.colors.textSecondary }]}>
              Set an active job first so we can calculate streaks, overtime, and output trends for the right report data.
            </Text>
            <Button title="Go Back" onPress={() => router.back()} style={{ width: "100%" }} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const noActivity = !analytics || analytics.activeDays === 0;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={["top"]}>
      <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
      <Header title="Report Analytics" />

      {loadError ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.dangerLight }]}>
              <HugeiconsIcon icon={Alert01Icon} size={24} color={theme.colors.danger} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>Analytics Unavailable</Text>
            <Text style={[styles.emptyBody, { color: theme.colors.textSecondary }]}>{loadError}</Text>
            <Button title="Go Back" onPress={() => router.back()} style={{ width: "100%" }} />
          </View>
        </View>
      ) : noActivity ? (
        <View style={styles.emptyWrap}>
          <View style={[styles.emptyCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: theme.colors.primaryLight }]}>
              <HugeiconsIcon icon={DashboardSquare03Icon} size={24} color={theme.colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>No Activity In This Range</Text>
            <Text style={[styles.emptyBody, { color: theme.colors.textSecondary }]}>
              Add entries or attendance inside this period to unlock streaks, overtime, and output trend analytics.
            </Text>
            <Button
              title="Add Entry"
              onPress={() => router.push({ pathname: "/reports/add-entry", params: { date: startDate } })}
              style={{ width: "100%" }}
            />
          </View>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient
            colors={theme.dark ? [theme.colors.headerStart, theme.colors.card] : [theme.colors.primary, theme.colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroBadge}>
              <HugeiconsIcon icon={DashboardSquare03Icon} size={16} color="#ffffff" />
              <Text style={styles.heroBadgeText}>Offline Report Analytics</Text>
            </View>
            <Text style={styles.heroTitle}>Streaks, overtime, and output patterns in one view.</Text>
            <Text style={styles.heroSubtitle}>
              {activeJob.title || "Current job"}{activeJob.company ? ` • ${activeJob.company}` : ""}
            </Text>
            <View style={styles.heroPeriod}>
              <HugeiconsIcon icon={Calendar03Icon} size={16} color="rgba(255,255,255,0.92)" />
              <Text style={styles.heroPeriodText}>{periodLabel}</Text>
            </View>
          </LinearGradient>

          <View style={styles.metricsGrid}>
            <MetricCard
              title="Current Streak"
              value={`${analytics.currentStreak} days`}
              helper={`Longest streak: ${analytics.longestStreak} days`}
              icon={Calendar03Icon}
              color={theme.colors.primary}
              theme={theme}
            />
            <MetricCard
              title="Total Overtime"
              value={formatMinutesAsHours(analytics.totalOvertimeMinutes)}
              helper={`${analytics.overtimeDays} overtime day${analytics.overtimeDays === 1 ? "" : "s"}`}
              icon={Clock01Icon}
              color={theme.colors.warning}
              theme={theme}
            />
            <MetricCard
              title="Outputs Logged"
              value={`${analytics.totalOutputs}`}
              helper={`${formatAverage(analytics.averageOutputsPerActiveDay)} avg per active day`}
              icon={File02Icon}
              color={theme.colors.success}
              theme={theme}
            />
            <MetricCard
              title="Worked Hours"
              value={formatMinutesAsHours(analytics.totalWorkedMinutes)}
              helper={`${analytics.activeDays} active day${analytics.activeDays === 1 ? "" : "s"}`}
              icon={Activity01Icon}
              color={theme.colors.accent}
              theme={theme}
            />
          </View>

          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.colors.primaryLight }]}>
                <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Streaks</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  Consecutive active report days inside the selected range.
                </Text>
              </View>
            </View>

            <View style={styles.pillGrid}>
              <InsightPill
                icon={Calendar03Icon}
                label="Current streak"
                value={`${analytics.currentStreak} day${analytics.currentStreak === 1 ? "" : "s"}`}
                accent={theme.colors.primary}
                theme={theme}
              />
              <InsightPill
                icon={Target02Icon}
                label="Longest streak"
                value={`${analytics.longestStreak} day${analytics.longestStreak === 1 ? "" : "s"}`}
                accent={theme.colors.success}
                theme={theme}
              />
              <InsightPill
                icon={Activity01Icon}
                label="Consistency"
                value={`${Math.round(analytics.consistencyRatio * 100)}% of ${analytics.periodDays} days`}
                accent={theme.colors.accent}
                theme={theme}
              />
            </View>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.colors.warningLight }]}>
                <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.warning} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Overtime</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  Calculated from net worked hours beyond 8 hours per day.
                </Text>
              </View>
            </View>

            <View style={styles.pillGrid}>
              <InsightPill
                icon={Clock01Icon}
                label="Total overtime"
                value={formatMinutesAsHours(analytics.totalOvertimeMinutes)}
                accent={theme.colors.warning}
                theme={theme}
              />
              <InsightPill
                icon={Activity01Icon}
                label="Overtime days"
                value={`${analytics.overtimeDays} day${analytics.overtimeDays === 1 ? "" : "s"}`}
                accent={theme.colors.primary}
                theme={theme}
              />
              <InsightPill
                icon={Calendar03Icon}
                label="Peak overtime day"
                value={
                  analytics.peakOvertimeDay
                    ? `${formatCompactDate(analytics.peakOvertimeDay.date)} • ${formatMinutesAsHours(analytics.peakOvertimeDay.overtimeMinutes)}`
                    : "No overtime logged"
                }
                accent={theme.colors.danger}
                theme={theme}
              />
            </View>

            <View style={styles.trendSection}>
              {analytics.totalOvertimeMinutes === 0 ? (
                <Text style={[styles.zeroStateText, { color: theme.colors.textSecondary }]}>
                  No overtime was recorded in this period.
                </Text>
              ) : (
                analytics.buckets.map((bucket) => (
                  <TrendRow
                    key={`ot-${bucket.startDate}-${bucket.endDate}`}
                    bucket={bucket}
                    value={bucket.overtimeMinutes}
                    maxValue={overtimeMax}
                    accent={theme.colors.warning}
                    valueLabel={formatMinutesAsHours(bucket.overtimeMinutes)}
                    theme={theme}
                  />
                ))
              )}
            </View>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.sectionHeader}>
              <View style={[styles.sectionIcon, { backgroundColor: theme.colors.successLight }]}>
                <HugeiconsIcon icon={File02Icon} size={18} color={theme.colors.success} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Output Trends</Text>
                <Text style={[styles.sectionSubtitle, { color: theme.colors.textSecondary }]}>
                  Tracks how many accomplishment entries were logged across the selected range.
                </Text>
              </View>
            </View>

            <View style={styles.pillGrid}>
              <InsightPill
                icon={File02Icon}
                label="Total outputs"
                value={`${analytics.totalOutputs} entries`}
                accent={theme.colors.success}
                theme={theme}
              />
              <InsightPill
                icon={Activity01Icon}
                label="Average output"
                value={`${formatAverage(analytics.averageOutputsPerActiveDay)} per active day`}
                accent={theme.colors.primary}
                theme={theme}
              />
              <InsightPill
                icon={Target02Icon}
                label="Busiest output day"
                value={
                  analytics.peakOutputDay
                    ? `${formatCompactDate(analytics.peakOutputDay.date)} • ${analytics.peakOutputDay.outputCount} entries`
                    : "No accomplishment entries"
                }
                accent={theme.colors.accent}
                theme={theme}
              />
            </View>

            <View style={styles.trendSection}>
              {analytics.totalOutputs === 0 ? (
                <Text style={[styles.zeroStateText, { color: theme.colors.textSecondary }]}>
                  No accomplishment entries were logged in this period.
                </Text>
              ) : (
                analytics.buckets.map((bucket) => (
                  <TrendRow
                    key={`out-${bucket.startDate}-${bucket.endDate}`}
                    bucket={bucket}
                    value={bucket.outputCount}
                    maxValue={outputMax}
                    accent={theme.colors.success}
                    valueLabel={`${bucket.outputCount} entr${bucket.outputCount === 1 ? "y" : "ies"}`}
                    theme={theme}
                  />
                ))
              )}
            </View>

            <TouchableOpacity
              onPress={() =>
                router.push({
                  pathname: "/reports/generate",
                  params: { startDate, endDate },
                })
              }
              activeOpacity={0.8}
              style={[styles.generateLink, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
            >
              <HugeiconsIcon icon={DashboardSquare03Icon} size={18} color={theme.colors.primary} />
              <Text style={[styles.generateLinkText, { color: theme.colors.text }]}>Generate report from this range</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    padding: 20,
    paddingBottom: 48,
    gap: 18,
  },
  heroCard: {
    borderRadius: 28,
    padding: 24,
    gap: 12,
  },
  heroBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  heroBadgeText: {
    color: "#ffffff",
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
  },
  heroTitle: {
    color: "#ffffff",
    fontSize: 28,
    lineHeight: 34,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.7,
  },
  heroSubtitle: {
    color: "rgba(255,255,255,0.88)",
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Nunito_600SemiBold",
  },
  heroPeriod: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  heroPeriodText: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    width: "48%",
    borderRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 8,
  },
  metricIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  metricTitle: {
    marginTop: 2,
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  metricValue: {
    fontSize: 21,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.4,
  },
  metricHelper: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: "Nunito_600SemiBold",
  },
  sectionCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 20,
    gap: 18,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    marginTop: 3,
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Nunito_600SemiBold",
  },
  pillGrid: {
    gap: 10,
  },
  insightPill: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  insightIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  insightLabel: {
    fontSize: 11,
    fontFamily: "Nunito_700Bold",
    textTransform: "uppercase",
    letterSpacing: 0.7,
  },
  insightValue: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: "Nunito_800ExtraBold",
  },
  trendSection: {
    gap: 12,
  },
  trendRow: {
    gap: 8,
  },
  trendHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  trendLabel: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Nunito_700Bold",
  },
  trendValue: {
    fontSize: 12,
    fontFamily: "Nunito_700Bold",
  },
  trendTrack: {
    height: 9,
    borderRadius: 999,
    overflow: "hidden",
  },
  trendFill: {
    height: "100%",
    borderRadius: 999,
  },
  zeroStateText: {
    fontSize: 13,
    lineHeight: 20,
    fontFamily: "Nunito_600SemiBold",
  },
  generateLink: {
    minHeight: 54,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  generateLinkText: {
    fontSize: 14,
    fontFamily: "Nunito_800ExtraBold",
  },
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  emptyCard: {
    borderRadius: 26,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 22,
    fontFamily: "Nunito_800ExtraBold",
    textAlign: "center",
  },
  emptyBody: {
    marginTop: 10,
    marginBottom: 22,
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Nunito_600SemiBold",
    textAlign: "center",
  },
});
