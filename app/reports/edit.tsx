// filepath: app/reports/edit.tsx
import {
    Calendar03Icon,
    Clock01Icon,
    Delete02Icon,
    MoreVerticalIcon,
    PencilEdit02Icon,
    Task01Icon,
    Time02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { format } from 'date-fns';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { runOnJS, useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import ActionMenu from '../../components/ActionMenu';
import Button from '../../components/Button';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
import TimePicker from '../../components/TimePicker';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { generateUUID, queueSyncItem, saveAttendanceLocal } from '../../lib/database';
import { getDB } from '../../lib/db-client';

export default function EditReportScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
    const { user } = useAuth();
    const { triggerSync } = useSync();
    
    const { date } = useLocalSearchParams();
    const dateStr = date as string;

    const [attendances, setAttendances] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [jobId, setJobId] = useState<string | null>(null);
    
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [isDirty, setIsDirty] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    const moreIconRef = useRef<View>(null);
    const [menuVisible, setMenuVisible] = useState(false);
    const [menuAnchor, setMenuAnchor] = useState<{ x: number; y: number } | undefined>(undefined);

    const [activePicker, setActivePicker] = useState<{ id: string, type: 'in' | 'out', current: string | null } | null>(null);

    const [isHeaderDate, setIsHeaderDate] = useState(false);
    const scrollY = useSharedValue(0);

    const handleScrollUpdate = (scrolled: boolean) => {
        if (isHeaderDate !== scrolled) setIsHeaderDate(scrolled);
    };

    const scrollHandler = useAnimatedScrollHandler((event) => {
        scrollY.value = event.contentOffset.y;
        runOnJS(handleScrollUpdate)(event.contentOffset.y > 60);
    });

    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (saving || !isDirty) return;
            e.preventDefault();
            setAlertConfig({
                visible: true, type: 'warning', title: 'Discard Changes?', message: 'You have unsaved modifications to the attendance time. Leave without saving?',
                confirmText: 'Discard', cancelText: 'Keep Editing',
                onConfirm: () => {
                    setAlertConfig({ visible: false });
                    setIsDirty(false); 
                    navigation.dispatch(e.data.action);
                },
                onCancel: () => setAlertConfig({ visible: false })
            });
        });
        return unsubscribe;
    }, [navigation, saving, isDirty]);

    const fetchData = useCallback(async () => {
        if (!user || !dateStr) return;
        try {
            const db = await getDB();
            const profile: any = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [user.id]);
            setJobId(profile?.current_job_id || null);

            const dbAtts: any[] = await db.getAllAsync(
                "SELECT * FROM attendance WHERE user_id = ? AND date = ? AND deleted_at IS NULL ORDER BY clock_in ASC",
                [user.id, dateStr]
            );
            const dbTasks: any[] = await db.getAllAsync(
                "SELECT * FROM accomplishments WHERE user_id = ? AND date = ? AND deleted_at IS NULL ORDER BY created_at DESC",
                [user.id, dateStr]
            );

            const processedTasks = (dbTasks || []).map((t) => {
                let images: string[] = [];
                if (t.image_url) {
                  try {
                    const parsed = JSON.parse(t.image_url);
                    images = Array.isArray(parsed) ? parsed : [t.image_url];
                  } catch { images = [t.image_url]; }
                }
                return { ...t, images, _isDeleted: false };
            });

            setAttendances(dbAtts.map(a => ({ ...a, _isDeleted: false, _isModified: false })));
            setTasks(processedTasks);
            setIsDirty(false);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    }, [user, dateStr]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleMenuOpen = () => {
        if (moreIconRef.current) {
            moreIconRef.current.measure((x, y, width, height, pageX, pageY) => {
                setMenuAnchor({ x: pageX + width, y: pageY + height });
                setMenuVisible(true);
            });
        }
    };

    const handleTimeConfirm = (hours: number, minutes: number, period?: "AM" | "PM" | undefined) => {
        if (!activePicker) return;
        
        const newDate = new Date(dateStr);
        let h = hours;
        if (period === 'PM' && h < 12) h += 12;
        if (period === 'AM' && h === 12) h = 0;
        newDate.setHours(h, minutes, 0, 0);

        setAttendances(prev => prev.map(a => {
            if (a.id === activePicker.id) {
                const updated = { ...a, _isModified: true };
                if (activePicker.type === 'in') {
                    updated.clock_in = newDate.toISOString();
                } else {
                    const inDate = updated.clock_in ? new Date(updated.clock_in) : new Date(dateStr);
                    if (newDate < inDate) newDate.setDate(newDate.getDate() + 1); 
                    updated.clock_out = newDate.toISOString();
                }
                return updated;
            }
            return a;
        }));

        setIsDirty(true);
        setActivePicker(null);
    };

    const handleAddSession = () => {
        setMenuVisible(false);
        if (!user) return;
        const newId = generateUUID();
        const placeholderDate = new Date(dateStr);
        placeholderDate.setHours(8, 0, 0, 0); 
        
        const newSession = {
            id: newId,
            user_id: user.id,
            job_id: jobId,
            date: dateStr,
            clock_in: placeholderDate.toISOString(),
            clock_out: null,
            status: 'pending',
            remarks: 'Manual Entry',
            _isDeleted: false,
            _isModified: true 
        };
        setAttendances([...attendances, newSession]);
        setIsDirty(true);
    };

    const handleDeleteAttendance = (id: string) => {
        setAttendances(prev => prev.map(a => a.id === id ? { ...a, _isDeleted: true } : a));
        setIsDirty(true);
    };

    const handleDeleteTask = (id: string) => {
        setAlertConfig({
            visible: true, type: 'warning', title: 'Delete Task', message: 'Are you sure you want to permanently delete this task?', confirmText: 'Delete', cancelText: 'Cancel',
            onConfirm: async () => {
                setAlertConfig({ visible: false });
                setLoading(true);
                try {
                    const db = await getDB();
                    const now = new Date().toISOString();
                    await db.runAsync('UPDATE accomplishments SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [now, now, id]);
                    await queueSyncItem('accomplishments', id, 'UPDATE', { deleted_at: now, updated_at: now });
                    triggerSync();
                    fetchData();
                } catch (error) { console.log(error); }
                setLoading(false);
            },
            onCancel: () => setAlertConfig({ visible: false })
        });
    };

    const saveChanges = async () => {
        setSaving(true);
        try {
            const db = await getDB();
            const now = new Date().toISOString();

            for (const att of attendances) {
                if (att._isDeleted) {
                    const exists = await db.getFirstAsync("SELECT id FROM attendance WHERE id = ?", [att.id]);
                    if (exists) {
                        await db.runAsync("UPDATE attendance SET deleted_at = ?, is_synced = 0 WHERE id = ?", [now, att.id]);
                        await queueSyncItem("attendance", att.id, "UPDATE", { deleted_at: now });
                    }
                } else if (att._isModified) {
                    const exists = await db.getFirstAsync("SELECT id FROM attendance WHERE id = ?", [att.id]);
                    if (exists) {
                        await db.runAsync(
                            "UPDATE attendance SET clock_in = ?, clock_out = ?, status = ?, updated_at = ?, is_synced = 0 WHERE id = ?",
                            [att.clock_in, att.clock_out, att.clock_out ? 'completed' : 'pending', now, att.id]
                        );
                        await queueSyncItem("attendance", att.id, "UPDATE", { clock_in: att.clock_in, clock_out: att.clock_out, status: att.clock_out ? 'completed' : 'pending', updated_at: now });
                    } else {
                        const newAtt = { id: att.id, user_id: att.user_id, job_id: att.job_id, date: att.date, clock_in: att.clock_in, clock_out: att.clock_out, status: att.clock_out ? 'completed' : 'pending', remarks: att.remarks, updated_at: now };
                        await saveAttendanceLocal(newAtt);
                    }
                }
            }

            setIsDirty(false);
            triggerSync();
            router.back();
        } catch (error: any) {
            setAlertConfig({ visible: true, type: 'error', title: 'Error', message: 'Failed to save changes.', confirmText: 'Okay', onConfirm: () => setAlertConfig({ visible: false }) });
        } finally {
            setSaving(false);
        }
    };

    const getInitialTime = (): { h: number; m: number; p: "AM" | "PM" } => {
        if (!activePicker?.current) return { h: 12, m: 0, p: 'AM' };
        const dateObj = new Date(activePicker.current);
        let h = dateObj.getHours();
        const m = dateObj.getMinutes();
        const p: "AM" | "PM" = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return { h, m, p };
    };

    const initialPickerVals = getInitialTime();
    const visibleAttendances = attendances.filter(a => !a._isDeleted);
    const visibleTasks = tasks.filter(t => !t._isDeleted);
    const dynamicHeaderTitle = isHeaderDate && dateStr ? format(new Date(dateStr), "MMMM d, yyyy") : "Edit Report";

    const renderTaskCard = (task: any) => (
        <View key={task.id} style={[styles.taskCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.taskCardHeader}>
                <View style={styles.taskHeaderLeft}>
                    <Text style={[styles.taskTitle, { color: theme.colors.text }]}>{task.description}</Text>
                    {task.remarks ? (
                        <Text style={[styles.taskRemarks, { color: theme.colors.textSecondary }]}>{task.remarks}</Text>
                    ) : null}
                </View>
                <View style={styles.taskHeaderRight}>
                    <TouchableOpacity onPress={() => router.push({ pathname: '/reports/add-entry', params: { id: task.id, fixedDate: 'true' } })} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <HugeiconsIcon icon={PencilEdit02Icon} size={18} color={theme.colors.primary} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDeleteTask(task.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} style={{ marginLeft: 16 }}>
                        <HugeiconsIcon icon={Delete02Icon} size={18} color={theme.colors.danger} />
                    </TouchableOpacity>
                </View>
            </View>

            {task.images && task.images.length > 0 && (
                <View style={styles.imageGrid}>
                    {task.images.map((imgUri: string, i: number) => (
                        <View key={i} style={[styles.imageGridItem, { borderColor: theme.colors.border }]}>
                            <Image source={{ uri: imgUri }} style={styles.taskImage} resizeMode="cover" />
                        </View>
                    ))}
                </View>
            )}

            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

            <View style={styles.taskFooter}>
                <HugeiconsIcon icon={Time02Icon} size={14} color={theme.colors.textSecondary} />
                <Text style={[styles.taskTimeText, { color: theme.colors.textSecondary }]}>
                    {task.created_at ? format(new Date(task.created_at), "h:mm a") : "--:--"}
                </Text>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} />
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={saving} message="Saving Report..." />

            <TimePicker 
                visible={!!activePicker} 
                onClose={() => setActivePicker(null)} 
                onConfirm={handleTimeConfirm} 
                title={activePicker?.type === 'in' ? "Select Time In" : "Select Time Out"} 
                initialHours={initialPickerVals.h}
                initialMinutes={initialPickerVals.m}
                initialPeriod={initialPickerVals.p}
            />

            <Header 
                title={dynamicHeaderTitle} 
                rightElement={
                    <View ref={moreIconRef} collapsable={false}>
                        <TouchableOpacity onPress={handleMenuOpen} style={styles.headerMoreBtn}>
                            <HugeiconsIcon icon={MoreVerticalIcon} size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>
                }
            />

            <ActionMenu
                visible={menuVisible}
                onClose={() => setMenuVisible(false)}
                anchor={menuAnchor}
                actions={[
                    { label: 'Add Session', icon: Clock01Icon, color: theme.colors.text, onPress: handleAddSession },
                    { label: 'Add Entry', icon: Task01Icon, color: theme.colors.text, onPress: () => { setMenuVisible(false); router.push({ pathname: '/reports/add-entry', params: { date: dateStr, fixedDate: 'true' } }); } },
                ]}
            />

            {loading ? (
                <View style={styles.center}><ActivityIndicator size="large" color={theme.colors.primary} /></View>
            ) : (
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                    <Animated.ScrollView 
                        contentContainerStyle={styles.scrollContent} 
                        showsVerticalScrollIndicator={false}
                        onScroll={scrollHandler}
                        scrollEventThrottle={16}
                    >
                        {/* HERO DATE SECTION */}
                        <View style={styles.heroSection}>
                            <View style={[styles.heroIconBox, { backgroundColor: theme.colors.primary + '15' }]}>
                                <HugeiconsIcon icon={Calendar03Icon} size={32} color={theme.colors.primary} />
                            </View>
                            <View>
                                <Text style={[styles.heroDate, { color: theme.colors.text }]}>
                                    {format(new Date(dateStr), "MMMM d, yyyy")}
                                </Text>
                                <Text style={[styles.heroDay, { color: theme.colors.textSecondary }]}>
                                    {format(new Date(dateStr), "EEEE")}
                                </Text>
                            </View>
                        </View>

                        {/* EDITABLE ATTENDANCE SECTION */}
                        <View style={styles.sectionHeader}>
                            <HugeiconsIcon icon={Clock01Icon} size={20} color={theme.colors.text} />
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Attendance Overview</Text>
                        </View>

                        {visibleAttendances.length > 0 ? (
                            <View style={{ marginBottom: 40, gap: 12 }}>
                                {visibleAttendances.map((session, index) => (
                                    <View key={session.id} style={[styles.sessionCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                        <View style={[styles.sessionCardHeader, { borderBottomColor: theme.colors.border }]}>
                                            <View style={[styles.sessionBadge, { backgroundColor: theme.colors.primary + '15' }]}>
                                                <Text style={[styles.sessionBadgeText, { color: theme.colors.primary }]}>Session {index + 1}</Text>
                                            </View>
                                            <TouchableOpacity onPress={() => handleDeleteAttendance(session.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                                <HugeiconsIcon icon={Delete02Icon} size={18} color={theme.colors.danger} />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.sessionCardBody}>
                                            <TouchableOpacity activeOpacity={0.7} onPress={() => setActivePicker({ id: session.id, type: 'in', current: session.clock_in })} style={styles.sessionTimeCol}>
                                                <Text style={[styles.sessionTimeLabel, { color: theme.colors.textSecondary }]}>TIME IN</Text>
                                                <View style={styles.sessionValueRow}>
                                                    <Text style={[styles.sessionTimeValue, { color: theme.colors.text }]}>
                                                        {session.clock_in ? format(new Date(session.clock_in), 'h:mm a') : '--:--'}
                                                    </Text>
                                                    <HugeiconsIcon icon={PencilEdit02Icon} size={14} color={theme.colors.primary} />
                                                </View>
                                            </TouchableOpacity>
                                            
                                            <View style={[styles.sessionCardDivider, { backgroundColor: theme.colors.border }]} />
                                            
                                            <TouchableOpacity activeOpacity={0.7} onPress={() => setActivePicker({ id: session.id, type: 'out', current: session.clock_out })} style={styles.sessionTimeCol}>
                                                <Text style={[styles.sessionTimeLabel, { color: theme.colors.textSecondary }]}>TIME OUT</Text>
                                                <View style={styles.sessionValueRow}>
                                                    <Text style={[styles.sessionTimeValue, { color: theme.colors.text }]}>
                                                        {session.clock_out ? format(new Date(session.clock_out), 'h:mm a') : 'Now'}
                                                    </Text>
                                                    <HugeiconsIcon icon={PencilEdit02Icon} size={14} color={theme.colors.primary} />
                                                </View>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        ) : (
                            <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginBottom: 40 }]}>
                                <HugeiconsIcon icon={Time02Icon} size={28} color={theme.colors.icon} />
                                <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium', marginTop: 12 }}>No attendance recorded.</Text>
                            </View>
                        )}

                        {/* EDITABLE TASKS SECTION */}
                        <View style={styles.sectionHeader}>
                            <HugeiconsIcon icon={Task01Icon} size={20} color={theme.colors.text} />
                            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Tasks</Text>
                            <View style={[styles.badge, { backgroundColor: theme.colors.primary + '15' }]}>
                                <Text style={[styles.badgeText, { color: theme.colors.primary }]}>{visibleTasks.length}</Text>
                            </View>
                        </View>

                        {visibleTasks.length > 0 ? (
                            <View style={{ marginTop: 8 }}>
                                {visibleTasks.map((task) => renderTaskCard(task))}
                            </View>
                        ) : (
                            <View style={[styles.emptyState, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, marginBottom: 24 }]}>
                                <HugeiconsIcon icon={Task01Icon} size={32} color={theme.colors.icon} />
                                <Text style={{ color: theme.colors.textSecondary, fontFamily: 'Nunito_500Medium', marginTop: 12 }}>No activity logged.</Text>
                            </View>
                        )}

                    </Animated.ScrollView>
                </KeyboardAvoidingView>
            )}

            {isDirty && (
                <Footer>
                    <Button title="Save Time Updates" onPress={saveChanges} isLoading={saving} disabled={saving} style={{ width: '100%' }} />
                </Footer>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scrollContent: { padding: 24, paddingBottom: 120 },
    headerMoreBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },

    heroSection: { flexDirection: "row", alignItems: "center", marginBottom: 40, gap: 16 },
    heroIconBox: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    heroDate: { fontSize: 24, fontFamily: 'Nunito_800ExtraBold', letterSpacing: -0.5, marginBottom: 4 },
    heroDay: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', letterSpacing: 1 },

    sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
    sectionTitle: { fontSize: 18, fontFamily: 'Nunito_800ExtraBold', flex: 1, letterSpacing: -0.3 },
    badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12 },
    badgeText: { fontSize: 13, fontFamily: 'Nunito_700Bold' },

    sessionCard: { borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
    sessionCardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1 },
    sessionBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    sessionBadgeText: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', textTransform: 'uppercase', letterSpacing: 0.5 },
    sessionCardBody: { flexDirection: 'row', alignItems: 'center', padding: 16 },
    sessionTimeCol: { flex: 1 },
    sessionTimeLabel: { fontSize: 11, fontFamily: 'Nunito_600SemiBold', textTransform: 'uppercase', marginBottom: 6, letterSpacing: 0.5 },
    sessionValueRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    sessionTimeValue: { fontSize: 16, fontFamily: 'Nunito_800ExtraBold' },
    sessionCardDivider: { width: 1, height: 32, marginHorizontal: 16, opacity: 0.5 },

    emptyState: { alignItems: "center", padding: 40, borderRadius: 24, borderWidth: 1, borderStyle: 'dashed' },

    taskCard: { borderRadius: 20, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1, marginBottom: 16, overflow: 'hidden' },
    taskCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', padding: 20, paddingBottom: 12 },
    taskHeaderLeft: { flex: 1 },
    taskHeaderRight: { flexDirection: 'row', alignItems: 'center', paddingLeft: 12 },
    taskTitle: { fontSize: 16, fontFamily: 'Nunito_700Bold', lineHeight: 24, marginBottom: 4 },
    taskRemarks: { fontSize: 15, fontFamily: 'Nunito_500Medium', lineHeight: 22, opacity: 0.8 },
    
    imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, paddingHorizontal: 20, paddingBottom: 16 },
    imageGridItem: { width: "48%", aspectRatio: 4 / 3, borderRadius: 12, overflow: "hidden", borderWidth: 1 },
    taskImage: { width: "100%", height: "100%" },

    divider: { height: 1, opacity: 0.5 },
    taskFooter: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingVertical: 12 },
    taskTimeText: { fontSize: 13, fontFamily: 'Nunito_600SemiBold' }
});