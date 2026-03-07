// filepath: app/(tabs)/home.tsx
import {
    ArrowDown01Icon,
    Notification01Icon,
    PlusSignIcon,
    Search01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import notifee, { EventType } from '@notifee/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNetInfo } from '@react-native-community/netinfo';
import { addDays, addHours, differenceInDays, differenceInSeconds, format, isToday, set, startOfMonth, startOfWeek } from 'date-fns';
import { useAudioPlayer } from 'expo-audio';
import { BlurView } from 'expo-blur';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    AppState,
    InteractionManager,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import ActivityTimeline from '../../components/ActivityTimeline';
import AppTutorialCards from '../../components/AppTutorialCards';
import BiometricButton from '../../components/BiometricButton';
import BreakModeAlert from '../../components/BreakModeAlert';
import DailySummaryCard from '../../components/DailySummaryCard';
import DatePicker from '../../components/DatePicker';
import DynamicBar from '../../components/DynamicBar';
import DynamicHeader from '../../components/DynamicHeader';
import ModernAlert from '../../components/ModernAlert';
import NoActiveJobCard from '../../components/NoActiveJobCard';
import OvertimeModal from '../../components/OvertimeModal';
import { SkeletonBlock, SkeletonCircle } from '../../components/Skeleton';

import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useSync } from '../../context/SyncContext';
import { generateUUID, getNotificationsLocal, queueSyncItem, saveAttendanceLocal, saveNotificationLocal } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { getSameDayClockOut } from '../../lib/attendance-session';
import { consumePendingWidgetAction, refreshWidgetSnapshot } from '../../lib/widgets';
import {
    clearAttendanceNotification,
    initNotificationSystem,
    showStandardNotification,
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

const HomeContentSkeleton = () => {
    const theme = useAppTheme();
    const borderColor = theme.colors.border;
    const cardBg = theme.colors.card;

    return (
        <View style={styles.skeletonContainer}>
            <View style={{ alignItems: 'center', marginBottom: 40 }}>
                <View style={[styles.skeletonDynamicBar, { borderColor, backgroundColor: cardBg }]}> 
                    <View style={styles.skeletonDynamicBarTopRow}>
                        <SkeletonBlock style={{ width: 84, height: 10, borderRadius: 999 }} />
                        <SkeletonBlock style={{ width: 24, height: 24, borderRadius: 8 }} />
                    </View>
                    <View style={{ gap: 10 }}>
                        <SkeletonBlock style={{ width: 72, height: 12, borderRadius: 999 }} />
                        <SkeletonBlock style={{ width: '82%', height: 20, borderRadius: 8 }} />
                        <SkeletonBlock style={{ width: '58%', height: 20, borderRadius: 8 }} />
                    </View>
                </View>

                <View style={{ alignItems: 'center', marginTop: 32 }}>
                    <View style={{ width: 120, height: 120, borderRadius: 60, borderWidth: 6, borderColor: borderColor + '40', alignItems: 'center', justifyContent: 'center', backgroundColor: cardBg }}>
                        <SkeletonCircle size={52} />
                    </View>
                    <SkeletonBlock style={{ width: 140, height: 12, marginTop: 24, borderRadius: 6 }} />
                </View>
            </View>

            <View style={[styles.skeletonCard, { backgroundColor: cardBg, borderColor, marginBottom: 24 }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 20, paddingBottom: 16 }}>
                    <View>
                        <SkeletonBlock style={{ width: 80, height: 20, marginBottom: 12, borderRadius: 6 }} />
                        <SkeletonBlock style={{ width: 150, height: 38, marginBottom: 4, borderRadius: 6 }} />
                    </View>
                    <View style={{ width: 100, height: 100, borderRadius: 50, borderWidth: 8, borderColor: borderColor + '30', alignItems: 'center', justifyContent: 'center' }}>
                        <SkeletonBlock style={{ width: 40, height: 14, borderRadius: 7 }} />
                    </View>
                </View>

                <View style={{ height: 1, backgroundColor: borderColor, opacity: 0.5 }} />

                <View style={{ flexDirection: 'row', paddingVertical: 14, paddingHorizontal: 8 }}>
                    {[1, 2, 3].map((i) => (
                        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6, borderRightWidth: i < 3 ? 1 : 0, borderColor: borderColor + '40' }}>
                            <SkeletonBlock style={{ width: 30, height: 8, borderRadius: 4 }} />
                            <SkeletonBlock style={{ width: 50, height: 12, borderRadius: 6 }} />
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
};

export default function Home() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const params = useLocalSearchParams<{ widgetAction?: string; widgetToken?: string }>();
    const theme = useAppTheme();
    const { user } = useAuth();
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
    
    const [accumulatedBreakMs, setAccumulatedBreakMs] = useState(0);
    const [breakStartTimestamp, setBreakStartTimestamp] = useState<number | null>(null);

    const [otExpiry, setOtExpiry] = useState<string | null>(null);
    const hasWarnedTimeout = useRef(false);

    const [notifications, setNotifications] = useState<any[]>([]);

    const [timelinePickerVisible, setTimelinePickerVisible] = useState(false);
    const [markedDates, setMarkedDates] = useState<string[]>([]);
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    const [alertType, setAlertType] = useState<'success' | 'check-in' | 'check-out'>('success');
    const [modernAlertConfig, setModernAlertConfig] = useState<any>({ visible: false });
    const [otModalVisible, setOtModalVisible] = useState(false);

    const [appSettings, setAppSettings] = useState<any>({ vibrationEnabled: true, soundEnabled: true, notificationsEnabled: true });
    const [pendingWidgetAction, setPendingWidgetAction] = useState<string | null>(null);

    const scrollViewRef = useRef<any>(null);
    const consumedWidgetTokenRef = useRef<string | null>(null);
    const [noJobCardY, setNoJobCardY] = useState(0);
    const [highlightNoJob, setHighlightNoJob] = useState(0);

    const scrollY = useSharedValue(0);
    const headerTranslateY = useSharedValue(0);
    const isHeaderHidden = useSharedValue(false);
    const HEADER_HEIGHT = 140 + insets.top; 
    const dynamicBarOffsetY = useSharedValue(HEADER_HEIGHT + 28);

    const scrollHandler = useAnimatedScrollHandler({
        onScroll: (event) => {
            const currentY = Math.max(event.contentOffset.y, 0);
            const diff = currentY - scrollY.value;
            const movingDown = diff > 3;
            const movingUp = diff < -3;
            const dynamicBarAtTop = (dynamicBarOffsetY.value - currentY) <= insets.top;

            if (currentY <= 4) {
                if (isHeaderHidden.value) {
                    isHeaderHidden.value = false;
                    headerTranslateY.value = withTiming(0, { duration: 150 });
                }
                scrollY.value = currentY;
                return;
            }

            if (!dynamicBarAtTop) {
                if (headerTranslateY.value !== 0 || isHeaderHidden.value) {
                    isHeaderHidden.value = false;
                    headerTranslateY.value = withTiming(0, { duration: 150 });
                }
                scrollY.value = currentY;
                return;
            }

            if (movingDown) {
                headerTranslateY.value = Math.max(-(HEADER_HEIGHT + 12), headerTranslateY.value - diff);
                isHeaderHidden.value = headerTranslateY.value <= -(HEADER_HEIGHT + 8);
            } else if (movingUp) {
                isHeaderHidden.value = false;
                headerTranslateY.value = withTiming(0, { duration: 150 });
            }

            scrollY.value = currentY;
        },
    });

    const headerAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: headerTranslateY.value }], zIndex: 10, position: 'absolute', top: 0, left: 0, right: 0,
    }));

    const headerBackdropAnimatedStyle = useAnimatedStyle(() => ({
        opacity: 1 - Math.min(Math.abs(headerTranslateY.value) / (HEADER_HEIGHT + 12), 1),
        transform: [{ translateY: headerTranslateY.value * 0.35 }],
        zIndex: 9,
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
    }));

    const latestRecord = todaysRecords.length > 0 ? todaysRecords[0] : null;
    
    const isClockedIn = latestRecord?.status?.toLowerCase() === 'pending' || latestRecord?.status?.toLowerCase() === 'active';
    const isSessionOvertime = latestRecord?.remarks?.includes('Overtime');
    const unreadNotifsCount = notifications.filter(n => !n.read).length;
    
    const displayName = profile ? (() => {
        if (profile.first_name) {
            const titlePart = profile.title ? `${profile.title.trim()} ` : '';
            return `${titlePart}${profile.first_name.trim()}`;
        }
        if (profile.full_name) return profile.full_name.split(' ')[0];
        return 'User';
    })() : 'User';

    const activityTitle = isToday(selectedDate) ? "Today's Activity" : `Activity \u2022 ${format(selectedDate, 'MMM d')}`;

    useEffect(() => {
        initNotificationSystem();
    }, []);

    const handleHideAlert = useCallback(() => { setAlertVisible(false); }, []);

    const loadNotifications = useCallback(async () => {
        if (!user) return;
        try {
            const data = await getNotificationsLocal(user.id);
            setNotifications(data);
        } catch (e) { console.log('Err loading notifs', e); }
    }, [user]);

    const saveNotifications = useCallback(async (newNotif: any) => {
        try {
             await saveNotificationLocal(newNotif);
             await loadNotifications();
        } catch (e) { console.log('Err saving notifs', e); }
    }, [loadNotifications]);

    const loadData = useCallback(async (isSilent = false) => {
        if (!user) return;
        if (!isInitialLoadRef.current && isSilent !== true) setTimelineLoading(true);
        try {
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
            setActiveJobId(localProfile?.current_job_id);

            if (!localProfile?.current_job_id) {
                setJobSettings(null); setTodaysRecords([]); setTasks([]); setLoading(false);
                await refreshWidgetSnapshot(user.id);
                return;
            }

            const activeJob = await db.getFirstAsync('SELECT * FROM job_positions WHERE id = ?', [localProfile.current_job_id]);
            if (activeJob) {
                const aj: any = activeJob;
                const parsedJob = {
                    ...aj,
                    work_schedule: typeof aj.work_schedule === 'string' ? JSON.parse(aj.work_schedule) : aj.work_schedule,
                    break_schedule: typeof aj.break_schedule === 'string' ? JSON.parse(aj.break_schedule) : aj.break_schedule,
                };
                setJobSettings(parsedJob);
                setDailyGoal(calculateDailyGoal(parsedJob));
                setDbPeriodTargetMinutes(parsedJob.period_target ? parseInt(parsedJob.period_target, 10) : undefined);

                const [attendance, dailyTasks] = await Promise.all([
                    db.getAllAsync('SELECT * FROM attendance WHERE user_id = ? AND job_id = ? AND date = ? ORDER BY clock_in DESC', [user.id, localProfile.current_job_id, dateStr]),
                    db.getAllAsync('SELECT * FROM accomplishments WHERE user_id = ? AND job_id = ? AND date = ?', [user.id, localProfile.current_job_id, dateStr]),
                ]);
                
                setTodaysRecords(attendance as any[]);
                setTasks(dailyTasks as any[]);

                if ((attendance as any[]).length > 0) {
                    const currentRecordId = (attendance as any[])[0].id;
                    const bTotal = await AsyncStorage.getItem(`break_total_${currentRecordId}`);
                    const bStart = await AsyncStorage.getItem(`break_start_${currentRecordId}`);
                    
                    setAccumulatedBreakMs(bTotal ? parseInt(bTotal, 10) || 0 : 0);
                    if (bStart) {
                        setBreakStartTimestamp(parseInt(bStart, 10) || null);
                        setIsBreakMode(true);
                    } else {
                        setBreakStartTimestamp(null);
                        setIsBreakMode(false); 
                    }
                } else {
                    setAccumulatedBreakMs(0);
                    setBreakStartTimestamp(null);
                    setIsBreakMode(false);
                }

                const payoutType = parsedJob.payout_type || 'Semi-Monthly';
                const periodStart = getPeriodStartDate(payoutType);
                const periodStartStr = format(periodStart, 'yyyy-MM-dd');
                
                const todayDate = new Date();
                let isCutoffEnd = false;
                if (payoutType === 'Weekly' && differenceInDays(todayDate, periodStart) >= 6) isCutoffEnd = true;
                else if (payoutType === 'Bi-Weekly' && differenceInDays(todayDate, periodStart) >= 13) isCutoffEnd = true;
                else if (payoutType === 'Semi-Monthly') {
                    const d = todayDate.getDate();
                    const lastDay = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
                    if (d === 15 || d === lastDay) isCutoffEnd = true;
                }
                else if (payoutType === 'Monthly') {
                    const lastDay = new Date(todayDate.getFullYear(), todayDate.getMonth() + 1, 0).getDate();
                    if (todayDate.getDate() === lastDay) isCutoffEnd = true;
                }

                if (isCutoffEnd) {
                    const cacheKey = `report_ready_notified_${periodStartStr}`;
                    const notified = await AsyncStorage.getItem(cacheKey);
                    if (!notified) {
                        const newNotif = { 
                            id: generateUUID(), user_id: user.id, title: "Report's Ready", 
                            body: `Your attendance report for the period starting ${periodStartStr} is complete and ready to be generated.`, 
                            created_at: todayDate.toISOString(), is_read: false, type: 'report_ready' 
                        };
                        await saveNotifications(newNotif);
                        await AsyncStorage.setItem(cacheKey, 'true');
                    }
                }

                const periodRecords: any[] = await db.getAllAsync(
                    'SELECT * FROM attendance WHERE user_id = ? AND job_id = ? AND date >= ?', 
                    [user.id, localProfile.current_job_id, periodStartStr]
                );

                let periodMins = 0;
                periodRecords.forEach(r => {
                    if (r.clock_in && r.clock_out) {
                        const s = new Date(r.clock_in).getTime();
                        const e = new Date(r.clock_out).getTime();
                        let grossMs = Math.max(0, e - s);
                        if (r.remarks && r.remarks.includes('BreakMs:')) {
                            const match = r.remarks.match(/BreakMs:(\d+)/);
                            if (match) grossMs -= parseInt(match[1], 10);
                        }
                        periodMins += Math.max(0, grossMs / (1000 * 60));
                    }
                });
                setPeriodWorkedMinutes(periodMins);

                const [allAttendance, allTasks] = await Promise.all([
                    db.getAllAsync('SELECT DISTINCT date FROM attendance WHERE user_id = ? AND job_id = ?', [user.id, localProfile.current_job_id]),
                    db.getAllAsync('SELECT DISTINCT date FROM accomplishments WHERE user_id = ? AND job_id = ?', [user.id, localProfile.current_job_id])
                ]);
                const uniqueDates = new Set([...(allAttendance as any[]).map(r => r.date), ...(allTasks as any[]).map(r => r.date)]);
                setMarkedDates(Array.from(uniqueDates));
            } else {
                setJobSettings(null); 
            }

            await refreshWidgetSnapshot(user.id);
        } catch (e: any) { 
            console.log("Load Data Error:", e);
        } finally { 
            setRefreshing(false); 
            if (isSilent !== true) setTimelineLoading(false);
            setTimeout(() => { setIsInitialLoading(false); isInitialLoadRef.current = false; }, 300); 
        }
    }, [user, selectedDate, saveNotifications]);

    useEffect(() => {
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') {
                loadData(true); 
                loadNotifications();
                triggerSync(); 
            }
        });
        return () => subscription.remove();
    }, [loadData, loadNotifications, triggerSync]);

    const processClockAction = useCallback(async (isOvertime = false, duration = 0) => {
        if (!user || !activeJobId) {
            setModernAlertConfig({ visible: true, type: 'warning', title: 'No Job Active', message: 'Please set an active job in your profile.', confirmText: 'Manage Jobs', onConfirm: () => { setModernAlertConfig((prev:any)=>({...prev, visible:false})); router.push('/job/job'); } });
            return;
        }
        setLoading(true);
        try {
            const db = await getDB();
            const nowDate = new Date();
            const todayStr = format(nowDate, 'yyyy-MM-dd');
            const openRecord: any = await db.getFirstAsync(
                'SELECT * FROM attendance WHERE user_id = ? AND job_id = ? AND clock_out IS NULL ORDER BY clock_in DESC LIMIT 1',
                [user.id, activeJobId]
            );

            if (!isClockedIn && openRecord && format(new Date(openRecord.clock_in), 'yyyy-MM-dd') !== todayStr) {
                const staleClockOut = getSameDayClockOut(openRecord.clock_in, nowDate).toISOString();
                const staleRemarks = openRecord.remarks
                    ? `${openRecord.remarks} | Auto-closed at day end`
                    : 'Auto-closed at day end';
                await saveAttendanceLocal({ ...openRecord, clock_out: staleClockOut, status: 'completed', remarks: staleRemarks });
            }

            if (isClockedIn && latestRecord) {
                const now = getSameDayClockOut(latestRecord.clock_in, nowDate).toISOString();
                let finalRemarks = latestRecord.remarks || '';
                if (accumulatedBreakMs > 0) finalRemarks = finalRemarks ? `${finalRemarks} | BreakMs:${accumulatedBreakMs}` : `BreakMs:${accumulatedBreakMs}`;

                const updatedRecord = { ...latestRecord, clock_out: now, status: 'completed', remarks: finalRemarks };
                await saveAttendanceLocal(updatedRecord);
                
                await AsyncStorage.removeItem(`break_start_${latestRecord.id}`);
                await AsyncStorage.removeItem(`break_total_${latestRecord.id}`);
                setAccumulatedBreakMs(0);
                setBreakStartTimestamp(null);
                await AsyncStorage.removeItem('active_ot_expiry');
                setOtExpiry(null);
                hasWarnedTimeout.current = false;
                
                await clearAttendanceNotification();
                setIsBreakMode(false);
                setAlertMessage("See you later!"); 
                setAlertType('check-out'); 
            } else {
                const now = new Date();
                let remarks = null;
                hasWarnedTimeout.current = false;
                if (isOvertime) {
                    remarks = duration > 0 ? `Overtime: ${duration.toFixed(2)} hrs` : 'Overtime';
                    const expiryIso = addHours(now, duration).toISOString();
                    await AsyncStorage.setItem('active_ot_expiry', expiryIso);
                    setOtExpiry(expiryIso);
                } else {
                     setOtExpiry(null);
                }
                
                const record = { id: generateUUID(), user_id: user.id, job_id: activeJobId, clock_in: now.toISOString(), date: todayStr, status: 'pending', remarks };
                await saveAttendanceLocal(record);
                
                setAlertMessage(isOvertime ? "Overtime Started!" : "Welcome In!"); 
                setAlertType('check-in'); 
            }
            
            if (appSettings?.soundEnabled && successPlayer) {
                try { successPlayer.seekTo(0); successPlayer.play(); } catch {}
            }
            if (appSettings?.vibrationEnabled !== false) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            setSelectedDate(new Date()); 
            setAlertVisible(true);
            await loadData();
            triggerSync(); 
        } catch (e: any) { 
             setModernAlertConfig({ visible: true, type: 'error', title: 'Error', message: e.message, confirmText: 'OK', onConfirm: () => setModernAlertConfig((prev: any) => ({ ...prev, visible: false })) });
        } finally { setLoading(false); }
    }, [user, activeJobId, isClockedIn, latestRecord, appSettings, loadData, triggerSync, successPlayer, router, accumulatedBreakMs]);

    const handleClockButtonPress = useCallback(() => {
        if (!jobSettings || !activeJobId) {
            if (scrollViewRef.current) {
                scrollViewRef.current.scrollTo({ y: Math.max(0, noJobCardY - 120), animated: true });
            }
            setHighlightNoJob(prev => prev + 1);
            return;
        }
        
        if (!isClockedIn && jobSettings?.work_schedule?.start && jobSettings?.work_schedule?.end) {
            const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
            const endMins = timeToMinutes(jobSettings.work_schedule.end);
            if (nowMins > endMins) {
                setOtModalVisible(true);
                return;
            }
        }
        processClockAction(false);
    }, [activeJobId, isClockedIn, jobSettings, noJobCardY, processClockAction]);

    const handleAutoTimeoutLogic = useCallback(async () => {
        if (!isClockedIn || !latestRecord || !user) return;
        const now = new Date();
        let targetTime: Date | null = null;
        let reason = "";

        if (isSessionOvertime && otExpiry) {
            targetTime = getSameDayClockOut(latestRecord.clock_in, new Date(otExpiry)); reason = "Overtime Duration Reached";
        } else if (!isSessionOvertime && latestRecord?.clock_in && jobSettings?.work_schedule?.end) {
            const [endH, endM] = jobSettings.work_schedule.end.split(':').map(Number);
            let shiftEnd = set(new Date(latestRecord.clock_in), { hours: endH, minutes: endM, seconds: 0, milliseconds: 0 });
            const [startH, startM] = jobSettings.work_schedule.start.split(':').map(Number);
            const shiftStart = set(new Date(latestRecord.clock_in), { hours: startH, minutes: startM, seconds: 0, milliseconds: 0 });
            
            if (shiftEnd <= shiftStart) shiftEnd = addDays(shiftEnd, 1);
            targetTime = getSameDayClockOut(latestRecord.clock_in, shiftEnd); reason = "Shift Ended";
        }

        if (!targetTime) return;
        const diffSeconds = differenceInSeconds(targetTime, now);

        if (diffSeconds > 0 && diffSeconds <= 60 && !hasWarnedTimeout.current) {
            hasWarnedTimeout.current = true;
            await showStandardNotification("Time Out Soon", `You will be automatically timed out in 1 minute.`);
            if (appSettings?.vibrationEnabled !== false) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);

            await saveNotifications({ id: generateUUID(), user_id: user.id, title: "Time Out Soon", body: `You will be automatically timed out in 1 minute.`, created_at: new Date().toISOString(), is_read: false, type: 'timeout_soon' });
        }

        if (diffSeconds <= 0) {
            await clearAttendanceNotification();
            const endIso = targetTime.toISOString();
            
            let finalRemarks = `Auto-timeout: ${reason}`;
            if (accumulatedBreakMs > 0) finalRemarks += ` | BreakMs:${accumulatedBreakMs}`;

            const updatedRecord = { ...latestRecord, clock_out: endIso, status: 'completed', remarks: finalRemarks };
            await saveAttendanceLocal(updatedRecord);
            
            await showStandardNotification("Auto Timed Out", `You have been timed out. (${reason})`);
            await saveNotifications({ id: generateUUID(), user_id: user.id, title: "Auto Timed Out", body: `Your session was automatically ended. (${reason})`, created_at: new Date().toISOString(), is_read: false, type: 'auto_timeout' });

            await AsyncStorage.removeItem(`break_start_${latestRecord.id}`);
            await AsyncStorage.removeItem(`break_total_${latestRecord.id}`);
            setAccumulatedBreakMs(0); setBreakStartTimestamp(null); setOtExpiry(null);
            hasWarnedTimeout.current = false;

            const timeStr = targetTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
            setModernAlertConfig({ visible: true, type: 'info', title: 'Auto Timed Out', message: `Session ended at ${timeStr}.`, confirmText: 'Okay', onConfirm: () => setModernAlertConfig((prev:any) => ({...prev, visible: false})) });
            
            triggerSync(); loadData(); 
        }
    }, [user, isClockedIn, latestRecord, isSessionOvertime, otExpiry, jobSettings, appSettings, triggerSync, loadData, accumulatedBreakMs, saveNotifications]);

    useEffect(() => {
        const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }) => {
            if (type === EventType.ACTION_PRESS && detail.pressAction) {
                const actionId = detail.pressAction.id;
                if (actionId === 'action_break') setIsBreakMode(true);
                else if (actionId === 'action_resume') setIsBreakMode(false);
                else if (actionId === 'action_checkout') processClockAction(false);
            }
        });
        return () => unsubscribeNotifee();
    }, [processClockAction]);

    useEffect(() => {
        if (isClockedIn && latestRecord?.clock_in && appSettings?.notificationsEnabled !== false) {
             updateAttendanceNotification(latestRecord.clock_in, isSessionOvertime, isBreakMode, accumulatedBreakMs);
        } else {
             clearAttendanceNotification();
        }
    }, [isBreakMode, isClockedIn, isSessionOvertime, latestRecord?.clock_in, appSettings?.notificationsEnabled, accumulatedBreakMs]);

    useEffect(() => {
        const updateBreakState = async () => {
            if (!latestRecord) return;
            const breakStartKey = `break_start_${latestRecord.id}`;
            const breakTotalKey = `break_total_${latestRecord.id}`;

            if (isBreakMode) {
                if (!breakStartTimestamp) {
                    const now = Date.now();
                    setBreakStartTimestamp(now);
                    await AsyncStorage.setItem(breakStartKey, now.toString());
                }
            } else {
                if (breakStartTimestamp) {
                    const duration = Date.now() - breakStartTimestamp;
                    const newTotal = accumulatedBreakMs + duration;
                    setAccumulatedBreakMs(newTotal);
                    setBreakStartTimestamp(null);
                    await AsyncStorage.setItem(breakTotalKey, newTotal.toString());
                    await AsyncStorage.removeItem(breakStartKey);
                }
            }
        };
        updateBreakState();
    }, [isBreakMode, latestRecord, breakStartTimestamp, accumulatedBreakMs]);

    useEffect(() => {
        const timer = setInterval(async () => {
            const now = new Date();
            let totalMs = 0;
            
            todaysRecords.forEach((record) => {
                const start = new Date(record.clock_in).getTime();
                const end = record.clock_out ? new Date(record.clock_out).getTime() : now.getTime();
                let recordMs = Math.max(0, end - start);

                if (record.remarks && record.remarks.includes('BreakMs:')) {
                    const match = record.remarks.match(/BreakMs:(\d+)/);
                    if (match) recordMs -= parseInt(match[1], 10);
                }

                if (latestRecord && record.id === latestRecord.id) {
                    recordMs -= accumulatedBreakMs;
                    if (isBreakMode && breakStartTimestamp) recordMs -= (now.getTime() - breakStartTimestamp);
                }
                totalMs += Math.max(0, recordMs);
            });
            
            setWorkedMinutes(totalMs / (1000 * 60));

            if (isClockedIn && latestRecord?.clock_in) handleAutoTimeoutLogic();
            if (jobSettings?.break_schedule) setIsBreak(checkIsBreakTime(jobSettings.break_schedule));
        }, 1000); 
        return () => clearInterval(timer);
    }, [todaysRecords, jobSettings, isClockedIn, isSessionOvertime, handleAutoTimeoutLogic, latestRecord, appSettings, isBreakMode, accumulatedBreakMs, breakStartTimestamp]);

    useFocusEffect(useCallback(() => {
        loadData();
        loadNotifications();
        AsyncStorage.getItem('appSettings').then(s => { if (s) setAppSettings(JSON.parse(s)); });
        AsyncStorage.getItem('active_ot_expiry').then(val => setOtExpiry(val));

        const paramAction = typeof params.widgetAction === 'string' ? params.widgetAction : null;
        const widgetToken = typeof params.widgetToken === 'string' ? params.widgetToken : null;
        if (paramAction === 'clock' && widgetToken && consumedWidgetTokenRef.current !== widgetToken) {
            consumedWidgetTokenRef.current = widgetToken;
            setPendingWidgetAction('clock');
        }

        consumePendingWidgetAction().then(action => {
            if (action === 'clock') {
                setPendingWidgetAction('clock');
            }
        }).catch(() => {});
    }, [loadData, loadNotifications, params.widgetAction, params.widgetToken]));

    useEffect(() => {
        if (pendingWidgetAction !== 'clock' || isInitialLoading || loading) return;
        setPendingWidgetAction(null);
        handleClockButtonPress();
        if (params.widgetAction) {
            router.replace('/(tabs)/home');
        }
    }, [pendingWidgetAction, isInitialLoading, loading, handleClockButtonPress, params.widgetAction, router]);

    const onRefresh = async () => { setRefreshing(true); await triggerSync(); await loadData(); };

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
                if (new Date(record.clock_in).getTime() <= shiftDate.getTime() - 1800000) isEarly = true;
            }
            timeline.push({ type: 'check-in', time: record.clock_in, id: record.id, isOvertime: isEarly ? false : isOTFlag, isEarly: isEarly, sortTime: new Date(record.clock_in).getTime() });
            if (record.clock_out) timeline.push({ type: 'check-out', time: record.clock_out, id: record.id, isOvertime: isOTFlag, sortTime: new Date(record.clock_out).getTime() });
        });
        
        tasks.forEach(task => { timeline.push({ type: 'task', data: task, sortTime: new Date(task.created_at).getTime() }); });
        timeline.sort((a, b) => a.sortTime - b.sortTime);
        setTimelineData(timeline);
    }, [todaysRecords, tasks, jobSettings]);

    const handleEdit = (t: any) => { router.push({ pathname: '/reports/add-entry', params: { id: t.id } }); };
    
    const handleDeleteTask = (t: any) => { 
        setModernAlertConfig({ 
            visible: true, type: 'warning', title: 'Delete Entry?', message: 'This will remove the entry from your history.', confirmText: 'Delete', cancelText: 'Cancel', 
            onConfirm: async () => { 
                setModernAlertConfig((prev: any) => ({ ...prev, visible: false })); 
                setLoading(true); 
                try { 
                    const db = await getDB(); 
                    const now = new Date().toISOString();
                    await db.runAsync('UPDATE accomplishments SET deleted_at = ?, updated_at = ?, is_synced = 0 WHERE id = ?', [now, now, t.id]); 
                    await queueSyncItem('accomplishments', t.id, 'UPDATE', { deleted_at: now, updated_at: now }); 
                    await loadData(); 
                    triggerSync(); 
                    setAlertMessage("Entry deleted"); setAlertType('success'); setAlertVisible(true); 
                } catch (e) { console.log(e); } 
                finally { setLoading(false); } 
            }, 
            onCancel: () => setModernAlertConfig((prev: any) => ({ ...prev, visible: false })) 
        }); 
    };

    const handleTitlePress = () => {
        setCalendarLoading(true);
        InteractionManager.runAfterInteractions(() => {
            setTimelinePickerVisible(true);
            setCalendarLoading(false);
        });
    };

    const shiftEndTarget = useMemo(() => {
        if (!latestRecord?.clock_in || !jobSettings?.work_schedule?.end) return undefined;
        const [endH, endM] = jobSettings.work_schedule.end.split(':').map(Number);
        let shiftEnd = set(new Date(latestRecord.clock_in), { hours: endH, minutes: endM, seconds: 0, milliseconds: 0 });
        const [startH, startM] = jobSettings.work_schedule.start?.split(':').map(Number) || [0, 0];
        const shiftStart = set(new Date(latestRecord.clock_in), { hours: startH, minutes: startM, seconds: 0, milliseconds: 0 });
        if (shiftEnd <= shiftStart) shiftEnd = addDays(shiftEnd, 1);
        return getSameDayClockOut(latestRecord.clock_in, shiftEnd).toISOString();
    }, [latestRecord?.clock_in, jobSettings?.work_schedule]);

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            <ModernAlert {...modernAlertConfig} />
            <OvertimeModal visible={otModalVisible} onClose={() => setOtModalVisible(false)} onConfirm={(hrs: number) => { setOtModalVisible(false); processClockAction(true, hrs); }} theme={theme} />
            <BreakModeAlert visible={isBreakMode} onResume={() => setIsBreakMode(false)} />
            <DatePicker visible={timelinePickerVisible} onClose={() => setTimelinePickerVisible(false)} onSelect={(date) => setSelectedDate(date)} selectedDate={selectedDate} title="Activity History" markedDates={markedDates} />
            
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
            
            <Animated.View pointerEvents="none" style={[styles.headerBlurBackdrop, { height: HEADER_HEIGHT + 20 }, headerBackdropAnimatedStyle]}>
                <BlurView intensity={theme.dark ? 42 : 58} tint={theme.dark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
                <ExpoLinearGradient
                    colors={
                        theme.dark
                            ? ['rgba(7, 12, 20, 0.18)', 'rgba(7, 12, 20, 0.08)', 'rgba(7, 12, 20, 0)']
                            : ['rgba(248, 250, 252, 0.28)', 'rgba(248, 250, 252, 0.12)', 'rgba(248, 250, 252, 0)']
                    }
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>

            <Animated.View style={headerAnimatedStyle}>
                 <DynamicHeader selectedDate={selectedDate} onSelectDate={(date) => setSelectedDate(date)} isClockedIn={isClockedIn} isOvertime={isSessionOvertime} workedMinutes={workedMinutes} dailyGoal={dailyGoal} isLoading={isInitialLoading} />
            </Animated.View>

            <Animated.ScrollView 
                ref={scrollViewRef}
                onScroll={scrollHandler} 
                scrollEventThrottle={16} 
                showsVerticalScrollIndicator={false} 
                contentContainerStyle={{ padding: 24, paddingTop: HEADER_HEIGHT + 28, paddingBottom: 140 }} 
                refreshControl={<RefreshControl refreshing={refreshing || syncStatus === 'syncing'} onRefresh={onRefresh} progressViewOffset={insets.top + 100} tintColor={theme.colors.primary} />}
            >

                {isInitialLoading ? (
                    <HomeContentSkeleton />
                ) : (
                    <>
                        <View style={{ alignItems: 'center', marginBottom: 40 }}>
                            <View style={{ width: '100%' }} onLayout={(event) => { dynamicBarOffsetY.value = event.nativeEvent.layout.y; }}>
                                <DynamicBar nameToDisplay={displayName} alertVisible={alertVisible} alertMessage={alertMessage} alertType={alertType} onHideAlert={handleHideAlert} customGreeting={isBreakMode ? "You are on break" : (isBreak ? "Happy Break Time" : null)} shiftStartTime={jobSettings?.work_schedule?.start || null} />
                            </View>
                            <View style={{ opacity: isBreakMode ? 0.5 : 1 }} pointerEvents={isBreakMode ? 'none' : 'auto'}>
                                <BiometricButton onSuccess={handleClockButtonPress} isClockedIn={isClockedIn} isLoading={loading} settings={appSettings} />
                            </View>
                        </View>

                        <View 
                            style={{ marginBottom: 24 }} 
                            collapsable={false}
                            onLayout={(e) => setNoJobCardY(e.nativeEvent.layout.y)}
                        >
                            {jobSettings ? (
                                <DailySummaryCard totalMinutes={workedMinutes} isClockedIn={isClockedIn} theme={theme} dailyGoal={dailyGoal} isOvertime={isSessionOvertime} startTime={latestRecord?.clock_in} targetEndTime={isSessionOvertime ? otExpiry : shiftEndTarget} payoutType={jobSettings?.payout_type} periodWorkedMinutes={periodWorkedMinutes + (isClockedIn ? workedMinutes : 0)} periodTargetMinutes={dbPeriodTargetMinutes} />
                            ) : (
                                <NoActiveJobCard theme={theme} isOffline={isOffline} highlightTrigger={highlightNoJob} />
                            )}
                        </View>

                        {jobSettings ? (
                            <>
                                <View style={styles.sectionHeader}>
                                    <TouchableOpacity onPress={handleTitlePress} activeOpacity={0.6} disabled={calendarLoading} style={styles.titleRow}>
                                        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{activityTitle}</Text>
                                        {calendarLoading ? <ActivityIndicator size="small" color={theme.colors.textSecondary} /> : <HugeiconsIcon icon={ArrowDown01Icon} size={20} color={theme.colors.textSecondary} />}
                                    </TouchableOpacity>
                                    <View style={styles.actionRow}>
                                        <TouchableOpacity onPress={() => router.push('/search')} style={[styles.iconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                            <HugeiconsIcon icon={Search01Icon} size={18} color={theme.colors.text} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => router.push('/notifications')} style={[styles.iconButton, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                                            <HugeiconsIcon icon={Notification01Icon} size={18} color={theme.colors.text} />
                                            {unreadNotifsCount > 0 && <View style={[styles.badge, { backgroundColor: theme.colors.danger, borderColor: theme.colors.card }]} />}
                                        </TouchableOpacity>
                                        
                                        {/* UNCLICKABLE IF OFFLINE OR NO ACTIVE SESSION -> ONLY ACCEPTS FIXED DATE ADDITIONS */}
                                        <TouchableOpacity 
                                            disabled={!isClockedIn} 
                                            onPress={() => router.push({ pathname: '/reports/add-entry', params: { jobId: activeJobId, fixedDate: 'true' } })} 
                                            style={[styles.iconButton, { backgroundColor: isClockedIn ? theme.colors.iconBg : theme.colors.background }]}
                                        >
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
                        ) : (
                            <AppTutorialCards />
                        )}
                    </>
                )}
            </Animated.ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    skeletonContainer: { flex: 1, paddingHorizontal: 0 },
    skeletonDynamicBar: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 14, borderRadius: 28, borderWidth: 1, width: '100%', maxWidth: 392, minHeight: 104, overflow: 'hidden' },
    skeletonDynamicBarTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    headerBlurBackdrop: { position: 'absolute', top: 0, left: 0, right: 0 },
    skeletonCard: { borderRadius: 24, borderWidth: 1.5, justifyContent: 'space-between', overflow: 'hidden' },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    sectionTitle: { fontFamily: 'Nunito_500Medium', fontSize: 18, letterSpacing: -0.5 },
    actionRow: { flexDirection: 'row', gap: 12 },
    iconButton: { borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'transparent' },
    badge: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, borderWidth: 1.5 },
    timelineCard: { borderRadius: 24, borderWidth: 1, overflow: 'hidden' },
});





