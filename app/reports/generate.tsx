import {
    ArrowRight01Icon,
    Calendar03Icon,
    CheckListIcon,
    CheckmarkCircle02Icon,
    Clock01Icon,
    Delete02Icon,
    Image01Icon,
    Layout01Icon,
    Layout03Icon,
    Note02Icon, // Updated Icon
    Pdf01Icon,
    PencilEdit02Icon,
    PrinterIcon,
    SignatureIcon,
    Timer01Icon, // Updated Icon
    Xls01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { format } from 'date-fns';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
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
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Button from '../../components/Button';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import ImageViewer from '../../components/ImageViewer';
import ModernAlert from '../../components/ModernAlert';
import SelectDropdown from '../../components/SelectDropdown';
import SignatureModal from '../../components/SignatureModal';
import { useAppTheme } from '../../constants/theme';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';
import { ReportService } from '../../services/ReportService';

const SETTINGS_KEY = 'report_generation_settings';

export default function GenerateReportScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    const params = useLocalSearchParams();
    
    // --- Data State ---
    const [loading, setLoading] = useState(true);
    const [reportCount, setReportCount] = useState(0); 
    const [periodLabel, setPeriodLabel] = useState('');
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    
    // --- Config State ---
    const [formatType, setFormatType] = useState<'pdf' | 'xlsx'>('pdf');
    const [paperSize, setPaperSize] = useState<'Letter' | 'A4' | 'Legal'>('Letter');
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
    const [reportStyle, setReportStyle] = useState<'corporate' | 'creative' | 'minimal'>('corporate');
    const [dateFormat, setDateFormat] = useState('MM/dd/yyyy');
    const [timeFormat, setTimeFormat] = useState('exact_hm'); 
    
    const [includeDocs, setIncludeDocs] = useState(true);
    const [includeDay, setIncludeDay] = useState(false); 
    
    // --- Meta State ---
    const [customName, setCustomName] = useState('');
    const [customTitle, setCustomTitle] = useState('');
    const [signature, setSignature] = useState<string | null>(null);
    const [sigModalVisible, setSigModalVisible] = useState(false);

    const [columns, setColumns] = useState({
        time: true,
        duration: true,
        activities: true,
        remarks: false,
    });

    const [initialSettings, setInitialSettings] = useState<string>('');
    const [shouldSaveSettings, setShouldSaveSettings] = useState(false);

    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    const [viewerVisible, setViewerVisible] = useState(false);
    const [activeImage, setActiveImage] = useState<string | null>(null);

    const today = new Date();

    // --- NAVIGATION GUARD ---
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            const currentSettings = JSON.stringify({
                formatType, paperSize, orientation, reportStyle, dateFormat, timeFormat, includeDocs, includeDay, columns, signature
            });

            if (currentSettings === initialSettings || loading) {
                return;
            }

            e.preventDefault();
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Unsaved Changes',
                message: 'You have modified the report settings. Do you want to leave without generating?',
                confirmText: 'Leave',
                cancelText: 'Stay',
                onConfirm: () => {
                    setAlertConfig((p:any) => ({ ...p, visible: false }));
                    navigation.dispatch(e.data.action);
                },
                onCancel: () => setAlertConfig((p:any) => ({ ...p, visible: false }))
            });
        });
        return unsubscribe;
    }, [navigation, loading, initialSettings, formatType, paperSize, orientation, reportStyle, dateFormat, timeFormat, includeDocs, includeDay, columns, signature]);

    // --- INITIALIZATION ---
    useEffect(() => {
        let isMounted = true;

        const init = async () => {
            setLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session?.user) {
                    if (isMounted) setLoading(false);
                    return;
                }
                const userId = session.user.id;
                const db = await getDB();

                const [profileRes, jobRes, settingsRes] = await Promise.all([
                    db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [userId]),
                    ReportService.getActiveJob(userId),
                    AsyncStorage.getItem(SETTINGS_KEY)
                ]);

                if (!isMounted) return;

                const profile: any = profileRes;
                const job: any = jobRes;

                setCustomName((prev) => prev || profile?.full_name || '');
                setCustomTitle((prev) => prev || profile?.title || job?.title || '');

                let loadedSettings: any = {};
                if (settingsRes) {
                    loadedSettings = JSON.parse(settingsRes);
                    if (loadedSettings.formatType) setFormatType(loadedSettings.formatType);
                    if (loadedSettings.paperSize) setPaperSize(loadedSettings.paperSize);
                    if (loadedSettings.orientation) setOrientation(loadedSettings.orientation);
                    if (loadedSettings.reportStyle) setReportStyle(loadedSettings.reportStyle);
                    if (loadedSettings.dateFormat) setDateFormat(loadedSettings.dateFormat);
                    if (loadedSettings.timeFormat) setTimeFormat(loadedSettings.timeFormat);
                    if (loadedSettings.includeDocs !== undefined) setIncludeDocs(loadedSettings.includeDocs);
                    if (loadedSettings.includeDay !== undefined) setIncludeDay(loadedSettings.includeDay);
                    if (loadedSettings.columns) setColumns(loadedSettings.columns);
                    if (loadedSettings.signature) setSignature(loadedSettings.signature);
                }
                setInitialSettings(JSON.stringify(loadedSettings));

                const { startDate, endDate, date } = params;
                let items: any = { attendance: [], tasks: [] };
                
                if (startDate && endDate) {
                    setPeriodLabel(`${format(new Date(startDate as string), 'MMM d')} - ${format(new Date(endDate as string), 'MMM d, yyyy')}`);
                    items = await ReportService.getReportRange(userId, job?.id, startDate as string, endDate as string);
                } else if (date) {
                    setPeriodLabel(format(new Date(date as string), 'MMMM d, yyyy'));
                    const res = await ReportService.getDailyReport(userId, date as string);
                    items = { attendance: res.attendance ? [res.attendance] : [], tasks: res.tasks };
                }

                // Count Reports (Days)
                const daysCount = items.attendance ? items.attendance.length : 0;
                setReportCount(daysCount);

                const imagesFound: string[] = [];
                (items.tasks || []).forEach((t: any) => {
                    if (t.image_url) {
                        try {
                            if (t.image_url.trim().startsWith('[')) {
                                const parsed = JSON.parse(t.image_url);
                                if (Array.isArray(parsed)) imagesFound.push(...parsed);
                            } else {
                                imagesFound.push(t.image_url);
                            }
                        } catch {
                            imagesFound.push(t.image_url);
                        }
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
        const current = JSON.stringify({
            formatType, paperSize, orientation, reportStyle, dateFormat, timeFormat, includeDocs, includeDay, columns, signature
        });
        return current !== initialSettings;
    };

    const handleProceed = async () => {
        if (reportCount === 0) {
            setAlertConfig({ visible: true, type: 'warning', title: 'No Data', message: 'There is no data to generate for this period.', confirmText: 'OK', onConfirm: () => setAlertConfig({visible:false}) });
            return;
        }

        if (shouldSaveSettings && hasSettingsChanged()) {
            try {
                const settingsToSave = {
                    formatType, paperSize, orientation, reportStyle, dateFormat, timeFormat, includeDocs, includeDay, columns, signature
                };
                await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settingsToSave));
                setInitialSettings(JSON.stringify(settingsToSave));
            } catch (e) { console.log("Failed to save settings"); }
        }

        router.push({
            pathname: '/reports/preview',
            params: {
                startDate: params.startDate,
                endDate: params.endDate,
                date: params.date,
                config: JSON.stringify({
                    format: formatType,
                    paperSize,
                    orientation,
                    style: reportStyle,
                    includeDocs,
                    includeDay,
                    dateFormat,
                    timeFormat,
                    columns,
                    meta: {
                        name: customName,
                        title: customTitle,
                        period: periodLabel,
                        signature
                    }
                })
            }
        });
    };

    if (loading) return (
        <View style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
    );

    const pdfColor = '#D91519';
    const excelColor = '#74E16C';

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top', 'bottom']}>
            <Header title="Report Settings" />
            <ModernAlert {...alertConfig} />
            <SignatureModal visible={sigModalVisible} onClose={() => setSigModalVisible(false)} onOK={setSignature} />
            
            <ImageViewer visible={viewerVisible} imageUri={activeImage} onClose={() => setViewerVisible(false)} />

            <View style={{ flex: 1 }}>
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
                    style={{ flex: 1 }}
                >
                    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                        
                        {/* 0. REPORT SUMMARY */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>REPORT SUMMARY</Text>
                            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                                <View style={{flexDirection: 'row', alignItems: 'center', gap: 12}}>
                                    <View style={{width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primary + '15', alignItems:'center', justifyContent:'center'}}>
                                         <HugeiconsIcon icon={Calendar03Icon} size={20} color={theme.colors.primary} />
                                    </View>
                                    <View style={{flex: 1}}>
                                        <Text style={{fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase'}}>Selected Period</Text>
                                        <Text style={{fontSize: 15, color: theme.colors.text, fontWeight: '700', marginTop: 2}}>{periodLabel || 'Loading...'}</Text>
                                    </View>
                                </View>
                                <View style={[styles.divider, { backgroundColor: theme.colors.border, marginVertical: 12 }]} />
                                <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'}}>
                                     <Text style={{fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600'}}>Total Reports</Text>
                                     <View style={{paddingHorizontal: 10, paddingVertical: 4, backgroundColor: theme.colors.success + '15', borderRadius: 8}}>
                                        <Text style={{fontSize: 13, color: theme.colors.success, fontWeight: '700'}}>{reportCount} {reportCount === 1 ? 'Day' : 'Days'}</Text>
                                     </View>
                                </View>
                            </View>
                        </View>

                        {/* 1. FILE FORMAT */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>FILE FORMAT</Text>
                            <View style={styles.row}>
                                <TouchableOpacity 
                                    onPress={() => setFormatType('pdf')} 
                                    style={[
                                        styles.optionCard, 
                                        formatType === 'pdf' && { borderColor: pdfColor, backgroundColor: pdfColor + '10' }, 
                                        { backgroundColor: theme.colors.card }
                                    ]}
                                >
                                    <HugeiconsIcon icon={Pdf01Icon} size={32} color={formatType === 'pdf' ? pdfColor : theme.colors.textSecondary} />
                                    <Text style={[styles.optionText, { color: theme.colors.text }]}>Adobe PDF</Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    onPress={() => setFormatType('xlsx')} 
                                    style={[
                                        styles.optionCard, 
                                        formatType === 'xlsx' && { borderColor: excelColor, backgroundColor: excelColor + '10' }, 
                                        { backgroundColor: theme.colors.card }
                                    ]}
                                >
                                    <HugeiconsIcon icon={Xls01Icon} size={32} color={formatType === 'xlsx' ? excelColor : theme.colors.textSecondary} />
                                    <Text style={[styles.optionText, { color: theme.colors.text }]}>Microsoft Excel</Text>
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* 2. CONFIGURATION */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>CONFIGURATION</Text>
                            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                                <SelectDropdown
                                    label="Visual Style"
                                    value={reportStyle}
                                    onChange={setReportStyle}
                                    options={[
                                        { label: 'Corporate Blue', value: 'corporate', icon: <View style={{width:16, height:16, borderRadius:8, backgroundColor:'#1e293b'}}/> },
                                        { label: 'Creative Indigo', value: 'creative', icon: <View style={{width:16, height:16, borderRadius:8, backgroundColor:'#4f46e5'}}/> },
                                        { label: 'Minimal Monochrome', value: 'minimal', icon: <View style={{width:16, height:16, borderRadius:8, backgroundColor:'#000', borderWidth:1, borderColor:'#ccc'}}/> },
                                    ]}
                                />

                                {formatType === 'pdf' && (
                                    <>
                                        <SelectDropdown
                                            label="Paper Format"
                                            value={paperSize}
                                            onChange={setPaperSize}
                                            options={[
                                                { label: 'Letter (8.5" x 11")', value: 'Letter', icon: <HugeiconsIcon icon={PrinterIcon} size={18} color={theme.colors.text} /> },
                                                { label: 'A4 (210mm x 297mm)', value: 'A4', icon: <HugeiconsIcon icon={PrinterIcon} size={18} color={theme.colors.text} /> },
                                                { label: 'Legal (8.5" x 14")', value: 'Legal', icon: <HugeiconsIcon icon={PrinterIcon} size={18} color={theme.colors.text} /> },
                                            ]}
                                        />
                                        <SelectDropdown
                                            label="Page Orientation"
                                            value={orientation}
                                            onChange={setOrientation}
                                            options={[
                                                { label: 'Portrait', value: 'portrait', icon: <HugeiconsIcon icon={Layout01Icon} size={18} color={theme.colors.text} /> },
                                                { label: 'Landscape', value: 'landscape', icon: <HugeiconsIcon icon={Layout03Icon} size={18} color={theme.colors.text} /> },
                                            ]}
                                        />
                                    </>
                                )}

                                <SelectDropdown
                                    label="Date Format"
                                    value={dateFormat}
                                    onChange={setDateFormat}
                                    options={[
                                        { label: `MM/DD/YYYY (${format(today, 'MM/dd/yyyy')})`, value: 'MM/dd/yyyy', icon: <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.text} /> },
                                        { label: `DD/MM/YYYY (${format(today, 'dd/MM/yyyy')})`, value: 'dd/MM/yyyy', icon: <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.text} /> },
                                        { label: `YYYY/MM/DD (${format(today, 'yyyy/MM/dd')})`, value: 'yyyy/MM/dd', icon: <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.text} /> },
                                        { label: `Month Day, Year (${format(today, 'MMMM d, yyyy')})`, value: 'MMMM d, yyyy', icon: <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.text} /> },
                                        { label: `Mon Day, Year (${format(today, 'MMM d, yyyy')})`, value: 'MMM d, yyyy', icon: <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.text} /> },
                                        { label: `Day Month Year (${format(today, 'd MMMM yyyy')})`, value: 'd MMMM yyyy', icon: <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.text} /> },
                                        { label: `DD Month YYYY (${format(today, 'd MMM yyyy')})`, value: 'd MMM yyyy', icon: <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.text} /> },
                                    ]}
                                />

                                <SelectDropdown
                                    label="Time & Duration"
                                    value={timeFormat}
                                    onChange={setTimeFormat}
                                    options={[
                                        { label: 'Exact (e.g. 8h 12m)', value: 'exact_hm', icon: <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.text} /> },
                                        { label: 'Decimal (e.g. 8.20h)', value: 'decimal', icon: <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.text} /> },
                                        { label: 'Round to 15m (e.g. 8h 15m)', value: 'round_15', icon: <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.text} /> },
                                        { label: 'Round to 30m (e.g. 8h 30m)', value: 'round_30', icon: <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.text} /> },
                                        { label: 'Round to 1h (e.g. 8h)', value: 'round_60', icon: <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.text} /> },
                                    ]}
                                />
                            </View>
                        </View>

                        {/* 3. REPORT CONTENT */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>REPORT CONTENT</Text>
                            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                
                                {/* 1. Day Toggle */}
                                <View style={[styles.checkRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                                        <HugeiconsIcon icon={Calendar03Icon} size={18} color={theme.colors.textSecondary} />
                                        <Text style={[styles.checkLabel, { color: theme.colors.text }]}>Day</Text>
                                    </View>
                                    <Switch 
                                        value={includeDay} 
                                        onValueChange={setIncludeDay} 
                                        trackColor={{ false: theme.colors.toggleOff, true: theme.colors.toggleOn }}
                                        thumbColor={theme.colors.toggleThumb}
                                    />
                                </View>

                                {/* 2. Time Toggle */}
                                <View style={[styles.checkRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                                        <HugeiconsIcon icon={Clock01Icon} size={18} color={theme.colors.textSecondary} />
                                        <Text style={[styles.checkLabel, { color: theme.colors.text }]}>Time Record</Text>
                                    </View>
                                    <Switch 
                                        value={columns.time} 
                                        onValueChange={(v) => setColumns(prev => ({...prev, time: v}))}
                                        trackColor={{ false: theme.colors.toggleOff, true: theme.colors.toggleOn }}
                                        thumbColor={theme.colors.toggleThumb}
                                    />
                                </View>

                                {/* 3. Duration Toggle */}
                                <View style={[styles.checkRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                                        <HugeiconsIcon icon={Timer01Icon} size={18} color={theme.colors.textSecondary} />
                                        <Text style={[styles.checkLabel, { color: theme.colors.text }]}>Duration</Text>
                                    </View>
                                    <Switch 
                                        value={columns.duration} 
                                        onValueChange={(v) => setColumns(prev => ({...prev, duration: v}))}
                                        trackColor={{ false: theme.colors.toggleOff, true: theme.colors.toggleOn }}
                                        thumbColor={theme.colors.toggleThumb}
                                    />
                                </View>

                                {/* 4. Activities Toggle */}
                                <View style={[styles.checkRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                                        <HugeiconsIcon icon={CheckListIcon} size={18} color={theme.colors.textSecondary} />
                                        <Text style={[styles.checkLabel, { color: theme.colors.text }]}>Activities</Text>
                                    </View>
                                    <Switch 
                                        value={columns.activities} 
                                        onValueChange={(v) => setColumns(prev => ({...prev, activities: v}))}
                                        trackColor={{ false: theme.colors.toggleOff, true: theme.colors.toggleOn }}
                                        thumbColor={theme.colors.toggleThumb}
                                    />
                                </View>

                                {/* 5. Remarks Toggle */}
                                <View style={[styles.checkRow, { borderBottomWidth: 1, borderBottomColor: theme.colors.border }]}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                                        <HugeiconsIcon icon={Note02Icon} size={18} color={theme.colors.textSecondary} />
                                        <Text style={[styles.checkLabel, { color: theme.colors.text }]}>Remarks</Text>
                                    </View>
                                    <Switch 
                                        value={columns.remarks} 
                                        onValueChange={(v) => setColumns(prev => ({...prev, remarks: v}))}
                                        trackColor={{ false: theme.colors.toggleOff, true: theme.colors.toggleOn }}
                                        thumbColor={theme.colors.toggleThumb}
                                    />
                                </View>

                                {/* 6. Documentation Toggle */}
                                <View style={styles.checkRow}>
                                    <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                                        <HugeiconsIcon icon={Image01Icon} size={18} color={theme.colors.textSecondary} />
                                        <View>
                                            <Text style={[styles.checkLabel, { color: theme.colors.text }]}>Documentation</Text>
                                            {previewImages.length > 0 && (
                                                <Text style={[styles.checkSub, { color: theme.colors.textSecondary }]}>
                                                    {previewImages.length} images found
                                                </Text>
                                            )}
                                        </View>
                                    </View>
                                    <Switch 
                                        value={includeDocs} 
                                        onValueChange={setIncludeDocs} 
                                        trackColor={{ false: theme.colors.toggleOff, true: theme.colors.toggleOn }}
                                        thumbColor={theme.colors.toggleThumb}
                                    />
                                </View>

                                {includeDocs && previewImages.length > 0 && (
                                    <View style={{ padding: 16, paddingTop: 0 }}>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                                            {previewImages.map((uri, i) => (
                                                <TouchableOpacity key={i} onPress={() => { setActiveImage(uri); setViewerVisible(true); }}>
                                                    <Image 
                                                        source={{ uri }} 
                                                        style={{ width: 60, height: 60, borderRadius: 8, backgroundColor: theme.colors.border }} 
                                                        resizeMode="cover"
                                                    />
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* 4. AUTHORIZATION */}
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>AUTHORIZATION</Text>
                            <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 20, gap: 16 }]}>
                                
                                <View>
                                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Printed Name</Text>
                                    <TextInput 
                                        value={customName} onChangeText={setCustomName}
                                        placeholder="Enter your Name"
                                        placeholderTextColor={theme.colors.textSecondary}
                                        style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                                    />
                                </View>

                                <View>
                                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Job Title</Text>
                                    <TextInput 
                                        value={customTitle} onChangeText={setCustomTitle}
                                        placeholder="Enter your Position"
                                        placeholderTextColor={theme.colors.textSecondary}
                                        style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                                    />
                                </View>
                                
                                <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                                
                                <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                                    <Text style={[styles.inputLabel, { color: theme.colors.textSecondary, marginBottom: 0 }]}>Digital Signature</Text>
                                    {signature && (
                                        <View style={{flexDirection: 'row', gap: 12}}>
                                            <TouchableOpacity onPress={() => setSigModalVisible(true)}>
                                                <HugeiconsIcon icon={PencilEdit02Icon} size={20} color={theme.colors.primary} />
                                            </TouchableOpacity>
                                            <TouchableOpacity onPress={() => setSignature(null)}>
                                                <HugeiconsIcon icon={Delete02Icon} size={20} color={theme.colors.danger} />
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                <TouchableOpacity 
                                    onPress={() => setSigModalVisible(true)} 
                                    style={[
                                        styles.sigBtn, 
                                        { borderColor: theme.colors.border, backgroundColor: theme.colors.background },
                                        signature ? { borderStyle: 'solid' } : { borderStyle: 'dashed' }
                                    ]}
                                >
                                    {signature ? (
                                        <View style={styles.sigPreviewContainer}>
                                            <Image source={{ uri: signature }} style={styles.sigImage} resizeMode="contain" />
                                        </View>
                                    ) : (
                                        <View style={{alignItems:'center', gap: 6}}>
                                            <HugeiconsIcon icon={SignatureIcon} size={24} color={theme.colors.primary} />
                                            <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Tap to Sign</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* 5. SAVE SETTINGS CHECKLIST STYLE */}
                        {hasSettingsChanged() && (
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => setShouldSaveSettings(!shouldSaveSettings)} 
                                style={[
                                    styles.saveSettingsRow, 
                                    shouldSaveSettings ? { backgroundColor: theme.colors.primary + '10', borderColor: theme.colors.primary } : { borderColor: 'transparent' }
                                ]}
                            >
                                <View style={[styles.checkbox, shouldSaveSettings ? { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary } : { borderColor: theme.colors.textSecondary }]}>
                                    {shouldSaveSettings && <HugeiconsIcon icon={CheckmarkCircle02Icon} size={14} color="#fff" />}
                                </View>
                                <Text style={[styles.saveSettingsText, { color: shouldSaveSettings ? theme.colors.primary : theme.colors.textSecondary }]}>
                                    Save current settings as default
                                </Text>
                            </TouchableOpacity>
                        )}

                    </ScrollView>
                </KeyboardAvoidingView>
            </View>

            <Footer>
                <Button 
                    title="Generate Report" 
                    onPress={handleProceed} 
                    variant="primary"
                    icon={<HugeiconsIcon icon={ArrowRight01Icon} size={20} color="#fff" />}
                />
            </Footer>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 40 },
    section: { marginBottom: 30 },
    sectionTitle: { fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginLeft: 4, opacity: 0.7 },
    row: { flexDirection: 'row', gap: 12 },
    optionCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', gap: 10 },
    optionText: { fontWeight: '700', fontSize: 14 },
    card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
    checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingVertical: 18 },
    checkLabel: { fontSize: 15, fontWeight: '600' },
    checkSub: { fontSize: 12, marginTop: 4, opacity: 0.8 },
    divider: { height: 1, width: '100%', opacity: 0.5 },
    inputLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6, textTransform: 'uppercase' },
    input: { borderRadius: 12, borderWidth: 1, padding: 12, fontSize: 15, height: 50 },
    sigBtn: { height: 100, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    sigPreviewContainer: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
    sigImage: { width: '60%', height: '80%' },
    
    // Save Settings Checklist Style
    saveSettingsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 20, gap: 10 },
    checkbox: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
    saveSettingsText: { fontWeight: '600', fontSize: 14 }
});