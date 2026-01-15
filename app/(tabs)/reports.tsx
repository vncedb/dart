import {
    ArrowRight01Icon,
    Calendar03Icon,
    Cancel01Icon,
    Clock01Icon,
    Delete02Icon,
    MoreVerticalCircle01Icon,
    PrinterIcon,
    RepeatIcon,
    Search01Icon,
    Task01Icon,
    Tick02Icon,
    WifiOff01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import NetInfo from '@react-native-community/netinfo';
import { format } from 'date-fns';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    BackHandler,
    GestureResponderEvent,
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
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionMenu from '../../components/ActionMenu';
import FloatingAlert from '../../components/FloatingAlert';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import TabHeader from '../../components/TabHeader';
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';
import { ReportService } from '../../services/ReportService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// MODIFIED: Only shows when Syncing or Offline. Hidden otherwise.
const SyncStatusBar = ({ isSyncing, isOffline, theme }: { isSyncing: boolean, isOffline: boolean, theme: any }) => {
    if (!isSyncing && !isOffline) return null;

    let icon, message, bgColor, textColor;

    if (isSyncing) {
        icon = <ActivityIndicator size="small" color={theme.colors.primary} />;
        message = "Syncing data...";
        bgColor = theme.colors.background;
        textColor = theme.colors.primary;
    } else { // isOffline
        icon = <HugeiconsIcon icon={WifiOff01Icon} size={16} color={theme.colors.danger} />;
        message = "You are offline. Data may be outdated.";
        bgColor = theme.colors.danger + '10';
        textColor = theme.colors.danger;
    }

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, backgroundColor: bgColor, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
            <View style={{ marginRight: 8 }}>{icon}</View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: textColor }}>{message}</Text>
        </View>
    );
};

