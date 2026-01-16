import {
    ArrowDown01Icon,
    ArrowRight01Icon,
    Cancel01Icon,
    Clock01Icon,
    Delete02Icon,
    File02Icon,
    FileVerifiedIcon,
    MoreVerticalCircle01Icon,
    PlusSignIcon,
    RefreshIcon,
    Search01Icon,
    Share01Icon,
    Task01Icon,
    Tick02Icon,
    WifiOff01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import NetInfo from '@react-native-community/netinfo';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    LayoutAnimation,
    Platform,
    RefreshControl,
    SectionList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    UIManager,
    View
} from 'react-native';
import Animated, {
    Easing,
    FadeInDown,
    Layout,
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// Components
import ActionMenu from '../../components/ActionMenu';
import CutoffSelectionModal, { DateRange } from '../../components/CutoffSelectionModal';
import FloatingAlert from '../../components/FloatingAlert';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import TabHeader from '../../components/TabHeader';
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';
import { ReportService } from '../../services/ReportService';
import { exportToExcel } from '../../utils/csvExporter';
import { generateReport } from '../../utils/reportGenerator';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    if (typeof UIManager.setLayoutAnimationEnabledExperimental === 'function') {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

const SyncStatusBar = ({ isSyncing, isOffline, theme }: { isSyncing: boolean, isOffline: boolean, theme: any }) => {
    if (!isSyncing && !isOffline) return null;
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, backgroundColor: isSyncing ? theme.colors.background : theme.colors.danger + '10', borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
            <View style={{ marginRight: 8 }}>
                {isSyncing ? <ActivityIndicator size="small" color={theme.colors.primary} /> : <HugeiconsIcon icon={WifiOff01Icon} size={16} color={theme.colors.danger} />}
            </View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: isSyncing ? theme.colors.primary : theme.colors.danger }}>
                {isSyncing ? "Syncing data..." : "You are offline. Data may be outdated."}
            </Text>
        </View>
    );
};

