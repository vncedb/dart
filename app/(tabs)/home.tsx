import {
    Briefcase01Icon,
    Delete02Icon,
    HourglassIcon,
    Image02Icon,
    Login03Icon,
    Logout03Icon,
    PencilEdit02Icon,
    PlusSignIcon,
    RefreshIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { endOfMonth, format, isToday, startOfMonth } from 'date-fns';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, {
    configureReanimatedLogger,
    Easing,
    FadeIn,
    FadeOut,
    interpolate,
    interpolateColor,
    ReanimatedLogLevel,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withSpring,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, G, LinearGradient, Rect, Stop } from 'react-native-svg';

// Components & Utils
import AttendanceCalendar from '../../components/AttendanceCalendar';
import BiometricButton from '../../components/BiometricButton';
import FloatingAlert from '../../components/FloatingAlert';
import ModernAlert from '../../components/ModernAlert';
import { GREETINGS } from '../../constants/Greetings';
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { generateUUID } from '../../lib/database'; // <--- ADDED THIS IMPORT
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';
import { registerForPushNotificationsAsync, setupNotificationCategories } from '../../utils/NotificationService';

// Silence Reanimated warnings
configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// --- HELPER FUNCTIONS ---
const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m;
};

const calculateDailyGoal = (jobSettings: any) => {
    if (!jobSettings || !jobSettings.work_schedule) return 8; 
    const startMins = timeToMinutes(jobSettings.work_schedule.start);
    const endMins = timeToMinutes(jobSettings.work_schedule.end);
    let workDuration = endMins - startMins;
    if (workDuration < 0) workDuration += 24 * 60;
    
    let breakDuration = 0;
    if (jobSettings.break_schedule && Array.isArray(jobSettings.break_schedule)) {
        jobSettings.break_schedule.forEach((brk: any) => {
            const bStart = timeToMinutes(brk.start);
            const bEnd = timeToMinutes(brk.end);
            let bDur = bEnd - bStart;
            if (bDur < 0) bDur += 24 * 60;
            breakDuration += bDur;
        });
    }
    const netMinutes = Math.max(0, workDuration - breakDuration);
    return Number((netMinutes / 60).toFixed(2));
};

const getLocalDate = (d = new Date()) => {
    const offsetMs = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offsetMs).toISOString().split('T')[0];
};

const getTimeBasedGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
};

// --- IMAGE COMPONENT ---
const ActivityImage = ({ uri, theme }: { uri: string, theme: any }) => {
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
    const [key, setKey] = useState(0); 

    const handleRetry = () => {
        setStatus('loading');
        setKey(prev => prev + 1);
    };

    return (
        <View style={{ width: '100%', aspectRatio: 4/3, borderRadius: 12, marginTop: 8, overflow: 'hidden', backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border }}>
             <Image
                key={key}
                source={{ uri }}
                style={[StyleSheet.absoluteFill, { opacity: status === 'success' ? 1 : 0 }]}
                resizeMode="cover"
                onLoad={() => setStatus('success')}
                onError={() => setStatus('error')}
            />
            {status === 'loading' && (
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                    <ActivityIndicator size="small" color={theme.colors.primary} />
                </View>
            )}
            {status === 'error' && (
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.card }]}>
                     <HugeiconsIcon icon={Image02Icon} size={32} color={theme.colors.icon} />
                     <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginTop: 8, marginBottom: 12 }}>Failed to load image</Text>
                     <TouchableOpacity onPress={handleRetry} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: theme.colors.background, borderRadius: 8, borderWidth: 1, borderColor: theme.colors.border }}>
                        <HugeiconsIcon icon={RefreshIcon} size={14} color={theme.colors.text} />
                        <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: 'bold', marginLeft: 6 }}>Retry</Text>
                     </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

// --- SKELETON LOADING ---
const SkeletonItem = ({ style, borderRadius = 12 }: { style?: any, borderRadius?: number }) => {
    const theme = useAppTheme();
    const opacity = useSharedValue(0.3);
    useEffect(() => {
        opacity.value = withRepeat(withSequence(withTiming(0.6, { duration: 800 }), withTiming(0.3, { duration: 800 })), -1, true);
    }, []);
    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    return <Animated.View style={[{ backgroundColor: theme.dark ? theme.colors.border : theme.colors.slate200, borderRadius }, style, animatedStyle]} />;
};

