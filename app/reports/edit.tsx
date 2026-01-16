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
    ScrollView,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

// Components
import AnalogTimePicker from '../../components/AnalogTimePicker';
import Footer from '../../components/Footer';
import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import ModernAlert from '../../components/ModernAlert';
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

    // Time Picker
    const [pickerVisible, setPickerVisible] = useState(false);
    const [pickerMode, setPickerMode] = useState<'in' | 'out'>('in');
    const [isDirty, setIsDirty] = useState(false);

    // Navigation Protection
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

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [date])
    );

    const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !date) return;

        try {
            // Fetch from Local DB for consistency
            const { attendance, tasks: t } = await ReportService.getDailyReport(user.id, date as string);

            if (attendance) {
                setAttendanceId(attendance.id);
                setClockIn(new Date(attendance.clock_in));
                setClockOut(attendance.clock_out ? new Date(attendance.clock_out) : null);
            }

            // Parse images for display
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
    };

    const handleSave = async () => {
        setLoading(true);
        try {
            if (attendanceId && clockIn) {
                const db = await getDB();
                const now = new Date().toISOString();
                
                // Prepare updates
                const clockInStr = clockIn.toISOString();
                const clockOutStr = clockOut ? clockOut.toISOString() : null;
                const status = clockOut ? 'completed' : 'pending';

                // Update Local DB
                await db.runAsync(
                    'UPDATE attendance SET clock_in = ?, clock_out = ?, status = ?, updated_at = ? WHERE id = ?',
                    [clockInStr, clockOutStr, status, now, attendanceId]
                );

                // Queue Sync
                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)',
                    ['attendance', attendanceId, 'UPDATE', JSON.stringify({ 
                        clock_in: clockInStr, 
                        clock_out: clockOutStr, 
                        status, 
                        updated_at: now 
                    })]
                );
                
                triggerSync();
            }
            setIsDirty(false);
            router.back();
        } catch (e: any) {
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Save Failed',
                message: e.message,
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig((prev:any) => ({...prev, visible: false}))
            });
        } finally {
            setLoading(false);
        }
    };

    const openPicker = (mode: 'in' | 'out') => {
        setPickerMode(mode);
        setPickerVisible(true);
    };

    const onTimeSelect = (timeStr: string) => {
        const [h, m] = timeStr.split(':').map(Number);
        if (pickerMode === 'in') {
            const newDate = new Date(clockIn || new Date());
            newDate.setHours(h); newDate.setMinutes(m);
            setClockIn(newDate);
        } else {
            const newDate = new Date(clockOut || new Date());
            newDate.setHours(h); newDate.setMinutes(m);
            setClockOut(newDate);
        }
        setIsDirty(true);
    };

    const deleteTask = (taskId: string) => {
        setAlertConfig({
            visible: true,
            type: 'warning',
            title: 'Delete Task',
            message: 'Are you sure you want to remove this task? This cannot be undone.',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({...prev, visible: false}));
                setLoading(true);
                try {
                    const db = await getDB();
                    // Local Delete
                    await db.runAsync('DELETE FROM accomplishments WHERE id = ?', [taskId]);
                    // Sync Queue
                    await db.runAsync(
                        'INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)',
                        ['accomplishments', taskId, 'DELETE', null]
                    );
                    triggerSync();
                    fetchData(); // Refresh list
                } catch (e) {
                    console.log(e);
                } finally {
                    setLoading(false);
                }
            },
            onCancel: () => setAlertConfig((prev: any) => ({...prev, visible: false}))
        });
    };

    const editTask = (taskId: string) => {
        router.push({ pathname: '/reports/add-entry', params: { id: taskId } });
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <LoadingOverlay visible={loading} message="Saving changes..." />
            <ModernAlert {...alertConfig} />
            <AnalogTimePicker 
                visible={pickerVisible} 
                onClose={() => setPickerVisible(false)} 
                onSelect={onTimeSelect}
                value={pickerMode === 'in' ? clockIn : clockOut}
                title={pickerMode === 'in' ? "Set Time In" : "Set Time Out"}
            />

            <Header title="Edit Report" />

            {initialLoading ? (
               <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                   <ActivityIndicator size="large" color={theme.colors.primary} />
                   <Text style={{ marginTop: 12, color: theme.colors.textSecondary }}>Loading Details...</Text>
               </View>
            ) : (
               <>
                <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
                    <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 12 }}>Time Settings</Text>
                    
                    <View style={{ gap: 12, marginBottom: 32 }}>
                        {/* Clock In */}
                        <TouchableOpacity onPress={() => openPicker('in')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.success + '15', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                                <HugeiconsIcon icon={Clock01Icon} size={20} color={theme.colors.success} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' }}>Clock In</Text>
                                <Text style={{ fontSize: 18, color: theme.colors.text, fontWeight: 'bold' }}>
                                    {clockIn ? clockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set Time'}
                                </Text>
                            </View>
                            <HugeiconsIcon icon={PencilEdit02Icon} size={20} color={theme.colors.icon} />
                        </TouchableOpacity>

                        {/* Clock Out */}
                        <TouchableOpacity onPress={() => openPicker('out')} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.warning + '15', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                                <HugeiconsIcon icon={Clock01Icon} size={20} color={theme.colors.warning} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' }}>Clock Out</Text>
                                <Text style={{ fontSize: 18, color: theme.colors.text, fontWeight: 'bold' }}>
                                    {clockOut ? clockOut.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Set Time'}
                                </Text>
                            </View>
                            <HugeiconsIcon icon={PencilEdit02Icon} size={20} color={theme.colors.icon} />
                        </TouchableOpacity>
                    </View>

                    {/* Tasks */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.textSecondary, textTransform: 'uppercase' }}>Tasks</Text>
                        <View style={{ backgroundColor: theme.colors.iconBg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary }}>{tasks.length}</Text>
                        </View>
                    </View>

                    <View style={{ gap: 16 }}>
                        {tasks.length === 0 ? (
                            <View style={{ alignItems: 'center', padding: 30, opacity: 0.5 }}>
                                <HugeiconsIcon icon={Task01Icon} size={40} color={theme.colors.icon} />
                                <Text style={{ marginTop: 8, color: theme.colors.textSecondary }}>No tasks found.</Text>
                            </View>
                        ) : tasks.map((task) => (
                            <View key={task.id} style={{ backgroundColor: theme.colors.card, borderRadius: 20, padding: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                                <View style={{ flexDirection: 'row', gap: 12 }}>
                                    {/* Thumbnail Image (Show first one if available) */}
                                    {task.images && task.images.length > 0 ? (
                                        <Image source={{ uri: task.images[0] }} style={{ width: 48, height: 48, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }} />
                                    ) : (
                                        <View style={{ width: 48, height: 48, borderRadius: 12, backgroundColor: theme.colors.iconBg, alignItems: 'center', justifyContent: 'center' }}>
                                            <HugeiconsIcon icon={Task01Icon} size={20} color={theme.colors.icon} />
                                        </View>
                                    )}
                                    
                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={{ fontSize: 15, fontWeight: '700', color: theme.colors.text, marginBottom: 4 }}>{task.description}</Text>
                                        <Text numberOfLines={2} style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 18 }}>{task.remarks || 'No remarks'}</Text>
                                    </View>
                                </View>
                                
                                {/* Edit Actions Row */}
                                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.colors.border }}>
                                    <TouchableOpacity 
                                        onPress={() => editTask(task.id)} 
                                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.background }}
                                    >
                                        <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.text} />
                                        <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '600', color: theme.colors.text }}>Edit</Text>
                                    </TouchableOpacity>
                                    
                                    <TouchableOpacity 
                                        onPress={() => deleteTask(task.id)} 
                                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: theme.colors.danger + '15' }}
                                    >
                                        <HugeiconsIcon icon={Delete02Icon} size={16} color={theme.colors.danger} />
                                        <Text style={{ marginLeft: 6, fontSize: 13, fontWeight: '600', color: theme.colors.danger }}>Delete</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))}
                    </View>
                </ScrollView>

                <Footer>
                    <TouchableOpacity onPress={handleSave} className="flex-row items-center justify-center bg-indigo-600 shadow-sm h-14 rounded-2xl">
                        <Text className="text-lg font-bold text-white">Save Changes</Text>
                    </TouchableOpacity>
                </Footer>
               </>
            )}
        </SafeAreaView>
    );
}