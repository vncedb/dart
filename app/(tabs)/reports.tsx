import {
    Calendar03Icon,
    Clock01Icon,
    Delete02Icon,
    File02Icon,
    Loading02Icon,
    MoreVerticalCircle01Icon,
    PrinterIcon,
    RepeatIcon,
    Search01Icon,
    Task01Icon,
    Tick02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import NetInfo from '@react-native-community/netinfo';
import { endOfWeek, format, getWeek, startOfWeek } from 'date-fns';
import { useFocusEffect, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    RefreshControl,
    SectionList,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    Easing,
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
import TabHeader from '../../components/TabHeader'; // Using shared component
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';

// --- Shared Styles & Components ---
const shadowStyle = Platform.select({
    ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 },
    android: { elevation: 2 }
});

const SyncStatusBar = ({ isSyncing, lastSynced, theme }: { isSyncing: boolean, lastSynced: Date | null, theme: any }) => {
    const rotation = useSharedValue(0);

    useEffect(() => {
        if (isSyncing) {
            rotation.value = withRepeat(withTiming(360, { duration: 1000, easing: Easing.linear }), -1);
        } else {
            rotation.value = 0;
        }
    }, [isSyncing]);

    const animatedStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value}deg` }] }));

    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, backgroundColor: theme.colors.background, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
            <Animated.View style={[animatedStyle, { marginRight: 8 }]}>
                {isSyncing ? (
                    <HugeiconsIcon icon={Loading02Icon} size={12} color={theme.colors.primary} />
                ) : (
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: theme.colors.success }} />
                )}
            </Animated.View>
            <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary }}>
                {isSyncing ? 'Syncing with cloud...' : lastSynced ? `Last Synced: ${format(lastSynced, 'h:mm a')}` : 'Offline Mode'}
            </Text>
        </View>
    );
};

export default function ReportsScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    
    const { triggerSync, isSyncing, lastSynced } = useSync();
    
    const [sections, setSections] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadingAction, setLoadingAction] = useState(false);
    
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [isOffline, setIsOffline] = useState(false);
    
    // Selection Mode
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [selectionMode, setSelectionMode] = useState(false);

    // Menus & Alerts
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuTarget, setMenuTarget] = useState<any>(null);
    const [menuPosition, setMenuPosition] = useState({ top: 0, right: 20 });
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    const [floatingAlert, setFloatingAlert] = useState({ visible: false, message: '', type: 'success' as 'success' | 'error' });

    // Monitor Connectivity
    useEffect(() => {
        const unsubscribe = NetInfo.addEventListener(state => {
            setIsOffline(!(state.isConnected && state.isInternetReachable));
        });
        return unsubscribe;
    }, []);

    // Prevent back gesture during critical actions
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (loadingAction) e.preventDefault();
        });
        return unsubscribe;
    }, [navigation, loadingAction]);

    useFocusEffect(
        useCallback(() => {
            fetchReports();
            setSelectionMode(false);
            setSelectedIds(new Set());
        }, [])
    );

    const fetchReports = async () => {
        try {
            const db = await getDB();
            
            // 1. Get Current User & Job Context (Offline First)
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            
            if (!userId) {
                // If strictly offline and session expired, we might need to handle this differently
                // usually supabase persists session.
                setIsLoading(false);
                return;
            }

            const profile = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [userId]);
            const currentJobId = (profile as any)?.current_job_id;
            setActiveJobId(currentJobId);

            let currentPayoutType = 'Bi-weekly'; 

            if (currentJobId) {
                const job: any = await db.getFirstAsync('SELECT title, payout_type FROM job_positions WHERE id = ?', [currentJobId]);
                if (job && job.payout_type) currentPayoutType = job.payout_type;
            } else {
                setSections([]);
                setIsLoading(false);
                return;
            }

            // 2. Fetch Data (Local DB)
            const attendance = await db.getAllAsync('SELECT * FROM attendance WHERE user_id = ? AND job_id = ? ORDER BY date DESC', [userId, currentJobId]);
            const tasks = await db.getAllAsync('SELECT * FROM accomplishments WHERE user_id = ? AND job_id = ?', [userId, currentJobId]);
            
            // 3. Process Data
            const allDates = new Set([
                ...(attendance?.map((a: any) => a.date) || []),
                ...(tasks?.map((t: any) => t.date) || [])
            ]);
            
            // Parse dates safely to avoid timezone issues causing "missing" reports
            const sortedDates = Array.from(allDates).sort((a, b) => {
                return new Date(b).getTime() - new Date(a).getTime();
            });

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

            // 4. Group by Payout Type
            const grouped = merged.reduce((acc: any, curr) => {
                // Safe Date Parsing
                const [y, m, d] = curr.date.split('-').map(Number);
                const date = new Date(y, m - 1, d); // Construct local date object

                let groupKey = "";
                let dateRange = {};
                let isCurrent = false;
                const today = new Date();

                if (currentPayoutType === 'Weekly') {
                    const weekNum = getWeek(date);
                    const start = startOfWeek(date, { weekStartsOn: 1 });
                    const end = endOfWeek(date, { weekStartsOn: 1 });
                    groupKey = `Week ${weekNum} (${format(start, 'MMM d')} - ${format(end, 'MMM d')})`;
                    dateRange = { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
                    if (weekNum === getWeek(today) && date.getFullYear() === today.getFullYear()) isCurrent = true;

                } else if (currentPayoutType === 'Monthly') {
                    groupKey = format(date, 'MMMM yyyy');
                    const start = new Date(date.getFullYear(), date.getMonth(), 1);
                    const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
                    dateRange = { start: format(start, 'yyyy-MM-dd'), end: format(end, 'yyyy-MM-dd') };
                    if (date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) isCurrent = true;

                } else {
                    // Bi-weekly / Cutoff
                    const day = date.getDate();
                    const month = date.toLocaleString('default', { month: 'long' });
                    const year = date.getFullYear();
                    const monthNum = date.getMonth() + 1;
                    const monthStr = monthNum < 10 ? `0${monthNum}` : monthNum;

                    if (day <= 15) {
                        groupKey = `1st Cutoff ${month} ${year}`;
                        dateRange = { start: `${year}-${monthStr}-01`, end: `${year}-${monthStr}-15` };
                        if (today.getFullYear() === year && today.getMonth() + 1 === monthNum && today.getDate() <= 15) isCurrent = true;
                    } else {
                        groupKey = `2nd Cutoff ${month} ${year}`;
                        const lastDay = new Date(year, monthNum, 0).getDate();
                        dateRange = { start: `${year}-${monthStr}-16`, end: `${year}-${monthStr}-${lastDay}` };
                        if (today.getFullYear() === year && today.getMonth() + 1 === monthNum && today.getDate() > 15) isCurrent = true;
                    }
                }

                if (!acc[groupKey]) {
                    acc[groupKey] = { 
                        title: groupKey, 
                        data: [], 
                        ...dateRange, 
                        isCurrent 
                    };
                }
                acc[groupKey].data.push(curr);
                return acc;
            }, {});

            setSections(Object.values(grouped));

        } catch (e) { console.log("Fetch Error", e); } finally { 
            setRefreshing(false); 
            setIsLoading(false); 
        }
    };

    const handleManualSync = async () => {
        if (isOffline) {
            setFloatingAlert({ visible: true, message: 'You are currently offline.', type: 'error' });
            return;
        }
        try {
            await triggerSync();
            setFloatingAlert({ visible: true, message: 'Data synchronized successfully', type: 'success' });
            fetchReports();
        } catch (e) {
            setFloatingAlert({ visible: true, message: 'Sync failed. Check connection.', type: 'error' });
        }
    };

    const handleDeleteSelected = () => {
        if (selectedIds.size === 0) return;
        setAlertConfig({
            visible: true,
            type: 'confirm',
            title: 'Delete Reports',
            message: `Delete ${selectedIds.size} selected item(s)? This cannot be undone.`,
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                setLoadingAction(true);
                try {
                    const db = await getDB();
                    const { data: { session } } = await supabase.auth.getSession();
                    const userId = session?.user?.id;
                    if (!userId || !activeJobId) return;

                    for (const date of Array.from(selectedIds)) {
                        // Queue Sync Deletions
                        const att = await db.getFirstAsync('SELECT id FROM attendance WHERE user_id = ? AND date = ?', [userId, date]);
                        if(att) await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action) VALUES (?, ?, ?)', ['attendance', (att as any).id, 'DELETE']);
                        
                        const tasks = await db.getAllAsync('SELECT id FROM accomplishments WHERE user_id = ? AND date = ?', [userId, date]);
                        for(const t of tasks as any[]) {
                            await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action) VALUES (?, ?, ?)', ['accomplishments', t.id, 'DELETE']);
                        }

                        // Local Delete
                        await db.runAsync('DELETE FROM attendance WHERE user_id = ? AND job_id = ? AND date = ?', [userId, activeJobId, date]);
                        await db.runAsync('DELETE FROM accomplishments WHERE user_id = ? AND job_id = ? AND date = ?', [userId, activeJobId, date]);
                    }

                    setSelectionMode(false);
                    setSelectedIds(new Set());
                    await fetchReports();
                    if (!isOffline) triggerSync(); 
                    setFloatingAlert({ visible: true, message: 'Reports deleted', type: 'success' });
                } catch (e) { console.log(e); } finally { setLoadingAction(false); }
            }
        });
    };

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedIds(newSet);
        if (newSet.size === 0) setSelectionMode(false);
    };

    const onGenerateReport = async () => {
        setMenuVisible(false);
        if (!menuTarget || menuTarget.data.length === 0) {
            setFloatingAlert({ visible: true, message: 'No data to generate.', type: 'error' });
            return;
        }
        
        // Log generation if online
        if (!isOffline) {
            const { data: { user } } = await supabase.auth.getSession();
            if (user) {
                supabase.from('report_history').insert({ 
                    user_id: user.id, 
                    title: menuTarget.title, 
                    start_date: menuTarget.start, 
                    end_date: menuTarget.end 
                }).then(() => {}); 
            }
        }

        router.push({ 
            pathname: '/reports/print', 
            params: { 
                mode: 'cutoff', 
                startDate: menuTarget.start, 
                endDate: menuTarget.end, 
                title: menuTarget.title, 
                jobId: activeJobId 
            } 
        });
    };

    const renderSectionHeader = ({ section }: any) => (
        <View style={{ backgroundColor: theme.colors.background, paddingHorizontal: 4, paddingTop: 24, paddingBottom: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    {section.isCurrent && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.success }} />}
                    <Text style={{ fontSize: 13, fontWeight: '800', color: theme.colors.text, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                        {section.title}
                    </Text>
                </View>
                <Text style={{ fontSize: 11, fontWeight: '600', color: theme.colors.textSecondary }}>
                    {section.data.length} Records • {format(new Date(section.start), 'MMM d')} - {format(new Date(section.end), 'MMM d')}
                </Text>
            </View>
            <TouchableOpacity 
                onPress={(e) => { 
                    setMenuTarget(section); 
                    setMenuPosition({ top: e.nativeEvent.pageY + 10, right: 20 }); 
                    setMenuVisible(true); 
                }}
                style={{ padding: 4 }}
            >
                <HugeiconsIcon icon={MoreVerticalCircle01Icon} size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
        </View>
    );

    const renderItem = ({ item }: any) => {
        const isSelected = selectedIds.has(item.date);
        const hasAttendance = item.status !== 'no-attendance';
        // Ensure date parsing is safe
        const [y, m, d] = item.date.split('-').map(Number);
        const dateObj = new Date(y, m - 1, d);
        
        return (
            <TouchableOpacity 
                activeOpacity={0.7}
                onPress={() => selectionMode ? toggleSelection(item.date) : router.push({ pathname: '/reports/details', params: { date: item.date } })} 
                onLongPress={() => { setSelectionMode(true); toggleSelection(item.date); }}
                style={[
                    styles.card, 
                    { 
                        backgroundColor: isSelected ? theme.colors.primary + '10' : theme.colors.card, 
                        borderColor: isSelected ? theme.colors.primary : theme.colors.border 
                    }
                ]}
            >
                <View style={[styles.dateBadge, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary, textTransform: 'uppercase' }}>
                        {format(dateObj, 'EEE')}
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: theme.colors.text }}>
                        {format(dateObj, 'd')}
                    </Text>
                </View>

                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                        <HugeiconsIcon icon={Clock01Icon} size={14} color={hasAttendance ? theme.colors.primary : theme.colors.textSecondary} />
                        <Text style={{ marginLeft: 6, fontSize: 14, fontWeight: '700', color: hasAttendance ? theme.colors.text : theme.colors.textSecondary }}>
                            {hasAttendance && item.clock_in ? format(new Date(item.clock_in), 'h:mm a') : 'No Attendance'}
                        </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', opacity: 0.8 }}>
                        <HugeiconsIcon icon={Task01Icon} size={14} color={theme.colors.textSecondary} />
                        <Text style={{ marginLeft: 6, fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary }}>
                            {item.accomplishments.length} Task{item.accomplishments.length !== 1 ? 's' : ''}
                        </Text>
                    </View>
                </View>

                {selectionMode ? (
                    <View style={{ width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: isSelected ? theme.colors.primary : theme.colors.border, backgroundColor: isSelected ? theme.colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                        {isSelected && <HugeiconsIcon icon={Tick02Icon} size={14} color="#fff" />}
                    </View>
                ) : (
                    <HugeiconsIcon 
                        icon={item.status === 'completed' ? Tick02Icon : File02Icon} 
                        size={20} 
                        color={item.status === 'completed' ? theme.colors.success : theme.colors.border} 
                    />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            <ModernAlert {...alertConfig} />
            <FloatingAlert visible={floatingAlert.visible} message={floatingAlert.message} type={floatingAlert.type} onHide={() => setFloatingAlert({...floatingAlert, visible: false})} />
            <LoadingOverlay visible={loadingAction} message="Processing..." />

            {selectionMode ? (
                <View style={[styles.header, { borderBottomColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={() => { setSelectionMode(false); setSelectedIds(new Set()); }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 16, fontWeight: '600' }}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.text }}>{selectedIds.size} Selected</Text>
                    </View>
                    <TouchableOpacity onPress={handleDeleteSelected} disabled={selectedIds.size === 0} style={{ backgroundColor: theme.colors.dangerLight, padding: 8, borderRadius: 100 }}>
                        <HugeiconsIcon icon={Delete02Icon} size={22} color={theme.colors.danger} />
                    </TouchableOpacity>
                </View>
            ) : (
                <TabHeader 
                    title="Reports" 
                    subtitle={isOffline ? "You're offline. Data may be outdated and incomplete. Check your internet connection." : undefined}
                    rightElement={
                        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                            <TouchableOpacity 
                                onPress={handleManualSync} 
                                disabled={isSyncing}
                                style={[styles.iconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                            >
                                <HugeiconsIcon icon={RepeatIcon} size={20} color={theme.colors.text} />
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={() => router.push('/reports/history')} 
                                style={[styles.iconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                            >
                                <HugeiconsIcon icon={Calendar03Icon} size={20} color={theme.colors.text} />
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            <SyncStatusBar isSyncing={isSyncing} lastSynced={lastSynced} theme={theme} />

            <ActionMenu 
                visible={menuVisible} 
                onClose={() => setMenuVisible(false)} 
                actions={[{ label: 'Generate & Print', icon: PrinterIcon, onPress: onGenerateReport, color: '#6366f1' }]} 
                position={menuPosition} 
            />

            {isLoading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={theme.colors.primary} />
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    renderSectionHeader={renderSectionHeader}
                    contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchReports(); }} tintColor={theme.colors.primary} />}
                    stickySectionHeadersEnabled={false}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 60 }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 16, borderWidth: 2, borderColor: theme.colors.border, borderStyle: 'dashed' }}>
                                <HugeiconsIcon icon={Search01Icon} size={32} color={theme.colors.textSecondary} />
                            </View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.text }}>No reports found</Text>
                            <Text style={{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, maxWidth: 220 }}>
                                Start by clocking in or adding a manual entry to see your reports here.
                            </Text>
                        </View>
                    }
                />
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: { paddingHorizontal: 24, paddingVertical: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1 },
    iconButton: { padding: 10, borderRadius: 99, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
    card: { 
        flexDirection: 'row', 
        alignItems: 'center', 
        padding: 16, 
        marginBottom: 12, 
        borderRadius: 20, 
        borderWidth: 1, 
        gap: 16,
        ...shadowStyle 
    },
    dateBadge: { 
        width: 52, 
        height: 56, 
        borderRadius: 14, 
        alignItems: 'center', 
        justifyContent: 'center', 
        borderWidth: 1 
    }
});