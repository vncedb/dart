import {
    Clock01Icon,
    Delete02Icon,
    PencilEdit02Icon,
    Task01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedList } from '../../components/AnimatedList';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import TimePicker from '../../components/TimePicker';
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';
import { ReportService } from '../../services/ReportService';

export default function EditReportScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    const { triggerSync } = useSync();
    const { date } = useLocalSearchParams();
    
    const [attendanceId, setAttendanceId] = useState<string | null>(null);
    const [clockIn, setClockIn] = useState<Date | null>(null);
    const [clockOut, setClockOut] = useState<Date | null>(null);
    const [tasks, setTasks] = useState<any[]>([]);

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    // Time Picker State
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerMode, setPickerMode] = useState<'in' | 'out'>('in');
    const [isDirty, setIsDirty] = useState(false);

    const scrollY = useSharedValue(0);
    const scrollHandler = useAnimatedScrollHandler((event) => {
        scrollY.value = event.contentOffset.y;
    });

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (loading || !isDirty) return;
            e.preventDefault();
            setAlertConfig({
                visible: true,
                type: 'warning',
                title: 'Unsaved Changes',
                message: 'You have unsaved changes. Are you sure you want to leave?',
                confirmText: 'Discard',
                cancelText: 'Keep Editing',
                onConfirm: () => {
                    setAlertConfig((p: any) => ({ ...p, visible: false }));
                    setIsDirty(false);
                    navigation.dispatch(e.data.action);
                },
                onCancel: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
            });
        });
        return unsubscribe;
    }, [navigation, loading, isDirty]);

    const fetchData = useCallback(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !date) return;

        try {
            const { attendance, tasks: t } = await ReportService.getDailyReport(user.id, date as string);
            const att: any = attendance; 

            if (att) {
                setAttendanceId(att.id);
                setClockIn(new Date(att.clock_in));
                setClockOut(att.clock_out ? new Date(att.clock_out) : null);
            }

            const processedTasks = (t || []).map((task: any) => {
                let images: string[] = [];
                if (task.image_url) {
                    try {
                        const parsed = JSON.parse(task.image_url);
                        images = Array.isArray(parsed) ? parsed : [task.image_url];
                    } catch {
                        images = [task.image_url];
                    }
                }
                return { ...task, images };
            });
            
            setTasks(processedTasks || []);
            setIsDirty(false);
        } catch (e) {
            console.log(e);
        } finally {
            setInitialLoading(false);
        }
    }, [date]);

    useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

    const handleSave = async () => {
        setLoading(true);
        try {
            if (attendanceId && clockIn) {
                const db = await getDB();
                const now = new Date().toISOString();
                
                const clockInStr = clockIn.toISOString();
                const clockOutStr = clockOut ? clockOut.toISOString() : null;
                const status = clockOut ? 'completed' : 'pending';

                await db.runAsync(
                    'UPDATE attendance SET clock_in = ?, clock_out = ?, status = ?, updated_at = ? WHERE id = ?',
                    [clockInStr, clockOutStr, status, now, attendanceId]
                );

                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)',
                    ['attendance', attendanceId, 'UPDATE', JSON.stringify({ clock_in: clockInStr, clockOutStr, status, updated_at: now })]
                );
                triggerSync();
            }
            setIsDirty(false);
            router.back();
        } catch (e: any) {
            setAlertConfig({ visible: true, type: 'error', title: 'Save Failed', message: e.message, confirmText: 'Okay', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
        } finally {
            setLoading(false);
        }
    };

    const openPicker = (mode: 'in' | 'out') => {
        setPickerMode(mode);
        setPickerVisible(true);
    };

    const handleTimeConfirm = (hours: number, minutes: number, period?: "AM" | "PM") => {
        let h24 = hours;
        if (period === "PM" && hours !== 12) h24 += 12;
        if (period === "AM" && hours === 12) h24 = 0;

        if (pickerMode === 'in') {
            const baseDate = clockIn ? new Date(clockIn) : new Date(date as string);
            baseDate.setHours(h24, minutes, 0, 0);
            setClockIn(baseDate);
        } else {
            const inDate = clockIn ? new Date(clockIn) : new Date(date as string);
            const outDate = clockOut ? new Date(clockOut) : new Date(inDate);
            outDate.setFullYear(inDate.getFullYear(), inDate.getMonth(), inDate.getDate());
            outDate.setHours(h24, minutes, 0, 0);
            if (outDate < inDate) outDate.setDate(outDate.getDate() + 1);
            setClockOut(outDate);
        }
        setIsDirty(true);
    };

    const deleteTask = (taskId: string) => {
        setAlertConfig({
            visible: true, type: 'warning', title: 'Delete Task', message: 'Are you sure you want to remove this task? This cannot be undone.', confirmText: 'Delete', cancelText: 'Cancel',
            onConfirm: async () => {
                setAlertConfig((p: any) => ({...p, visible: false}));
                setLoading(true);
                try {
                    const db = await getDB();
                    await db.runAsync('DELETE FROM accomplishments WHERE id = ?', [taskId]);
                    await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)', ['accomplishments', taskId, 'DELETE', null]);
                    triggerSync();
                    fetchData(); 
                } catch (e) { console.log(e); } finally { setLoading(false); }
            },
            onCancel: () => setAlertConfig((p: any) => ({...p, visible: false}))
        });
    };

    const getInitialTime = (dateObj: Date | null): { h: number; m: number; p: "AM" | "PM" } => {
        if (!dateObj) return { h: 12, m: 0, p: 'AM' };
        let h = dateObj.getHours();
        const m = dateObj.getMinutes();
        const p: "AM" | "PM" = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return { h, m, p };
    };

    const initialPickerVals = getInitialTime(pickerMode === 'in' ? clockIn : clockOut);

    const renderTaskItem = (task: any) => (
        <View style={[styles.taskItem, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.taskItemContent}>
                {task.images && task.images.length > 0 ? (
                    <Image source={{ uri: task.images[0] }} style={[styles.taskThumb, { borderColor: theme.colors.border }]} />
                ) : (
                    <View style={[styles.taskThumbPlaceholder, { backgroundColor: theme.colors.background }]}>
                        <HugeiconsIcon icon={Task01Icon} size={20} color={theme.colors.icon} />
                    </View>
                )}
                
                <View style={{ flex: 1 }}>
                    <Text numberOfLines={1} style={[styles.taskTitleText, { color: theme.colors.text }]}>{task.description}</Text>
                    <Text numberOfLines={1} style={[styles.taskDescText, { color: theme.colors.textSecondary }]}>{task.remarks || 'No remarks'}</Text>
                </View>
            </View>
            
            <View style={[styles.taskActions, { borderTopColor: theme.colors.border }]}>
                <TouchableOpacity onPress={() => router.push({ pathname: '/reports/add-entry', params: { id: task.id } })} style={styles.actionBtn}>
                    <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.text} />
                    <Text style={[styles.actionBtnText, { color: theme.colors.text }]}>Edit</Text>
                </TouchableOpacity>
                
                <TouchableOpacity onPress={() => deleteTask(task.id)} style={styles.actionBtn}>
                    <HugeiconsIcon icon={Delete02Icon} size={16} color={theme.colors.danger} />
                    <Text style={[styles.actionBtnText, { color: theme.colors.danger }]}>Delete</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <LoadingOverlay visible={loading} message="Saving changes..." />
            <ModernAlert {...alertConfig} />
            
            <TimePicker
                visible={pickerVisible}
                onClose={() => setPickerVisible(false)}
                onConfirm={handleTimeConfirm}
                title={pickerMode === 'in' ? "Set Time In" : "Set Time Out"}
                initialHours={initialPickerVals.h}
                initialMinutes={initialPickerVals.m}
                initialPeriod={initialPickerVals.p}
            />

            <Header title="Edit Session" />

            {initialLoading ? (
               <View style={styles.center}>
                   <ActivityIndicator size="large" color={theme.colors.primary} />
               </View>
            ) : (
               <>
                <Animated.ScrollView 
                    contentContainerStyle={styles.scrollContent} 
                    showsVerticalScrollIndicator={false}
                    onScroll={scrollHandler}
                    scrollEventThrottle={16}
                >
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>TIME SETTINGS</Text>
                    
                    <View style={styles.timeGrid}>
                        {/* Time In */}
                        <TouchableOpacity onPress={() => openPicker('in')} style={[styles.timeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={styles.timeCardHeader}>
                                <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.success} />
                                <Text style={[styles.timeCardLabel, { color: theme.colors.textSecondary }]}>TIME IN</Text>
                            </View>
                            <View style={styles.timeCardBody}>
                                <Text style={[styles.timeCardValue, { color: theme.colors.text }]}>
                                    {clockIn ? clockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                </Text>
                                <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.icon} />
                            </View>
                        </TouchableOpacity>

                        {/* Time Out */}
                        <TouchableOpacity onPress={() => openPicker('out')} style={[styles.timeCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                            <View style={styles.timeCardHeader}>
                                <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.warning} />
                                <Text style={[styles.timeCardLabel, { color: theme.colors.textSecondary }]}>TIME OUT</Text>
                            </View>
                            <View style={styles.timeCardBody}>
                                <Text style={[styles.timeCardValue, { color: theme.colors.text }]}>
                                    {clockOut ? clockOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                </Text>
                                <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.icon} />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Tasks */}
                    <View style={styles.taskHeaderRow}>
                        <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginBottom: 0 }]}>LOGGED TASKS</Text>
                        <View style={[styles.taskCountBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                            <Text style={[styles.taskCountText, { color: theme.colors.primary }]}>{tasks.length}</Text>
                        </View>
                    </View>

                    {tasks.length === 0 ? (
                        <View style={[styles.emptyState, { borderColor: theme.colors.border }]}>
                            <HugeiconsIcon icon={Task01Icon} size={32} color={theme.colors.border} />
                            <Text style={{ marginTop: 8, color: theme.colors.textSecondary, fontFamily: 'Nunito_600SemiBold' }}>No tasks found.</Text>
                        </View>
                    ) : (
                        <AnimatedList data={tasks} renderItem={renderTaskItem} />
                    )}
                </Animated.ScrollView>

                <Footer>
                    <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
                        <Text style={styles.saveBtnText}>Save Changes</Text>
                    </TouchableOpacity>
                </Footer>
               </>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 24, paddingBottom: 100 },
    sectionTitle: { fontSize: 12, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
    
    timeGrid: { flexDirection: "row", gap: 12, marginBottom: 36 },
    timeCard: { flex: 1, padding: 20, borderRadius: 24, borderWidth: 1 },
    timeCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
    timeCardLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', textTransform: "uppercase", letterSpacing: 0.5 },
    timeCardBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    timeCardValue: { fontSize: 20, fontFamily: 'Nunito_700Bold' },

    taskHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 },
    taskCountBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    taskCountText: { fontSize: 12, fontFamily: 'Nunito_700Bold' },
    emptyState: { alignItems: 'center', padding: 30, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed' },
    
    taskItem: { 
        borderRadius: 20, 
        borderWidth: 1, 
        marginBottom: 16, // Fixed gap spacing
        shadowColor: "#000", 
        shadowOffset: { width: 0, height: 2 }, 
        shadowOpacity: 0.03, 
        shadowRadius: 8, 
        elevation: 1 
    },
    taskItemContent: { flexDirection: 'row', gap: 12, padding: 16 },
    taskThumb: { width: 44, height: 44, borderRadius: 12, borderWidth: 1 },
    taskThumbPlaceholder: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    taskTitleText: { fontSize: 15, fontFamily: 'Nunito_700Bold', marginBottom: 4 },
    taskDescText: { fontSize: 13, fontFamily: 'Nunito_500Medium' },
    taskActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    actionBtnText: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
    
    saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#4f46e5', height: 56, borderRadius: 16 },
    saveBtnText: { color: '#fff', fontSize: 16, fontFamily: 'Nunito_700Bold' }
});