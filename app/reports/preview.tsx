// filepath: app/reports/preview.tsx
import {
  DocumentValidationIcon,
  File02Icon,
  FloppyDiskIcon,
  Share08Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { format } from "date-fns";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "../../components/Button";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import LoadingScreen from "../../components/LoadingScreen";
import ModernAlert from "../../components/ModernAlert";
import { useAppTheme } from "../../constants/theme";
import { generateUUID, saveReportLocal } from "../../lib/database";
import {
  buildProcessedReportData,
  buildReportDisplayTitle,
  buildReportStorageFileName,
  buildSavedReportRecord,
  formatReportPeriod,
} from "../../lib/reporting";
import { getSafeFileInfo, saveReportFileOffline } from "../../lib/report-storage";
import { supabase } from "../../lib/supabase";
import { ReportService } from "../../services/ReportService";
import { exportToExcel } from "../../utils/csvExporter";
import { generateReport } from "../../utils/reportGenerator";

const formatBytes = (bytes: number, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const MarqueeText = ({ text, style }: { text: string; style: any }) => {
    const [textWidth, setTextWidth] = useState(0);
    const [containerWidth, setContainerWidth] = useState(0);
    const translateX = useSharedValue(0);

    useEffect(() => {
        if (textWidth > containerWidth && containerWidth > 0) {
            translateX.value = 0;
            translateX.value = withDelay(
                1000, 
                withRepeat(
                    withTiming(-(textWidth + 30), { duration: (textWidth + 30) * 15, easing: Easing.linear }),
                    -1,
                    false
                )
            );
        } else {
            translateX.value = 0;
        }
    }, [textWidth, containerWidth, translateX]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }]
    }));

    return (
        <View 
            style={{ flex: 1, overflow: 'hidden', alignItems: 'flex-end', paddingLeft: 10 }}
            onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        >
            <Animated.View style={[{ flexDirection: 'row' }, textWidth > containerWidth ? animatedStyle : undefined]}>
                <Text
                    numberOfLines={1}
                    onLayout={(e) => setTextWidth(e.nativeEvent.layout.width)}
                    style={[style, { maxWidth: undefined }]}
                >
                    {text}
                </Text>
                {textWidth > containerWidth && containerWidth > 0 && (
                    <Text style={[style, { marginLeft: 30, maxWidth: undefined }]}>{text}</Text>
                )}
            </Animated.View>
        </View>
    );
};

