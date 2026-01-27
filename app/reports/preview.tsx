import {
  CheckmarkCircle03Icon,
  Download01Icon,
  File02Icon,
  Share01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { differenceInMinutes, format } from "date-fns";
import * as FileSystem from "expo-file-system/legacy";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import Button from "../../components/Button";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import ModernAlert from "../../components/ModernAlert";
import { useAppTheme } from "../../constants/theme";
import { useSync } from "../../context/SyncContext";
import {
  checkReportTitleExists,
  generateUUID,
  queueSyncItem,
  saveReportLocal,
} from "../../lib/database";
import { supabase } from "../../lib/supabase";
import { ReportService } from "../../services/ReportService";
import { exportToExcel } from "../../utils/csvExporter";
import { generateReport } from "../../utils/reportGenerator";

export default function PreviewReportScreen() {
  const router = useRouter();
  const theme = useAppTheme();
  const { startDate, endDate, date, config } = useLocalSearchParams();
  const { triggerSync } = useSync();

  const [fileUri, setFileUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

  const generateFile = useCallback(async () => {
    setLoading(true);
    try {
      const options = config ? JSON.parse(config as string) : {};
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const job: any = await ReportService.getActiveJob(user.id);
      let items: any = { attendance: [], tasks: [] };

      if (startDate && endDate) {
        items = await ReportService.getReportRange(
          user.id,
          job?.id,
          startDate as string,
          endDate as string,
        );
      } else if (date) {
        const res = await ReportService.getDailyReport(user.id, date as string);
        items = {
          attendance: res.attendance ? [res.attendance] : [],
          tasks: res.tasks,
        };
      }

      const dates = new Set([
        ...(items.attendance || []).map((a: any) => a.date),
        ...(items.tasks || []).map((t: any) => t.date),
      ]);

      const processedData = Array.from(dates)
        .sort()
        .map((d) => {
          const att = (items.attendance || []).find((a: any) => a.date === d);
          const dayTasks = (items.tasks || [])
            .filter((t: any) => t.date === d)
            .map((t: any) => {
              let images: string[] = [];
              if (options.includeDocs && t.image_url) {
                try {
                  const raw = t.image_url.trim();
                  if (raw.startsWith("[")) {
                    const parsed = JSON.parse(raw);
                    images = Array.isArray(parsed) ? parsed : [raw];
                  } else {
                    images = [raw];
                  }
                } catch {
                  images = [t.image_url];
                }
              }
              return { ...t, images };
            });

          let durationTxt = "--";
          if (att?.clock_in && att?.clock_out) {
            const start = new Date(att.clock_in);
            const end = new Date(att.clock_out);
            let diff = differenceInMinutes(end, start);
            if (options.timeFormat === "round_15")
              diff = Math.round(diff / 15) * 15;
            else if (options.timeFormat === "round_30")
              diff = Math.round(diff / 30) * 30;
            else if (options.timeFormat === "round_60")
              diff = Math.round(diff / 60) * 60;

            if (options.timeFormat === "decimal")
              durationTxt = (diff / 60).toFixed(2) + "h";
            else {
              const h = Math.floor(diff / 60);
              const m = diff % 60;
              durationTxt = `${h}h ${m > 0 ? `${m}m` : ""}`;
            }
          }

          const dateObj = new Date(d as string);
          let formattedDate = d;
          try {
            formattedDate = format(dateObj, options.dateFormat || "MM/dd/yyyy");
            if (options.includeDay)
              formattedDate += `\n${format(dateObj, "EEEE")}`;
          } catch (e) {
            formattedDate = d as string;
          }

          return {
            date: formattedDate,
            clockIn: att?.clock_in
              ? format(new Date(att.clock_in), "h:mm a")
              : "--:--",
            clockOut: att?.clock_out
              ? format(new Date(att.clock_out), "h:mm a")
              : "--:--",
            duration: durationTxt,
            status: att?.status,
            remarks: att?.remarks,
            summary: dayTasks,
          };
        });

      const meta = {
        userName: options.meta.name,
        userTitle: options.meta.title,
        company: options.meta.company,
        department: options.includeDept ? options.meta.department : undefined,
        reportTitle: "ACCOMPLISHMENT REPORT",
        period: options.meta.period,
        signatureUri: options.meta.signature,
        style: options.style,
        paperSize: options.paperSize,
        columns: options.columns,
        dateFormat: options.dateFormat,
      };

      let uri = "";
      if (options.format === "pdf") {
        uri = await generateReport({ ...meta, data: processedData });
      } else {
        uri = await exportToExcel({
          ...meta,
          data: processedData,
          fileName: options.meta.period,
        });
      }
      setFileUri(uri);
    } catch (e) {
      console.error("Preview Generation Error:", e);
    } finally {
      setLoading(false);
    }
  }, [config, date, endDate, startDate]);

  useEffect(() => {
    generateFile();
  }, [generateFile]);

  const handleShare = async () => {
    if (fileUri) {
      const options = config ? JSON.parse(config as string) : {};
      await Sharing.shareAsync(fileUri, {
        mimeType:
          options.format === "pdf"
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        dialogTitle: "Report Options",
      });
    }
  };

  const handleSave = async () => {
    if (!fileUri) return;
    setLoading(true);
    try {
      const options = config ? JSON.parse(config as string) : {};
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const reportTitle = options.meta.period;
      const fileFormat = options.format;
      const exists = await checkReportTitleExists(
        reportTitle,
        fileFormat,
        user.id,
      );

      if (exists) {
        setAlertConfig({
          visible: true,
          type: "warning",
          title: "Duplicate File",
          message: `A ${fileFormat.toUpperCase()} report named "${reportTitle}" already exists.`,
          confirmText: "OK",
          onConfirm: () =>
            setAlertConfig((prev: any) => ({ ...prev, visible: false })),
        });
        setLoading(false);
        return;
      }

      const safeFilename = reportTitle.replace(/[^a-zA-Z0-9 _-]/g, "_");
      const ext = fileFormat === "pdf" ? "pdf" : "xlsx";
      const fileName = `${safeFilename}.${ext}`;
      const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      const reportsDir = (baseDir || "") + "reports/";
      await FileSystem.makeDirectoryAsync(reportsDir, { intermediates: true });
      const permUri = reportsDir + fileName;

      await FileSystem.copyAsync({ from: fileUri, to: permUri });
      const info = await FileSystem.getInfoAsync(permUri);

      const reportId = generateUUID();
      const reportData = {
        id: reportId,
        user_id: user.id,
        title: reportTitle,
        file_path: permUri,
        file_type: fileFormat,
        file_size: info.exists ? info.size : 0,
        created_at: new Date().toISOString(),
        remote_url: null,
      };

      await saveReportLocal(reportData);
      await queueSyncItem("saved_reports", reportId, "INSERT", reportData);
      triggerSync();

      setAlertConfig({
        visible: true,
        type: "success",
        title: "Report Saved",
        message: "Your report has been saved successfully.",
        cancelText: "View",
        confirmText: "Done",
        onCancel: () => {
          setAlertConfig((prev: any) => ({ ...prev, visible: false }));
          // Use replace to swap current screen with saved reports
          // This prevents triggering 'beforeRemove' on previous screens (Unsaved Changes)
          router.replace("/reports/saved-reports");
        },
        onConfirm: () => {
          setAlertConfig((prev: any) => ({ ...prev, visible: false }));
          router.dismissAll();
          router.replace("/(tabs)/reports");
        },
      });
    } catch (e) {
      console.error("Save Error:", e);
      setAlertConfig({
        visible: true,
        type: "error",
        title: "Save Failed",
        message: "Could not save the report. Please try again.",
        confirmText: "OK",
        onConfirm: () =>
          setAlertConfig((prev: any) => ({ ...prev, visible: false })),
      });
    } finally {
      setLoading(false);
    }
  };

  const renderPlaceholder = (type: "pdf" | "xlsx") => (
    <View style={styles.center}>
      <View
        style={[
          styles.iconCircle,
          {
            backgroundColor:
              type === "pdf" ? theme.colors.primary : theme.colors.success,
          },
        ]}
      >
        <HugeiconsIcon
          icon={type === "pdf" ? File02Icon : Download01Icon}
          size={48}
          color="#fff"
        />
      </View>
      <Text style={[styles.successTitle, { color: theme.colors.text }]}>
        {type === "pdf" ? "PDF Document Ready" : "Excel File Ready"}
      </Text>
      <Text
        style={{
          color: theme.colors.textSecondary,
          textAlign: "center",
          marginTop: 8,
          paddingHorizontal: 40,
        }}
      >
        {type === "pdf"
          ? "Preview is available below. Save the report to access it offline."
          : "Spreadsheets cannot be previewed here. Save the report to open it."}
      </Text>
    </View>
  );

  const viewOptions = config ? JSON.parse(config as string) : {};

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      edges={["top", "bottom"]}
    >
      <ModernAlert {...alertConfig} />
      <Header
        title="Preview"
        rightElement={
          <TouchableOpacity
            onPress={handleShare}
            disabled={loading || !fileUri}
            style={{ padding: 8, opacity: loading || !fileUri ? 0.5 : 1 }}
          >
            <HugeiconsIcon
              icon={Share01Icon}
              size={24}
              color={theme.colors.text}
            />
          </TouchableOpacity>
        }
      />

      <View style={styles.content}>
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={{ marginTop: 16, color: theme.colors.textSecondary }}>
              Generating File...
            </Text>
          </View>
        ) : (
          <View style={[styles.previewFrame, { backgroundColor: "#f2f2f2" }]}>
            {viewOptions.format === "pdf" &&
            Platform.OS === "ios" &&
            fileUri ? (
              <WebView
                source={{ uri: fileUri }}
                style={{ flex: 1 }}
                originWhitelist={["*"]}
                scalesPageToFit={true}
              />
            ) : (
              renderPlaceholder(viewOptions.format)
            )}
          </View>
        )}
      </View>

      <Footer>
        <Button
          title="Save Report"
          onPress={handleSave}
          variant="primary"
          disabled={loading || !fileUri}
          icon={
            <HugeiconsIcon
              icon={CheckmarkCircle03Icon}
              size={20}
              color="#fff"
            />
          }
          style={{ width: "100%" }}
        />
      </Footer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  previewFrame: {
    flex: 1,
    margin: 16,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  successTitle: { fontSize: 20, fontWeight: "800" },
});