export default function ReportsScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const { triggerSync, syncStatus } = useSync();
    const isSyncing = syncStatus === 'syncing';
    
    // Data & UI
    const [allSections, setAllSections] = useState<any[]>([]);
    const [filteredSections, setFilteredSections] = useState<any[]>([]);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    const [availableDates, setAvailableDates] = useState<string[]>([]);
    const [userProfile, setUserProfile] = useState<any>(null);
    
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    
    // Modals
    const [modalVisible, setModalVisible] = useState(false);
    const [currentRange, setCurrentRange] = useState<DateRange | null>(null);
    const [actionMenuVisible, setActionMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number, y: number } | undefined>(undefined);
    
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);
    
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    const [floatingAlert, setFloatingAlert] = useState({ visible: false, message: '', type: 'success' });

    const syncButtonRotation = useSharedValue(0);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => { setIsOffline(!(state.isConnected && state.isInternetReachable)); });
        return unsubscribe;
    }, []);

    useEffect(() => {
        if (isSyncing) {
            syncButtonRotation.value = withRepeat(withTiming(360, { duration: 1000 }), -1);
        } else {
            cancelAnimation(syncButtonRotation);
            syncButtonRotation.value = withTiming(0);
        }
    }, [isSyncing]);
    
    const syncButtonStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${syncButtonRotation.value}deg` }] }));

    useEffect(() => {
        const onBackPress = () => {
            if (selectionMode) {
                setSelectionMode(false);
                setSelectedIds(new Set());
                return true;
            }
            return false;
        };
        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove(); 
    }, [selectionMode]);

    useFocusEffect(
        useCallback(() => {
            fetchReports();
        }, [])
    );

    const fetchReports = async () => {
        try {
            const db = await getDB();
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            
            if (!userId) { setIsLoading(false); return; }

            const profile = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [userId]);
            setUserProfile(profile);

            const job: any = await ReportService.getActiveJob(userId);
            if (!job) { setAllSections([]); setFilteredSections([]); setIsLoading(false); return; }
            
            const payoutType = job.payout_type || 'Semi-Monthly';

            const attendance = await db.getAllAsync('SELECT * FROM attendance WHERE user_id = ? AND job_id = ? ORDER BY date DESC', [userId, job.id]);
            const tasks = await db.getAllAsync('SELECT * FROM accomplishments WHERE user_id = ? AND job_id = ?', [userId, job.id]);
            
            const allDatesSet = new Set([ ...(attendance?.map((a: any) => a.date) || []), ...(tasks?.map((t: any) => t.date) || []) ]);
            const allDatesArray = Array.from(allDatesSet);
            setAvailableDates(allDatesArray);

            const sortedDates = allDatesArray.sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

            const merged = sortedDates.map(dateStr => {
                const att: any = attendance?.find((a: any) => a.date === dateStr);
                const taskList: any = tasks?.filter((t: any) => t.date === dateStr) || [];
                return {
                    id: dateStr,
                    date: dateStr,
                    clock_in: att?.clock_in,
                    clock_out: att?.clock_out,
                    status: att?.status || 'no-attendance',
                    accomplishments: taskList
                };
            });

            const grouped = ReportService.groupReportsByPayout(merged, payoutType);
            const sectionsArray = Object.values(grouped);
            setAllSections(sectionsArray);

            if (!currentRange) {
                const now = new Date();
                const start = startOfMonth(now).toISOString();
                const end = endOfMonth(now).toISOString();
                const defaultRange: DateRange = { start, end, label: format(now, 'MMMM yyyy'), type: 'month' };
                setCurrentRange(defaultRange);
                applyFilter(defaultRange, sectionsArray);
            } else {
                applyFilter(currentRange, sectionsArray);
            }

        } catch (e) { console.log("Fetch Error", e); } finally { setRefreshing(false); setIsLoading(false); }
    };

    const applyFilter = (range: DateRange, data: any[]) => {
        const start = new Date(range.start).getTime();
        const end = new Date(range.end).getTime();
        const filtered = data.filter(section => {
            const sStart = new Date(section.start).getTime();
            const sEnd = new Date(section.end).getTime();
            return (sStart <= end && sEnd >= start);
        });
        setFilteredSections(filtered);
    };

    const handleRangeSelect = (range: DateRange) => {
        setCurrentRange(range);
        applyFilter(range, allSections);
    };

    const toggleSection = (title: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title); else next.add(title);
            return next;
        });
    };

    const handleSharePDF = async () => {
        setActionMenuVisible(false);
        if (!currentRange || filteredSections.length === 0) return;
        setLoadingAction(true);
        try {
            const allItems = filteredSections.flatMap(section => section.data);
            const reportData = allItems.map(item => ({
                date: item.date,
                clockIn: item.clock_in ? format(new Date(item.clock_in), 'h:mm a') : '--:--',
                clockOut: item.clock_out ? format(new Date(item.clock_out), 'h:mm a') : '--:--',
                summary: item.accomplishments.map((t: any) => `• ${t.description}`).join('<br/>') || 'No tasks'
            }));

            await generateReport({
                userName: userProfile?.full_name || 'User',
                userTitle: userProfile?.title || 'Employee',
                reportTitle: 'Accomplishment Report',
                period: currentRange.label,
                data: reportData,
                style: 'corporate',
                paperSize: 'Letter'
            });

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('report_history').insert({
                    user_id: user.id,
                    title: `PDF: ${currentRange.label}`,
                    start_date: currentRange.start,
                    end_date: currentRange.end,
                    generated_at: new Date().toISOString()
                });
            }
        } catch (e) {
            setFloatingAlert({ visible: true, message: 'Failed to generate PDF', type: 'error' });
        } finally {
            setLoadingAction(false);
        }
    };

    const handleShareExcel = async () => {
        setActionMenuVisible(false);
        if (!currentRange || filteredSections.length === 0) return;
        setLoadingAction(true);
        try {
            const allItems = filteredSections.flatMap(section => section.data);
            const excelData = allItems.map(item => ({
                Date: item.date,
                Clock_In: item.clock_in ? format(new Date(item.clock_in), 'h:mm a') : '--:--',
                Clock_Out: item.clock_out ? format(new Date(item.clock_out), 'h:mm a') : '--:--',
                Tasks: item.accomplishments.map((t: any) => t.description).join('; ')
            }));

            await exportToExcel(excelData, `Report_${currentRange.label}`);
            
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await supabase.from('report_history').insert({
                    user_id: user.id,
                    title: `XLSX: ${currentRange.label}`,
                    start_date: currentRange.start,
                    end_date: currentRange.end,
                    generated_at: new Date().toISOString()
                });
            }
        } catch (e) {
            setFloatingAlert({ visible: true, message: 'Failed to generate Excel', type: 'error' });
        } finally {
            setLoadingAction(false);
        }
    };

    const renderItem = ({ item, index, section }: any) => {
        if (collapsedSections.has(section.title)) return null;
        const isSelected = selectedIds.has(item.date);
        const hasAttendance = item.status !== 'no-attendance';
        const [y, m, d] = item.date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        const statusColor = item.status === 'completed' ? theme.colors.success : (item.status === 'pending' ? theme.colors.warning : theme.colors.border);

        const toggleSelection = () => {
            const newSet = new Set(selectedIds);
            if (newSet.has(item.date)) newSet.delete(item.date); else newSet.add(item.date);
            setSelectedIds(newSet);
            if (newSet.size === 0) setSelectionMode(false);
        };

        return (
            <Animated.View entering={FadeInDown.delay(index * 30).duration(300).easing(Easing.out(Easing.quad))} layout={Layout.duration(200)}>
                <TouchableOpacity 
                    activeOpacity={0.9}
                    onPress={() => selectionMode ? toggleSelection() : router.push({ pathname: '/reports/details', params: { date: item.date } })} 
                    onLongPress={() => { setSelectionMode(true); toggleSelection(); }}
                    style={[styles.card, { backgroundColor: theme.colors.card, borderColor: isSelected ? theme.colors.primary : theme.colors.border, borderWidth: isSelected ? 2 : 1 }]}
                >
                    <View style={styles.dateBlock}>
                        <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase' }}>{format(dateObj, 'EEE')}</Text>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: theme.colors.text, marginTop: 2 }}>{format(dateObj, 'dd')}</Text>
                    </View>
                    <View style={{ width: 1, height: '60%', backgroundColor: theme.colors.border, marginHorizontal: 4 }} />
                    <View style={{ flex: 1, paddingLeft: 16, justifyContent: 'center' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                             <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                             {hasAttendance ? (
                                <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.3 }}>
                                    {item.clock_in ? format(new Date(item.clock_in), 'HH:mm') : '--:--'} <Text style={{ color: theme.colors.textSecondary }}>—</Text> {item.clock_out ? format(new Date(item.clock_out), 'HH:mm') : '--:--'}
                                </Text>
                             ) : (
                                <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary, fontStyle: 'italic' }}>Absent</Text>
                             )}
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <HugeiconsIcon icon={Task01Icon} size={14} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary }}>{item.accomplishments.length} Task{item.accomplishments.length !== 1 ? 's' : ''}</Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8 }}>
                        {selectionMode ? (
                             <View style={{ width: 20, height: 20, borderRadius: 6, borderWidth: isSelected ? 0 : 2, borderColor: theme.colors.border, backgroundColor: isSelected ? theme.colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                                {isSelected && <HugeiconsIcon icon={Tick02Icon} size={12} color="#fff" />}
                            </View>
                        ) : (
                            <View style={{ width: 4, height: 32, borderRadius: 2, backgroundColor: statusColor, opacity: hasAttendance ? 1 : 0.3 }} />
                        )}
                        {!selectionMode && (
                            <View style={{ marginLeft: 12 }}>
                                 <HugeiconsIcon icon={ArrowRight01Icon} size={16} color={theme.colors.border} />
                            </View>
                        )}
                    </View>
                </TouchableOpacity>
            </Animated.View>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
            <ModernAlert {...alertConfig} />
            <FloatingAlert visible={floatingAlert.visible} message={floatingAlert.message} type={floatingAlert.type as any} onHide={() => setFloatingAlert({...floatingAlert, visible: false})} />
            <LoadingOverlay visible={loadingAction} message="Processing..." />
            
            <CutoffSelectionModal 
                visible={modalVisible} 
                onClose={() => setModalVisible(false)} 
                availableDates={availableDates}
                currentRange={currentRange}
                onSelect={handleRangeSelect}
            />

            <ActionMenu 
                visible={actionMenuVisible}
                onClose={() => setActionMenuVisible(false)}
                anchor={menuAnchor}
                actions={[
                    { label: 'Add Entry', icon: PlusSignIcon, onPress: () => router.push('/reports/add-entry') },
                    { label: 'Share PDF', icon: File02Icon, onPress: handleSharePDF },
                    { label: 'Share Excel', icon: Share01Icon, onPress: handleShareExcel },
                ]}
            />

            {/* HEADER */}
            <TabHeader 
                title={selectionMode ? `${selectedIds.size} Selected` : "Reports"} 
                rightElement={
                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                        {!selectionMode && (
                            <TouchableOpacity onPress={async () => { await triggerSync(); fetchReports(); }} disabled={isSyncing} style={[styles.iconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                <Animated.View style={syncButtonStyle}><HugeiconsIcon icon={RefreshIcon} size={20} color={theme.colors.text} /></Animated.View>
                            </TouchableOpacity>
                        )}
                        {/* History Icon */}
                        {!selectionMode && (
                            <TouchableOpacity onPress={() => router.push('/reports/history')} style={[styles.iconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                <HugeiconsIcon icon={FileVerifiedIcon} size={20} color={theme.colors.text} />
                            </TouchableOpacity>
                        )}
                        {selectionMode && (
                            <TouchableOpacity onPress={() => {}} disabled={selectedIds.size === 0} style={{ backgroundColor: theme.colors.dangerLight, padding: 10, borderRadius: 100 }}>
                                <HugeiconsIcon icon={Delete02Icon} size={20} color={theme.colors.danger} />
                            </TouchableOpacity>
                        )}
                    </View>
                }
                leftElement={selectionMode ? <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedIds(new Set()); }} style={{ padding: 10 }}><HugeiconsIcon icon={Cancel01Icon} size={24} color={theme.colors.text} /></TouchableOpacity> : undefined}
            />

            <SyncStatusBar isSyncing={isSyncing} isOffline={isOffline} theme={theme} />

            {isLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
            ) : (
                <View style={{ flex: 1 }}>
                    {/* BODY SELECTION HEADER */}
                    <View style={[styles.bodyHeaderContainer, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.background }]}>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => setModalVisible(true)} style={styles.selectionBtn}>
                            <View>
                                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' }}>
                                    {currentRange?.type === 'period' ? 'Pay Period' : currentRange?.type === 'week' ? 'This Week' : currentRange?.type === 'month' ? 'This Month' : 'Custom'}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>{currentRange?.label || 'Select Date'}</Text>
                                    <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.primary} />
                                </View>
                            </View>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={(e) => { setMenuAnchor({ x: e.nativeEvent.pageX, y: e.nativeEvent.pageY + 20 }); setActionMenuVisible(true); }}
                            style={styles.moreBtn}
                        >
                            <HugeiconsIcon icon={MoreVerticalCircle01Icon} size={24} color={theme.colors.textSecondary} />
                        </TouchableOpacity>
                    </View>

                    <SectionList
                        sections={filteredSections}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        renderSectionHeader={({ section }: any) => {
                            // Smart Header: Hide duplicate title if body already shows the same period/range
                            if (filteredSections.length === 1 && currentRange?.type !== 'custom') return null;
                            return (
                                <TouchableOpacity activeOpacity={0.8} onPress={() => toggleSection(section.title)} style={styles.sectionHeader}>
                                    <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{section.title}</Text>
                                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>{format(new Date(section.start), 'MMM d')} — {format(new Date(section.end), 'MMM d, yyyy')}</Text>
                                </TouchableOpacity>
                            );
                        }}
                        contentContainerStyle={{ paddingBottom: 100 }}
                        showsVerticalScrollIndicator={false}
                        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} tintColor={theme.colors.primary} />}
                        ListEmptyComponent={
                            <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 80 }}>
                                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                                    <HugeiconsIcon icon={Search01Icon} size={32} color={theme.colors.textSecondary} />
                                </View>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>No reports found</Text>
                            </View>
                        }
                    />
                </View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    iconButton: { padding: 10, borderRadius: 99, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    bodyHeaderContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1 },
    selectionBtn: { flexDirection: 'row', alignItems: 'center', flex: 1 },
    moreBtn: { padding: 8 },
    card: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, paddingHorizontal: 16, marginHorizontal: 16, marginBottom: 8, borderRadius: 16, borderWidth: 1 },
    dateBlock: { alignItems: 'center', justifyContent: 'center', width: 44, marginRight: 8 },
    sectionHeader: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 12 },
    sectionTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.5, textTransform: 'uppercase' }
});