const HomeSkeleton = () => (
    <View style={{ gap: 32, marginTop: 10 }}>
        <View style={{ alignItems: 'center', gap: 24 }}>
            <SkeletonItem style={{ width: 160, height: 40, borderRadius: 20 }} />
            <SkeletonItem style={{ width: 160, height: 160, borderRadius: 80 }} /> 
        </View>
        <SkeletonItem style={{ width: '100%', height: 200, borderRadius: 32 }} />
        <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <SkeletonItem style={{ width: 140, height: 24, borderRadius: 8 }} />
                <SkeletonItem style={{ width: 40, height: 40, borderRadius: 20 }} />
            </View>
            <SkeletonItem style={{ width: '100%', height: 80, borderRadius: 24 }} />
            <SkeletonItem style={{ width: '100%', height: 80, borderRadius: 24 }} />
        </View>
    </View>
);

// --- DAILY SUMMARY CARD ---
const DailySummaryCard = ({ totalMinutes, isClockedIn, theme, dailyGoal = 8, isOvertime = false, startTime }: any) => {
    const safeMinutes = Math.max(0, totalMinutes);
    const h = Math.floor(safeMinutes / 60);
    const m = Math.floor(safeMinutes % 60);
    const goalMinutes = dailyGoal * 60;
    const percentage = goalMinutes > 0 ? Math.min(safeMinutes / goalMinutes, 1) : 0;
    const displayPercentage = Math.round(percentage * 100);
    const isGoalReached = safeMinutes >= goalMinutes;
    
    const progressValue = useSharedValue(0);
    const scaleValue = useSharedValue(1);

    useEffect(() => {
        progressValue.value = withTiming(percentage, { duration: 1500, easing: Easing.out(Easing.cubic) });
    }, [percentage]);

    const handlePressIn = () => { scaleValue.value = withSpring(0.97); };
    const handlePressOut = () => { scaleValue.value = withSpring(1); };

    const activeColor = isOvertime ? '#EF4444' : isClockedIn ? '#10B981' : '#94A3B8';
    const statusText = isOvertime ? 'OVERTIME' : isClockedIn ? 'ACTIVE' : 'CHECKED OUT';
    const timeColor = isGoalReached ? '#4ADE80' : theme.colors.text;

    const SIZE = 110;
    const RADIUS = 48;
    const STROKE_WIDTH = 8;
    const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
    
    const animatedCircleProps = useAnimatedStyle(() => ({ strokeDashoffset: CIRCUMFERENCE * (1 - progressValue.value) }));
    const animatedCardStyle = useAnimatedStyle(() => ({ transform: [{ scale: scaleValue.value }] }));

    return (
        <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={1}>
            <Animated.View style={[styles.cardNew, animatedCardStyle, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                <View style={StyleSheet.absoluteFill}>
                    <Svg height="100%" width="100%">
                        <Defs>
                            <LinearGradient id="meshGrad" x1="0" y1="0" x2="1" y2="1">
                                <Stop offset="0" stopColor={theme.dark ? "#020617" : "#F8FAFC"} stopOpacity="1" />
                                <Stop offset="1" stopColor={theme.dark ? "#1E293B" : "#F1F5F9"} stopOpacity="1" />
                            </LinearGradient>
                        </Defs>
                        <Rect x="0" y="0" width="100%" height="100%" fill="url(#meshGrad)" />
                    </Svg>
                </View>
                <View style={{ padding: 24, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flex: 1, paddingRight: 16 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, backgroundColor: isClockedIn ? `${activeColor}15` : theme.colors.border, borderWidth: 1, borderColor: isClockedIn ? activeColor : theme.colors.border }}>
                                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: activeColor, marginRight: 6 }} />
                                <Text style={{ color: activeColor, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>{statusText}</Text>
                            </View>
                        </View>
                        <Text style={{ fontSize: 36, fontWeight: '900', color: timeColor, fontVariant: ['tabular-nums'], letterSpacing: -1, lineHeight: 40 }}>
                            {h}<Text style={{ fontSize: 18, color: theme.colors.textSecondary, fontWeight: '600' }}>h</Text> {m}<Text style={{ fontSize: 18, color: theme.colors.textSecondary, fontWeight: '600' }}>m</Text>
                        </Text>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 16 }}>Total Duration</Text>
                        <View style={{ flexDirection: 'row', gap: 20 }}>
                            <View>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary, opacity: 0.7 }}>CHECK-IN</Text>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text, marginTop: 2 }}>
                                    {isClockedIn && startTime ? format(new Date(startTime), 'h:mm a') : '--:--'}
                                </Text>
                            </View>
                            <View>
                                <Text style={{ fontSize: 10, fontWeight: '700', color: theme.colors.textSecondary, opacity: 0.7 }}>GOAL</Text>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.text, marginTop: 2 }}>{dailyGoal}h</Text>
                            </View>
                        </View>
                    </View>
                    <View style={{ width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' }}>
                        <Svg width={SIZE} height={SIZE}>
                            <G rotation="-90" origin={`${SIZE/2}, ${SIZE/2}`}>
                                <Circle cx={SIZE/2} cy={SIZE/2} r={RADIUS} stroke={theme.dark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"} strokeWidth={STROKE_WIDTH} fill="none" />
                                <AnimatedCircle cx={SIZE/2} cy={SIZE/2} r={RADIUS} stroke={activeColor} strokeWidth={STROKE_WIDTH} fill="none" strokeDasharray={CIRCUMFERENCE} animatedProps={animatedCircleProps} strokeLinecap="round" />
                            </G>
                        </Svg>
                        <View style={StyleSheet.absoluteFillObject} className="items-center justify-center">
                            <Text style={{ fontSize: 20, fontWeight: '800', color: theme.colors.text }}>{displayPercentage}<Text style={{ fontSize: 12 }}>%</Text></Text>
                        </View>
                    </View>
                </View>
            </Animated.View>
        </Pressable>
    );
};

// --- OT MODAL ---
const OvertimeModal = ({ visible, onClose, onConfirm, theme }: any) => {
    const [hours, setHours] = useState('');
    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
                <View style={[styles.modalContent, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <View style={[styles.modalIcon, { backgroundColor: theme.colors.warning + '15' }]}>
                        <HugeiconsIcon icon={Briefcase01Icon} size={32} color={theme.colors.warning} />
                    </View>
                    <Text style={[styles.modalTitle, { color: theme.colors.text }]}>Overtime Detected</Text>
                    <Text style={[styles.modalDesc, { color: theme.colors.textSecondary }]}>Starting a session outside your scheduled shift. Please specify the duration.</Text>
                    <TextInput value={hours} onChangeText={setHours} placeholder="Hours" keyboardType="numeric" placeholderTextColor={theme.colors.textSecondary} textAlign="center" style={[styles.modalInput, { backgroundColor: theme.colors.background, color: theme.colors.text, borderColor: theme.colors.border }]} />
                    <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                        <TouchableOpacity onPress={onClose} style={[styles.modalButton, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                            <Text style={{ color: theme.colors.text, fontWeight: '700' }}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { if(hours) onConfirm(parseFloat(hours)); }} style={[styles.modalButton, { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }]}>
                            <Text style={{ color: '#fff', fontWeight: '800' }}>Start</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
};

// --- JOB SETUP CARD ---
const JobSetupCard = ({ theme, router }: any) => {
    return (
        <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, padding: 24, borderRadius: 24, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: theme.colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <HugeiconsIcon icon={Briefcase01Icon} size={28} color={theme.colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '800', marginBottom: 4 }}>Set up your Job</Text>
                <TouchableOpacity onPress={() => router.push('/job/form')} style={{ backgroundColor: theme.colors.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-start' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Start Setup</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

// --- MAIN HOME COMPONENT ---
export default function Home() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const theme = useAppTheme();
    const { triggerSync } = useSync(); // Sync Hook
    const successPlayer = useAudioPlayer(require('../../assets/success.mp3'));

    const [loading, setLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true); 
    const [refreshing, setRefreshing] = useState(false);
    
    const [profile, setProfile] = useState<any>(null);
    const [jobSettings, setJobSettings] = useState<any>(null); 
    const [dailyGoal, setDailyGoal] = useState(8); 
    const [todaysRecords, setTodaysRecords] = useState<any[]>([]);
    const [monthRecords, setMonthRecords] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [timelineData, setTimelineData] = useState<any[]>([]);
    const [appSettings, setAppSettings] = useState({ vibrationEnabled: true, soundEnabled: true });
    
    const [greetingPhrase, setGreetingPhrase] = useState("");
    const [isDefaultGreeting, setIsDefaultGreeting] = useState(true);
    const [workedMinutes, setWorkedMinutes] = useState(0); 
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [currentDate, setCurrentDate] = useState(new Date());
    
    const [isIslandExpanded, setIsIslandExpanded] = useState(false);
    const islandAnimation = useSharedValue(0); 
    const bgBreath = useSharedValue(0); 
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    const [alertType, setAlertType] = useState<'success' | 'check-in' | 'check-out'>('success');
    const [modernAlertConfig, setModernAlertConfig] = useState<any>({ visible: false });
    const [otModalVisible, setOtModalVisible] = useState(false);

    const latestRecord = todaysRecords.length > 0 ? todaysRecords[0] : null;
    const isClockedIn = latestRecord?.status === 'pending';
    const isSessionOvertime = latestRecord?.remarks?.includes('Overtime');

    const displayName = profile ? (profile.first_name || 'User') : 'User';
    const activityTitle = isToday(selectedDate) ? "Today's Activity" : `Activity • ${format(selectedDate, 'MMM d')}`;

    useEffect(() => {
        bgBreath.value = withRepeat(withSequence(withTiming(1, { duration: 3000 }), withTiming(0, { duration: 3000 })), -1, true);
        registerForPushNotificationsAsync();
        setupNotificationCategories();
        
        setGreetingPhrase(getTimeBasedGreeting());
        const greetingInterval = setInterval(() => {
            const randomIndex = Math.floor(Math.random() * GREETINGS.length);
            setGreetingPhrase(GREETINGS[randomIndex]);
            setIsDefaultGreeting(false);
        }, 20000);

        const clockInterval = setInterval(() => setCurrentDate(new Date()), 1000);
        return () => { clearInterval(greetingInterval); clearInterval(clockInterval); };
    }, []);

    const fetchMonthAttendance = async (date: Date) => {
        try {
            // Use getSession instead of getUser for offline compatibility
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            
            const db = await getDB();
            const start = startOfMonth(date).toISOString().split('T')[0];
            const end = endOfMonth(date).toISOString().split('T')[0];
            
            // SQLite Query for Month Range
            const data = await db.getAllAsync(
                'SELECT id, date, clock_in, clock_out FROM attendance WHERE user_id = ? AND date >= ? AND date <= ?',
                [session.user.id, start, end]
            );
            if (data) setMonthRecords(data as any);
        } catch (e) { console.log(e); }
    };

    const loadData = async () => {
        try {
            // Use getSession so we don't hit the network for auth verification
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const user = session.user;
            
            const db = await getDB();
            const dateStr = getLocalDate(selectedDate);
            
            // Parallel Fetch: ALL data from Local DB (including cached profile/job)
            const [attendance, dailyTasks, profileSetting, jobSetting] = await Promise.all([
                db.getAllAsync('SELECT * FROM attendance WHERE user_id = ? AND date = ? ORDER BY clock_in DESC', [user.id, dateStr]),
                db.getAllAsync('SELECT * FROM accomplishments WHERE user_id = ? AND date = ?', [user.id, dateStr]),
                db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['user_profile']),
                db.getFirstAsync('SELECT value FROM app_settings WHERE key = ?', ['job_settings'])
            ]);

            // Set Profile from Cache
            if (profileSetting && (profileSetting as any).value) {
                setProfile(JSON.parse((profileSetting as any).value));
            }

            // Set Job from Cache
            if (jobSetting && (jobSetting as any).value) {
                const parsedJob = JSON.parse((jobSetting as any).value);
                setJobSettings(parsedJob);
                setDailyGoal(calculateDailyGoal(parsedJob));
            } else {
                setJobSettings(null);
                setDailyGoal(8);
            }

            setTodaysRecords(attendance as any[]);
            setTasks(dailyTasks as any[]);

        } catch (e: any) { 
            console.log(e);
            setModernAlertConfig({ 
                visible: true, type: 'error', title: 'Error', message: e.message || 'Unable to fetch data.', 
                confirmText: 'Retry', onConfirm: () => { setModernAlertConfig((prev: any) => ({...prev, visible: false})); setRefreshing(true); loadData(); },
                cancelText: 'Close', onCancel: () => setModernAlertConfig((prev: any) => ({...prev, visible: false}))
            });
        } 
        finally { 
            setRefreshing(false); 
            setTimeout(() => setIsInitialLoading(false), 300); 
        }
    };

    useFocusEffect(useCallback(() => {
        loadData();
        fetchMonthAttendance(selectedDate);
        AsyncStorage.getItem('appSettings').then(s => { if (s) setAppSettings(JSON.parse(s)); });
    }, [selectedDate]));

    useEffect(() => {
        const timer = setInterval(() => {
            let totalMs = 0;
            todaysRecords.forEach(record => {
                const start = new Date(record.clock_in).getTime();
                const end = record.clock_out ? new Date(record.clock_out).getTime() : new Date().getTime();
                totalMs += Math.max(0, end - start);
            });
            setWorkedMinutes(totalMs / (1000 * 60));
        }, 1000);
        return () => clearInterval(timer);
    }, [todaysRecords]);

    useEffect(() => {
        const timeline: any[] = [];
        const sortedRecords = [...todaysRecords].sort((a, b) => new Date(a.clock_in).getTime() - new Date(b.clock_in).getTime());
        sortedRecords.forEach(record => {
            const isOT = record.remarks && record.remarks.includes('Overtime');
            timeline.push({ type: 'check-in', time: record.clock_in, id: record.id, isOvertime: isOT });
            const start = new Date(record.clock_in).getTime();
            const end = record.clock_out ? new Date(record.clock_out).getTime() : Infinity;
            tasks.filter(t => { const tTime = new Date(t.created_at).getTime(); return tTime >= start && tTime <= end; }).forEach(t => timeline.push({ type: 'task', data: t }));
            if (record.clock_out) timeline.push({ type: 'check-out', time: record.clock_out, id: record.id, isOvertime: isOT });
        });
        setTimelineData(timeline);
    }, [todaysRecords, tasks]);

    const processClockAction = async (isOvertime = false, duration = 0) => {
        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const user = session.user;
            const db = await getDB();

            if (isClockedIn) {
                const now = new Date().toISOString();
                // 1. Update Local
                await db.runAsync('UPDATE attendance SET clock_out = ?, status = ? WHERE id = ?', [now, 'completed', latestRecord.id]);
                // 2. Queue Sync
                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)',
                    ['attendance', latestRecord.id, 'UPDATE', JSON.stringify({ clock_out: now, status: 'completed' })]
                );
                
                await AsyncStorage.removeItem('active_ot_end');
                setAlertMessage("See you later!"); 
                setAlertType('check-out');
            } else {
                const now = new Date();
                let remarks = null;
                if (isOvertime && duration > 0) {
                    const expectedEnd = new Date(now.getTime() + duration * 60 * 60 * 1000);
                    remarks = `Overtime: ${duration} hrs`;
                    await AsyncStorage.setItem('active_ot_end', expectedEnd.toISOString());
                } else {
                    await AsyncStorage.removeItem('active_ot_end');
                }

                const newId = generateUUID();
                const record = { id: newId, user_id: user.id, clock_in: now.toISOString(), date: getLocalDate(), status: 'pending', remarks };

                // 1. Insert Local
                await db.runAsync(
                    'INSERT INTO attendance (id, user_id, date, clock_in, status, remarks) VALUES (?, ?, ?, ?, ?, ?)',
                    [record.id, record.user_id, record.date, record.clock_in, record.status, record.remarks]
                );
                // 2. Queue Sync
                await db.runAsync(
                    'INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)',
                    ['attendance', record.id, 'INSERT', JSON.stringify(record)]
                );

                setAlertMessage(isOvertime ? "Overtime Started!" : "Welcome In!"); 
                setAlertType('check-in');
            }

            if (appSettings.soundEnabled) { successPlayer.seekTo(0); successPlayer.play(); }
            if (appSettings.vibrationEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            setAlertVisible(true);
            await loadData();
            triggerSync(); // Trigger background sync

        } catch (e: any) { Alert.alert("Error", e.message); } finally { setLoading(false); }
    };

    const handleClockButtonPress = () => {
        if (!jobSettings) {
            setModernAlertConfig({ visible: true, type: 'warning', title: 'No Job Found', message: 'Please set up your job details first.', confirmText: 'Add Job', onConfirm: () => { setModernAlertConfig((prev:any)=>({...prev, visible:false})); router.push('/job/form'); } });
            return;
        }
        if (isClockedIn) { processClockAction(); return; }

        if (jobSettings?.work_schedule?.start && jobSettings?.work_schedule?.end) {
            const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
            const startMins = timeToMinutes(jobSettings.work_schedule.start);
            const endMins = timeToMinutes(jobSettings.work_schedule.end);
            const isDayShift = startMins < endMins;
            const isInside = isDayShift ? (nowMins >= startMins - 30 && nowMins <= endMins) : (nowMins >= startMins - 30 || nowMins <= endMins);
            if (!isInside) { setOtModalVisible(true); return; }
        }
        processClockAction(false);
    };

    const toggleIsland = () => {
        setIsIslandExpanded(!isIslandExpanded);
        islandAnimation.value = withTiming(isIslandExpanded ? 0 : 1, { duration: 500 });
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const islandStyle = useAnimatedStyle(() => ({
        height: interpolate(islandAnimation.value, [0, 1], [72, 540]),
        width: interpolate(islandAnimation.value, [0, 1], [SCREEN_WIDTH - 40, SCREEN_WIDTH - 16]),
        borderRadius: interpolate(islandAnimation.value, [0, 1], [36, 28]),
        backgroundColor: interpolateColor(bgBreath.value, [0, 1], [theme.colors.headerStart, theme.colors.headerEnd])
    }));
    const contentOpacity = useAnimatedStyle(() => ({ opacity: interpolate(islandAnimation.value, [0, 0.15], [1, 0]) }));
    const calendarOpacity = useAnimatedStyle(() => ({ opacity: interpolate(islandAnimation.value, [0.2, 1], [0, 1]), zIndex: islandAnimation.value > 0.5 ? 1 : -1 }));

    const handleAdd = () => { router.push('/reports/add-entry'); };
    const handleEdit = (t: any) => { router.push({ pathname: '/reports/add-entry', params: { id: t.id } }); };
    
    // Offline Delete Task
    const handleDeleteTask = (t: any) => { 
        setModernAlertConfig({ 
            visible: true, type: 'warning', title: 'Delete Entry?', message: 'This will remove the entry from your history.', confirmText: 'Delete', cancelText: 'Cancel', 
            onConfirm: async () => { 
                setModernAlertConfig((prev: any) => ({ ...prev, visible: false })); 
                setLoading(true); 
                try { 
                    const db = await getDB();
                    // 1. Delete Local
                    await db.runAsync('DELETE FROM accomplishments WHERE id = ?', [t.id]);
                    // 2. Queue Sync
                    await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action) VALUES (?, ?, ?)', ['accomplishments', t.id, 'DELETE']);
                    
                    await loadData(); 
                    triggerSync();

                    setAlertMessage("Entry deleted"); 
                    setAlertType('success'); 
                    setAlertVisible(true); 
                } catch (e) { console.log(e); } finally { setLoading(false); } 
            }, 
            onCancel: () => setModernAlertConfig((prev: any) => ({ ...prev, visible: false })) 
        }); 
    };

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            <FloatingAlert visible={alertVisible} message={alertMessage} type={alertType} onHide={() => setAlertVisible(false)} />
            <ModernAlert {...modernAlertConfig} />
            <OvertimeModal visible={otModalVisible} onClose={() => setOtModalVisible(false)} onConfirm={(hrs: number) => { setOtModalVisible(false); processClockAction(true, hrs); }} theme={theme} />
            
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Svg height="100%" width="100%"><Defs><LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={theme.colors.bgGradientStart} stopOpacity="1" /><Stop offset="1" stopColor={theme.colors.bgGradientEnd} stopOpacity="1" /></LinearGradient></Defs><Rect x="0" y="0" width="100%" height="100%" fill="url(#bgGrad)" /></Svg>
            </View>
            <View style={{ position: 'absolute', top: 0, height: insets.top + 40, width: '100%', zIndex: 90 }}>
                <Svg height="100%" width="100%"><Rect x="0" y="0" width="100%" height="100%" fill={theme.colors.bgGradientStart} opacity={0.8} /></Svg>
            </View>

            {/* Dynamic Island */}
            <View style={{ position: 'absolute', top: insets.top + 5, alignItems: 'center', width: '100%', zIndex: 100 }}>
                {isIslandExpanded && <Pressable onPress={toggleIsland} style={StyleSheet.absoluteFill} />}
                <Pressable onPress={!isIslandExpanded ? toggleIsland : undefined} activeOpacity={1}>
                    <Animated.View style={[styles.island, islandStyle]}>
                        <Animated.View style={[styles.islandContent, contentOpacity]}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', width: '100%', paddingHorizontal: 24 }}>
                                <View><Text style={{ color: theme.colors.headerText, fontWeight: '800' }}>{format(selectedDate, 'MMMM d')}</Text><Text style={{ color: theme.colors.headerText, opacity: 0.7, fontSize: 10, fontWeight: 'bold' }}>{format(selectedDate, 'yyyy')}</Text></View>
                                <View style={{ flexDirection: 'row', alignItems: 'baseline' }}><Text style={{ color: theme.colors.headerText, fontSize: 32, fontWeight: '700' }}>{format(currentDate, 'h:mm')}</Text><Text style={{ color: theme.colors.headerText, fontSize: 12, fontWeight: 'bold', marginLeft: 4 }}>{format(currentDate, 'a')}</Text></View>
                            </View>
                        </Animated.View>
                        <Animated.View style={[StyleSheet.absoluteFill, calendarOpacity, { padding: 16 }]} pointerEvents={isIslandExpanded ? 'auto' : 'none'}>
                            <AttendanceCalendar records={monthRecords} selectedDate={selectedDate} onSelectDate={(date) => { setSelectedDate(date); toggleIsland(); }} onMonthChange={(date) => {}} showDetails={false} />
                            <TouchableOpacity onPress={toggleIsland} style={{ height: 40, alignItems: 'center', justifyContent: 'center' }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} /></TouchableOpacity>
                        </Animated.View>
                    </Animated.View>
                </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingTop: 120 + insets.top, paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} progressViewOffset={insets.top + 100} tintColor={theme.colors.primary} />}>
                {isInitialLoading ? <HomeSkeleton /> : (
                    <>
                        <View style={{ alignItems: 'center', marginBottom: 40 }}>
                            <View style={{ backgroundColor: theme.colors.surface, height: 48, borderRadius: 99, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center', paddingHorizontal: 24, marginBottom: 32 }}>
                                <Animated.View key={greetingPhrase} entering={FadeIn.duration(1000)} exiting={FadeOut.duration(1000)}>
                                    <Text style={{ color: theme.colors.text, fontSize: 12, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase' }}>
                                        {isDefaultGreeting ? `${greetingPhrase}, ${displayName}` : greetingPhrase}
                                    </Text>
                                </Animated.View>
                            </View>
                            <BiometricButton onSuccess={handleClockButtonPress} isClockedIn={isClockedIn} isLoading={loading} settings={appSettings} />
                        </View>

                        <View style={{ marginBottom: 24 }} collapsable={false}>
                            {jobSettings ? <DailySummaryCard totalMinutes={workedMinutes} isClockedIn={isClockedIn} theme={theme} dailyGoal={dailyGoal} isOvertime={isSessionOvertime} startTime={latestRecord?.clock_in} /> : <JobSetupCard theme={theme} router={router} />}
                        </View>

                        {/* Activity Header */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                            <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 }}>{activityTitle}</Text>
                            <TouchableOpacity disabled={!isClockedIn} onPress={() => router.push('/reports/add-entry')} style={{ backgroundColor: isClockedIn ? theme.colors.iconBg : theme.colors.background, borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
                                <HugeiconsIcon icon={PlusSignIcon} size={20} color={isClockedIn ? theme.colors.primary : theme.colors.icon} />
                            </TouchableOpacity>
                        </View>

                        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }} collapsable={false}>
                            <View style={{ padding: 20 }}>
                                {timelineData.length === 0 ? (
                                    <View style={{ alignItems: 'center', padding: 20, opacity: 0.5 }}>
                                        <HugeiconsIcon icon={HourglassIcon} size={32} color={theme.colors.icon} />
                                        <Text style={{ color: theme.colors.textSecondary, marginTop: 8, fontSize: 12 }}>No activity yet.</Text>
                                    </View>
                                ) : (
                                    <View style={{ borderLeftWidth: 2, borderLeftColor: theme.colors.border, marginLeft: 8, paddingLeft: 16 }}>
                                        {timelineData.map((item: any) => (
                                            <View key={`${item.type}-${item.id}`} style={{ marginBottom: 24 }}>
                                                <View style={{ position: 'absolute', left: -32, top: '50%', marginTop: -16 }}>
                                                    {item.type === 'check-in' ? (
                                                        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 4, borderWidth: 2, borderColor: theme.colors.success }}>
                                                            <HugeiconsIcon icon={Login03Icon} size={16} color={theme.colors.success} />
                                                        </View>
                                                    ) : item.type === 'check-out' ? (
                                                        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 4, borderWidth: 2, borderColor: theme.colors.warning }}>
                                                            <HugeiconsIcon icon={Logout03Icon} size={16} color={theme.colors.warning} />
                                                        </View>
                                                    ) : (
                                                        <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.card, borderWidth: 3, borderColor: theme.colors.primary, marginLeft: 10 }} />
                                                    )}
                                                </View>
                                                {item.type === 'task' ? (
                                                    <View style={{ backgroundColor: theme.colors.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                            <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '700', opacity: 0.8 }}>
                                                                {format(new Date(item.data.created_at), 'h:mm a')}
                                                            </Text>
                                                            <View style={{ flexDirection: 'row', gap: 12 }}>
                                                                <TouchableOpacity onPress={() => handleEdit(item.data)} hitSlop={10}>
                                                                    <HugeiconsIcon icon={PencilEdit02Icon} size={16} color={theme.colors.textSecondary} />
                                                                </TouchableOpacity>
                                                                <TouchableOpacity onPress={() => handleDeleteTask(item.data)} hitSlop={10}>
                                                                    <HugeiconsIcon icon={Delete02Icon} size={16} color="#ef4444" />
                                                                </TouchableOpacity>
                                                            </View>
                                                        </View>
                                                        <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginBottom: 4 }}>{item.data.description}</Text>
                                                        {item.data.remarks && <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 8 }}>{item.data.remarks}</Text>}
                                                        {item.data.image_url && <ActivityImage uri={item.data.image_url} theme={theme} />}
                                                    </View>
                                                ) : (
                                                    <View style={{ justifyContent: 'center', minHeight: 32 }}>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                            <Text style={{ color: theme.colors.text, fontWeight: '700', fontSize: 14, marginRight: 8 }}>
                                                                {item.type === 'check-in' ? 'Checked In' : 'Checked Out'}
                                                            </Text>
                                                            {item.isOvertime && (
                                                                <View style={{ backgroundColor: theme.colors.warning + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: theme.colors.warning }}>
                                                                    <Text style={{ fontSize: 10, fontWeight: '800', color: theme.colors.warning }}>OT</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>{format(new Date(item.time), 'h:mm a')}</Text>
                                                    </View>
                                                )}
                                            </View>
                                        ))}
                                    </View>
                                )}
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    island: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10 },
    islandContent: { position: 'absolute', width: '100%', height: '100%', justifyContent: 'center', alignItems: 'center' },
    cardNew: { borderRadius: 24, marginBottom: 32, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 6, overflow: 'hidden', position: 'relative', height: 200, borderWidth: 1 },
    glassHighlight: { position: 'absolute', top: 0, left: 0, right: 0, height: '40%', backgroundColor: 'rgba(255,255,255,0.03)', borderTopLeftRadius: 24, borderTopRightRadius: 24 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { width: '100%', borderRadius: 28, padding: 24, alignItems: 'center', borderWidth: 1 },
    modalIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
    modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    modalDesc: { textAlign: 'center', marginBottom: 24, lineHeight: 22 },
    modalInput: { width: '100%', marginBottom: 24, borderRadius: 16, padding: 18, fontSize: 18, fontWeight: '700', borderWidth: 1 },
    modalButton: { flex: 1, padding: 16, borderRadius: 16, alignItems: 'center', borderWidth: 1 }
});