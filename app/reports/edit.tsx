// filepath: vncedb/dart/dart-8346f6d6d3ba6721214d0c5b9d4684d9a2a9874e/app/reports/edit.tsx
import {
    Add01Icon,
    Cancel01Icon,
    Clock01Icon,
    Delete02Icon,
    MoreVerticalIcon,
    PencilEdit02Icon,
    Task01Icon,
    Time02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
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

import ActionMenu from '../../components/ActionMenu';
import { AnimatedList } from '../../components/AnimatedList';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import InputModal from '../../components/InputModal';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import TimePicker from '../../components/TimePicker';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { queueSyncItem } from '../../lib/database';
import { getDB } from '../../lib/db-client';

export default function EditReportScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    const { user } = useAuth();
    const { triggerSync } = useSync();
    const { date } = useLocalSearchParams();
    
    const [sessions, setSessions] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);

    const [loading, setLoading] = useState(false);
    const [initialLoading, setInitialLoading] = useState(true);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    // Action Menu State
    const moreIconRef = useRef<View>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);

    // Time Picker State
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerConfig, setPickerConfig] = useState<{ index: number; mode: 'in' | 'out' }>({ index: 0, mode: 'in' });
    const [isDirty, setIsDirty] = useState(false);

    // Rename Session Modal State
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [renamingIndex, setRenamingIndex] = useState<number | null>(null);

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
        if (!user || !date) return;

        try {
            const db = await getDB();
            const attendances: any[] = await db.getAllAsync(
                "SELECT * FROM attendance WHERE user_id = ? AND date = ? ORDER BY clock_in ASC",
                [user.id, date as string]
            );
            
            setSessions(attendances.map((a, i) => ({ ...a, title: a.title || `Session ${i + 1}` })));

            const t: any[] = await db.getAllAsync(
                "SELECT * FROM accomplishments WHERE user_id = ? AND date = ? ORDER BY created_at DESC",
                [user.id, date as string]
            );

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

    const handleMenuOpen = () => {
        if (moreIconRef.current) {
            moreIconRef.current.measure((x, y, width, height, pageX, pageY) => {
                setMenuAnchor({ x: pageX + width, y: pageY + height });
                setMenuVisible(true);
            });
        }
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            const db = await getDB();
            const now = new Date().toISOString();
            
            for (const session of sessions) {
                if (session.id && session.clock_in) {
                    const clockInStr = session.clock_in;
                    const clockOutStr = session.clock_out || null;
                    const status = clockOutStr ? 'completed' : 'pending';

                    // 1. UPDATE LOCALLY FIRST AND FLAG AS UN-SYNCED
                    await db.runAsync(
                        'UPDATE attendance SET clock_in = ?, clock_out = ?, status = ?, title = ?, updated_at = ?, is_synced = 0 WHERE id = ?',
                        [clockInStr, clockOutStr, status, session.title, now, session.id]
                    );

                    // 2. QUEUE FOR BACKGROUND SYNC
                    await queueSyncItem('attendance', session.id, 'UPDATE', {
                        clock_in: clockInStr,
                        clock_out: clockOutStr,
                        status,
                        title: session.title,
                        updated_at: now
                    });
                }
            }
            
            // 3. TRIGGER BACKGROUND SYNC ENGINE
            triggerSync();
            
            setIsDirty(false);
            router.back();
        } catch (e: any) {
            setAlertConfig({ visible: true, type: 'error', title: 'Save Failed', message: e.message, confirmText: 'Okay', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
        } finally {
            setLoading(false);
        }
    };

    const openPicker = (index: number, mode: 'in' | 'out') => {
        setPickerConfig({ index, mode });
        setPickerVisible(true);
    };

    const handleTimeConfirm = (hours: number, minutes: number, period?: "AM" | "PM") => {
        let h24 = hours;
        if (period === "PM" && hours !== 12) h24 += 12;
        if (period === "AM" && hours === 12) h24 = 0;

        const newSessions = [...sessions];
        const targetSession = newSessions[pickerConfig.index];

        if (pickerConfig.mode === 'in') {
            const baseDate = targetSession.clock_in ? new Date(targetSession.clock_in) : new Date(date as string);
            baseDate.setHours(h24, minutes, 0, 0);
            targetSession.clock_in = baseDate.toISOString();
        } else {
            const inDate = targetSession.clock_in ? new Date(targetSession.clock_in) : new Date(date as string);
            const outDate = targetSession.clock_out ? new Date(targetSession.clock_out) : new Date(inDate);
            outDate.setFullYear(inDate.getFullYear(), inDate.getMonth(), inDate.getDate());
            outDate.setHours(h24, minutes, 0, 0);
            if (outDate < inDate) outDate.setDate(outDate.getDate() + 1);
            targetSession.clock_out = outDate.toISOString();
        }
        
        setSessions(newSessions);
        setIsDirty(true);
    };

    const handleDeleteSession = (sessionId: string) => {
        setAlertConfig({
            visible: true, type: 'warning', title: 'Delete Session', message: 'Are you sure you want to remove this session?', confirmText: 'Delete', cancelText: 'Cancel',
            onConfirm: async () => {
                setAlertConfig((p: any) => ({...p, visible: false}));
                setSessions(sessions.filter(s => s.id !== sessionId));
                setIsDirty(true);
                
                try {
                    const db = await getDB();
                    // OFFLINE FIRST DELETION
                    await db.runAsync('DELETE FROM attendance WHERE id = ?', [sessionId]);
                    await queueSyncItem('attendance', sessionId, 'DELETE');
                    triggerSync();
                } catch (e) { console.log(e); }
            },
            onCancel: () => setAlertConfig((p: any) => ({...p, visible: false}))
        });
    };

    const deleteTask = (taskId: string) => {
        setAlertConfig({
            visible: true, type: 'warning', title: 'Delete Task', message: 'Are you sure you want to remove this task? This cannot be undone.', confirmText: 'Delete', cancelText: 'Cancel',
            onConfirm: async () => {
                setAlertConfig((p: any) => ({...p, visible: false}));
                setLoading(true);
                try {
                    const db = await getDB();
                    // OFFLINE FIRST DELETION
                    await db.runAsync('DELETE FROM accomplishments WHERE id = ?', [taskId]);
                    await queueSyncItem('accomplishments', taskId, 'DELETE');
                    triggerSync();
                    fetchData(); 
                } catch (e) { console.log(e); } finally { setLoading(false); }
            },
            onCancel: () => setAlertConfig((p: any) => ({...p, visible: false}))
        });
    };

    const getInitialTime = (): { h: number; m: number; p: "AM" | "PM" } => {
        if (!sessions || sessions.length === 0 || pickerConfig.index >= sessions.length) {
            return { h: 12, m: 0, p: 'AM' };
        }
        
        const target = sessions[pickerConfig.index];
        if (!target) return { h: 12, m: 0, p: 'AM' };
        
        const dateStr = pickerConfig.mode === 'in' ? target.clock_in : target.clock_out;
        if (!dateStr) return { h: 12, m: 0, p: 'AM' };
        
        const dateObj = new Date(dateStr);
        let h = dateObj.getHours();
        const m = dateObj.getMinutes();
        const p: "AM" | "PM" = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return { h, m, p };
    };

    const initialPickerVals = getInitialTime();

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
                title={pickerConfig.mode === 'in' ? "Set Time In" : "Set Time Out"}
                initialHours={initialPickerVals.h}
                initialMinutes={initialPickerVals.m}
                initialPeriod={initialPickerVals.p}
            />

            <InputModal 
                visible={renameModalVisible}
                onClose={() => { setRenameModalVisible(false); setRenamingIndex(null); }}
                title="Rename Session"
                placeholder="Enter session name..."
                initialValue={renamingIndex !== null ? sessions[renamingIndex]?.title : ''}
                onConfirm={(newTitle) => {
                    if (renamingIndex !== null && newTitle.trim()) {
                        const newSessions = [...sessions];
                        newSessions[renamingIndex].title = newTitle.trim();
                        setSessions(newSessions);
                        setIsDirty(true);
                    }
                }}
            />

            <Header 
                title="Edit Session" 
                rightElement={
                    <View ref={moreIconRef} collapsable={false}>
                        <TouchableOpacity onPress={handleMenuOpen} style={styles.headerMoreBtn}>
                            <HugeiconsIcon icon={MoreVerticalIcon} size={24} color={theme.colors.primary} />
                        </TouchableOpacity>
                    </View>
                }
            />

            <ActionMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                anchor={menuAnchor}
                actions={[
                    {
                        label: 'Add Entry',
                        icon: Add01Icon,
                        color: theme.colors.text,
                        onPress: () => {
                            setMenuVisible(false);
                            router.push({ pathname: '/reports/add-entry', params: { date: date as string, fixedDate: 'true' } });
                        }
                    },
                    {
                        label: 'Discard',
                        icon: Cancel01Icon,
                        destructive: true,
                        onPress: () => {
                            setMenuVisible(false);
                            if (isDirty) {
                                setAlertConfig({
                                    visible: true, type: 'warning', title: 'Discard Changes', message: 'Are you sure you want to discard your changes?',
                                    confirmText: 'Discard', cancelText: 'Keep Editing',
                                    onConfirm: () => { setIsDirty(false); setAlertConfig((p:any) => ({...p, visible: false})); router.back(); },
                                    onCancel: () => setAlertConfig((p:any) => ({...p, visible: false}))
                                });
                            } else {
                                router.back();
                            }
                        }
                    }
                ]}
            />

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
                    
                    {sessions.length === 0 ? (
                        <View style={[styles.emptyState, { borderColor: theme.colors.border, marginBottom: 36 }]}>
                            <HugeiconsIcon icon={Time02Icon} size={32} color={theme.colors.border} />
                            <Text style={{ marginTop: 8, color: theme.colors.textSecondary, fontFamily: 'Nunito_600SemiBold' }}>No sessions logged.</Text>
                        </View>
                    ) : (
                        sessions.map((session, index) => (
                            <View key={session.id} style={[styles.sessionBlock, { borderColor: theme.colors.border, backgroundColor: theme.colors.card }]}>
                                <View style={[styles.sessionHeaderRow, { borderBottomColor: theme.colors.border }]}>
                                    
                                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 8 }}>
                                        <Text numberOfLines={1} style={[styles.sessionTitleText, { color: theme.colors.text }]}>
                                            {session.title}
                                        </Text>
                                        <TouchableOpacity 
                                            onPress={() => {
                                                setRenamingIndex(index);
                                                setRenameModalVisible(true);
                                            }}
                                            style={styles.editIconBtn}
                                        >
                                            <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.textSecondary} />
                                        </TouchableOpacity>
                                    </View>

                                    <TouchableOpacity onPress={() => handleDeleteSession(session.id)} style={styles.deleteSessionBtn}>
                                        <HugeiconsIcon icon={Delete02Icon} size={18} color={theme.colors.danger} />
                                    </TouchableOpacity>
                                </View>
                                
                                <View style={styles.timeGrid}>
                                    <TouchableOpacity onPress={() => openPicker(index, 'in')} style={[styles.timeCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                                        <View style={styles.timeCardHeader}>
                                            <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.success} />
                                            <Text style={[styles.timeCardLabel, { color: theme.colors.textSecondary }]}>TIME IN</Text>
                                        </View>
                                        <View style={styles.timeCardBody}>
                                            <Text style={[styles.timeCardValue, { color: theme.colors.text }]}>
                                                {session.clock_in ? new Date(session.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                            </Text>
                                            <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.icon} />
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity onPress={() => openPicker(index, 'out')} style={[styles.timeCard, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                                        <View style={styles.timeCardHeader}>
                                            <HugeiconsIcon icon={Clock01Icon} size={14} color={theme.colors.warning} />
                                            <Text style={[styles.timeCardLabel, { color: theme.colors.textSecondary }]}>TIME OUT</Text>
                                        </View>
                                        <View style={styles.timeCardBody}>
                                            <Text style={[styles.timeCardValue, { color: theme.colors.text }]}>
                                                {session.clock_out ? new Date(session.clock_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                            </Text>
                                            <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.icon} />
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}

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
    headerMoreBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 24, paddingBottom: 100 },
    sectionTitle: { fontSize: 12, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
    
    sessionBlock: {
        borderRadius: 24,
        borderWidth: 1,
        marginBottom: 20,
        overflow: 'hidden',
    },
    sessionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    sessionTitleText: {
        fontSize: 16,
        fontFamily: 'Nunito_700Bold',
        flexShrink: 1, 
    },
    editIconBtn: {
        padding: 4,
    },
    deleteSessionBtn: {
        padding: 6,
    },
    timeGrid: { 
        flexDirection: "row", 
        gap: 12, 
        padding: 16 
    },
    timeCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1 },
    timeCardHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
    timeCardLabel: { fontSize: 11, fontFamily: 'Nunito_700Bold', textTransform: "uppercase", letterSpacing: 0.5 },
    timeCardBody: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    timeCardValue: { fontSize: 18, fontFamily: 'Nunito_700Bold' },

    taskHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4 },
    taskCountBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    taskCountText: { fontSize: 12, fontFamily: 'Nunito_700Bold' },
    emptyState: { alignItems: 'center', padding: 30, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed' },
    
    taskItem: { 
        borderRadius: 20, 
        borderWidth: 1, 
        marginBottom: 16, 
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