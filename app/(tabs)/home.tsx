import {
    ArrowDown01Icon,
    Notification01Icon,
    PlusSignIcon,
    Settings02Icon,
    WifiOffIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetInfo } from '@react-native-community/netinfo';
import { addDays, addHours, differenceInSeconds, format, isToday, set, startOfMonth, startOfWeek } from 'date-fns';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    FadeIn,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withSequence,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import ActivityTimeline from '../../components/ActivityTimeline';
import BiometricButton from '../../components/BiometricButton';
import BreakModeAlert from '../../components/BreakModeAlert';
import DailySummaryCard from '../../components/DailySummaryCard';
import DatePicker from '../../components/DatePicker';
import DynamicBar from '../../components/DynamicBar';
import DynamicHeader from '../../components/DynamicHeader';
import ModernAlert from '../../components/ModernAlert';
import NotificationModal from '../../components/NotificationModal';
import OvertimeModal from '../../components/OvertimeModal';
import ScaleButton from '../../components/ScaleButton';

import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { generateUUID, getNotificationsLocal, markAllNotificationsReadLocal, saveNotificationLocal } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';
import {
    clearAttendanceNotification,
    initNotificationSystem,
    updateAttendanceNotification
} from '../../utils/NotificationService';

const timeToMinutes = (timeStr: string) => {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return (h * 60) + m;
};