export default function ReportsScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    const { triggerSync, isSyncing } = useSync();
    
    // Data State
    const [sections, setSections] = useState<any[]>([]);
    const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
    
    // UI State
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);
    const [isOffline, setIsOffline] = useState(false);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);

    // Selection State
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);

    // Menu State
    const [menuVisible, setMenuVisible] = useState(false);
    const [targetSection, setTargetSection] = useState<any>(null);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number, y: number } | undefined>(undefined);
    
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    const [floatingAlert, setFloatingAlert] = useState({ visible: false, message: '', type: 'success' });

    const syncButtonRotation = useSharedValue(0);

    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOffline(!(state.isConnected && state.isInternetReachable));
        });
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
    
    const syncButtonStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${syncButtonRotation.value}deg` }]
    }));

    useEffect(() => {
        const onBackPress = () => {
            if (selectionMode) {
                setSelectionMode(false);
                setSelectedIds(new Set());
                return true;
            }
            return false;
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => backHandler.remove();
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

            const job: any = await ReportService.getActiveJob(userId);
            if (!job) { setSections([]); setIsLoading(false); return; }
            
            setActiveJobId(job.id);

            const attendance = await db.getAllAsync('SELECT * FROM attendance WHERE user_id = ? AND job_id = ? ORDER BY date DESC', [userId, job.id]);
            const tasks = await db.getAllAsync('SELECT * FROM accomplishments WHERE user_id = ? AND job_id = ?', [userId, job.id]);
            
            const allDates = new Set([ ...(attendance?.map((a: any) => a.date) || []), ...(tasks?.map((t: any) => t.date) || []) ]);
            const sortedDates = Array.from(allDates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

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

            const grouped = ReportService.groupReportsByPayout(merged, job.payout_type || 'Bi-weekly');
            const newSections = Object.values(grouped);
            setSections(newSections);

        } catch (e) { console.log("Fetch Error", e); } finally { setRefreshing(false); setIsLoading(false); }
    };

    const toggleSection = (title: string) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setCollapsedSections(prev => {
            const next = new Set(prev);
            if (next.has(title)) next.delete(title);
            else next.add(title);
            return next;
        });
    };

    const handleMenuOpen = (section: any, event: GestureResponderEvent) => {
        const { pageX, pageY } = event.nativeEvent;
        // Anchor below the touch point
        setMenuAnchor({ x: pageX, y: pageY + 15 });
        setTargetSection(section);
        setMenuVisible(true);
    };

    const handlePrintSection = () => {
        if (!targetSection) return;
        const logPrint = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user && !isOffline) {
                supabase.from('report_history').insert({ user_id: user.id, title: targetSection.title, start_date: targetSection.start, end_date: targetSection.end }).then(() => {}); 
            }
        }
        logPrint();
        router.push({ 
            pathname: '/reports/print', 
            params: { mode: 'cutoff', startDate: targetSection.start, endDate: targetSection.end, title: targetSection.title, jobId: activeJobId } 
        });
    };

    const handleDeleteSection = () => {
        if (!targetSection) return;
        setAlertConfig({
            visible: true, 
            type: 'confirm', 
            title: 'Delete Entire Period?', 
            message: `This will permanently delete all ${targetSection.data.length} reports in "${targetSection.title}". This cannot be undone.`,
            confirmText: 'Delete All',
            cancelText: 'Cancel',
            onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                setLoadingAction(true);
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const userId = session?.user?.id;
                    if (userId && activeJobId) {
                        for (const item of targetSection.data) {
                            await ReportService.deleteReportDay(userId, activeJobId, item.date);
                        }
                        await fetchReports();
                        setFloatingAlert({ visible: true, message: 'Period deleted', type: 'success' });
                    }
                } catch (e) { console.log(e); } finally { setLoadingAction(false); }
            }
        });
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        setAlertConfig({
            visible: true, type: 'confirm', title: 'Delete Reports', message: `Delete ${selectedIds.size} selected item(s)?`, confirmText: 'Delete', cancelText: 'Cancel',
            onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                setLoadingAction(true);
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    const userId = session?.user?.id;
                    if (userId && activeJobId) {
                        for (const date of Array.from(selectedIds)) {
                            await ReportService.deleteReportDay(userId, activeJobId, date);
                        }
                        setSelectionMode(false); setSelectedIds(new Set()); await fetchReports();
                        setFloatingAlert({ visible: true, message: 'Deleted successfully', type: 'success' });
                    }
                } catch (e) { console.log(e); } finally { setLoadingAction(false); }
            }
        });
    };

    const handleManualSync = async () => {
        if (isOffline) { setFloatingAlert({ visible: true, message: 'You are currently offline.', type: 'error' }); return; }
        try {
            await triggerSync();
            setFloatingAlert({ visible: true, message: 'Data synchronized', type: 'success' });
            fetchReports();
        } catch (e) { setFloatingAlert({ visible: true, message: 'Sync failed.', type: 'error' }); }
    };

    const renderSectionHeader = ({ section }: any) => {
        const isCollapsed = collapsedSections.has(section.title);
        
        return (
            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => toggleSection(section.title)}
                style={{ 
                    backgroundColor: theme.colors.background, 
                    paddingHorizontal: 20, 
                    paddingTop: 24, 
                    paddingBottom: 12,
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end'
                }}
            >
                <View>
                    <Text style={{ 
                        fontSize: 18, 
                        fontWeight: '800', 
                        color: theme.colors.text, 
                        letterSpacing: -0.5,
                        textTransform: 'uppercase'
                    }}>
                        {section.title}
                    </Text>
                    <Text style={{ 
                        fontSize: 12, 
                        fontWeight: '500', 
                        color: theme.colors.textSecondary, 
                        marginTop: 4 
                    }}>
                        {format(new Date(section.start), 'MMM d')} — {format(new Date(section.end), 'MMM d, yyyy')}
                    </Text>
                </View>
                
                <TouchableOpacity 
                    onPress={(e) => { e.stopPropagation(); handleMenuOpen(section, e); }}
                    style={{ padding: 8, marginRight: -8, marginBottom: -4 }}
                    hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                    <HugeiconsIcon icon={MoreVerticalCircle01Icon} size={22} color={theme.colors.textSecondary} />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    const renderItem = ({ item, section }: any) => {
        if (collapsedSections.has(section.title)) return null;

        const isSelected = selectedIds.has(item.date);
        const hasAttendance = item.status !== 'no-attendance';
        const [y, m, d] = item.date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        
        const isCompleted = item.status === 'completed';
        const isPending = item.status === 'pending';
        // Status color determines the "border-left" indicator
        const statusColor = isCompleted ? theme.colors.success : (isPending ? theme.colors.warning : theme.colors.border);

        const toggleSelection = (id: string) => {
            const newSet = new Set(selectedIds);
            if (newSet.has(id)) newSet.delete(id);
            else newSet.add(id);
            setSelectedIds(newSet);
            if (newSet.size === 0) setSelectionMode(false);
        };

        return (
            <TouchableOpacity 
                activeOpacity={0.9}
                onPress={() => selectionMode ? toggleSelection(item.date) : router.push({ pathname: '/reports/details', params: { date: item.date } })} 
                onLongPress={() => { setSelectionMode(true); toggleSelection(item.date); }}
                style={[
                    styles.card, 
                    { 
                        backgroundColor: theme.colors.card, 
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                        borderWidth: isSelected ? 2 : 1, 
                    }
                ]}
            >
                {/* Left: Date Block */}
                <View style={styles.dateBlock}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase' }}>
                        {format(dateObj, 'EEE')}
                    </Text>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: theme.colors.text, marginTop: 2 }}>
                        {format(dateObj, 'dd')}
                    </Text>
                </View>

                {/* Vertical Divider */}
                <View style={{ width: 1, height: '60%', backgroundColor: theme.colors.border, marginHorizontal: 4 }} />

                {/* Middle: Content */}
                <View style={{ flex: 1, paddingLeft: 16, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                         <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                         {hasAttendance ? (
                            <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, letterSpacing: -0.3 }}>
                                {item.clock_in ? format(new Date(item.clock_in), 'HH:mm') : '--:--'} 
                                <Text style={{ color: theme.colors.textSecondary, fontWeight: '400' }}> — </Text> 
                                {item.clock_out ? format(new Date(item.clock_out), 'HH:mm') : '--:--'}
                            </Text>
                         ) : (
                            <Text style={{ fontSize: 14, fontWeight: '500', color: theme.colors.textSecondary, fontStyle: 'italic' }}>Absent</Text>
                         )}
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <HugeiconsIcon icon={Task01Icon} size={14} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary }}>
                            {item.accomplishments.length} Task{item.accomplishments.length !== 1 ? 's' : ''}
                        </Text>
                    </View>
                </View>

                {/* Right: Status Indicator & Selection */}
                <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: 8 }}>
                    {selectionMode ? (
                         <View style={{ 
                            width: 20, height: 20, borderRadius: 6, 
                            borderWidth: isSelected ? 0 : 2, 
                            borderColor: theme.colors.border, 
                            backgroundColor: isSelected ? theme.colors.primary : 'transparent', 
                            alignItems: 'center', justifyContent: 'center' 
                        }}>
                            {isSelected && <HugeiconsIcon icon={Tick02Icon} size={12} color="#fff" />}
                        </View>
                    ) : (
                        // Sleek vertical status pill
                        <View style={{ 
                            width: 4, 
                            height: 32, 
                            borderRadius: 2, 
                            backgroundColor: statusColor,
                            opacity: hasAttendance ? 1 : 0.3 
                        }} />
                    )}
                     {/* Chevron visual hint if not selecting */}
                    {!selectionMode && (
                        <View style={{ marginLeft: 12 }}>
                             <HugeiconsIcon icon={ArrowRight01Icon} size={16} color={theme.colors.border} />
                        </View>
                    )}
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            <ModernAlert {...alertConfig} />
            <FloatingAlert visible={floatingAlert.visible} message={floatingAlert.message} type={floatingAlert.type as any} onHide={() => setFloatingAlert({...floatingAlert, visible: false})} />
            <LoadingOverlay visible={loadingAction} message="Processing..." />
            
            {/* Action Menu */}
            <ActionMenu 
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                anchor={menuAnchor}
                actions={[
                    { label: 'Print Report', icon: PrinterIcon, onPress: handlePrintSection },
                    { label: 'Delete Records', icon: Delete02Icon, onPress: handleDeleteSection, destructive: true }
                ]}
            />

            {selectionMode ? (
                <TabHeader 
                    title={`${selectedIds.size} Selected`}
                    leftElement={
                        <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedIds(new Set()); }} style={{ padding: 10 }}>
                             <HugeiconsIcon icon={Cancel01Icon} size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    }
                    rightElement={
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TouchableOpacity onPress={handleDeleteSelected} disabled={selectedIds.size === 0} style={{ backgroundColor: theme.colors.dangerLight, padding: 10, borderRadius: 100 }}>
                                <HugeiconsIcon icon={Delete02Icon} size={20} color={theme.colors.danger} />
                            </TouchableOpacity>
                        </View>
                    }
                />
            ) : (
                <TabHeader 
                    title="Reports" 
                    rightElement={
                        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            <TouchableOpacity onPress={handleManualSync} disabled={isSyncing} style={[styles.iconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                <Animated.View style={syncButtonStyle}><HugeiconsIcon icon={RepeatIcon} size={20} color={theme.colors.text} /></Animated.View>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => router.push('/reports/history')} style={[styles.iconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                <HugeiconsIcon icon={Calendar03Icon} size={20} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            <SyncStatusBar isSyncing={isSyncing} isOffline={isOffline} theme={theme} />

            {isLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} tintColor={theme.colors.primary} />}
                    stickySectionHeadersEnabled={false}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 80 }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                                <HugeiconsIcon icon={Search01Icon} size={32} color={theme.colors.textSecondary} />
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>No reports found</Text>
                            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, maxWidth: 220 }}>Start by clocking in to see your reports.</Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    iconButton: { padding: 10, borderRadius: 99, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    card: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        paddingVertical: 14,
        paddingHorizontal: 16,
        marginHorizontal: 16,
        marginBottom: 8, 
        borderRadius: 16, // Modern "Squircle" radius
        // Removed heavy shadow for clean "Bordered" look
        borderWidth: 1, 
    },
    dateBlock: {
        alignItems: 'center',
        justifyContent: 'center',
        width: 44,
        marginRight: 8
    }
});