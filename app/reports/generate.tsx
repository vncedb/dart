// filepath: app/reports/generate.tsx
import {
  ArrowRight01Icon,
  Briefcase02Icon,
  Building04Icon,
  Calendar03Icon,
  CheckListIcon,
  Clock01Icon,
  CustomizeIcon,
  Image01Icon,
  PrinterIcon,
  Tick01Icon,
  UserCircleIcon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import Button from "../../components/Button";
import Footer from "../../components/Footer";
import Header from "../../components/Header";
import ImageViewer from "../../components/ImageViewer";
import LoadingOverlay from "../../components/LoadingOverlay";
import LoadingScreen from "../../components/LoadingScreen";
import { ModernAlert } from "../../components/ModernUI";
import SelectDropdown from "../../components/SelectDropdown";
import { useAppTheme } from "../../constants/theme";
import { getDB } from "../../lib/db-client";
import { summarizeAttendances } from "../../lib/report-helpers";
import { supabase } from "../../lib/supabase";
import { ReportService } from "../../services/ReportService";

const SETTINGS_KEY = "report_generation_settings";

export default function GenerateReportScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useAppTheme();
  
  const params = useLocalSearchParams();
  const toSingleParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const startDate = toSingleParam(params.startDate);
  const endDate = toSingleParam(params.endDate);
  const date = toSingleParam(params.date);

  // --- Data State ---
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [activeJob, setActiveJob] = useState<any>(null);
  const [periodLabel, setPeriodLabel] = useState("");
  const [previewImages, setPreviewImages] = useState<{ uri: string; date: string }[]>([]);

  // --- Config State (Default Toggled ON) ---
  const [formatType, setFormatType] = useState<"pdf" | "xlsx">("pdf");
  const [paperSize, setPaperSize] = useState<"Letter" | "A4" | "Legal">("Letter");
  const [reportStyle, setReportStyle] = useState<"corporate" | "creative" | "minimal">("corporate");
  const [dateFormat, setDateFormat] = useState("MM/dd/yyyy");
  const [timeFormat, setTimeFormat] = useState("exact_hm");

  const [includeDocs, setIncludeDocs] = useState(true);
  const [includeSecondarySignee, setIncludeSecondarySignee] = useState(false);
  const [includeRemarks, setIncludeRemarks] = useState(true);

  // --- Meta State ---
  const [customName, setCustomName] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [department, setDepartment] = useState("");
  
  const [secondaryName, setSecondaryName] = useState("");
  const [secondaryTitle, setSecondaryTitle] = useState("");

  const [initialSettings, setInitialSettings] = useState<string>("");
  const [shouldSaveSettings, setShouldSaveSettings] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [viewerVisible, setViewerVisible] = useState(false);
  const [activeImage, setActiveImage] = useState<{ uri: string; date: string } | null>(null);

  const today = new Date();
  const isProceeding = useRef(false);

  useFocusEffect(
    useCallback(() => {
      isProceeding.current = false;
      setGenerating(false); 
    }, [])
  );

  useEffect(() => {
    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      if (isProceeding.current) return;

      const currentSettings = JSON.stringify({
        formatType, paperSize, reportStyle, dateFormat, timeFormat,
        includeDocs, includeSecondarySignee, includeRemarks,
        customName, customTitle, companyName, department, secondaryName, secondaryTitle
      });

      if (loading || currentSettings === initialSettings) return;

      e.preventDefault();
      setAlertConfig({
        visible: true, type: "warning", title: "Unsaved Changes",
        message: "You have modified the report settings. Do you want to leave without generating?",
        confirmText: "Leave", cancelText: "Stay",
        onConfirm: () => {
          setAlertConfig((p: any) => ({ ...p, visible: false }));
          navigation.dispatch(e.data.action);
        },
        onCancel: () => setAlertConfig((p: any) => ({ ...p, visible: false })),
        onDismiss: () => setAlertConfig((p: any) => ({ ...p, visible: false })),
      });
    });
    return unsubscribe;
  }, [
    navigation, loading, initialSettings, formatType, paperSize, reportStyle,
    dateFormat, timeFormat, includeDocs, includeSecondarySignee, includeRemarks,
    customName, customTitle, companyName, department, secondaryName, secondaryTitle
  ]);

  useEffect(() => {
    let isMounted = true;
    const init = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;
        if (!user) { if (isMounted) setLoading(false); return; }
        const userId = user.id;
        const db = await getDB();

        const [profileRes, jobRes, settingsRes] = await Promise.all([
          db.getFirstAsync("SELECT * FROM profiles WHERE id = ?", [userId]),
          ReportService.getActiveJob(userId),
          AsyncStorage.getItem(SETTINGS_KEY),
        ]);

        if (!isMounted) return;
        const profile: any = profileRes;
        const job: any = jobRes;
        setActiveJob(job);

        let currentName = profile?.full_name || "";
        let currentTitle = job?.title || profile?.title || "";
        let currentCompany = job?.company || profile?.company || "";
        let currentDept = job?.department || "";

        let sName = "";
        let sTitle = "";
        let sInc = false;

        if (settingsRes) {
          const loaded = JSON.parse(settingsRes);
          if (loaded.formatType === "pdf" || loaded.formatType === "xlsx") {
            setFormatType(loaded.formatType);
          }
          if (loaded.paperSize) setPaperSize(loaded.paperSize);
          if (loaded.reportStyle) setReportStyle(loaded.reportStyle);
          if (loaded.dateFormat) setDateFormat(loaded.dateFormat);
          if (loaded.timeFormat) setTimeFormat(loaded.timeFormat);
          if (loaded.includeDocs !== undefined) setIncludeDocs(loaded.includeDocs);
          if (loaded.includeRemarks !== undefined) setIncludeRemarks(loaded.includeRemarks);
          else if (loaded.includeActivities !== undefined) setIncludeRemarks(loaded.includeActivities);
          if (loaded.customName) currentName = loaded.customName;
          if (loaded.customTitle) currentTitle = loaded.customTitle;
          if (loaded.companyName) currentCompany = loaded.companyName;
          if (loaded.department) currentDept = loaded.department;

          if (loaded.includeSecondarySignee !== undefined) sInc = loaded.includeSecondarySignee;
          if (loaded.secondaryName) sName = loaded.secondaryName;
          if (loaded.secondaryTitle) sTitle = loaded.secondaryTitle;
        }

        setCustomName(currentName);
        setCustomTitle(currentTitle);
        setCompanyName(currentCompany);
        setDepartment(currentDept);
        setIncludeSecondarySignee(sInc);
        setSecondaryName(sName);
        setSecondaryTitle(sTitle);

        setInitialSettings(
          JSON.stringify({
            formatType: settingsRes ? JSON.parse(settingsRes).formatType : "pdf",
            paperSize: settingsRes ? JSON.parse(settingsRes).paperSize : "Letter",
            reportStyle: settingsRes ? JSON.parse(settingsRes).reportStyle : "corporate",
            dateFormat: settingsRes ? JSON.parse(settingsRes).dateFormat : "MM/dd/yyyy",
            timeFormat: settingsRes ? JSON.parse(settingsRes).timeFormat : "exact_hm",
            includeDocs: settingsRes ? JSON.parse(settingsRes).includeDocs : true,
            includeRemarks:
              settingsRes
                ? (() => {
                    const parsed = JSON.parse(settingsRes);
                    if (parsed.includeRemarks !== undefined) return parsed.includeRemarks;
                    if (parsed.includeActivities !== undefined) return parsed.includeActivities;
                    return true;
                  })()
                : true,
            includeSecondarySignee: sInc,
            customName: currentName, customTitle: currentTitle, companyName: currentCompany, department: currentDept,
            secondaryName: sName, secondaryTitle: sTitle
          })
        );

        let items: any = { attendance: [], tasks: [] };

        if (startDate && endDate) {
          setPeriodLabel(`${format(new Date(startDate as string), "MMM d")} - ${format(new Date(endDate as string), "MMM d, yyyy")}`);
          items = await ReportService.getReportRange(userId, job?.id || null, startDate as string, endDate as string);
        } else if (date) {
          setPeriodLabel(format(new Date(date as string), "MMM dd, yyyy"));
          const res = await ReportService.getDailyReport(userId, date as string);
          items = { attendance: res.attendance || [], tasks: res.tasks };
        }

        setAttendanceRecords(items.attendance || []);

        const datesFound = new Set<string>();
        (items.attendance || []).forEach((a: any) => datesFound.add(a.date));
        (items.tasks || []).forEach((t: any) => datesFound.add(t.date));
        
        const sortedDates = Array.from(datesFound).sort((a, b) => new Date(a).getTime() - new Date(b).getTime());
        setAvailableDates(sortedDates);
        setSelectedDates(new Set(sortedDates));

        const imagesFound: { uri: string; date: string }[] = [];
        (items.tasks || []).forEach((t: any) => {
          if (t.image_url) {
            try {
              if (t.image_url.trim().startsWith("[")) {
                const parsed = JSON.parse(t.image_url);
                if (Array.isArray(parsed)) parsed.forEach((uri: string) => imagesFound.push({ uri, date: t.date }));
              } else {
                imagesFound.push({ uri: t.image_url, date: t.date });
              }
            } catch {
              imagesFound.push({ uri: t.image_url, date: t.date });
            }
          }
        });
        setPreviewImages(imagesFound);
      } catch (err) {
        console.error("Generate Init Error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    init();
    return () => { isMounted = false; };
  }, [startDate, endDate, date]);

  const hasSettingsChanged = () => {
    return JSON.stringify({
      formatType, paperSize, reportStyle, dateFormat, timeFormat,
      includeDocs, includeSecondarySignee, includeRemarks,
      customName, customTitle, companyName, department, secondaryName, secondaryTitle
    }) !== initialSettings;
  };

  const selectedAttendanceSummary = useMemo(() => {
    const filteredAttendance = attendanceRecords.filter((attendance) => selectedDates.has(attendance.date));
    return summarizeAttendances(filteredAttendance, timeFormat as any, { breakSchedule: activeJob?.break_schedule });
  }, [activeJob?.break_schedule, attendanceRecords, selectedDates, timeFormat]);

  const handleProceed = async () => {
    if (selectedDates.size === 0) {
      setAlertConfig({
        visible: true, type: "warning", title: "No Data",
        message: "There are no dates selected to generate for this period.", confirmText: "OK",
        onConfirm: () => setAlertConfig({ visible: false }),
        onDismiss: () => setAlertConfig({ visible: false }),
      });
      return;
    }

    if (!customName.trim() || !customTitle.trim()) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Missing Report Identity",
        message: "Enter your printed name and job title before generating the report.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig({ visible: false }),
        onDismiss: () => setAlertConfig({ visible: false }),
      });
      return;
    }

    if (includeSecondarySignee && (!secondaryName.trim() || !secondaryTitle.trim())) {
      setAlertConfig({
        visible: true,
        type: "warning",
        title: "Approver Details Required",
        message: "Provide both the approver name and title, or turn off the secondary signee option.",
        confirmText: "OK",
        onConfirm: () => setAlertConfig({ visible: false }),
        onDismiss: () => setAlertConfig({ visible: false }),
      });
      return;
    }

    setGenerating(true);

    setTimeout(async () => {
        if (shouldSaveSettings && hasSettingsChanged()) {
          try {
            const settingsToSave = {
              formatType, paperSize, reportStyle, dateFormat, timeFormat,
              includeDocs, includeSecondarySignee, includeRemarks,
              customName, customTitle, companyName, department, secondaryName, secondaryTitle
            };
            await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToSave));
            setInitialSettings(JSON.stringify(settingsToSave));
          } catch (err) { console.log("Failed to save settings", err); }
        }

        isProceeding.current = true;

        router.push({
          pathname: "/reports/preview",
          params: {
            startDate, endDate, date,
            config: JSON.stringify({
              format: formatType, paperSize, style: reportStyle, includeDocs, includeDay: true,
              includeDept: true, dateFormat, timeFormat, 
              columns: { time: true, duration: true, remarks: includeRemarks }, 
              selectedDates: Array.from(selectedDates),
              meta: {
                name: customName, title: customTitle, company: companyName, department: department, period: periodLabel,
                secondaryName: includeSecondarySignee ? secondaryName : undefined,
                secondaryTitle: includeSecondarySignee ? secondaryTitle : undefined,
              },
            }),
          },
        });
    }, 50);
  };

  if (loading) return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top", "bottom"]}>
        <LoadingScreen variant="reports" message="Loading report setup..." />
      </SafeAreaView>
  );

  const pdfColor = "#D91519";
  const excelColor = "#74E16C";
  const renderInputRow = (label: string, icon: any, value: string, setValue: (val: string) => void, placeholder: string) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>{label}</Text>
      <View style={[styles.inputWrapper, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
        <HugeiconsIcon icon={icon} size={20} color={theme.colors.textSecondary} />
        <TextInput value={value} onChangeText={setValue} placeholder={placeholder} placeholderTextColor={theme.colors.textSecondary} style={[styles.inputElement, { color: theme.colors.text }]} />
      </View>
    </View>
  );

  const renderToggleRow = (label: string, icon: any, value: boolean, onToggle: (val: boolean) => void, isLast?: boolean) => (
      <View style={[styles.checkRow, !isLast && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }}>
            <HugeiconsIcon icon={icon} size={18} color={theme.colors.textSecondary} />
          </View>
          <Text style={[styles.checkLabel, { color: theme.colors.text }]}>{label}</Text>
        </View>
        <Switch 
          value={value} 
          onValueChange={onToggle} 
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }} 
          thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (value ? '#FFFFFF' : '#F3F4F6')} 
          style={{ 
            transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.1,
            shadowRadius: 2,
            elevation: 2 
          }}
        />
      </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top", "bottom"]}>
      <Header title="Generate Report" />
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={generating} message="Generating Report..." />

      <ImageViewer visible={viewerVisible} imageUri={activeImage?.uri || null} onClose={() => setViewerVisible(false)} context={{ reportDate: activeImage?.date || date || startDate || null }} />

      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>REPORT SUMMARY</Text>
              <View style={[styles.summaryCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={styles.summaryTopRow}>
                  <View style={styles.summaryField}>
                    <Text style={[styles.summaryEyebrow, { color: theme.colors.textSecondary }]}>Selected Period</Text>
                    <Text style={[styles.summaryPeriod, { color: theme.colors.text }]}>{periodLabel || "Loading..."}</Text>
                  </View>

                  <View style={[styles.summaryField, styles.summaryFieldRight]}>
                    <Text style={[styles.summaryHoursLabel, { color: theme.colors.textSecondary }]}>Total Hours</Text>
                    <Text style={[styles.summaryHoursValue, { color: theme.colors.text }]}>{selectedAttendanceSummary.durationText}</Text>
                  </View>
                </View>

                <View style={[styles.summaryDivider, { backgroundColor: theme.colors.border }]} />

                <SelectDropdown
                  label="Customize Inclusion"
                  multiple
                  value={Array.from(selectedDates)}
                  options={availableDates.map(d => ({ label: format(new Date(d), 'MMMM dd, yyyy'), value: d }))}
                  onChange={(val) => setSelectedDates(new Set(val))}
                  customTrigger={
                    <View
                      pointerEvents="none"
                      style={[
                        styles.customizeTrigger,
                        {
                          backgroundColor: theme.colors.background,
                          borderColor: theme.colors.border,
                        }
                      ]}
                    >
                      <View style={[styles.customizeTriggerIcon, { backgroundColor: theme.colors.primary + '12' }]}>
                        <HugeiconsIcon icon={CustomizeIcon} size={18} color={theme.colors.primary} />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.customizeTriggerTitle, { color: theme.colors.text }]}>Customize Inclusion</Text>
                        <Text style={[styles.customizeTriggerMeta, { color: theme.colors.textSecondary }]}>
                          Choose which logged dates to include in this report.
                        </Text>
                      </View>

                      <View style={styles.customizeTriggerRight}>
                        <Text style={[styles.customizeTriggerCountText, { color: theme.colors.text }]}>
                          {selectedDates.size}/{availableDates.length || 0}
                        </Text>
                        <HugeiconsIcon icon={ArrowRight01Icon} size={16} color={theme.colors.textSecondary} />
                      </View>
                    </View>
                  }
                />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>FILE FORMAT</Text>
              <View style={styles.row}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setFormatType("pdf")} style={[styles.optionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, formatType === "pdf" && { borderColor: pdfColor, backgroundColor: pdfColor + "08" }]}>
                  <Image source={require('../../assets/icons/custom-icons/pdf.png')} style={{ width: 36, height: 36, opacity: formatType === 'pdf' ? 1 : 0.6 }} resizeMode="contain" />
                  <Text style={[styles.optionText, { color: formatType === "pdf" ? pdfColor : theme.colors.text }]}>Adobe PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setFormatType("xlsx")} style={[styles.optionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, formatType === "xlsx" && { borderColor: excelColor, backgroundColor: excelColor + "08" }]}>
                  <Image source={require('../../assets/icons/custom-icons/xlsx.png')} style={{ width: 36, height: 36, opacity: formatType === 'xlsx' ? 1 : 0.6 }} resizeMode="contain" />
                  <Text style={[styles.optionText, { color: formatType === "xlsx" ? excelColor : theme.colors.text }]}>Microsoft Excel</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>CONFIGURATION</Text>
              <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                <SelectDropdown label="Visual Style" value={reportStyle} onChange={setReportStyle} options={[
                    { label: "Corporate Blue", value: "corporate", icon: <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#1e293b" }} /> },
                    { label: "Creative Indigo", value: "creative", icon: <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#4f46e5" }} /> },
                    { label: "Minimal Monochrome", value: "minimal", icon: <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: "#000", borderWidth: 1, borderColor: "#ccc" }} /> },
                  ]} />
                {formatType === "pdf" && (
                  <SelectDropdown label="Paper Format" value={paperSize} onChange={setPaperSize} options={[
                      { label: 'Letter (8.5" x 11")', value: "Letter", icon: <HugeiconsIcon icon={PrinterIcon} size={18} color={theme.colors.text} /> },
                      { label: "A4 (210mm x 297mm)", value: "A4", icon: <HugeiconsIcon icon={PrinterIcon} size={18} color={theme.colors.text} /> },
                      { label: 'Legal (8.5" x 14")', value: "Legal", icon: <HugeiconsIcon icon={PrinterIcon} size={18} color={theme.colors.text} /> },
                    ]} />
                )}
                <SelectDropdown label="Date Format" value={dateFormat} onChange={setDateFormat} options={[
                    { label: `MM/DD/YYYY (${format(today, "MM/dd/yyyy")})`, value: "MM/dd/yyyy", icon: <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.text} /> },
                    { label: `DD/MM/YYYY (${format(today, "dd/MM/yyyy")})`, value: "dd/MM/yyyy", icon: <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.text} /> },
                    { label: `YYYY/MM/DD (${format(today, "yyyy/MM/dd")})`, value: "yyyy/MM/dd", icon: <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.text} /> },
                    { label: `Month Day, Year (${format(today, "MMMM d, yyyy")})`, value: "MMMM d, yyyy", icon: <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.text} /> },
                  ]} />
                <SelectDropdown label="Time & Duration" value={timeFormat} onChange={setTimeFormat} options={[
                    { label: "Exact Duration (8h 12m)", value: "exact_hm", icon: <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.text} /> },
                    { label: "Decimal Hours (8.20h)", value: "decimal", icon: <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.text} /> },
                    { label: "Round to 15 Minutes", value: "round_15", icon: <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.text} /> },
                    { label: "Round to 30 Minutes", value: "round_30", icon: <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.text} /> },
                    { label: "Hourly Rounding", value: "round_60", icon: <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.text} /> },
                  ]} />
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>REPORT CONTENT</Text>
              <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                
                {renderToggleRow("Include Remarks", CheckListIcon, includeRemarks, setIncludeRemarks, formatType !== 'pdf')}
                
                {formatType === "pdf" && (
                  <>
                    <View style={[styles.checkRow]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                         <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }}>
                            <HugeiconsIcon icon={Image01Icon} size={18} color={theme.colors.textSecondary} />
                         </View>
                        <View>
                          <Text style={[styles.checkLabel, { color: theme.colors.text }]}>Include Documentation</Text>
                          {previewImages.length > 0 && <Text style={[styles.checkSub, { color: theme.colors.textSecondary }]}>{previewImages.length} images found</Text>}
                        </View>
                      </View>
                      <Switch 
                        value={includeDocs} 
                        onValueChange={setIncludeDocs} 
                        trackColor={{ false: theme.colors.border, true: theme.colors.primary }} 
                        thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (includeDocs ? '#FFFFFF' : '#F3F4F6')}
                        style={{ 
                          transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.1,
                          shadowRadius: 2,
                          elevation: 2 
                        }}
                      />
                    </View>
                    {includeDocs && previewImages.length > 0 && (
                      <View style={{ padding: 16, paddingTop: 0 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                          {previewImages.map((image, i) => (
                            <TouchableOpacity key={`${image.uri}-${i}`} onPress={() => { setActiveImage(image); setViewerVisible(true); }}>
                              <Image source={{ uri: image.uri }} style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: theme.colors.border }} resizeMode="cover" />
                            </TouchableOpacity>
                          ))}
                        </ScrollView>
                      </View>
                    )}
                  </>
                )}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>DETAILS & AUTHORIZATION</Text>
              
              <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 20, marginBottom: 16 }]}>
                <Text style={[styles.subSectionTitle, { color: theme.colors.text }]}>Company Information</Text>
                {renderInputRow("Organization Name", Building04Icon, companyName, setCompanyName, "Company/Organization")}
                {renderInputRow("Department", UserGroupIcon, department, setDepartment, "Department Name")}

                <View style={[styles.divider, { backgroundColor: theme.colors.border, marginVertical: 24 }]} />

                <Text style={[styles.subSectionTitle, { color: theme.colors.text }]}>Your Information</Text>
                {renderInputRow("Printed Name", UserCircleIcon, customName, setCustomName, "Enter your Name")}
                {renderInputRow("Job Title", Briefcase02Icon, customTitle, setCustomTitle, "Enter your Position")}
              </View>

              <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 20 }]}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: includeSecondarySignee ? 24 : 0 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontFamily: 'Nunito_800ExtraBold', color: theme.colors.text }}>Secondary Signee</Text>
                        <Text style={{ fontSize: 13, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary, marginTop: 4 }}>Include a co-signer or approver</Text>
                    </View>
                    <Switch 
                      value={includeSecondarySignee} 
                      onValueChange={setIncludeSecondarySignee} 
                      trackColor={{ false: theme.colors.border, true: theme.colors.primary }} 
                      thumbColor={Platform.OS === 'ios' ? '#FFFFFF' : (includeSecondarySignee ? '#FFFFFF' : '#F3F4F6')}
                      style={{ 
                        transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }],
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.1,
                        shadowRadius: 2,
                        elevation: 2 
                      }}
                    />
                 </View>

                 {includeSecondarySignee && (
                     <>
                        {renderInputRow("Approver Name", UserCircleIcon, secondaryName, setSecondaryName, "Enter Approver's Name")}
                        {renderInputRow("Approver Title", Briefcase02Icon, secondaryTitle, setSecondaryTitle, "Enter Approver's Title")}
                     </>
                 )}
              </View>
            </View>

            {hasSettingsChanged() && (
              <TouchableOpacity activeOpacity={0.8} onPress={() => setShouldSaveSettings(!shouldSaveSettings)} style={[styles.saveSettingsRow, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, shouldSaveSettings && { backgroundColor: theme.colors.primary + "10", borderColor: theme.colors.primary }]}>
                <View style={[styles.checkbox, shouldSaveSettings ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary } : { borderColor: theme.colors.textSecondary }]}>
                  {shouldSaveSettings && <HugeiconsIcon icon={Tick01Icon} size={14} color="#fff" />}
                </View>
                <Text style={[styles.saveSettingsText, { color: shouldSaveSettings ? theme.colors.primary : theme.colors.text }]}>Save current settings as default</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      <Footer>
        <Button title="Generate Report" onPress={handleProceed} variant="primary" icon={<HugeiconsIcon icon={ArrowRight01Icon} size={20} color="#fff" />} style={{ width: "100%" }} disabled={generating} />
      </Footer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 44 },
  section: { marginBottom: 28 },
  sectionTitle: { fontSize: 11, fontFamily: "Nunito_800ExtraBold", letterSpacing: 1.2, marginBottom: 12, marginLeft: 4, opacity: 0.56 },
  subSectionTitle: { fontSize: 15, fontFamily: "Nunito_800ExtraBold", marginBottom: 16, letterSpacing: -0.3 },
  row: { flexDirection: "row", gap: 12 },
  optionCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    gap: 12,
  },
  optionText: { fontFamily: "Nunito_800ExtraBold", fontSize: 15 },
  card: {
    borderRadius: 22,
    borderWidth: 1,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.03,
    shadowRadius: 18,
    elevation: 1,
  },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  summaryCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 18,
    gap: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
  },
  summaryTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 14,
  },
  summaryField: {
    flex: 1,
    minWidth: 0,
  },
  summaryFieldRight: {
    alignItems: "flex-end",
  },
  summaryHoursLabel: {
    fontSize: 10,
    fontFamily: "Nunito_800ExtraBold",
    textTransform: "uppercase",
    letterSpacing: 0.9,
    opacity: 0.68,
  },
  summaryHoursValue: {
    fontSize: 20,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.55,
    marginTop: 6,
    lineHeight: 25,
  },
  summaryEyebrow: {
    fontSize: 11,
    fontFamily: "Nunito_800ExtraBold",
    textTransform: "uppercase",
    letterSpacing: 1.2,
    opacity: 0.72,
  },
  summaryPeriod: {
    fontSize: 20,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.55,
    marginTop: 6,
    lineHeight: 25,
  },
  summaryDivider: { height: 1, width: "100%", opacity: 0.7 },
  customizeTrigger: {
    minHeight: 60,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  customizeTriggerIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  customizeTriggerTitle: {
    fontSize: 14,
    fontFamily: "Nunito_800ExtraBold",
    letterSpacing: -0.2,
  },
  customizeTriggerMeta: {
    fontSize: 11.5,
    lineHeight: 16,
    fontFamily: "Nunito_600SemiBold",
    marginTop: 1,
  },
  customizeTriggerRight: {
    minWidth: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  customizeTriggerCountText: {
    fontSize: 12,
    fontFamily: "Nunito_800ExtraBold",
  },
  checkRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingVertical: 14 },
  checkLabel: { fontSize: 15, fontFamily: "Nunito_700Bold" },
  checkSub: { fontSize: 12, marginTop: 4, opacity: 0.6, fontFamily: 'Nunito_500Medium' },
  divider: { height: 1, width: "100%", opacity: 0.5 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 11, fontFamily: "Nunito_800ExtraBold", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, height: 54 },
  inputElement: { flex: 1, fontSize: 15, fontFamily: 'Nunito_600SemiBold', marginLeft: 10, height: '100%' },

  saveSettingsRow: { flexDirection: "row", alignItems: "center", padding: 18, borderRadius: 16, borderWidth: 1, marginBottom: 20, gap: 14 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  saveSettingsText: { fontFamily: "Nunito_700Bold", fontSize: 15 },
});