export default function PreviewReportScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { startDate, endDate, date, config } = useLocalSearchParams();

  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [reportSummary, setReportSummary] = useState({ totalDays: 0, totalMinutes: 0, totalHoursText: "0h" });
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("Generating Report...");
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [generatedMetadata, setGeneratedMetadata] = useState<any>({});
  
  const [reportId] = useState(() => generateUUID());
  const [generatedAt] = useState(() => new Date());

  const viewOptions = useMemo(() => config ? JSON.parse(config as string) : {}, [config]);

  const formattedPeriod = useMemo(() => {
      return formatReportPeriod({
        date: typeof date === "string" ? date : null,
        startDate: typeof startDate === "string" ? startDate : null,
        endDate: typeof endDate === "string" ? endDate : null,
        fallback: viewOptions.meta?.period || "Report",
      });
  }, [startDate, endDate, date, viewOptions]);

  const finalReportTitle = useMemo(
    () => buildReportDisplayTitle({ generatedAt }),
    [generatedAt],
  );
  const storageFileName = useMemo(() => {
    return buildReportStorageFileName({
      generatedAt,
      format: viewOptions.format || "pdf",
    });
  }, [generatedAt, viewOptions.format]);

  const generateFile = useCallback(async () => {
    setLoading(true);
    setLoadingMsg("Generating Report...");
    setLoadingProgress(5);
    try {
      setLoadingMsg("Loading account...");
      setLoadingProgress(10);
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      setLoadingMsg("Loading report data...");
      setLoadingProgress(20);
      const job: any = await ReportService.getActiveJob(user.id);
      let items: any = { attendance: [], tasks: [] };

      if (startDate && endDate) {
        items = await ReportService.getReportRange(user.id, job?.id || null, startDate as string, endDate as string);
      } else if (date) {
        const res = await ReportService.getDailyReport(user.id, date as string);
        items = { attendance: res.attendance || [], tasks: res.tasks };
      }

      setLoadingMsg("Preparing entries...");
      setLoadingProgress(35);
      const {
        processedData,
        includedDates,
        totalDays,
        totalMinutes,
        totalHoursText,
        totalEntries,
        totalImages,
      } = buildProcessedReportData({
        attendance: items.attendance || [],
        tasks: items.tasks || [],
        job,
        selectedDates: (viewOptions.selectedDates || []) as string[],
        includeDocs: viewOptions.includeDocs,
        includeRemarks: viewOptions.columns?.remarks !== false,
        includeDay: viewOptions.includeDay !== false,
        dateFormat: viewOptions.dateFormat || "MM/dd/yyyy",
        timeFormat: viewOptions.timeFormat || "exact_hm",
      });

      if (processedData.length === 0) {
        throw new Error("No report content found for the selected dates.");
      }
      setReportSummary({
        totalDays,
        totalMinutes,
        totalHoursText,
      });

      const meta = {
        userName: viewOptions.meta?.name, userTitle: viewOptions.meta?.title, company: viewOptions.meta?.company,
        department: viewOptions.includeDept ? viewOptions.meta?.department : undefined, reportTitle: "ACCOMPLISHMENT REPORT",
        period: viewOptions.meta?.period, signatureUri: viewOptions.meta?.signature,
        secondaryName: viewOptions.meta?.secondaryName, secondaryTitle: viewOptions.meta?.secondaryTitle,
        secondarySignatureUri: viewOptions.meta?.secondarySignature, style: viewOptions.style,
        paperSize: viewOptions.paperSize, columns: viewOptions.columns, dateFormat: viewOptions.dateFormat,
        totals: { totalDays, totalHours: totalHoursText },
      };

      let uri = "";
      if (viewOptions.format === "pdf") {
        uri = await generateReport({
          ...meta,
          data: processedData,
          onProgress: (progress, message) => {
            if (message) setLoadingMsg(message);
            setLoadingProgress(Math.max(35, progress));
          },
        });
      }
      else uri = await exportToExcel({ ...meta, data: processedData, fileName: storageFileName });

      setLoadingMsg("Finishing up...");
      setLoadingProgress(95);
      setFileUri(uri);
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) setFileSize(info.size);
      setLoadingProgress(100);

      const nextMeta = {
        reportDate: formattedPeriod,
        startDate: typeof startDate === "string" ? new Date(startDate).toISOString() : (typeof date === "string" ? new Date(date).toISOString() : null),
        endDate: typeof endDate === "string" ? new Date(endDate).toISOString() : (typeof date === "string" ? new Date(date).toISOString() : null),
        periodLabel: viewOptions.meta?.period || formattedPeriod,
        format: viewOptions.format || "pdf",
        fileName: storageFileName,
        generatedAt: generatedAt.toISOString(),
        totalDays,
        totalMinutes,
        totalHours: totalHoursText,
        totalEntries,
        totalImages,
        includedDates,
        style: viewOptions.style || null,
        paperSize: viewOptions.paperSize || null,
        company: viewOptions.meta?.company || null,
        department: viewOptions.meta?.department || null,
        generatedBy: viewOptions.meta?.name || null,
      };
      setGeneratedMetadata(nextMeta);

    } catch (error: any) {
      console.error("Preview Generation Error:", error);
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Generation Failed",
        message: error?.message || "Could not build the report for the selected dates.",
        confirmText: "Back",
        onConfirm: () => {
          setAlertConfig((prev: any) => ({ ...prev, visible: false }));
          router.back();
        },
      });
    } finally { setLoading(false); }
  }, [date, endDate, formattedPeriod, generatedAt, router, startDate, storageFileName, viewOptions]);

  useEffect(() => { generateFile(); }, [generateFile]);

  const handleShare = async () => {
    if (fileUri) {
      await Sharing.shareAsync(fileUri, {
        mimeType:
          viewOptions.format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Share Report",
      });
    }
  };

  const handleSavePress = async () => {
    if (!fileUri) return;
    try {
      setLoading(true);
      setLoadingMsg("Saving Report...");
      
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const savedFile = await saveReportFileOffline({
        sourceUri: fileUri,
        fileName: storageFileName,
        fileType: viewOptions.format,
      });
      const finalInfo = await getSafeFileInfo(savedFile.filePath);

      const savedMetadata = {
        ...generatedMetadata,
        fileName: savedFile.fileName,
        format: viewOptions.format || "pdf",
        reportDate: formattedPeriod,
        generatedAt: generatedAt.toISOString(),
      };

      const reportData = buildSavedReportRecord({
        reportId,
        userId: user.id,
        title: finalReportTitle,
        filePath: savedFile.filePath,
        fileSize: finalInfo.size,
        format: viewOptions.format || "pdf",
        createdAt: generatedAt,
        periodKey: formattedPeriod,
        metadata: savedMetadata,
        isSynced: false,
      });

      await saveReportLocal(reportData, { queueSync: true, synced: false });

      setAlertConfig({
        visible: true, type: "success", title: "Report Saved",
        message: "Your report has been saved to this device and queued for cloud backup when sync is available.", 
        cancelText: "View", confirmText: "Done",
        onCancel: () => {
          setAlertConfig((prev: any) => ({ ...prev, visible: false }));
          router.dismissAll();
          setTimeout(() => { router.push("/reports/saved-reports"); }, 350); 
        },
        onConfirm: () => { setAlertConfig((prev: any) => ({ ...prev, visible: false })); router.dismissAll(); },
      });
    } catch (error) {
      console.error("Save Error:", error);
      setAlertConfig({
        visible: true, type: "error", title: "Save Failed", message: "Could not save the report to Documents/DART/Reports. Please try again.", confirmText: "OK",
        onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
      });
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top", "bottom"]}>
      <ModernAlert {...alertConfig} />
      <Header 
        title="Report Summary" 
        rightElement={
          <TouchableOpacity onPress={handleShare} disabled={loading || !fileUri} style={{ padding: 8, opacity: loading || !fileUri ? 0.5 : 1 }}>
            <HugeiconsIcon icon={Share08Icon} size={24} color={theme.colors.text} />
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        {loading ? (
          <LoadingScreen message={`${loadingMsg} ${loadingProgress}%`} />
        ) : (
          <View style={styles.successContainer}>
              <View style={[styles.iconGlow, { backgroundColor: theme.colors.success + '15' }]}>
                  <View style={[styles.iconCircle, { backgroundColor: theme.colors.success }]}>
                      <HugeiconsIcon icon={DocumentValidationIcon} size={42} color="#fff" />
                  </View>
              </View>

              <Text style={[styles.mainTitle, { color: theme.colors.text }]}>Your Report is Ready!</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Your report is ready to save as a device file named `DART Report - Date - Time`, and it will be queued for backup after saving.</Text>

              <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <View style={styles.cardHeader}>
                      <HugeiconsIcon icon={File02Icon} size={20} color={theme.colors.primary} />
                      <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Document Details</Text>
                  </View>
                  <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                  <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>File Name</Text>
                      <MarqueeText text={storageFileName} style={[styles.detailValue, { color: theme.colors.text }]} />
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>File Type</Text>
                      <View style={[styles.badge, { backgroundColor: theme.colors.primary + '15' }]}>
                          <Text style={[styles.badgeText, { color: theme.colors.primary }]}>
                            {viewOptions.format === 'pdf' ? 'PDF Document' : 'Excel Spreadsheet'}
                          </Text>
                      </View>
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Report Date</Text>
                      <Text style={[styles.detailValue, { color: theme.colors.text }]}>{formattedPeriod}</Text>
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Included Days</Text>
                      <Text style={[styles.detailValue, { color: theme.colors.text }]}>{reportSummary.totalDays}</Text>
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Total Hours</Text>
                      <Text style={[styles.detailValue, { color: theme.colors.text }]}>{reportSummary.totalHoursText}</Text>
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Generated On</Text>
                      <Text style={[styles.detailValue, { color: theme.colors.text }]}>{format(generatedAt, "MMM d, yyyy \u2022 h:mm a")}</Text>
                  </View>
                  <View style={[styles.detailRow, { marginBottom: 0 }]}>
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>File Size</Text>
                      <Text style={[styles.detailValue, { color: theme.colors.text }]}>{formatBytes(fileSize)}</Text>
                  </View>
              </View>
          </View>
        )}
      </View>

      {!loading && fileUri && (
        <Footer>
          <Button title="Save Report" onPress={handleSavePress} variant="primary" disabled={loading || !fileUri} icon={<HugeiconsIcon icon={FloppyDiskIcon} size={20} color="#fff" />} style={{ width: "100%" }} />
        </Footer>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  successContainer: { alignItems: 'center', paddingBottom: 20 },
  iconGlow: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', elevation: 5 },
  mainTitle: { fontSize: 24, fontFamily: 'Nunito_700Bold', marginBottom: 8, letterSpacing: -0.5 },
  subtitle: { fontSize: 15, fontFamily: 'Nunito_500Medium', textAlign: 'center', lineHeight: 22, marginBottom: 32, paddingHorizontal: 16 },
  summaryCard: { width: '100%', borderWidth: 1, borderRadius: 20, padding: 20, elevation: 2 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  cardTitle: { fontSize: 15, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: 1, width: '100%', marginBottom: 16, opacity: 0.6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  detailLabel: { fontSize: 14, fontFamily: 'Nunito_600SemiBold', flex: 1 },
  detailValue: { fontSize: 14, fontFamily: 'Nunito_700Bold', maxWidth: '65%', textAlign: 'right' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  badgeText: { fontSize: 12, fontFamily: 'Nunito_800ExtraBold' }
});
