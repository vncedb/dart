import {
    ArrowRight01Icon,
    CheckListIcon,
    File01Icon,
    File02Icon,
    Settings02Icon,
    SignatureIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import ModernAlert from '../../components/ModernAlert';
import SignatureModal from '../../components/SignatureModal';
import { useAppTheme } from '../../constants/theme';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';
import { ReportService } from '../../services/ReportService';

export default function GenerateReportScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const params = useLocalSearchParams();
    
    // --- Data State ---
    const [loading, setLoading] = useState(true);
    const [reportItems, setReportItems] = useState<any[]>([]);
    const [periodLabel, setPeriodLabel] = useState('');
    
    // --- Config State ---
    const [formatType, setFormatType] = useState<'pdf' | 'xlsx'>('pdf');
    const [paperSize, setPaperSize] = useState<'Letter' | 'A4' | 'Legal'>('Letter');
    const [reportStyle, setReportStyle] = useState<'corporate' | 'creative' | 'minimal'>('corporate');
    
    // Toggles
    const [includeDocs, setIncludeDocs] = useState(true);
    const [roundHours, setRoundHours] = useState(false);
    
    // Meta
    const [customName, setCustomName] = useState('');
    const [customTitle, setCustomTitle] = useState('');
    const [signature, setSignature] = useState<string | null>(null);
    const [sigModalVisible, setSigModalVisible] = useState(false);

    // Columns
    const [columns, setColumns] = useState({
        date: true,
        time: true,
        duration: true,
        activities: true,
        remarks: false,
    });

    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const userId = session.user.id;

            const db = await getDB();
            const profile = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [userId]);
            setCustomName(profile?.full_name || '');
            setCustomTitle(profile?.title || '');

            const job = await ReportService.getActiveJob(userId);
            if (job && !profile?.title) setCustomTitle(job.title);

            // Fetch Items
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

            // Process Raw Data into a flat list for the report
            const dates = new Set([...(items.attendance||[]).map((a:any) => a.date), ...(items.tasks||[]).map((t:any) => t.date)]);
            const processed = Array.from(dates).sort().map(d => {
                const att = (items.attendance||[]).find((a:any) => a.date === d);
                const dayTasks = (items.tasks||[]).filter((t:any) => t.date === d);
                return {
                    date: d,
                    clockIn: att?.clock_in,
                    clockOut: att?.clock_out,
                    status: att?.status,
                    remarks: att?.remarks,
                    tasks: dayTasks
                };
            });
            setReportItems(processed);

        } catch (e) {
            console.error(e);
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'Failed to load data', confirmText: 'Back', onConfirm: () => router.back() });
        } finally {
            setLoading(false);
        }
    };

    const handleProceed = () => {
        if (reportItems.length === 0) {
            setAlertConfig({ visible: true, type: 'warning', title: 'No Data', message: 'There is no data to generate for this period.', confirmText: 'OK', onConfirm: () => setAlertConfig({visible:false}) });
            return;
        }

        // Navigate to Preview
        router.push({
            pathname: '/reports/preview',
            params: {
                data: JSON.stringify(reportItems),
                config: JSON.stringify({
                    format: formatType,
                    paperSize,
                    style: reportStyle,
                    includeDocs,
                    roundHours,
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <Header title="Configure Report" />
            <ModernAlert {...alertConfig} />
            <SignatureModal visible={sigModalVisible} onClose={() => setSigModalVisible(false)} onOK={setSignature} />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                
                {/* 1. FORMAT */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>OUTPUT FORMAT</Text>
                    <View style={styles.row}>
                        <TouchableOpacity onPress={() => setFormatType('pdf')} style={[styles.optionCard, formatType === 'pdf' && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '10' }, { backgroundColor: theme.colors.card }]}>
                            <HugeiconsIcon icon={File02Icon} size={24} color={formatType === 'pdf' ? theme.colors.primary : theme.colors.textSecondary} />
                            <Text style={[styles.optionText, { color: theme.colors.text }]}>PDF Document</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setFormatType('xlsx')} style={[styles.optionCard, formatType === 'xlsx' && { borderColor: theme.colors.success, backgroundColor: theme.colors.success + '10' }, { backgroundColor: theme.colors.card }]}>
                            <HugeiconsIcon icon={File01Icon} size={24} color={formatType === 'xlsx' ? theme.colors.success : theme.colors.textSecondary} />
                            <Text style={[styles.optionText, { color: theme.colors.text }]}>Excel Sheet</Text>
                        </TouchableOpacity>
                    </View>

                    {formatType === 'pdf' && (
                        <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginTop: 12 }]}>
                            <View style={styles.settingRow}>
                                <Text style={[styles.label, { color: theme.colors.text }]}>Paper Size</Text>
                                <View style={styles.pillContainer}>
                                    {['Letter', 'A4', 'Legal'].map(s => (
                                        <TouchableOpacity key={s} onPress={() => setPaperSize(s as any)} style={[styles.pill, paperSize === s && { backgroundColor: theme.colors.primary }]}>
                                            <Text style={[styles.pillText, paperSize === s && { color: '#fff' }, { color: theme.colors.textSecondary }]}>{s}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                            <View style={styles.settingRow}>
                                <Text style={[styles.label, { color: theme.colors.text }]}>Theme</Text>
                                <View style={styles.pillContainer}>
                                    {['Corporate', 'Minimal', 'Creative'].map(s => (
                                        <TouchableOpacity key={s} onPress={() => setReportStyle(s.toLowerCase() as any)} style={[styles.pill, reportStyle === s.toLowerCase() && { backgroundColor: theme.colors.primary }]}>
                                            <Text style={[styles.pillText, reportStyle === s.toLowerCase() && { color: '#fff' }, { color: theme.colors.textSecondary }]}>{s}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>
                        </View>
                    )}
                </View>

                {/* 2. DATA CHECKLIST */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>DATA COLUMNS</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        {Object.entries(columns).map(([key, val], idx) => (
                            <View key={key} style={[styles.checkRow, idx > 0 && { borderTopWidth: 1, borderTopColor: theme.colors.border }]}>
                                <View style={{flexDirection: 'row', alignItems: 'center', gap: 10}}>
                                    <HugeiconsIcon icon={key === 'activities' ? CheckListIcon : Settings02Icon} size={18} color={theme.colors.textSecondary} />
                                    <Text style={[styles.checkLabel, { color: theme.colors.text }]}>
                                        {key === 'activities' ? 'Activities / Tasks' : key.charAt(0).toUpperCase() + key.slice(1)}
                                    </Text>
                                </View>
                                <Switch 
                                    value={val} 
                                    onValueChange={(v) => setColumns(prev => ({...prev, [key]: v}))}
                                    trackColor={{ true: theme.colors.primary }}
                                />
                            </View>
                        ))}
                    </View>
                </View>

                {/* 3. OPTIONS */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>OPTIONS</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <View style={styles.checkRow}>
                            <View>
                                <Text style={[styles.checkLabel, { color: theme.colors.text }]}>Include Documentation</Text>
                                <Text style={[styles.checkSub, { color: theme.colors.textSecondary }]}>Show images attached to tasks</Text>
                            </View>
                            <Switch value={includeDocs} onValueChange={setIncludeDocs} trackColor={{ true: theme.colors.primary }} />
                        </View>
                        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                        <View style={styles.checkRow}>
                            <View>
                                <Text style={[styles.checkLabel, { color: theme.colors.text }]}>Round Hours</Text>
                                <Text style={[styles.checkSub, { color: theme.colors.textSecondary }]}>Round duration to nearest 15m</Text>
                            </View>
                            <Switch value={roundHours} onValueChange={setRoundHours} trackColor={{ true: theme.colors.primary }} />
                        </View>
                    </View>
                </View>

                {/* 4. PERSONALIZATION */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>SIGNATURE & INFO</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16, gap: 12 }]}>
                        <View>
                            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Printed Name</Text>
                            <TextInput 
                                value={customName} onChangeText={setCustomName}
                                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                            />
                        </View>
                        <View>
                            <Text style={[styles.inputLabel, { color: theme.colors.textSecondary }]}>Job Title</Text>
                            <TextInput 
                                value={customTitle} onChangeText={setCustomTitle}
                                style={[styles.input, { color: theme.colors.text, borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}
                            />
                        </View>
                        
                        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
                        
                        <TouchableOpacity onPress={() => setSigModalVisible(true)} style={[styles.sigBtn, { borderColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                            {signature ? (
                                <Image source={{ uri: signature }} style={{ width: 150, height: 50, resizeMode: 'contain' }} />
                            ) : (
                                <>
                                    <HugeiconsIcon icon={SignatureIcon} size={18} color={theme.colors.primary} />
                                    <Text style={{ color: theme.colors.primary, fontWeight: '600' }}>Add Digital Signature</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

            </ScrollView>

            <View style={[styles.footer, { backgroundColor: theme.colors.card, borderTopColor: theme.colors.border }]}>
                <TouchableOpacity onPress={handleProceed} style={[styles.genBtn, { backgroundColor: theme.colors.primary }]}>
                    <HugeiconsIcon icon={ArrowRight01Icon} size={20} color="#fff" />
                    <Text style={styles.genBtnText}>Generate & Preview</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    content: { padding: 20, paddingBottom: 100 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
    row: { flexDirection: 'row', gap: 12 },
    optionCard: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, borderWidth: 2, borderColor: 'transparent', gap: 8 },
    optionText: { fontWeight: '700', fontSize: 13 },
    card: { borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    label: { fontWeight: '600', fontSize: 14 },
    pillContainer: { flexDirection: 'row', gap: 8 },
    pill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
    pillText: { fontSize: 12, fontWeight: '600' },
    divider: { height: 1, width: '100%' },
    checkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
    checkLabel: { fontSize: 14, fontWeight: '600' },
    checkSub: { fontSize: 11, marginTop: 2 },
    inputLabel: { fontSize: 12, fontWeight: '600', marginBottom: 6 },
    input: { borderRadius: 10, borderWidth: 1, padding: 10, fontSize: 14 },
    sigBtn: { height: 60, borderRadius: 10, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    footer: { padding: 20, borderTopWidth: 1, position: 'absolute', bottom: 0, left: 0, right: 0 },
    genBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, gap: 10 },
    genBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' }
});