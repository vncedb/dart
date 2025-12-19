import {
    Calendar03Icon,
    Camera01Icon,
    Cancel01Icon,
    Delete02Icon,
    HourglassIcon,
    Image01Icon,
    Login03Icon,
    Logout03Icon,
    PencilEdit02Icon,
    PlusSignIcon,
    UserCircleIcon,
    ViewIcon,
    ViewOffIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    LayoutRectangle,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import {
    configureReanimatedLogger,
    ReanimatedLogLevel,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import AppTour from '../../components/AppTour';
import AttendanceCalendar from '../../components/AttendanceCalendar';
import BiometricButton from '../../components/BiometricButton';
import FloatingAlert from '../../components/FloatingAlert';
import ModernAlert from '../../components/ModernAlert';
import { supabase } from '../../lib/supabase';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

configureReanimatedLogger({
    level: ReanimatedLogLevel.warn,
    strict: false, 
});

type UserProfile = { first_name: string; last_name: string; title: string; avatar_url: string | null; salary: number; rate_type: 'daily' | 'hourly'; };
type AttendanceRecord = { id: string; clock_in: string; clock_out: string | null; date: string; status: 'pending' | 'completed'; };
type TaskRecord = { id: string; description: string; remarks?: string; image_url?: string; created_at: string; date: string; };
type TimelineItem = { type: 'check-in'; time: string; id: string } | { type: 'check-out'; time: string; id: string } | { type: 'task'; data: TaskRecord };
type AlertType = 'success' | 'error' | 'check-in' | 'check-out';

const getLocalDate = (d = new Date()) => {
    const offsetMs = d.getTimezoneOffset() * 60000;
    const localDate = new Date(d.getTime() - offsetMs);
    return localDate.toISOString().split('T')[0];
};

const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
};

const formatTimeComponents = (date: Date) => {
    const timeStr = format(date, 'h:mm a');
    const [time, period] = timeStr.split(' ');
    return { time, period };
};

export default function Home() {
    const insets = useSafeAreaInsets();
    const router = useRouter();

    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [todaysRecords, setTodaysRecords] = useState<AttendanceRecord[]>([]);
    const [monthRecords, setMonthRecords] = useState<AttendanceRecord[]>([]);
    const [tasks, setTasks] = useState<TaskRecord[]>([]);
    const [timelineData, setTimelineData] = useState<TimelineItem[]>([]);
    const [appSettings, setAppSettings] = useState({ vibrationEnabled: true, soundEnabled: true });
    
    const [workedHours, setWorkedHours] = useState("0h 0m");
    const [currentPay, setCurrentPay] = useState("₱ 0.00");
    const [currentDate, setCurrentDate] = useState(new Date());

    const [showCalendar, setShowCalendar] = useState(false);
    const [showEntryCalendar, setShowEntryCalendar] = useState(false);
    const [showPay, setShowPay] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [showTour, setShowTour] = useState(false);
    const [tourStep, setTourStep] = useState(0);
    const [tourSteps, setTourSteps] = useState<any[]>([]);
    
    const clockButtonRef = useRef<View>(null);
    const metricsRef = useRef<View>(null);
    const timelineRef = useRef<View>(null);

    const [alertVisible, setAlertVisible] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    const [alertType, setAlertType] = useState<AlertType>('success');
    const [modernAlertConfig, setModernAlertConfig] = useState<any>({ visible: false });

    const [editingId, setEditingId] = useState<string | null>(null);
    const [inputText, setInputText] = useState('');
    const [inputRemarks, setInputRemarks] = useState('');
    const [inputImage, setInputImage] = useState<string | null>(null);
    const [inputDate, setInputDate] = useState(getLocalDate());

    const isMounted = useRef(true);
    const latestRecord = todaysRecords.length > 0 ? todaysRecords[0] : null;
    const isClockedIn = latestRecord?.status === 'pending';
    const isSaveDisabled = !inputText.trim();

    const measureElement = (ref: React.RefObject<View>): Promise<LayoutRectangle | null> => {
        return new Promise((resolve) => {
            if (ref.current) {
                ref.current.measureInWindow((x, y, width, height) => {
                    if (width > 0 && height > 0) resolve({ x, y, width, height });
                    else resolve(null);
                });
            } else {
                resolve(null);
            }
        });
    };

    const startTour = async () => {
        setTimeout(async () => {
            const clockLayout = await measureElement(clockButtonRef);
            const metricsLayout = await measureElement(metricsRef);
            const timelineLayout = await measureElement(timelineRef);

            const steps = [];

            if (clockLayout) {
                steps.push({
                    id: 1,
                    title: "Clock In & Out",
                    description: "Tap the fingerprint button to record your attendance. It's quick, secure, and easy.",
                    target: clockLayout
                });
            }
            if (metricsLayout) {
                steps.push({
                    id: 2,
                    title: "Track Progress",
                    description: "See your total hours and estimated pay in real-time. Toggle pay visibility for privacy.",
                    target: metricsLayout
                });
            }
            if (timelineLayout) {
                steps.push({
                    id: 3,
                    title: "Log Your Work",
                    description: "Use the (+) button to add tasks, photos, or notes to your daily timeline.",
                    target: timelineLayout
                });
            }

            if (steps.length > 0) {
                setTourSteps(steps);
                setShowTour(true);
            }
        }, 800);
    };

    const checkTourStatus = async () => {
        try {
            const isNewUser = await AsyncStorage.getItem('isNewUser');
            if (isNewUser === 'true') {
                startTour();
                await AsyncStorage.removeItem('isNewUser');
            }
        } catch (e) { console.log(e); }
    };

    const loadData = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const dateStr = getLocalDate(selectedDate);
            const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (profileData) {
                setProfile(profileData);
            }

            const { data: attendanceData } = await supabase.from('attendance').select('*').eq('user_id', user.id).eq('date', dateStr).order('clock_in', { ascending: false });
            if (attendanceData) setTodaysRecords(attendanceData);
            const { data: tasksData } = await supabase.from('accomplishments').select('*').eq('user_id', user.id).eq('date', dateStr);
            if (tasksData) setTasks(tasksData);
        } catch (e) { console.log(e); } finally { setRefreshing(false); }
    };

    const fetchMonthAttendance = async (date: Date) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const start = startOfMonth(date).toISOString().split('T')[0];
            const end = endOfMonth(date).toISOString().split('T')[0];
            const { data } = await supabase.from('attendance').select('id, date, clock_in, clock_out').eq('user_id', user.id).gte('date', start).lte('date', end);
            if (data) setMonthRecords(data as any);
        } catch (e) { console.log(e); }
    };

    useFocusEffect(useCallback(() => {
        loadData();
        fetchMonthAttendance(selectedDate);
        AsyncStorage.getItem('appSettings').then(s => { if (s) setAppSettings(JSON.parse(s)); });
        checkTourStatus();
    }, [selectedDate]));

    useEffect(() => {
        isMounted.current = true;
        const timer = setInterval(() => {
            setCurrentDate(new Date());
            let totalMs = 0;
            todaysRecords.forEach(record => {
                const start = new Date(record.clock_in).getTime();
                const end = record.clock_out ? new Date(record.clock_out).getTime() : new Date().getTime();
                totalMs += (end - start);
            });
            let hours = totalMs / (1000 * 60 * 60);
            if (hours > 5) hours = Math.max(0, hours - 1);
            setWorkedHours(`${Math.floor(hours)}h ${Math.floor((hours - Math.floor(hours)) * 60)}m`);
            if (profile?.salary) {
                let pay = 0;
                if (profile.rate_type === 'hourly') pay = hours * profile.salary;
                else { const hourlyRate = profile.salary / 8; pay = hours * hourlyRate; }
                setCurrentPay(`₱ ${pay.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
            }
        }, 1000);
        return () => { isMounted.current = false; clearInterval(timer); };
    }, [todaysRecords, profile]);

    useEffect(() => {
        const timeline: TimelineItem[] = [];
        const sortedRecords = [...todaysRecords].sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());
        const sortedTasks = [...tasks].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        sortedRecords.forEach(record => {
            timeline.push({ type: 'check-in', time: record.clock_in, id: record.id });
            const start = new Date(record.clock_in).getTime();
            const end = record.clock_out ? new Date(record.clock_out).getTime() : Infinity;
            const sessionTasks = sortedTasks.filter(t => { const tTime = new Date(t.created_at).getTime(); return tTime >= start && tTime <= end; });
            sessionTasks.forEach(t => timeline.push({ type: 'task', data: t }));
            if (record.clock_out) timeline.push({ type: 'check-out', time: record.clock_out, id: record.id });
        });
        const processedTaskIds = new Set(timeline.filter(t => t.type === 'task').map(t => (t as any).data.id));
        sortedTasks.forEach(t => { if (!processedTaskIds.has(t.id)) timeline.push({ type: 'task', data: t }); });
        setTimelineData(timeline);
    }, [todaysRecords, tasks]);

    const playSuccessSound = async () => {
        try {
            const { sound } = await Audio.Sound.createAsync(require('../../assets/success.mp3'));
            await sound.playAsync();
            sound.setOnPlaybackStatusUpdate(async (status) => { if (status.isLoaded && status.didJustFinish) await sound.unloadAsync(); });
        } catch (error) { console.log('Failed to play sound:', error); }
    };

    const handleClockAction = async () => {
        const isToday = getLocalDate(selectedDate) === getLocalDate(new Date());
        if (!isToday) {
            setModernAlertConfig({ visible: true, type: 'info', title: 'Restricted', message: 'Switch to today to update status.', confirmText: 'Go to Today', onConfirm: () => { setModernAlertConfig((prev: any) => ({ ...prev, visible: false })); setSelectedDate(new Date()); } });
            return;
        }
        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const todayStr = getLocalDate();
            if (!latestRecord || latestRecord.status === 'completed') {
                const { error } = await supabase.from('attendance').insert({ user_id: user.id, clock_in: new Date().toISOString(), date: todayStr, status: 'pending' });
                if (error) throw error;
                setAlertMessage("Welcome In!"); setAlertType('check-in');
            } else {
                const { error } = await supabase.from('attendance').update({ clock_out: new Date().toISOString(), status: 'completed' }).eq('id', latestRecord.id);
                if (error) throw error;
                setAlertMessage("See you later!"); setAlertType('check-out');
            }
            if (appSettings.soundEnabled) playSuccessSound();
            if (appSettings.vibrationEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            await loadData(); fetchMonthAttendance(selectedDate); setAlertVisible(true);
        } catch (e: any) { Alert.alert("Error", e.message); } finally { setLoading(false); }
    };

    const handleAdd = () => { setEditingId(null); setInputText(''); setInputRemarks(''); setInputImage(null); setInputDate(getLocalDate(selectedDate)); setModalVisible(true); };
    const handleEdit = (t: TaskRecord) => { setEditingId(t.id); setInputText(t.description); setInputRemarks(t.remarks || ''); setInputImage(t.image_url || null); setInputDate(t.date || getLocalDate(selectedDate)); setModalVisible(true); };

    const pickImage = async (useCamera = false) => {
        const options: ImagePicker.ImagePickerOptions = { mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [3, 4], quality: 0.7 };
        let result;
        try {
            if (useCamera) {
                const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
                if (permissionResult.granted === false) { Alert.alert("Permission Required", "Camera access is required."); return; }
                result = await ImagePicker.launchCameraAsync(options);
            } else {
                result = await ImagePicker.launchImageLibraryAsync(options);
            }
            if (!result.canceled) setInputImage(result.assets[0].uri);
        } catch (error) { Alert.alert("Error", "Image picker error."); }
    };

    const confirmRemoveImage = () => {
        setModernAlertConfig({ visible: true, type: 'info', title: 'Remove Image?', message: 'Remove this image?', confirmText: 'Remove', onConfirm: () => { setInputImage(null); setModernAlertConfig(prev => ({ ...prev, visible: false })); }, cancelText: 'Cancel', onCancel: () => setModernAlertConfig(prev => ({ ...prev, visible: false })) });
    };

    const handleSaveTask = async () => {
        if (!inputText.trim()) return;
        setIsSaving(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const payload = { description: inputText, remarks: inputRemarks, image_url: inputImage, date: inputDate };
            if (editingId) await supabase.from('accomplishments').update(payload).eq('id', editingId);
            else await supabase.from('accomplishments').insert({ user_id: user.id, ...payload });
            setModalVisible(false); await loadData(); setAlertMessage("Saved"); setAlertType('success'); setAlertVisible(true);
        } catch (e: any) { Alert.alert("Error", e.message); } finally { setIsSaving(false); }
    };

    const handleDeleteTask = () => {
        setModernAlertConfig({ visible: true, type: 'info', title: 'Delete Entry?', message: 'Are you sure? This cannot be undone.', confirmText: 'Delete', cancelText: 'Cancel', onConfirm: async () => { setModernAlertConfig(prev => ({ ...prev, visible: false })); if (!editingId) return; setIsDeleting(true); try { await supabase.from('accomplishments').delete().eq('id', editingId); setModalVisible(false); await loadData(); } catch (e: any) { Alert.alert("Error", "Failed to delete"); } finally { setIsDeleting(false); } }, onCancel: () => setModernAlertConfig(prev => ({ ...prev, visible: false })) });
    };

    const formattedDate = format(selectedDate, 'MMM d, yyyy');
    const { time: displayTime, period: displayPeriod } = formatTimeComponents(currentDate);

    // --- PAY CARD CONTENT (UNLOCKED) ---
    const renderPayCardContent = () => {
        return (
            <>
                <View className="flex-row items-center justify-between mb-2">
                    <View className="flex-row items-center gap-2">
                        <View className="p-1.5 rounded-full bg-green-50 dark:bg-green-900/20"><Text className="font-bold text-green-600 dark:text-green-400 text-[10px]">₱</Text></View>
                        <Text className="font-sans text-[10px] font-bold tracking-widest uppercase text-slate-400">Est. Pay</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowPay(!showPay)} className="p-1">
                        <HugeiconsIcon icon={showPay ? ViewIcon : ViewOffIcon} size={14} color="#94a3b8" />
                    </TouchableOpacity>
                </View>
                <Text className="font-sans text-2xl font-black text-slate-800 dark:text-white">{showPay ? currentPay : '••••'}</Text>
            </>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
            <FloatingAlert visible={alertVisible} message={alertMessage} type={alertType} onHide={() => setAlertVisible(false)} />
            <ModernAlert {...modernAlertConfig} />

            <AppTour 
                visible={showTour} 
                steps={tourSteps} 
                currentStepIndex={tourStep}
                onNext={() => setTourStep(prev => prev + 1)}
                onSkip={() => setShowTour(false)}
                onFinish={() => setShowTour(false)}
            />

            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100 + insets.top, zIndex: 100, backgroundColor: '#4f46e5', borderBottomRightRadius: 24, borderBottomLeftRadius: 24, overflow: 'hidden', shadowColor: '#4f46e5', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 8 }}>
                <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}>
                    <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
                        <Defs><LinearGradient id="grad" x1="0" y1="0" x2="1" y2="1"><Stop offset="0" stopColor="#6366f1" stopOpacity="1" /><Stop offset="1" stopColor="#4338ca" stopOpacity="1" /></LinearGradient></Defs>
                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#grad)" />
                        <Circle cx="85%" cy="20%" r="120" fill="white" opacity="0.1" /><Circle cx="10%" cy="80%" r="80" fill="white" opacity="0.08" />
                    </Svg>
                </View>
                <View style={{ paddingTop: insets.top, paddingHorizontal: 24, flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View className="justify-center">
                        <View className="flex-row items-center justify-between w-full mb-1"><Text className="font-sans text-[10px] font-bold text-indigo-200 uppercase tracking-widest opacity-90">{formattedDate}</Text></View>
                        <TouchableOpacity onPress={() => setShowCalendar(true)}>
                            <View className="flex-row items-baseline"><Text className="font-sans text-5xl font-black tracking-tight text-white">{displayTime}</Text><Text className="ml-1.5 font-sans text-2xl font-bold text-indigo-200">{displayPeriod}</Text></View>
                        </TouchableOpacity>
                    </View>
                    <View className="border-2 rounded-full shadow-lg border-white/20 bg-indigo-500/30">
                        {profile?.avatar_url ? <Image source={{ uri: profile.avatar_url }} className="rounded-full w-14 h-14" /> : <View className="items-center justify-center rounded-full w-14 h-14"><HugeiconsIcon icon={UserCircleIcon} size={32} color="#e0e7ff" /></View>}
                    </View>
                </View>
            </View>

            <Modal visible={showCalendar} transparent animationType="fade" onRequestClose={() => setShowCalendar(false)}>
                <View className="justify-center flex-1 p-6 bg-black/60 backdrop-blur-sm">
                    <View className="bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl">
                        <AttendanceCalendar records={monthRecords} selectedDate={selectedDate} onSelectDate={(date) => setSelectedDate(date)} onMonthChange={(date) => fetchMonthAttendance(date)} />
                        <TouchableOpacity onPress={() => setShowCalendar(false)} className="items-center p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"><Text className="font-bold text-indigo-600">Close Calendar</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <Modal visible={showEntryCalendar} transparent animationType="fade" onRequestClose={() => setShowEntryCalendar(false)}>
                <View className="justify-center flex-1 p-6 bg-black/60 backdrop-blur-sm">
                    <View className="bg-white dark:bg-slate-900 rounded-[32px] overflow-hidden shadow-2xl">
                        <AttendanceCalendar records={monthRecords} selectedDate={new Date(inputDate)} onSelectDate={(date) => { setInputDate(getLocalDate(date)); setShowEntryCalendar(false); }} onMonthChange={(date) => fetchMonthAttendance(date)} showIndicators={false} showDetails={false} />
                        <TouchableOpacity onPress={() => setShowEntryCalendar(false)} className="items-center p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900"><Text className="font-bold text-indigo-600">Cancel</Text></TouchableOpacity>
                    </View>
                </View>
            </Modal>

            <ScrollView contentContainerStyle={{ padding: 24, paddingTop: 100 + insets.top + 24, paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} progressViewOffset={120} />}>
                <View className="items-center mb-10" ref={clockButtonRef} collapsable={false}>
                    <View className="items-center mb-8"><Text className="font-sans text-lg font-bold leading-relaxed tracking-wider text-center uppercase text-slate-800 dark:text-white">{getGreeting()}, {profile?.title ? `${profile.title} ` : ''}{profile?.first_name || 'User'}</Text></View>
                    <BiometricButton onSuccess={handleClockAction} isClockedIn={isClockedIn} isLoading={loading} settings={appSettings} />
                </View>

                <View className="flex-row gap-4 mb-8" ref={metricsRef} collapsable={false}>
                    <View className="flex-1 bg-white dark:bg-slate-800 p-5 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-700/50">
                        <View className="flex-row items-center gap-2 mb-2"><View className="p-1.5 rounded-full bg-blue-50 dark:bg-blue-900/20"><HugeiconsIcon icon={HourglassIcon} size={14} color="#3b82f6" /></View><Text className="font-sans text-[10px] font-bold tracking-widest uppercase text-slate-400">Total Hours</Text>{isClockedIn && <PulsingDot />}</View>
                        <Text className="font-sans text-2xl font-black text-slate-800 dark:text-white">{workedHours}</Text>
                    </View>
                    <View className="flex-1 bg-white dark:bg-slate-800 p-5 rounded-[24px] shadow-sm border border-slate-100 dark:border-slate-700/50">
                        {renderPayCardContent()}
                    </View>
                </View>

                <View className="bg-white dark:bg-slate-800 rounded-[32px] shadow-sm overflow-hidden border border-slate-100 dark:border-slate-700/50" ref={timelineRef} collapsable={false}>
                    <View className="flex-row items-center justify-between p-6 pb-4 border-b border-slate-50 dark:border-slate-700/50">
                        <Text className="font-sans text-lg font-extrabold text-slate-800 dark:text-white">Today&apos;s Activity</Text>
                        <TouchableOpacity onPress={isClockedIn ? handleAdd : () => setModernAlertConfig({ visible: true, type: 'info', title: 'Restricted', message: 'Clock in to add entries.', confirmText: 'OK', onConfirm: () => setModernAlertConfig((prev: any) => ({ ...prev, visible: false })) })} className={`items-center justify-center w-10 h-10 rounded-full ${isClockedIn ? 'bg-indigo-50 active:bg-indigo-100 dark:bg-indigo-900/30' : 'bg-slate-100 dark:bg-slate-800 opacity-50'}`}><HugeiconsIcon icon={PlusSignIcon} size={20} color={isClockedIn ? "#6366f1" : "#94a3b8"} /></TouchableOpacity>
                    </View>
                    <View className="p-6">
                        {timelineData.length === 0 ? <View className="items-center py-12 opacity-40"><HugeiconsIcon icon={HourglassIcon} size={40} color="#94a3b8" /><Text className="mt-4 text-sm font-semibold text-slate-400">No activity recorded yet.</Text></View> : <View className="pl-4 ml-2 border-l-2 border-slate-100 dark:border-slate-700">
                            {timelineData.map((item) => {
                                if (item.type === 'check-in') return <View key={`in-${item.id}`} className="relative mb-8"><View className="absolute -left-[27px] top-0 bg-white dark:bg-slate-800 p-1"><View className="items-center justify-center w-8 h-8 bg-green-100 border-2 border-white rounded-full shadow-sm dark:bg-green-900/30 dark:border-slate-800"><HugeiconsIcon icon={Login03Icon} size={14} color="#16a34a" /></View></View><View className="ml-5"><Text className="text-base font-bold text-slate-800 dark:text-white">Clock In</Text><Text className="text-xs font-semibold text-slate-400">{new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View></View>;
                                if (item.type === 'check-out') return <View key={`out-${item.id}`} className="relative mb-8"><View className="absolute -left-[27px] top-0 bg-white dark:bg-slate-800 p-1"><View className="items-center justify-center w-8 h-8 bg-orange-100 border-2 border-white rounded-full shadow-sm dark:bg-orange-900/30 dark:border-slate-800"><HugeiconsIcon icon={Logout03Icon} size={14} color="#ea580c" /></View></View><View className="ml-5"><Text className="text-base font-bold text-slate-800 dark:text-white">Clock Out</Text><Text className="text-xs font-semibold text-slate-400">{new Date(item.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View></View>;
                                if (item.type === 'task') return <View key={item.data.id} className="relative mb-8"><View className="absolute -left-[21px] top-4 w-3 h-3 rounded-full bg-indigo-500 border-2 border-white dark:border-slate-800 ring-4 ring-indigo-50 dark:ring-indigo-900/20" /><View className="p-4 ml-3 border bg-slate-50 dark:bg-slate-900/50 rounded-2xl border-slate-100 dark:border-slate-700/50"><View className="flex-row items-start justify-between"><View className="flex-1 mr-3"><Text className="text-sm font-bold leading-relaxed text-slate-700 dark:text-slate-200">{item.data.description}</Text>{item.data.remarks ? <Text className="mt-2 text-xs italic text-slate-400">{item.data.remarks}</Text> : null}</View><TouchableOpacity onPress={() => handleEdit(item.data)} className="p-2 bg-white border shadow-sm dark:bg-slate-800 rounded-xl border-slate-100 dark:border-slate-700"><HugeiconsIcon icon={PencilEdit02Icon} size={14} color="#94a3b8" /></TouchableOpacity></View>{item.data.image_url && <Image source={{ uri: item.data.image_url }} style={{ aspectRatio: 3 / 4 }} className="w-full mt-4 rounded-xl bg-slate-200" resizeMode="cover" />}<Text className="mt-3 text-[10px] font-bold text-slate-300 uppercase tracking-wider">{new Date(item.data.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text></View></View>;
                            })}
                        </View>}
                    </View>
                </View>
            </ScrollView>

            <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                    <View className="justify-end flex-1 bg-black/50">
                        <View className="bg-white rounded-t-[32px] px-6 pt-6 pb-0 h-[85%] flex-col">
                            <View className="flex-row items-center justify-between mb-4"><Text className="text-xl font-bold text-slate-900">{editingId ? "Edit Entry" : "New Entry"}</Text><TouchableOpacity onPress={() => setModalVisible(false)} className="p-2 rounded-full bg-slate-100"><HugeiconsIcon icon={Cancel01Icon} size={20} color="#64748b" /></TouchableOpacity></View>
                            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                <TouchableOpacity onPress={() => setShowEntryCalendar(true)} className="flex-row items-center p-4 mb-4 border bg-slate-50 border-slate-200 rounded-2xl"><HugeiconsIcon icon={Calendar03Icon} size={20} color="#64748b" /><Text className="ml-3 text-lg font-medium text-slate-700">{format(new Date(inputDate), 'MMM d, yyyy')}</Text></TouchableOpacity>
                                <TextInput placeholder="Task description..." placeholderTextColor="#94a3b8" className="p-4 mt-2 text-lg font-medium border bg-slate-50 rounded-2xl border-slate-200" multiline value={inputText} onChangeText={setInputText} />
                                <TextInput placeholder="Remarks..." placeholderTextColor="#94a3b8" className="p-4 mt-4 border bg-slate-50 rounded-2xl border-slate-200" value={inputRemarks} onChangeText={setInputRemarks} />
                                <View className="flex-row gap-3 mt-4"><TouchableOpacity onPress={() => pickImage(true)} className="items-center justify-center flex-1 p-4 border bg-slate-50 rounded-2xl border-slate-200"><HugeiconsIcon icon={Camera01Icon} size={24} color="#6366f1" /></TouchableOpacity><TouchableOpacity onPress={() => pickImage(false)} className="items-center justify-center flex-1 p-4 border bg-slate-50 rounded-2xl border-slate-200"><HugeiconsIcon icon={Image01Icon} size={24} color="#6366f1" /></TouchableOpacity></View>
                                {inputImage && <View className="relative"><Image source={{ uri: inputImage }} style={{ aspectRatio: 3 / 4 }} className="w-full mt-4 rounded-2xl bg-slate-200" resizeMode="cover" /><TouchableOpacity onPress={confirmRemoveImage} style={{ position: 'absolute', top: 24, right: 8, backgroundColor: '#ef4444', width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' }}><HugeiconsIcon icon={Delete02Icon} size={16} color="white" /></TouchableOpacity></View>}
                            </ScrollView>
                            <View className="pt-4 pb-6 border-t border-slate-100"><TouchableOpacity onPress={handleSaveTask} disabled={isSaveDisabled || isSaving} style={{ opacity: (isSaveDisabled || isSaving) ? 0.5 : 1 }} className={`items-center justify-center w-full py-4 rounded-2xl shadow-lg ${isSaveDisabled ? 'bg-slate-300 shadow-none' : 'bg-indigo-600 shadow-indigo-200'}`}>{isSaving ? <ActivityIndicator size="small" color="#fff" /> : <Text className="text-lg font-bold text-center text-white">Save Entry</Text>}</TouchableOpacity>{editingId && <TouchableOpacity onPress={handleDeleteTask} disabled={isDeleting} className="items-center justify-center py-3 mt-2">{isDeleting ? <ActivityIndicator size="small" color="#ef4444" /> : <Text className="font-bold text-red-500">Delete Entry</Text>}</TouchableOpacity>}</View>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
}