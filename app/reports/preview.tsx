// filepath: app/reports/preview.tsx
import {
  DocumentValidationIcon,
  Download01Icon,
  File02Icon,
  FloppyDiskIcon,
  Share08Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { differenceInMinutes, format } from "date-fns";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "../../components/Button";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import ModernAlert from "../../components/ModernAlert";
import { useAppTheme } from "../../constants/theme";
import { useSync } from "../../context/SyncContext";
import { generateUUID, queueSyncItem, saveReportLocal } from "../../lib/database";
import { getDB } from "../../lib/db-client";
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
  const { triggerSync } = useSync();

  const [fileUri, setFileUri] = useState<string | null>(null);
  const [fileSize, setFileSize] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadingMsg, setLoadingMsg] = useState("Generating Report...");
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  
  const [reportTimestamp] = useState(() => Date.now().toString());

  const viewOptions = useMemo(() => config ? JSON.parse(config as string) : {}, [config]);

  const formattedPeriod = useMemo(() => {
      if (date) return format(new Date(date as string), "MMM dd, yyyy"); 
      
      if (startDate && endDate) {
          const s = new Date(startDate as string);
          const e = new Date(endDate as string);
          
          const isSameYear = s.getFullYear() === e.getFullYear();
          const isSameMonth = s.getMonth() === e.getMonth() && isSameYear;
          const isFirstDay = s.getDate() === 1;
          const isLastDay = e.getDate() === new Date(e.getFullYear(), e.getMonth() + 1, 0).getDate();

          if (isSameMonth && isFirstDay && isLastDay) return format(s, "MMMM");
          if (isSameMonth) return `${format(s, "MMM dd")} - ${format(e, "dd, yyyy")}`;
          if (isSameYear) return `${format(s, "MMM dd")} - ${format(e, "MMM dd, yyyy")}`;
          
          return `${format(s, "MMM dd, yyyy")} - ${format(e, "MMM dd, yyyy")}`;
      }
      return viewOptions.meta?.period || 'Report';
  }, [startDate, endDate, date, viewOptions]);

  const finalReportName = `ACCOMPLISHMENT_REPORT_${reportTimestamp}`;
  const displayFileName = `${finalReportName}.${viewOptions.format === 'pdf' ? 'pdf' : 'xlsx'}`;

  const generateFile = useCallback(async () => {
    setLoading(true);
    setLoadingMsg("Generating Report...");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const job: any = await ReportService.getActiveJob(user.id);
      let items: any = { attendance: [], tasks: [] };

      if (startDate && endDate) {
        items = await ReportService.getReportRange(user.id, job?.id || null, startDate as string, endDate as string);
      } else if (date) {
        const res = await ReportService.getDailyReport(user.id, date as string);
        items = { attendance: res.attendance ? [res.attendance] : [], tasks: res.tasks };
      }

      const dates = new Set([
        ...(items.attendance || []).map((a: any) => a.date),
        ...(items.tasks || []).map((t: any) => t.date),
      ]);

      const processedData = Array.from(dates)
        .sort()
        .map((d) => {
          const att = (items.attendance || []).find((a: any) => a.date === d);
          const dayTasks = (items.tasks || []).filter((t: any) => t.date === d).map((t: any) => {
              let images: string[] = [];
              if (viewOptions.includeDocs && t.image_url) {
                try {
                  const raw = t.image_url.trim();
                  if (raw.startsWith("[")) {
                    const parsed = JSON.parse(raw);
                    images = Array.isArray(parsed) ? parsed : [raw];
                  } else images = [raw];
                } catch { images = [t.image_url]; }
              }
              return { ...t, images };
            });

          let durationTxt = "--";
          if (att?.clock_in && att?.clock_out) {
            const start = new Date(att.clock_in);
            const end = new Date(att.clock_out);
            let diff = differenceInMinutes(end, start);
            
            if (viewOptions.timeFormat === "round_15") diff = Math.round(diff / 15) * 15;
            else if (viewOptions.timeFormat === "round_30") diff = Math.round(diff / 30) * 30;
            else if (viewOptions.timeFormat === "round_60") diff = Math.round(diff / 60) * 60;

            if (viewOptions.timeFormat === "decimal") durationTxt = (diff / 60).toFixed(2) + "h";
            else {
              const h = Math.floor(diff / 60);
              const m = diff % 60;
              durationTxt = `${h}h ${m > 0 ? `${m}m` : ""}`;
            }
          }

          const dateObj = new Date(d as string);
          let formattedDate = d;
          try {
            formattedDate = format(dateObj, viewOptions.dateFormat || "MM/dd/yyyy");
            if (viewOptions.includeDay) formattedDate += `\n${format(dateObj, "EEEE")}`;
          } catch { formattedDate = d as string; }

          return {
            date: formattedDate, clockIn: att?.clock_in ? format(new Date(att.clock_in), "h:mm a") : "--:--",
            clockOut: att?.clock_out ? format(new Date(att.clock_out), "h:mm a") : "--:--",
            duration: durationTxt, status: att?.status, remarks: att?.remarks, summary: dayTasks,
          };
        });

      const meta = {
        userName: viewOptions.meta?.name, userTitle: viewOptions.meta?.title, company: viewOptions.meta?.company,
        department: viewOptions.includeDept ? viewOptions.meta?.department : undefined, reportTitle: "ACCOMPLISHMENT REPORT",
        period: viewOptions.meta?.period, signatureUri: viewOptions.meta?.signature,
        secondaryName: viewOptions.meta?.secondaryName, secondaryTitle: viewOptions.meta?.secondaryTitle,
        secondarySignatureUri: viewOptions.meta?.secondarySignature, style: viewOptions.style,
        paperSize: viewOptions.paperSize, columns: viewOptions.columns, dateFormat: viewOptions.dateFormat,
      };

      let uri = "";
      if (viewOptions.format === "pdf") uri = await generateReport({ ...meta, data: processedData });
      else uri = await exportToExcel({ ...meta, data: processedData, fileName: finalReportName });

      setFileUri(uri);
      const info = await FileSystem.getInfoAsync(uri);
      if (info.exists) setFileSize(info.size);

    } catch (error) { console.error("Preview Generation Error:", error); } finally { setLoading(false); }
  }, [date, endDate, startDate, viewOptions, finalReportName]);

  useEffect(() => { generateFile(); }, [generateFile]);

  const handleShare = async () => {
    if (fileUri) {
      await Sharing.shareAsync(fileUri, {
        mimeType: viewOptions.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Share Report",
      });
    }
  };

  const handleSavePress = async () => {
      if (!fileUri) return;
      setLoading(true);
      setLoadingMsg("Saving Report...");
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) return;

        const db = await getDB();
        const existing: any = await db.getFirstAsync(
            "SELECT id FROM saved_reports WHERE user_id = ? AND title = ? AND file_type = ?",
            [user.id, finalReportName, viewOptions.format]
        );

        if (existing) {
            setAlertConfig({
                visible: true, type: "warning", title: "File Already Exists",
                message: `A ${viewOptions.format.toUpperCase()} report named "${finalReportName}" already exists. Do you want to replace it?`,
                confirmText: "Replace", cancelText: "Cancel",
                onConfirm: () => { setAlertConfig((prev: any) => ({ ...prev, visible: false })); executeSave(existing.id); },
                onCancel: () => { setAlertConfig((prev: any) => ({ ...prev, visible: false })); setLoading(false); }
            });
        } else executeSave(); 
      } catch (error) { console.error("Duplicate Check Error:", error); setLoading(false); }
  };

  const executeSave = async (overwriteId?: string) => {
    try {
      setLoading(true);
      setLoadingMsg("Saving Report...");
      
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const ext = viewOptions.format === "pdf" ? "pdf" : "xlsx";
      const mimeType = viewOptions.format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      let destPath = "";

      // Safely move file to configured Android SAF Directory
      if (Platform.OS === 'android') {
          const safUri = await AsyncStorage.getItem('reports_directory_uri');
          if (safUri) {
              try {
                  const base64Data = await FileSystem.readAsStringAsync(fileUri!, { encoding: 'base64' });
                  const newUri = await FileSystem.StorageAccessFramework.createFileAsync(safUri, finalReportName, mimeType);
                  await FileSystem.writeAsStringAsync(newUri, base64Data, { encoding: 'base64' });
                  destPath = newUri;
              } catch (e) {
                  console.error("SAF Save Error, falling back to internal space.", e);
              }
          }
      }

      // Fallback if iOS or if Android SAF fails
      if (!destPath) {
          const reportsDir = `${FileSystem.documentDirectory}DART/Reports/`;
          const dirInfo = await FileSystem.getInfoAsync(reportsDir);
          if (!dirInfo.exists) {
              await FileSystem.makeDirectoryAsync(reportsDir, { intermediates: true });
          }
          destPath = `${reportsDir}${finalReportName}.${ext}`;
          if (overwriteId) { try { await FileSystem.deleteAsync(destPath, { idempotent: true }); } catch {} }
          await FileSystem.copyAsync({ from: fileUri!, to: destPath });
      }

      // Re-verify actual file size at the final destination
      let finalFileSize = 0;
      try {
          const finalInfo = await FileSystem.getInfoAsync(destPath);
          if (finalInfo.exists) finalFileSize = finalInfo.size;
      } catch (e) { console.log(e); }

      const reportMeta = {
          reportDate: formattedPeriod,
          startDate: startDate ? new Date(startDate as string).toISOString() : (date ? new Date(date as string).toISOString() : new Date().toISOString()),
          endDate: endDate ? new Date(endDate as string).toISOString() : (date ? new Date(date as string).toISOString() : new Date().toISOString())
      };

      const reportId = overwriteId || generateUUID();
      const reportData = {
        id: reportId, user_id: user.id, title: finalReportName, file_path: destPath,
        file_type: viewOptions.format, file_size: finalFileSize,
        created_at: new Date().toISOString(), remote_url: null, file_url: null,
        period_key: formattedPeriod, 
        metadata: JSON.stringify(reportMeta),
        is_synced: 0 // Specifically mark as 0 so background worker picks it up
      };

      // 1. Instant local SQLite Save
      await saveReportLocal(reportData);
      
      // 2. Queue for background cloud upload
      await queueSyncItem("saved_reports", reportId, overwriteId ? "UPDATE" : "INSERT", reportData);
      
      // 3. Fire and forget the sync system
      triggerSync();

      // 4. Immediately notify user and proceed to next screen without waiting for the internet!
      setAlertConfig({
        visible: true, type: "success", title: overwriteId ? "Report Replaced" : "Report Saved",
        message: "Your report has been saved to your device. Cloud backup will process seamlessly in the background.", 
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
        visible: true, type: "error", title: "Save Failed", message: "Could not save the report. Please try again.", confirmText: "OK",
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
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ marginTop: 16, color: theme.colors.textSecondary, fontFamily: 'Nunito_600SemiBold' }}>{loadingMsg}</Text>
          </View>
        ) : (
          <View style={styles.successContainer}>
              <View style={[styles.iconGlow, { backgroundColor: theme.colors.success + '15' }]}>
                  <View style={[styles.iconCircle, { backgroundColor: theme.colors.success }]}>
                      <HugeiconsIcon icon={DocumentValidationIcon} size={42} color="#fff" />
                  </View>
              </View>

              <Text style={[styles.mainTitle, { color: theme.colors.text }]}>Your Report is Ready!</Text>
              <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>Your accomplishment document has been successfully compiled and is ready to be saved.</Text>

              <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                  <View style={styles.cardHeader}>
                      <HugeiconsIcon icon={viewOptions.format === 'pdf' ? File02Icon : Download01Icon} size={20} color={theme.colors.primary} />
                      <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Document Details</Text>
                  </View>
                  <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

                  <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>File Name</Text>
                      <MarqueeText text={displayFileName} style={[styles.detailValue, { color: theme.colors.text }]} />
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>File Type</Text>
                      <View style={[styles.badge, { backgroundColor: theme.colors.primary + '15' }]}>
                          <Text style={[styles.badgeText, { color: theme.colors.primary }]}>{viewOptions.format === 'pdf' ? 'PDF Document' : 'Excel Spreadsheet'}</Text>
                      </View>
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Report Date</Text>
                      <Text style={[styles.detailValue, { color: theme.colors.text }]}>{formattedPeriod}</Text>
                  </View>
                  <View style={styles.detailRow}>
                      <Text style={[styles.detailLabel, { color: theme.colors.textSecondary }]}>Generated On</Text>
                      <Text style={[styles.detailValue, { color: theme.colors.text }]}>{format(new Date(), "MMM d, yyyy \u2022 h:mm a")}</Text>
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
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