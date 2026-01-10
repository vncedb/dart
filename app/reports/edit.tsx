import {
    Clock01Icon,
    Delete02Icon,
    PencilEdit02Icon
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
import { supabase } from '../../lib/supabase';

export default function EditReportScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const theme = useAppTheme();
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

    // Navigation Protection
    useEffect(() => {
        const unsubscribe = navigation.addListener('beforeRemove', (e) => {
            if (loading) {
                e.preventDefault();
                setAlertConfig({
                    visible: true,
                    type: 'warning',
                    title: 'Saving in Progress',
                    message: 'Your changes are being saved. Please wait until the process is complete.',
                    confirmText: 'Okay',
                    onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false }))
                });
            }
        });
        return unsubscribe;
    }, [navigation, loading]);

    useFocusEffect(
        useCallback(() => {
            fetchData();
        }, [date])
    );

    const fetchData = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || !date) return;

        try {
            const { data: att } = await supabase.from('attendance')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', date)
                .single();

            if (att) {
                setAttendanceId(att.id);
                setClockIn(new Date(att.clock_in));
                setClockOut(att.clock_out ? new Date(att.clock_out) : null);
            }

            const { data: t } = await supabase.from('accomplishments')
                .select('*')
                .eq('user_id', user.id)
                .eq('date', date);
            
            setTasks(t || []);
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
                const updates: any = {
                    clock_in: clockIn.toISOString(),
                    clock_out: clockOut ? clockOut.toISOString() : null,
                    status: clockOut ? 'completed' : 'pending'
                };

                const { error } = await supabase.from('attendance').update(updates).eq('id', attendanceId);
                if (error) throw error;
            }
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
    };

    const deleteTask = (taskId: string) => {
        setAlertConfig({
            visible: true,
            type: 'warning',
            title: 'Delete Task',
            message: 'Are you sure you want to remove this task?',
            confirmText: 'Delete',
            cancelText: 'Cancel',
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({...prev, visible: false}));
                setLoading(true);
                await supabase.from('accomplishments').delete().eq('id', taskId);
                fetchData();
                setLoading(false);
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
                <ScrollView contentContainerStyle={{ padding: 24 }}>
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
                    </View>

                    <View style={{ gap: 12 }}>
                        {tasks.map((task) => (
                            <View key={task.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.card, padding: 12, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                                {task.image_url ? (
                                    <Image source={{ uri: task.image_url }} style={{ width: 48, height: 48, borderRadius: 10, marginRight: 12 }} />
                                ) : (
                                    <View style={{ width: 48, height: 48, borderRadius: 10, backgroundColor: theme.colors.iconBg, marginRight: 12 }} />
                                )}
                                
                                <View style={{ flex: 1 }}>
                                    <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.text }}>{task.description}</Text>
                                    <Text numberOfLines={1} style={{ fontSize: 12, color: theme.colors.textSecondary }}>{task.remarks || 'No remarks'}</Text>
                                </View>

                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <TouchableOpacity onPress={() => editTask(task.id)} style={{ padding: 8, backgroundColor: theme.colors.background, borderRadius: 8 }}>
                                        <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.icon} />
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => deleteTask(task.id)} style={{ padding: 8, backgroundColor: theme.colors.dangerLight, borderRadius: 8 }}>
                                        <HugeiconsIcon icon={Delete02Icon} size={16} color={theme.colors.danger} />
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