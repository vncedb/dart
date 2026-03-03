// filepath: app/reports/generate.tsx
import {
  ArrowRight01Icon,
  Briefcase02Icon,
  Building04Icon,
  Calendar03Icon,
  CheckListIcon,
  Clock01Icon,
  Delete02Icon,
  Image01Icon,
  Pdf01Icon,
  PencilEdit02Icon,
  PrinterIcon,
  SignatureIcon,
  Tick01Icon,
  Timer01Icon,
  UserCircleIcon,
  UserGroupIcon,
  Xls01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { format } from "date-fns";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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
import ModernAlert from "../../components/ModernAlert";
import SelectDropdown from "../../components/SelectDropdown";
import SignatureModal from "../../components/SignatureModal";
import { useAppTheme } from "../../constants/theme";
import { getDB } from "../../lib/db-client";
import { supabase } from "../../lib/supabase";
import { ReportService } from "../../services/ReportService";

const SETTINGS_KEY = "report_generation_settings";

export default function GenerateReportScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const theme = useAppTheme();
  const params = useLocalSearchParams();

  // --- Data State ---
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportCount, setReportCount] = useState(0);
  const [periodLabel, setPeriodLabel] = useState("");
  const [previewImages, setPreviewImages] = useState<string[]>([]);

  // --- Config State (Default Toggled ON) ---
  const [formatType, setFormatType] = useState<"pdf" | "xlsx">("pdf");
  const [paperSize, setPaperSize] = useState<"Letter" | "A4" | "Legal">("Letter");
  const [reportStyle, setReportStyle] = useState<"corporate" | "creative" | "minimal">("corporate");
  const [dateFormat, setDateFormat] = useState("MM/dd/yyyy");
  const [timeFormat, setTimeFormat] = useState("exact_hm");

  const [includeDocs, setIncludeDocs] = useState(true);
  const [includeDay, setIncludeDay] = useState(true);
  const [includeDept, setIncludeDept] = useState(true);
  const [includeSecondarySignee, setIncludeSecondarySignee] = useState(false);
  const [columns, setColumns] = useState({ time: true, duration: true, activities: true });

  // --- Meta State ---
  const [customName, setCustomName] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [department, setDepartment] = useState("");
  
  // Signatures
  const [signature, setSignature] = useState<string | null>(null);
  const [secondaryName, setSecondaryName] = useState("");
  const [secondaryTitle, setSecondaryTitle] = useState("");
  const [secondarySignature, setSecondarySignature] = useState<string | null>(null);

  const [sigModalVisible, setSigModalVisible] = useState(false);
  const [activeSigner, setActiveSigner] = useState<"primary" | "secondary">("primary");

  const [initialSettings, setInitialSettings] = useState<string>("");
  const [shouldSaveSettings, setShouldSaveSettings] = useState(false);
  const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
  const [viewerVisible, setViewerVisible] = useState(false);
  const [activeImage, setActiveImage] = useState<string | null>(null);

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
        includeDocs, includeDay, includeDept, includeSecondarySignee, columns, signature,
        customName, customTitle, companyName, department, secondaryName, secondaryTitle, secondarySignature
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
      });
    });
    return unsubscribe;
  }, [
    navigation, loading, initialSettings, formatType, paperSize, reportStyle,
    dateFormat, timeFormat, includeDocs, includeDay, includeDept, includeSecondarySignee, columns,
    signature, customName, customTitle, companyName, department, secondaryName, secondaryTitle, secondarySignature
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

        let currentName = profile?.full_name || "";
        let currentTitle = job?.title || profile?.title || "";
        let currentCompany = job?.company || profile?.company || "";
        let currentDept = job?.department || "";

        let sName = "";
        let sTitle = "";
        let sSig = null;
        let sInc = false;

        if (settingsRes) {
          const loaded = JSON.parse(settingsRes);
          if (loaded.formatType) setFormatType(loaded.formatType);
          if (loaded.paperSize) setPaperSize(loaded.paperSize);
          if (loaded.reportStyle) setReportStyle(loaded.reportStyle);
          if (loaded.dateFormat) setDateFormat(loaded.dateFormat);
          if (loaded.timeFormat) setTimeFormat(loaded.timeFormat);
          if (loaded.includeDocs !== undefined) setIncludeDocs(loaded.includeDocs);
          if (loaded.includeDay !== undefined) setIncludeDay(loaded.includeDay);
          if (loaded.includeDept !== undefined) setIncludeDept(loaded.includeDept);
          if (loaded.columns) setColumns(loaded.columns);
          if (loaded.signature) setSignature(loaded.signature);

          if (loaded.customName) currentName = loaded.customName;
          if (loaded.customTitle) currentTitle = loaded.customTitle;
          if (loaded.companyName) currentCompany = loaded.companyName;
          if (loaded.department) currentDept = loaded.department;

          if (loaded.includeSecondarySignee !== undefined) sInc = loaded.includeSecondarySignee;
          if (loaded.secondaryName) sName = loaded.secondaryName;
          if (loaded.secondaryTitle) sTitle = loaded.secondaryTitle;
          if (loaded.secondarySignature) sSig = loaded.secondarySignature;
        }

        setCustomName(currentName);
        setCustomTitle(currentTitle);
        setCompanyName(currentCompany);
        setDepartment(currentDept);
        setIncludeSecondarySignee(sInc);
        setSecondaryName(sName);
        setSecondaryTitle(sTitle);
        setSecondarySignature(sSig);

        setInitialSettings(
          JSON.stringify({
            formatType: settingsRes ? JSON.parse(settingsRes).formatType : "pdf",
            paperSize: settingsRes ? JSON.parse(settingsRes).paperSize : "Letter",
            reportStyle: settingsRes ? JSON.parse(settingsRes).reportStyle : "corporate",
            dateFormat: settingsRes ? JSON.parse(settingsRes).dateFormat : "MM/dd/yyyy",
            timeFormat: settingsRes ? JSON.parse(settingsRes).timeFormat : "exact_hm",
            includeDocs: settingsRes ? JSON.parse(settingsRes).includeDocs : true,
            includeDay: settingsRes ? JSON.parse(settingsRes).includeDay : true,
            includeDept: settingsRes ? JSON.parse(settingsRes).includeDept : true,
            includeSecondarySignee: sInc,
            columns: settingsRes ? JSON.parse(settingsRes).columns : { time: true, duration: true, activities: true },
            signature: settingsRes ? JSON.parse(settingsRes).signature : null,
            customName: currentName, customTitle: currentTitle, companyName: currentCompany, department: currentDept,
            secondaryName: sName, secondaryTitle: sTitle, secondarySignature: sSig
          })
        );

        const { startDate, endDate, date } = params;
        let items: any = { attendance: [], tasks: [] };

        if (startDate && endDate) {
          setPeriodLabel(`${format(new Date(startDate as string), "MMM d")} - ${format(new Date(endDate as string), "MMM d, yyyy")}`);
          items = await ReportService.getReportRange(userId, job?.id || null, startDate as string, endDate as string);
        } else if (date) {
          setPeriodLabel(format(new Date(date as string), "MMM dd, yyyy"));
          const res = await ReportService.getDailyReport(userId, date as string);
          items = { attendance: res.attendance ? [res.attendance] : [], tasks: res.tasks };
        }

        const uniqueDates = new Set();
        (items.attendance || []).forEach((a: any) => uniqueDates.add(a.date));
        (items.tasks || []).forEach((t: any) => uniqueDates.add(t.date));
        setReportCount(uniqueDates.size);

        const imagesFound: string[] = [];
        (items.tasks || []).forEach((t: any) => {
          if (t.image_url) {
            try {
              if (t.image_url.trim().startsWith("[")) {
                const parsed = JSON.parse(t.image_url);
                if (Array.isArray(parsed)) imagesFound.push(...parsed);
              } else { imagesFound.push(t.image_url); }
            } catch { imagesFound.push(t.image_url); }
          }
        });
        setPreviewImages(imagesFound);
      } catch (e) {
        console.error("Generate Init Error:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    init();
    return () => { isMounted = false; };
  }, [params.startDate, params.endDate, params.date]);

  const hasSettingsChanged = () => {
    return JSON.stringify({
      formatType, paperSize, reportStyle, dateFormat, timeFormat,
      includeDocs, includeDay, includeDept, includeSecondarySignee, columns, signature,
      customName, customTitle, companyName, department, secondaryName, secondaryTitle, secondarySignature
    }) !== initialSettings;
  };

  const handleProceed = async () => {
    if (reportCount === 0) {
      setAlertConfig({
        visible: true, type: "warning", title: "No Data",
        message: "There is no data to generate for this period.", confirmText: "OK",
        onConfirm: () => setAlertConfig({ visible: false }),
      });
      return;
    }

    setGenerating(true);

    if (shouldSaveSettings && hasSettingsChanged()) {
      try {
        const settingsToSave = {
          formatType, paperSize, reportStyle, dateFormat, timeFormat,
          includeDocs, includeDay, includeDept, includeSecondarySignee, columns, signature,
          customName, customTitle, companyName, department, secondaryName, secondaryTitle, secondarySignature
        };
        await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToSave));
        setInitialSettings(JSON.stringify(settingsToSave));
      } catch (e) { console.log("Failed to save settings"); }
    }

    isProceeding.current = true;

    router.push({
      pathname: "/reports/preview",
      params: {
        startDate: params.startDate, endDate: params.endDate, date: params.date,
        config: JSON.stringify({
          format: formatType, paperSize, style: reportStyle, includeDocs, includeDay,
          includeDept, dateFormat, timeFormat, columns,
          meta: {
            name: customName, title: customTitle, company: companyName, department: department, period: periodLabel, signature,
            secondaryName: includeSecondarySignee ? secondaryName : undefined,
            secondaryTitle: includeSecondarySignee ? secondaryTitle : undefined,
            secondarySignature: includeSecondarySignee ? secondarySignature : undefined,
          },
        }),
      },
    });
  };

  const handleSignatureSave = (sig: string) => {
      if (activeSigner === "primary") setSignature(sig);
      else setSecondarySignature(sig);
  };

  if (loading) return (
      <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
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

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={["top", "bottom"]}>
      <Header title="Generate Report" />
      <ModernAlert {...alertConfig} />
      <LoadingOverlay visible={generating} message="Generating Report..." />
      
      <SignatureModal 
        visible={sigModalVisible} 
        onClose={() => setSigModalVisible(false)} 
        onOK={handleSignatureSave} 
        title={activeSigner === "primary" ? "Your Signature" : "Approver Signature"}
      />

      <ImageViewer visible={viewerVisible} imageUri={activeImage} onClose={() => setViewerVisible(false)} />

      <View style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>REPORT SUMMARY</Text>
              <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <View style={[styles.iconBox, { backgroundColor: theme.colors.primary + "15" }]}>
                    <HugeiconsIcon icon={Calendar03Icon} size={20} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: "700", textTransform: "uppercase" }}>Selected Period</Text>
                    <Text style={{ fontSize: 16, color: theme.colors.text, fontWeight: "800", marginTop: 2 }}>{periodLabel || "Loading..."}</Text>
                  </View>
                </View>
                <View style={[styles.divider, { backgroundColor: theme.colors.border, marginVertical: 14 }]} />
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary, fontWeight: "600" }}>Total Included Reports</Text>
                  <View style={[styles.badge, { backgroundColor: theme.colors.success + "15" }]}>
                    <Text style={{ fontSize: 13, color: theme.colors.success, fontWeight: "800" }}>{reportCount} {reportCount === 1 ? "Day" : "Days"}</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>FILE FORMAT</Text>
              <View style={styles.row}>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setFormatType("pdf")} style={[styles.optionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, formatType === "pdf" && { borderColor: pdfColor, backgroundColor: pdfColor + "10" }]}>
                  <HugeiconsIcon icon={Pdf01Icon} size={32} color={formatType === "pdf" ? pdfColor : theme.colors.textSecondary} />
                  <Text style={[styles.optionText, { color: formatType === "pdf" ? pdfColor : theme.colors.text }]}>Adobe PDF</Text>
                </TouchableOpacity>
                <TouchableOpacity activeOpacity={0.8} onPress={() => setFormatType("xlsx")} style={[styles.optionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }, formatType === "xlsx" && { borderColor: excelColor, backgroundColor: excelColor + "10" }]}>
                  <HugeiconsIcon icon={Xls01Icon} size={32} color={formatType === "xlsx" ? excelColor : theme.colors.textSecondary} />
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
                {[
                  { label: "Day", icon: Calendar03Icon, value: includeDay, setValue: setIncludeDay },
                  { label: "Time Record", icon: Clock01Icon, value: columns.time, setValue: (v: boolean) => setColumns(prev => ({ ...prev, time: v })) },
                  { label: "Duration", icon: Timer01Icon, value: columns.duration, setValue: (v: boolean) => setColumns(prev => ({ ...prev, duration: v })) },
                  { label: "Activities", icon: CheckListIcon, value: columns.activities, setValue: (v: boolean) => setColumns(prev => ({ ...prev, activities: v })) },
                  { label: "Department", icon: UserGroupIcon, value: includeDept, setValue: setIncludeDept },
                ].map((item, index, array) => (
                  <View key={item.label} style={[styles.checkRow, index !== array.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }}>
                        <HugeiconsIcon icon={item.icon} size={16} color={theme.colors.textSecondary} />
                      </View>
                      <Text style={[styles.checkLabel, { color: theme.colors.text }]}>{item.label}</Text>
                    </View>
                    <Switch value={item.value} onValueChange={item.setValue} trackColor={{ false: theme.colors.toggleOff, true: theme.colors.toggleOn }} thumbColor={theme.colors.toggleThumb} />
                  </View>
                ))}

                {formatType === "pdf" && (
                  <>
                    <View style={[styles.checkRow, { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                         <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }}>
                            <HugeiconsIcon icon={Image01Icon} size={16} color={theme.colors.textSecondary} />
                         </View>
                        <View>
                          <Text style={[styles.checkLabel, { color: theme.colors.text }]}>Documentation</Text>
                          {previewImages.length > 0 && <Text style={[styles.checkSub, { color: theme.colors.textSecondary }]}>{previewImages.length} images found</Text>}
                        </View>
                      </View>
                      <Switch value={includeDocs} onValueChange={setIncludeDocs} trackColor={{ false: theme.colors.toggleOff, true: theme.colors.toggleOn }} thumbColor={theme.colors.toggleThumb} />
                    </View>
                    {includeDocs && previewImages.length > 0 && (
                      <View style={{ padding: 16, paddingTop: 0 }}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                          {previewImages.map((uri, i) => (
                            <TouchableOpacity key={i} onPress={() => { setActiveImage(uri); setViewerVisible(true); }}>
                              <Image source={{ uri }} style={{ width: 64, height: 64, borderRadius: 8, backgroundColor: theme.colors.border }} resizeMode="cover" />
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

                {formatType === "pdf" && (
                  <View style={{ marginTop: 16 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <Text style={[styles.inputLabel, { color: theme.colors.textSecondary, marginBottom: 0 }]}>Digital Signature</Text>
                      {signature && (
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <TouchableOpacity onPress={() => { setActiveSigner("primary"); setSigModalVisible(true); }}>
                            <HugeiconsIcon icon={PencilEdit02Icon} size={20} color={theme.colors.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setSignature(null)}>
                            <HugeiconsIcon icon={Delete02Icon} size={20} color={theme.colors.danger} />
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {signature ? (
                        <View style={styles.pdfSignaturePreview}>
                            <Image source={{ uri: signature }} style={styles.pdfSigImage} resizeMode="contain" />
                            <View style={styles.pdfSigLine} />
                            <Text style={styles.pdfSigName}>{customName || 'YOUR NAME'}</Text>
                            <Text style={styles.pdfSigTitle}>{customTitle || 'Your Title'}</Text>
                        </View>
                    ) : (
                        <TouchableOpacity activeOpacity={0.8} onPress={() => { setActiveSigner("primary"); setSigModalVisible(true); }} style={[styles.sigBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                            <View style={{ alignItems: "center", gap: 8 }}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                                    <HugeiconsIcon icon={SignatureIcon} size={22} color={theme.colors.primary} />
                                </View>
                                <Text style={{ color: theme.colors.textSecondary, fontWeight: "600", fontSize: 13 }}>Tap here to draw signature</Text>
                            </View>
                        </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>

              <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 20 }]}>
                 <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: includeSecondarySignee ? 24 : 0 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: theme.colors.text }}>Secondary Signee</Text>
                        <Text style={{ fontSize: 12, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary, marginTop: 2 }}>Include a co-signer or approver</Text>
                    </View>
                    <Switch value={includeSecondarySignee} onValueChange={setIncludeSecondarySignee} trackColor={{ true: theme.colors.primary, false: theme.colors.border }} />
                 </View>

                 {includeSecondarySignee && (
                     <>
                        {renderInputRow("Approver Name", UserCircleIcon, secondaryName, setSecondaryName, "e.g. Jane Doe")}
                        {renderInputRow("Approver Title", Briefcase02Icon, secondaryTitle, setSecondaryTitle, "e.g. Project Manager")}
                        
                        {formatType === "pdf" && (
                            <View style={{ marginTop: 16 }}>
                                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary, marginBottom: 0 }]}>Approver Signature</Text>
                                    {secondarySignature && (
                                        <View style={{ flexDirection: "row", gap: 12 }}>
                                            <TouchableOpacity onPress={() => { setActiveSigner("secondary"); setSigModalVisible(true); }}>
                                                <HugeiconsIcon icon={PencilEdit02Icon} size={20} color={theme.colors.primary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setSecondarySignature(null)}>
                                                <HugeiconsIcon icon={Delete02Icon} size={20} color={theme.colors.danger} />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                {secondarySignature ? (
                                    <View style={styles.pdfSignaturePreview}>
                                        <Image source={{ uri: secondarySignature }} style={styles.pdfSigImage} resizeMode="contain" />
                                        <View style={styles.pdfSigLine} />
                                        <Text style={styles.pdfSigName}>{secondaryName || 'APPROVER NAME'}</Text>
                                        <Text style={styles.pdfSigTitle}>{secondaryTitle || 'Approver Title'}</Text>
                                    </View>
                                ) : (
                                    <TouchableOpacity activeOpacity={0.8} onPress={() => { setActiveSigner("secondary"); setSigModalVisible(true); }} style={[styles.sigBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                                        <View style={{ alignItems: "center", gap: 8 }}>
                                            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary + '15', alignItems: 'center', justifyContent: 'center' }}>
                                                <HugeiconsIcon icon={SignatureIcon} size={22} color={theme.colors.primary} />
                                            </View>
                                            <Text style={{ color: theme.colors.textSecondary, fontWeight: "600", fontSize: 13 }}>Tap to add approver signature</Text>
                                        </View>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
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
  content: { padding: 20, paddingBottom: 40 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 11, fontFamily: "Nunito_800ExtraBold", letterSpacing: 1.2, marginBottom: 12, marginLeft: 4, opacity: 0.6 },
  subSectionTitle: { fontSize: 15, fontFamily: "Nunito_800ExtraBold", marginBottom: 16, letterSpacing: -0.3 },
  row: { flexDirection: "row", gap: 12 },
  optionCard: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20, borderRadius: 16, borderWidth: 1.5, gap: 12 },
  optionText: { fontFamily: "Nunito_800ExtraBold", fontSize: 15 },
  card: { borderRadius: 20, borderWidth: 1, overflow: "hidden" },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  checkRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, paddingVertical: 14 },
  checkLabel: { fontSize: 15, fontFamily: "Nunito_700Bold" },
  checkSub: { fontSize: 12, marginTop: 4, opacity: 0.6, fontFamily: 'Nunito_500Medium' },
  divider: { height: 1, width: "100%", opacity: 0.5 },
  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 11, fontFamily: "Nunito_800ExtraBold", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  inputWrapper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, height: 52 },
  inputElement: { flex: 1, fontSize: 15, fontFamily: 'Nunito_600SemiBold', marginLeft: 10, height: '100%' },
  sigBtn: { height: 120, borderRadius: 16, borderWidth: 1.5, borderStyle: 'dashed', alignItems: "center", justifyContent: "center", overflow: "hidden" },
  
  pdfSignaturePreview: {
      backgroundColor: '#F8FAFC',
      padding: 20,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: '#E2E8F0',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
  },
  pdfSigImage: { width: 180, height: 75, marginBottom: -12, zIndex: 10 },
  pdfSigLine: { width: '85%', height: 1, backgroundColor: '#1e293b', marginBottom: 8 },
  pdfSigName: { fontSize: 14, fontFamily: 'Nunito_800ExtraBold', color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center' },
  pdfSigTitle: { fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: '#64748b', textAlign: 'center' },

  saveSettingsRow: { flexDirection: "row", alignItems: "center", padding: 18, borderRadius: 16, borderWidth: 1, marginBottom: 20, gap: 14 },
  checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  saveSettingsText: { fontFamily: "Nunito_700Bold", fontSize: 15 },
});