const checkIsBreakTime = (schedule: any[]) => {
    if (!schedule || !Array.isArray(schedule)) return false;
    const now = new Date();
    const currentMins = now.getHours() * 60 + now.getMinutes();
    return schedule.some(brk => {
        const start = timeToMinutes(brk.start);
        const end = timeToMinutes(brk.end);
        if (end < start) return currentMins >= start || currentMins < end;
        return currentMins >= start && currentMins < end;
    });
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

const getPeriodStartDate = (payoutType: string) => {
    const now = new Date();
    const weekStartsOn = 1; 
    switch (payoutType) {
        case 'Weekly': return startOfWeek(now, { weekStartsOn }); 
        case 'Bi-Weekly': return addDays(startOfWeek(now, { weekStartsOn }), -7); 
        case 'Monthly': return startOfMonth(now);
        case 'Semi-Monthly':
            if (now.getDate() <= 15) return startOfMonth(now);
            return set(now, { date: 16, hours: 0, minutes: 0, seconds: 0 });
        default: return startOfWeek(now, { weekStartsOn });
    }
};

const SkeletonItem = ({ style, borderRadius = 4, color }: { style?: any, borderRadius?: number, color?: string }) => {
    const theme = useAppTheme();
    const opacity = useSharedValue(0.5);

    useEffect(() => {
        opacity.value = withRepeat(
            withSequence(withTiming(1, { duration: 1000 }), withTiming(0.5, { duration: 1000 })), 
            -1, 
            true
        );
    }, [opacity]);

    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const bgColor = color || (theme.dark ? 'rgba(255,255,255,0.1)' : '#E5E7EB');

    return <Animated.View style={[{ backgroundColor: bgColor, borderRadius }, style, animatedStyle]} />;
};

const HomeContentSkeleton = () => {
    const theme = useAppTheme();
    const borderColor = theme.colors.border;
    const cardBg = theme.colors.card;

    return (
        <View style={styles.skeletonContainer}>
            <View style={{ alignItems: 'center', marginBottom: 40, marginTop: 20 }}>
                <View style={[styles.skeletonDynamicBar, { borderColor, backgroundColor: cardBg }]}>
                     <SkeletonItem style={{ width: 40, height: 40, borderRadius: 20, marginRight: 14 }} />
                     <View>
                         <SkeletonItem style={{ width: 60, height: 8, marginBottom: 6 }} />
                         <SkeletonItem style={{ width: 100, height: 12 }} />
                     </View>
                </View>
                <View style={{ alignItems: 'center', marginTop: 24 }}>
                     <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 1, borderColor, alignItems: 'center', justifyContent: 'center' }}>
                         <SkeletonItem style={{ width: 100, height: 100, borderRadius: 50 }} color={theme.dark ? undefined : '#F3F4F6'} />
                     </View>
                     <SkeletonItem style={{ width: 120, height: 10, marginTop: 20 }} />
                </View>
            </View>

            <View style={[styles.skeletonCard, { backgroundColor: cardBg, borderColor, marginBottom: 24 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingBottom: 16 }}>
                    <View>
                        <SkeletonItem style={{ width: 70, height: 20, marginBottom: 12, borderRadius: 6 }} />
                        <SkeletonItem style={{ width: 130, height: 32, marginBottom: 4 }} />
                        <SkeletonItem style={{ width: 80, height: 10 }} />
                    </View>
                    <SkeletonItem style={{ width: 90, height: 90, borderRadius: 45 }} color={theme.dark ? undefined : '#F3F4F6'} />
                </View>
                <View style={{ height: 1, backgroundColor: borderColor, opacity: 0.5, marginHorizontal: 20 }} />
                <View style={{ flexDirection: 'row', paddingVertical: 16, paddingHorizontal: 8 }}>
                    {[1, 2, 3].map((i) => (
                        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6, borderRightWidth: i < 3 ? 1 : 0, borderColor }}>
                            <SkeletonItem style={{ width: 30, height: 8 }} />
                            <SkeletonItem style={{ width: 50, height: 12 }} />
                        </View>
                    ))}
                </View>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, paddingHorizontal: 4, alignItems: 'center' }}>
                <SkeletonItem style={{ width: 120, height: 18 }} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                    <SkeletonItem style={{ width: 32, height: 32, borderRadius: 16 }} />
                    <SkeletonItem style={{ width: 32, height: 32, borderRadius: 16 }} />
                </View>
            </View>

            <View style={{ borderLeftWidth: 2, borderLeftColor: borderColor, marginLeft: 8, paddingLeft: 24, paddingBottom: 20 }}>
                {[1, 2].map((i) => (
                    <View key={i} style={{ marginBottom: 32 }}>
                        <View style={{ position: 'absolute', left: -31, top: 0, width: 12, height: 12, borderRadius: 6, backgroundColor: borderColor }} />
                        <View style={{ backgroundColor: cardBg, borderRadius: 12, padding: 16, borderWidth: 1, borderColor }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                                <SkeletonItem style={{ width: '60%', height: 14 }} />
                                <SkeletonItem style={{ width: 24, height: 24, borderRadius: 12 }} />
                            </View>
                            <SkeletonItem style={{ width: '40%', height: 10 }} />
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
};

const NoJobState = ({ theme, router, isOffline }: any) => (
    <Animated.View entering={FadeIn.duration(500)} style={[styles.noJobCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
        <View style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ marginBottom: 12, opacity: 0.8 }}>
                <HugeiconsIcon icon={isOffline ? WifiOffIcon : Settings02Icon} size={32} color={theme.colors.textSecondary} />
            </View>
            
            <Text style={[styles.noJobTitle, { color: theme.colors.text }]}>
                {isOffline ? 'Offline Mode' : 'No Active Job Set'}
            </Text>
            
            <Text style={[styles.noJobDesc, { color: theme.colors.textSecondary }]}>
                {isOffline 
                    ? "Your job details couldn't be loaded. Please check your internet connection." 
                    : "Activate a job profile to unlock the daily summary card and start tracking your progress."}
            </Text>

            {!isOffline && (
                <View style={{ width: '100%', marginTop: 20 }}>
                    <ScaleButton onPress={() => router.push('/job/job')}>
                        <View style={[styles.noJobButton, { backgroundColor: theme.colors.primary, shadowColor: theme.colors.primary }]}>
                            <Text style={styles.noJobButtonText}>Set Up Job</Text>
                            <HugeiconsIcon icon={PlusSignIcon} size={18} color="#fff" />
                        </View>
                    </ScaleButton>
                </View>
            )}
        </View>
    </Animated.View>
);

export default function Home() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const theme = useAppTheme();
    const { triggerSync, syncStatus } = useSync();
    
    const netInfo = useNetInfo();
    const isOffline = netInfo.isConnected === false;
    
    const successPlayer = useAudioPlayer(require('../../assets/success.mp3'));

    const [loading, setLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true); 
    const isInitialLoadRef = useRef(true); 

    const [refreshing, setRefreshing] = useState(false);
    const [timelineLoading, setTimelineLoading] = useState(false);
    const [calendarLoading, setCalendarLoading] = useState(false);

    const [profile, setProfile] = useState<any>(null);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [jobSettings, setJobSettings] = useState<any>(null); 
    const [todaysRecords, setTodaysRecords] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    const [timelineData, setTimelineData] = useState<any[]>([]);
    const [dailyGoal, setDailyGoal] = useState(8); 
    const [workedMinutes, setWorkedMinutes] = useState(0);
    const [periodWorkedMinutes, setPeriodWorkedMinutes] = useState(0); 
    const [dbPeriodTargetMinutes, setDbPeriodTargetMinutes] = useState<number | undefined>(undefined);
    const [selectedDate, setSelectedDate] = useState(new Date());

    const [isBreakMode, setIsBreakMode] = useState(false); 
    const [isBreak, setIsBreak] = useState(false);
    
    const [otExpiry, setOtExpiry] = useState<string | null>(null);

    const [hasShownInitialNotif, setHasShownInitialNotif] = useState(false);
    const hasWarnedTimeout = useRef(false);

    const [notifications, setNotifications] = useState<any[]>([]);
    const [notifModalVisible, setNotifModalVisible] = useState(false);
    const notificationListener = useRef<any>(null);
    const lastUpdateMinute = useRef<number | null>(null);

    const [timelinePickerVisible, setTimelinePickerVisible] = useState(false);
    const [markedDates, setMarkedDates] = useState<string[]>([]);
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    const [alertType, setAlertType] = useState<'success' | 'check-in' | 'check-out'>('success');
    const [modernAlertConfig, setModernAlertConfig] = useState<any>({ visible: false });
    const [otModalVisible, setOtModalVisible] = useState(false);

    const [appSettings, setAppSettings] = useState<any>({ vibrationEnabled: true, soundEnabled: true, notificationsEnabled: true });

    const scrollY = useSharedValue(0);
    const headerTranslateY = useSharedValue(0);
    const HEADER_HEIGHT = 100 + insets.top; 

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            const currentY = event.contentOffset.y;
            const diff = currentY - scrollY.value;
            scrollY.value = currentY;

            if (currentY > 0) {
                headerTranslateY.value = Math.max(
                    -HEADER_HEIGHT, 
                    Math.min(0, headerTranslateY.value - diff)
                );
            } else {
                headerTranslateY.value = 0;
            }
        },
    });

    const headerAnimatedStyle = useAnimatedStyle(() => {
        return {
            transform: [{ translateY: headerTranslateY.value }],
            zIndex: 10,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
        };
    });

    const latestRecord = todaysRecords.length > 0 ? todaysRecords[0] : null;
    const isClockedIn = latestRecord?.status === 'pending';
    const isSessionOvertime = latestRecord?.remarks?.includes('Overtime');
    const unreadNotifsCount = notifications.filter(n => !n.read).length;
    
    const displayName = profile ? (() => {
        if (profile.first_name) {
            const titlePart = profile.title ? `${profile.title.trim()} ` : '';
            return `${titlePart}${profile.first_name.trim()}`;
        }
        if (profile.full_name) {
            return profile.full_name.split(' ')[0];
        }
        return 'User';
    })() : 'User';

    const activityTitle = isToday(selectedDate) ? "Today's Activity" : `Activity • ${format(selectedDate, 'MMM d')}`;

    useEffect(() => {
        initNotificationSystem();
    }, []);

    const handleHideAlert = useCallback(() => { setAlertVisible(false); }, []);

    const loadNotifications = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const data = await getNotificationsLocal(session.user.id);
            setNotifications(data);
        } catch (e) { console.log('Err loading notifs', e); }
    }, []);

    const saveNotifications = useCallback(async (newNotif: any) => {
        try {
             await saveNotificationLocal(newNotif);
             await loadNotifications();
        } catch (e) { console.log('Err saving notifs', e); }
    }, [loadNotifications]);

    const loadData = useCallback(async () => {
        if (!isInitialLoadRef.current) setTimelineLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const user = session.user;
            const db = await getDB();
            const dateStr = format(selectedDate, 'yyyy-MM-dd');

            let localProfile: any = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [user.id]);
            const meta = user.user_metadata || {};
            if (!localProfile) {
                localProfile = {
                    first_name: meta.full_name?.split(' ')[0] || meta.name?.split(' ')[0] || '',
                    full_name: meta.full_name || meta.name || '',
                };
            } else if (!localProfile.first_name) {
                const metaName = meta.full_name?.split(' ')[0] || meta.name?.split(' ')[0];
                if (metaName) localProfile.first_name = metaName;
            }

            setProfile(localProfile);
            
            const currentJobId = localProfile?.current_job_id;
            setActiveJobId(currentJobId);

            if (!currentJobId) {
                setJobSettings(null);
                setTodaysRecords([]);
                setTasks([]);
                setLoading(false);
                return;
            }

            const activeJob = await db.getFirstAsync('SELECT * FROM job_positions WHERE id = ?', [currentJobId]);
            if (activeJob) {
                const aj: any = activeJob;
                const parsedJob = {
                    ...aj,
                    work_schedule: typeof aj.work_schedule === 'string' ? JSON.parse(aj.work_schedule) : aj.work_schedule,
                    break_schedule: typeof aj.break_schedule === 'string' ? JSON.parse(aj.break_schedule) : aj.break_schedule,
                };
                setJobSettings(parsedJob);
                setDailyGoal(calculateDailyGoal(parsedJob));

                if (parsedJob.period_target) {
                    setDbPeriodTargetMinutes(parseInt(parsedJob.period_target, 10));
                } else {
                    setDbPeriodTargetMinutes(undefined);
                }

                const [attendance, dailyTasks] = await Promise.all([
                    db.getAllAsync('SELECT * FROM attendance WHERE user_id = ? AND job_id = ? AND date = ? ORDER BY clock_in DESC', [user.id, currentJobId, dateStr]),
                    db.getAllAsync('SELECT * FROM accomplishments WHERE user_id = ? AND job_id = ? AND date = ?', [user.id, currentJobId, dateStr]),
                ]);
                setTodaysRecords(attendance as any[]);
                setTasks(dailyTasks as any[]);

                const payoutType = parsedJob.payout_type || 'Semi-Monthly';
                const periodStart = getPeriodStartDate(payoutType);
                const periodStartStr = format(periodStart, 'yyyy-MM-dd');
                
                const periodRecords: any[] = await db.getAllAsync(
                    'SELECT * FROM attendance WHERE user_id = ? AND job_id = ? AND date >= ?', 
                    [user.id, currentJobId, periodStartStr]
                );

                let periodMins = 0;
                periodRecords.forEach(r => {
                    if (r.clock_in && r.clock_out) {
                        const s = new Date(r.clock_in).getTime();
                        const e = new Date(r.clock_out).getTime();
                        periodMins += Math.max(0, (e - s) / (1000 * 60));
                    }
                });
                setPeriodWorkedMinutes(periodMins);

                const [allAttendance, allTasks] = await Promise.all([
                    db.getAllAsync('SELECT DISTINCT date FROM attendance WHERE user_id = ? AND job_id = ?', [user.id, currentJobId]),
                    db.getAllAsync('SELECT DISTINCT date FROM accomplishments WHERE user_id = ? AND job_id = ?', [user.id, currentJobId])
                ]);
                const uniqueDates = new Set([
                    ...(allAttendance as any[]).map(r => r.date),
                    ...(allTasks as any[]).map(r => r.date)
                ]);
                setMarkedDates(Array.from(uniqueDates));
            } else {
                setJobSettings(null); 
            }
        } catch (e: any) { 
            console.log("Load Data Error:", e);
        } finally { 
            setRefreshing(false); 
            setTimelineLoading(false);
            setTimeout(() => {
                setIsInitialLoading(false);
                isInitialLoadRef.current = false;
            }, 300); 
        }
    }, [selectedDate]);

    const processClockAction = useCallback(async (isOvertime = false, duration = 0) => {
        if (!activeJobId) {
            setModernAlertConfig({ visible: true, type: 'warning', title: 'No Job Active', message: 'Please set an active job in your profile first.', confirmText: 'Manage Jobs', onConfirm: () => { setModernAlertConfig((prev:any)=>({...prev, visible:false})); router.push('/job/job'); } });
            return;
        }

        setLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const user = session.user;
            const db = await getDB();
            
            const todayStr = format(new Date(), 'yyyy-MM-dd');

            if (isClockedIn) {
                const now = new Date().toISOString();
                if (latestRecord) {
                    await db.runAsync('UPDATE attendance SET clock_out = ?, status = ? WHERE id = ?', [now, 'completed', latestRecord.id]);
                    await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)', ['attendance', latestRecord.id, 'UPDATE', JSON.stringify({ clock_out: now, status: 'completed' })]);
                }
                await AsyncStorage.removeItem('active_ot_expiry');
                setOtExpiry(null);
                hasWarnedTimeout.current = false;
                await clearAttendanceNotification();
                setHasShownInitialNotif(false); 
                setIsBreakMode(false);
                setAlertMessage("See you later!"); 
                setAlertType('check-out'); // Keep internal state the same
            } else {
                const now = new Date();
                let remarks = null;
                hasWarnedTimeout.current = false;
                if (isOvertime) {
                    remarks = duration > 0 ? `Overtime: ${duration.toFixed(2)} hrs` : 'Overtime';
                    const expiryTime = addHours(now, duration);
                    const expiryIso = expiryTime.toISOString();
                    await AsyncStorage.setItem('active_ot_expiry', expiryIso);
                    setOtExpiry(expiryIso);
                } else {
                     setOtExpiry(null);
                }
                const newId = generateUUID();
                const record = { 
                    id: newId, 
                    user_id: user.id, 
                    job_id: activeJobId, 
                    clock_in: now.toISOString(), 
                    date: todayStr, 
                    status: 'pending', 
                    remarks 
                };
                await db.runAsync('INSERT INTO attendance (id, user_id, job_id, date, clock_in, status, remarks) VALUES (?, ?, ?, ?, ?, ?, ?)', 
                    [record.id, record.user_id, record.job_id, record.date, record.clock_in, record.status, record.remarks]);
                await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)', ['attendance', record.id, 'INSERT', JSON.stringify(record)]);
                setHasShownInitialNotif(false);
                setAlertMessage(isOvertime ? "Overtime Started!" : "Welcome In!"); 
                setAlertType('check-in'); // Keep internal state the same
            }
            if (appSettings?.soundEnabled && successPlayer) {
                try { successPlayer.seekTo(0); successPlayer.play(); } catch (audioErr) { console.log("Audio play failed (non-fatal):", audioErr); }
            }
            if (appSettings?.vibrationEnabled !== false) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setSelectedDate(new Date()); 
            setAlertVisible(true);
            await loadData();
            triggerSync(); 
        } catch (e: any) { 
             setModernAlertConfig({ visible: true, type: 'error', title: 'Error', message: e.message, confirmText: 'OK', onConfirm: () => setModernAlertConfig((prev: any) => ({ ...prev, visible: false })) });
        } finally { setLoading(false); }
    }, [activeJobId, isClockedIn, latestRecord, appSettings, loadData, triggerSync, successPlayer, router]);

    const handleClockButtonPress = () => {
        if (!jobSettings || !activeJobId) {
            setModernAlertConfig({ 
                visible: true, 
                type: 'warning', 
                title: 'No Job Active', 
                message: 'Please select an active job in your profile.', 
                confirmText: 'Manage Jobs', 
                onConfirm: () => { setModernAlertConfig((prev:any)=>({...prev, visible:false})); router.push('/job/job'); },
                onDismiss: () => setModernAlertConfig((prev:any) => ({...prev, visible: false})) 
            });
            return;
        }
        
        if (!isClockedIn) {
            if (jobSettings?.work_schedule?.start && jobSettings?.work_schedule?.end) {
                const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
                const endMins = timeToMinutes(jobSettings.work_schedule.end);
                
                const isLateCheckIn = nowMins > endMins;
                if (isLateCheckIn) {
                    setOtModalVisible(true);
                    return;
                }
            }
        }
        processClockAction(false);
    };

    const handleAutoTimeoutLogic = useCallback(async () => {
        if (!isClockedIn || !latestRecord) return;
        const now = new Date();
        let targetTime: Date | null = null;
        let reason = "";

        if (isSessionOvertime && otExpiry) {
            targetTime = new Date(otExpiry);
            reason = "Overtime Duration Reached";
        } else if (!isSessionOvertime && latestRecord?.clock_in && jobSettings?.work_schedule?.end) {
            const [endH, endM] = jobSettings.work_schedule.end.split(':').map(Number);
            let shiftEnd = set(new Date(latestRecord.clock_in), { hours: endH, minutes: endM, seconds: 0, milliseconds: 0 });
            
            const [startH, startM] = jobSettings.work_schedule.start.split(':').map(Number);
            const shiftStart = set(new Date(latestRecord.clock_in), { hours: startH, minutes: startM, seconds: 0, milliseconds: 0 });
            
            if (shiftEnd <= shiftStart) {
                shiftEnd = addDays(shiftEnd, 1);
            }

            targetTime = shiftEnd;
            reason = "Shift Ended";
        }

        if (!targetTime) return;
        const diffSeconds = differenceInSeconds(targetTime, now);

        if (diffSeconds > 0 && diffSeconds <= 60 && !hasWarnedTimeout.current) {
            hasWarnedTimeout.current = true;
            await Notifications.scheduleNotificationAsync({
                content: { title: "Time Out Soon", body: `You will be automatically timed out in 1 minute.`, sound: true, priority: Notifications.AndroidNotificationPriority.HIGH },
                trigger: null,
            });
            if (appSettings?.vibrationEnabled !== false) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }

        if (diffSeconds <= 0) {
            await clearAttendanceNotification();

            const db = await getDB();
            const endIso = targetTime.toISOString();
            // Changed "Auto-checkout" to "Auto-timeout"
            await db.runAsync('UPDATE attendance SET clock_out = ?, status = ?, remarks = ? WHERE id = ?', 
                [endIso, 'completed', `Auto-timeout: ${reason}`, latestRecord.id]);
            await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)', 
                ['attendance', latestRecord.id, 'UPDATE', JSON.stringify({ clock_out: endIso, status: 'completed', remarks: `Auto-timeout: ${reason}` })]);
            await Notifications.scheduleNotificationAsync({ content: { title: "Auto Timed Out", body: `You have been timed out. (${reason})`, sound: true }, trigger: null });

            setOtExpiry(null);
            hasWarnedTimeout.current = false;
            setHasShownInitialNotif(false);

            const timeStr = targetTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

            setModernAlertConfig({ visible: true, type: 'info', title: 'Auto Timed Out', message: `Session ended at ${timeStr}.`, confirmText: 'Okay', onConfirm: () => setModernAlertConfig((prev:any) => ({...prev, visible: false})) });
            triggerSync();
            loadData(); 
        }
    }, [isClockedIn, latestRecord, isSessionOvertime, otExpiry, jobSettings, appSettings, triggerSync, loadData]);

    useEffect(() => {
        loadNotifications();
        notificationListener.current = Notifications.addNotificationReceivedListener(async (notification) => {
            if (notification.request.identifier === 'attendance_persistent') return;
            
            const { data: { session } } = await supabase.auth.getSession();
            const userId = session?.user?.id;
            if (!userId) return;

            const newNotif = { 
                id: notification.request.identifier, 
                user_id: userId,
                title: notification.request.content.title || 'Notification', 
                body: notification.request.content.body || '', 
                created_at: new Date().toISOString(),
                is_read: false,
                type: 'system'
            };

            await saveNotifications(newNotif);
        });
        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const actionId = response.actionIdentifier;
            if (actionId === 'action_break_start') setIsBreakMode(true);
            else if (actionId === 'action_break_end') setIsBreakMode(false);
            else if (actionId === 'action_checkout') processClockAction(false);
        });
        return () => { if (subscription) subscription.remove(); };
    }, [loadNotifications, saveNotifications, processClockAction]);

    const markAllNotificationsRead = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            
            await markAllNotificationsReadLocal(session.user.id);
            
            const updated = notifications.map(n => ({ ...n, read: true }));
            setNotifications(updated);
        } catch (e) { console.log('Err marking read', e); }
    };

    useEffect(() => {
        if (isClockedIn && latestRecord?.clock_in && appSettings?.notificationsEnabled !== false) {
             updateAttendanceNotification(
                 latestRecord.clock_in, 
                 isSessionOvertime, 
                 isBreakMode, 
                 true 
             );
        }
    }, [isBreakMode, isClockedIn, isSessionOvertime, latestRecord, appSettings]);

    useEffect(() => {
        const timer = setInterval(async () => {
            const now = new Date();
            const currentMinute = now.getMinutes();
            let totalMs = 0;
            if (!isBreakMode) {
                todaysRecords.forEach((record) => {
                    const start = new Date(record.clock_in).getTime();
                    const end = record.clock_out ? new Date(record.clock_out).getTime() : now.getTime();
                    totalMs += Math.max(0, end - start);
                });
                const workedMins = totalMs / (1000 * 60);
                setWorkedMinutes(workedMins);
            }
            if (isClockedIn && latestRecord?.clock_in) {
                if (appSettings?.notificationsEnabled !== false) {
                    if (currentMinute !== lastUpdateMinute.current || !hasShownInitialNotif) {
                        const shouldBanner = !hasShownInitialNotif;
                        await updateAttendanceNotification(
                            latestRecord.clock_in, 
                            isSessionOvertime, 
                            isBreakMode, 
                            shouldBanner
                        );
                        if (shouldBanner) setHasShownInitialNotif(true);
                        lastUpdateMinute.current = currentMinute;
                    }
                }
                handleAutoTimeoutLogic();
            }
            if (jobSettings?.break_schedule) setIsBreak(checkIsBreakTime(jobSettings.break_schedule));
        }, 1000); 
        return () => clearInterval(timer);
    }, [todaysRecords, jobSettings, isClockedIn, isSessionOvertime, handleAutoTimeoutLogic, latestRecord, appSettings, isBreakMode, hasShownInitialNotif]);

    useFocusEffect(useCallback(() => {
        loadData();
        AsyncStorage.getItem('appSettings').then(s => { if (s) setAppSettings(JSON.parse(s)); });
        AsyncStorage.getItem('active_ot_expiry').then(val => setOtExpiry(val));
    }, [loadData]));

    const onRefresh = async () => {
        setRefreshing(true);
        await triggerSync(); 
        await loadData();
    };

    useEffect(() => {
        let timeline: any[] = [];
        const shiftStart = jobSettings?.work_schedule?.start;

        todaysRecords.forEach(record => {
            const isOTFlag = record.remarks && record.remarks.includes('Overtime');
            let isEarly = false;

            if (shiftStart && record.clock_in) {
                const [h, m] = shiftStart.split(':').map(Number);
                const shiftDate = new Date(record.clock_in);
                shiftDate.setHours(h, m, 0, 0);
                
                if (new Date(record.clock_in).getTime() <= shiftDate.getTime() - 1800000) {
                    isEarly = true;
                }
            }

            timeline.push({ 
                type: 'check-in', 
                time: record.clock_in, 
                id: record.id, 
                isOvertime: isEarly ? false : isOTFlag, 
                isEarly: isEarly, 
                sortTime: new Date(record.clock_in).getTime() 
            });

            if (record.clock_out) {
                timeline.push({ 
                    type: 'check-out', 
                    time: record.clock_out, 
                    id: record.id, 
                    isOvertime: isOTFlag, 
                    sortTime: new Date(record.clock_out).getTime() 
                });
            }
        });
        
        tasks.forEach(task => { timeline.push({ type: 'task', data: task, sortTime: new Date(task.created_at).getTime() }); });
        timeline.sort((a, b) => a.sortTime - b.sortTime);
        setTimelineData(timeline);
    }, [todaysRecords, tasks, jobSettings]);

    const handleEdit = (t: any) => { router.push({ pathname: '/reports/add-entry', params: { id: t.id } }); };
    
    const handleDeleteTask = (t: any) => { setModernAlertConfig({ visible: true, type: 'warning', title: 'Delete Entry?', message: 'This will remove the entry from your history.', confirmText: 'Delete', cancelText: 'Cancel', onConfirm: async () => { setModernAlertConfig((prev: any) => ({ ...prev, visible: false })); setLoading(true); try { const db = await getDB(); await db.runAsync('DELETE FROM accomplishments WHERE id = ?', [t.id]); await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action) VALUES (?, ?, ?)', ['accomplishments', t.id, 'DELETE']); await loadData(); triggerSync(); setAlertMessage("Entry deleted"); setAlertType('success'); setAlertVisible(true); } catch (e) { console.log(e); } finally { setLoading(false); } }, onCancel: () => setModernAlertConfig((prev: any) => ({ ...prev, visible: false })) }); };

    const handleTitlePress = () => {
        setCalendarLoading(true);
        setTimeout(() => { setTimelinePickerVisible(true); setCalendarLoading(false); }, 50);
    };

    const shiftEndTarget = useMemo(() => {
        if (!latestRecord?.clock_in || !jobSettings?.work_schedule?.end) return undefined;
        
        const [endH, endM] = jobSettings.work_schedule.end.split(':').map(Number);
        let shiftEnd = set(new Date(latestRecord.clock_in), { hours: endH, minutes: endM, seconds: 0, milliseconds: 0 });
        
        const [startH, startM] = jobSettings.work_schedule.start?.split(':').map(Number) || [0, 0];
        const shiftStart = set(new Date(latestRecord.clock_in), { hours: startH, minutes: startM, seconds: 0, milliseconds: 0 });
        
        if (shiftEnd <= shiftStart) {
            shiftEnd = addDays(shiftEnd, 1);
        }
        
        return shiftEnd.toISOString();
    }, [latestRecord?.clock_in, jobSettings?.work_schedule]);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            <ModernAlert {...modernAlertConfig} />
            <OvertimeModal visible={otModalVisible} onClose={() => setOtModalVisible(false)} onConfirm={(hrs: number) => { setOtModalVisible(false); processClockAction(true, hrs); }} theme={theme} />
            <BreakModeAlert visible={isBreakMode} onResume={() => setIsBreakMode(false)} />
            <DatePicker visible={timelinePickerVisible} onClose={() => setTimelinePickerVisible(false)} onSelect={(date) => setSelectedDate(date)} selectedDate={selectedDate} title="Activity History" markedDates={markedDates} />
            <NotificationModal visible={notifModalVisible} onClose={() => setNotifModalVisible(false)} notifications={notifications} onMarkAllRead={markAllNotificationsRead} theme={theme} />
            
            <View style={StyleSheet.absoluteFill} pointerEvents="none">
                <Svg height="100%" width="100%">
                    <Defs>
                        <LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
                            <Stop offset="0" stopColor={theme.colors.bgGradientStart} stopOpacity="1" />
                            <Stop offset="1" stopColor={theme.colors.bgGradientEnd} stopOpacity="1" />
                        </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#bgGrad)" />
                </Svg>
            </View>
            
            <Animated.View style={headerAnimatedStyle}>
                 <DynamicHeader selectedDate={selectedDate} onSelectDate={(date) => setSelectedDate(date)} isClockedIn={isClockedIn} isOvertime={isSessionOvertime} workedMinutes={workedMinutes} dailyGoal={dailyGoal} isLoading={false} />
            </Animated.View>

            <Animated.ScrollView 
                onScroll={scrollHandler}
                scrollEventThrottle={16} 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ padding: 24, paddingTop: 120 + insets.top, paddingBottom: 140 }} 
                refreshControl={<RefreshControl refreshing={refreshing || syncStatus === 'syncing'} onRefresh={onRefresh} progressViewOffset={insets.top + 100} tintColor={theme.colors.primary} />}
            >
                {isInitialLoading ? (
                    <HomeContentSkeleton />
                ) : (
                    <>
                        <View style={{ alignItems: 'center', marginBottom: 40 }}>
                            <DynamicBar nameToDisplay={displayName} alertVisible={alertVisible} alertMessage={alertMessage} alertType={alertType} onHideAlert={handleHideAlert} customGreeting={isBreakMode ? "You are on break" : (isBreak ? "Happy Break Time" : null)} />
                            <View style={{ opacity: isBreakMode ? 0.5 : 1 }} pointerEvents={isBreakMode ? 'none' : 'auto'}>
                                <BiometricButton onSuccess={handleClockButtonPress} isClockedIn={isClockedIn} isLoading={loading} settings={appSettings} />
                            </View>
                        </View>

                        <View style={{ marginBottom: 24 }} collapsable={false}>
                            {jobSettings ? (
                                <DailySummaryCard 
                                    totalMinutes={workedMinutes} 
                                    isClockedIn={isClockedIn} 
                                    theme={theme} 
                                    dailyGoal={dailyGoal} 
                                    isOvertime={isSessionOvertime} 
                                    startTime={latestRecord?.clock_in}
                                    targetEndTime={isSessionOvertime ? otExpiry : shiftEndTarget} 
                                    payoutType={jobSettings?.payout_type}
                                    periodWorkedMinutes={periodWorkedMinutes + (isClockedIn && !isBreakMode ? workedMinutes : 0)} 
                                    periodTargetMinutes={dbPeriodTargetMinutes}
                                />
                            ) : (
                                <NoJobState theme={theme} router={router} isOffline={isOffline} />
                            )}
                        </View>

                        <View style={styles.sectionHeader}>
                            <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.6} disabled={calendarLoading} style={styles.titleRow}>
                                <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{activityTitle}</Text>
                                {calendarLoading ? <ActivityIndicator size="small" color={theme.colors.textSecondary} /> : <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.textSecondary} />}
                            </TouchableOpacity>
                            <View style={styles.actionRow}>
                                <TouchableOpacity onPress={() => setNotifModalVisible(true)} style={[styles.iconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                    <HugeiconsIcon icon={Notification01Icon} size={18} color={theme.colors.text} />
                                    {unreadNotifsCount > 0 && <View style={[styles.badge, { backgroundColor: theme.colors.danger, borderColor: theme.colors.card }]} />}
                                </TouchableOpacity>
                                <TouchableOpacity disabled={!isClockedIn} onPress={() => router.push({ pathname: '/reports/add-entry', params: { jobId: activeJobId } })} style={[styles.iconButton, { backgroundColor: isClockedIn ? theme.colors.iconBg : theme.colors.background }]}>
                                    <HugeiconsIcon icon={PlusSignIcon} size={20} color={isClockedIn ? theme.colors.primary : theme.colors.icon} />
                                </TouchableOpacity>
                            </View>
                        </View>
                        
                        <View style={[styles.timelineCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]} collapsable={false}>
                            <View style={{ padding: 20 }}>
                                <ActivityTimeline timelineData={timelineData} theme={theme} onEditTask={handleEdit} onDeleteTask={handleDeleteTask} isLoading={timelineLoading} />
                            </View>
                        </View>
                    </>
                )}
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    skeletonContainer: { flex: 1, paddingHorizontal: 0 },
    skeletonDynamicBar: { flexDirection: 'row', alignItems: 'center', padding: 6, borderRadius: 24, borderWidth: 1, width: '100%', maxWidth: 380, height: 60 },
    skeletonCard: { borderRadius: 24, borderWidth: 1, justifyContent: 'space-between' },
    rowBetween: { flexDirection: 'row', justifyContent: 'space-between' },
    jobCard: { borderWidth: 1, padding: 24, borderRadius: 24, flexDirection: 'row', alignItems: 'center' },
    jobIconBox: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    jobTitle: { fontFamily: 'Nunito_700Bold', fontSize: 16, marginBottom: 4 },
    jobButton: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-start' },
    jobButtonText: { fontFamily: 'Nunito_700Bold', color: '#fff', fontSize: 12 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionTitle: { fontFamily: 'Nunito_700Bold', fontSize: 18, letterSpacing: -0.5 },
    actionRow: { flexDirection: 'row', gap: 12 },
    iconButton: { borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
    badge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
    timelineCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
    noJobCard: { borderWidth: 1, padding: 28, borderRadius: 24, flexDirection: 'row', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 },
    noJobTitle: { fontFamily: 'Nunito_700Bold', fontSize: 18, marginBottom: 8, textAlign: 'center' },
    noJobDesc: { fontFamily: 'Nunito_400Regular', fontSize: 14, lineHeight: 22, textAlign: 'center', opacity: 0.8 },
    noJobButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14, borderRadius: 16, width: '100%', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4, gap: 10 },
    noJobButtonText: { fontFamily: 'Nunito_700Bold', color: '#fff', fontSize: 16 },
});