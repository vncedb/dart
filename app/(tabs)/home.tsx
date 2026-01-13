import {
    Briefcase01Icon,
    Notification01Icon, // FIXED: Changed from 03 to 01
    PlusSignIcon,
    WifiOffIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { addHours, addSeconds, endOfMonth, format, isAfter, isToday, startOfMonth } from 'date-fns';
import { useAudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    RefreshControl,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import ActivityTimeline from '../../components/ActivityTimeline';
import BiometricButton from '../../components/BiometricButton';
import DailySummaryCard from '../../components/DailySummaryCard';
import DynamicBar from '../../components/DynamicBar';
import DynamicDateHeader from '../../components/DynamicDateHeader';
import ModernAlert from '../../components/ModernAlert';
import NotificationModal from '../../components/NotificationModal';
import OvertimeModal from '../../components/OvertimeModal';
import { useAppTheme } from '../../constants/theme';
import { useSync } from '../../context/SyncContext';
import { generateUUID } from '../../lib/database';
import { getDB } from '../../lib/db-client';
import { supabase } from '../../lib/supabase';
import { registerForPushNotificationsAsync, setupNotificationCategories } from '../../utils/NotificationService';

configureReanimatedLogger({ level: ReanimatedLogLevel.warn, strict: false });

// --- HELPER FUNCTIONS ---
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

const getLocalDate = (d = new Date()) => {
    return format(d, 'yyyy-MM-dd');
};

// --- SKELETONS ---
const SkeletonItem = ({ style, borderRadius = 12 }: { style?: any, borderRadius?: number }) => {
    const theme = useAppTheme();
    return <View style={[{ backgroundColor: theme.colors.border, borderRadius, opacity: 0.3 }, style]} />;
};

const HomeSkeleton = () => {
    const insets = useSafeAreaInsets();
    const theme = useAppTheme();
    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            <View style={{ paddingHorizontal: 24, paddingTop: 120 + insets.top }}>
                <View style={{ alignItems: 'center', marginBottom: 40, gap: 24 }}>
                    <SkeletonItem style={{ width: 220, height: 24, borderRadius: 12 }} />
                    <SkeletonItem style={{ width: 160, height: 160, borderRadius: 80 }} /> 
                </View>
                <View style={{ marginBottom: 24 }}>
                    <SkeletonItem style={{ width: '100%', height: 200, borderRadius: 24 }} />
                </View>
            </View>
        </View>
    );
};

const JobSetupCard = ({ theme, router, isOffline }: any) => {
    return (
        <View style={{ backgroundColor: theme.colors.card, borderColor: theme.colors.border, borderWidth: 1, padding: 24, borderRadius: 24, flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: theme.colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                {isOffline ? <HugeiconsIcon icon={WifiOffIcon} size={28} color={theme.colors.primary} /> : <HugeiconsIcon icon={Briefcase01Icon} size={28} color={theme.colors.primary} />}
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '800', marginBottom: 4 }}>
                    {isOffline ? 'Offline Mode' : 'No Active Job'}
                </Text>
                {isOffline ? (
                     <Text style={{ color: theme.colors.textSecondary, fontSize: 12 }}>Using cached details.</Text>
                ) : (
                    <>
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 12, marginBottom: 8 }}>Please select an active job to continue.</Text>
                        <TouchableOpacity onPress={() => router.push('/job/job')} style={{ backgroundColor: theme.colors.primary, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 10, alignSelf: 'flex-start' }}>
                            <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>Manage Jobs</Text>
                        </TouchableOpacity>
                    </>
                )}
            </View>
        </View>
    );
};

export default function Home() {
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const theme = useAppTheme();
    const { triggerSync, syncStatus } = useSync(); 
    const successPlayer = useAudioPlayer(require('../../assets/success.mp3'));

    const [loading, setLoading] = useState(false);
    const [isInitialLoading, setIsInitialLoading] = useState(true); 
    const [refreshing, setRefreshing] = useState(false);
    
    // Data State
    const [profile, setProfile] = useState<any>(null);
    const [activeJobId, setActiveJobId] = useState<string | null>(null);
    const [jobSettings, setJobSettings] = useState<any>(null); 
    const [todaysRecords, setTodaysRecords] = useState<any[]>([]);
    const [monthRecords, setMonthRecords] = useState<any[]>([]);
    const [tasks, setTasks] = useState<any[]>([]);
    
    // Notifications State
    const [notifications, setNotifications] = useState<any[]>([]);
    const [notifModalVisible, setNotifModalVisible] = useState(false);
    const notificationListener = useRef<any>();
    
    // Computed
    const [dailyGoal, setDailyGoal] = useState(8); 
    const [timelineData, setTimelineData] = useState<any[]>([]);
    const [appSettings, setAppSettings] = useState({ vibrationEnabled: true, soundEnabled: true });
    
    const [workedMinutes, setWorkedMinutes] = useState(0);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [isBreak, setIsBreak] = useState(false);
    const [otExpiry, setOtExpiry] = useState<string | null>(null);
    
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");
    const [alertType, setAlertType] = useState<'success' | 'check-in' | 'check-out'>('success');
    
    const [modernAlertConfig, setModernAlertConfig] = useState<any>({ visible: false });
    const [otModalVisible, setOtModalVisible] = useState(false);

    const latestRecord = todaysRecords.length > 0 ? todaysRecords[0] : null;
    const isClockedIn = latestRecord?.status === 'pending';
    const isSessionOvertime = latestRecord?.remarks?.includes('Overtime');
    const unreadNotifsCount = notifications.filter(n => !n.read).length;

    const displayName = profile ? (() => {
        const titlePart = profile.title ? `${profile.title.trim()} ` : '';
        const firstName = profile.first_name ? profile.first_name.trim() : (profile.full_name ? profile.full_name.split(' ')[0] : 'User');
        return `${titlePart}${firstName}`.trim();
    })() : 'User';

    const activityTitle = isToday(selectedDate) ? "Today's Activity" : `Activity • ${format(selectedDate, 'MMM d')}`;

    const handleHideAlert = useCallback(() => { setAlertVisible(false); }, []);

    // --- NOTIFICATION HANDLERS ---
    useEffect(() => {
        registerForPushNotificationsAsync();
        setupNotificationCategories();
        loadNotifications();

        notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
            const content = notification.request.content;
            const newNotif = {
                id: notification.request.identifier,
                title: content.title || 'Notification',
                body: content.body || '',
                date: Date.now(),
                read: false
            };
            
            setNotifications(prev => {
                const updated = [newNotif, ...prev];
                saveNotifications(updated);
                return updated;
            });
        });

        const subscription = Notifications.addNotificationResponseReceivedListener(response => {
            const actionId = response.actionIdentifier;
            if (actionId === 'time_out_now') {
                processClockAction(false);
            } else if (actionId === 'extend_shift') {
                const now = new Date();
                const todayKey = `extended_${now.toISOString().split('T')[0]}`;
                AsyncStorage.setItem(todayKey, 'true');
                Alert.alert("Shift Extended", "Auto-checkout has been disabled for today's shift.");
            }
        });

        return () => {
            if (subscription) subscription.remove();
            if (notificationListener.current) notificationListener.current.remove();
        };
    }, []);

    const loadNotifications = async () => {
        try {
            const json = await AsyncStorage.getItem('local_notifications');
            if (json) setNotifications(JSON.parse(json));
        } catch (e) { console.log('Err loading notifs', e); }
    };

    const saveNotifications = async (newNotifs: any[]) => {
        try {
            await AsyncStorage.setItem('local_notifications', JSON.stringify(newNotifs.slice(0, 50))); 
        } catch (e) { console.log('Err saving notifs', e); }
    };

    const markAllNotificationsRead = () => {
        const updated = notifications.map(n => ({ ...n, read: true }));
        setNotifications(updated);
        saveNotifications(updated);
    };

    useEffect(() => {
        const timer = setInterval(async () => {
            let totalMs = 0;
            todaysRecords.forEach((record) => {
                const start = new Date(record.clock_in).getTime();
                const end = record.clock_out ? new Date(record.clock_out).getTime() : new Date().getTime();
                totalMs += Math.max(0, end - start);
            });
            setWorkedMinutes(totalMs / (1000 * 60));

            if (jobSettings && jobSettings.break_schedule) setIsBreak(checkIsBreakTime(jobSettings.break_schedule));

            if (isClockedIn && isSessionOvertime) {
                const otEndTimeStr = await AsyncStorage.getItem('active_ot_expiry');
                if (otEndTimeStr) {
                    setOtExpiry(otEndTimeStr);
                    const otEndTime = new Date(otEndTimeStr);
                    const now = new Date();
                    
                    if (isAfter(now, otEndTime)) {
                        processClockAction(false); 
                        await AsyncStorage.removeItem('active_ot_expiry');
                        setOtExpiry(null);
                        
                        await Notifications.scheduleNotificationAsync({
                             content: { title: "Overtime Finished", body: "You have been automatically checked out.", sound: true },
                             trigger: null,
                         });
                        setModernAlertConfig({ visible: true, type: 'info', title: 'Overtime Finished', message: 'You have been automatically checked out.', confirmText: 'Okay', onConfirm: () => setModernAlertConfig((prev: any) => ({ ...prev, visible: false })) });
                    }
                }
            } else {
                setOtExpiry(null);
            }
            
            if (isClockedIn && !isSessionOvertime && jobSettings) {
                checkAutoCheckout(jobSettings, latestRecord);
            }

        }, 1000); 

        return () => clearInterval(timer);
    }, [todaysRecords, jobSettings, isClockedIn, isSessionOvertime]);

    const checkAutoCheckout = async (currentJob: any, lastRecord: any) => {
        if (!lastRecord || lastRecord.status !== 'pending' || !currentJob?.work_schedule?.end) return;
        if (lastRecord.remarks && lastRecord.remarks.includes('Overtime')) return;

        const dateKey = `extended_${getLocalDate()}`;
        const isExtended = await AsyncStorage.getItem(dateKey);
        if (isExtended === 'true') return;

        const now = new Date();
        const [endH, endM] = currentJob.work_schedule.end.split(':').map(Number);
        const shiftEnd = new Date();
        shiftEnd.setHours(endH, endM, 0, 0);

        if (isAfter(now, shiftEnd) && !isAfter(now, addSeconds(shiftEnd, 30))) {
            const warningKey = `shift_end_notif_${getLocalDate()}`;
            const hasWarned = await AsyncStorage.getItem(warningKey);
            if (!hasWarned) {
                 await Notifications.scheduleNotificationAsync({
                     content: { title: "Shift Ended", body: "Shift time over. Auto-checkout in 30 seconds.", sound: true, categoryIdentifier: 'auto_checkout_actions' },
                     trigger: null,
                 });
                 await AsyncStorage.setItem(warningKey, 'true');
            }
        }

        if (isAfter(now, addSeconds(shiftEnd, 30))) {
            const db = await getDB();
            const endIso = shiftEnd.toISOString();
            await db.runAsync('UPDATE attendance SET clock_out = ?, status = ?, remarks = ? WHERE id = ?', [endIso, 'completed', 'Auto-checkout: Shift End', lastRecord.id]);
            await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)', ['attendance', lastRecord.id, 'UPDATE', JSON.stringify({ clock_out: endIso, status: 'completed', remarks: 'Auto-checkout: Shift End' })]);
            await Notifications.scheduleNotificationAsync({ content: { title: "Auto Checked Out", body: "You have been checked out.", sound: true }, trigger: null });
            setModernAlertConfig({ visible: true, type: 'info', title: 'Auto Checked Out', message: `You were automatically checked out at ${format(shiftEnd, 'h:mm a')}.`, confirmText: 'Okay', onConfirm: () => setModernAlertConfig((prev:any) => ({...prev, visible: false})) });
            await loadData();
            triggerSync();
        }
    };

    const loadData = useCallback(async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) return;
            const user = session.user;
            const db = await getDB();
            
            const dateStr = format(selectedDate, 'yyyy-MM-dd');
            const startMonth = startOfMonth(selectedDate).toISOString().split('T')[0];
            const endMonth = endOfMonth(selectedDate).toISOString().split('T')[0];

            const localProfile: any = await db.getFirstAsync('SELECT * FROM profiles WHERE id = ?', [user.id]);
            setProfile(localProfile);
            
            const currentJobId = localProfile?.current_job_id;
            setActiveJobId(currentJobId);

            if (!currentJobId) {
                setJobSettings(null);
                setTodaysRecords([]);
                setTasks([]);
                setMonthRecords([]);
                setLoading(false);
                setIsInitialLoading(false);
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

                const [attendance, dailyTasks, monthlyAtt] = await Promise.all([
                    db.getAllAsync('SELECT * FROM attendance WHERE user_id = ? AND job_id = ? AND date = ? ORDER BY clock_in DESC', [user.id, currentJobId, dateStr]),
                    db.getAllAsync('SELECT * FROM accomplishments WHERE user_id = ? AND job_id = ? AND date = ?', [user.id, currentJobId, dateStr]),
                    db.getAllAsync('SELECT id, date, clock_in, clock_out FROM attendance WHERE user_id = ? AND job_id = ? AND date >= ? AND date <= ?', [user.id, currentJobId, startMonth, endMonth]),
                ]);
                
                setTodaysRecords(attendance as any[]);
                setTasks(dailyTasks as any[]);
                setMonthRecords(monthlyAtt as any[]);

                if (attendance && (attendance as any[]).length > 0) {
                        checkAutoCheckout(parsedJob, (attendance as any[])[0]);
                }
            } else {
                setJobSettings(null); 
            }

        } catch (e: any) { 
            console.log("Load Data Error:", e);
        } finally { 
            setRefreshing(false); 
            setTimeout(() => setIsInitialLoading(false), 300); 
        }
    }, [selectedDate]);

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
        
        todaysRecords.forEach(record => {
            const isOT = record.remarks && record.remarks.includes('Overtime');
            timeline.push({ 
                type: 'check-in', 
                time: record.clock_in, 
                id: record.id, 
                isOvertime: isOT,
                sortTime: new Date(record.clock_in).getTime()
            });

            if (record.clock_out) {
                timeline.push({ 
                    type: 'check-out', 
                    time: record.clock_out, 
                    id: record.id, 
                    isOvertime: isOT,
                    sortTime: new Date(record.clock_out).getTime()
                });
            }
        });

        tasks.forEach(task => {
            timeline.push({
                type: 'task',
                data: task,
                sortTime: new Date(task.created_at).getTime()
            });
        });

        timeline.sort((a, b) => a.sortTime - b.sortTime);
        setTimelineData(timeline);
    }, [todaysRecords, tasks]);

    const processClockAction = async (isOvertime = false, duration = 0) => {
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
                await db.runAsync('UPDATE attendance SET clock_out = ?, status = ? WHERE id = ?', [now, 'completed', latestRecord.id]);
                await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action, data) VALUES (?, ?, ?, ?)', ['attendance', latestRecord.id, 'UPDATE', JSON.stringify({ clock_out: now, status: 'completed' })]);
                await AsyncStorage.removeItem('active_ot_expiry');
                setOtExpiry(null);
                setAlertMessage("See you later!"); 
                setAlertType('check-out');
            } else {
                const now = new Date();
                let remarks = null;
                if (isOvertime) {
                    remarks = duration > 0 ? `Overtime: ${duration.toFixed(2)} hrs` : 'Overtime';
                    const expiryTime = addHours(now, duration);
                    const expiryIso = expiryTime.toISOString();
                    await AsyncStorage.setItem('active_ot_expiry', expiryIso);
                    setOtExpiry(expiryIso);
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
                
                setAlertMessage(isOvertime ? "Overtime Started!" : "Welcome In!"); 
                setAlertType('check-in');
            }
            
            // FIXED: Safer audio playback
            if (appSettings.soundEnabled) {
                try {
                    // Check if player is still valid/loaded before playing
                    if (successPlayer) {
                        successPlayer.seekTo(0); 
                        successPlayer.play(); 
                    }
                } catch (audioErr) {
                    console.log("Audio play failed (non-fatal):", audioErr);
                }
            }
            if (appSettings.vibrationEnabled) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            setAlertVisible(true);
            await loadData();
            triggerSync(); 
        } catch (e: any) { Alert.alert("Error", e.message); } finally { setLoading(false); }
    };

    const handleClockButtonPress = () => {
        if (!jobSettings || !activeJobId) {
            setModernAlertConfig({ visible: true, type: 'warning', title: 'No Job Active', message: 'Please select an active job in your profile.', confirmText: 'Manage Jobs', onConfirm: () => { setModernAlertConfig((prev:any)=>({...prev, visible:false})); router.push('/job/job'); } });
            return;
        }
        
        if (!isClockedIn) {
            if (jobSettings?.work_schedule?.start && jobSettings?.work_schedule?.end) {
                const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
                const startMins = timeToMinutes(jobSettings.work_schedule.start);
                const endMins = timeToMinutes(jobSettings.work_schedule.end);
                
                const isEarly = nowMins < (startMins - 30);
                const isLate = nowMins > endMins;
                
                if (isEarly || isLate) {
                    setOtModalVisible(true);
                    return;
                }
            }
        }
        
        processClockAction(false);
    };

    const handleEdit = (t: any) => { router.push({ pathname: '/reports/add-entry', params: { id: t.id } }); };
    const handleDeleteTask = (t: any) => { setModernAlertConfig({ visible: true, type: 'warning', title: 'Delete Entry?', message: 'This will remove the entry from your history.', confirmText: 'Delete', cancelText: 'Cancel', onConfirm: async () => { setModernAlertConfig((prev: any) => ({ ...prev, visible: false })); setLoading(true); try { const db = await getDB(); await db.runAsync('DELETE FROM accomplishments WHERE id = ?', [t.id]); await db.runAsync('INSERT INTO sync_queue (table_name, row_id, action) VALUES (?, ?, ?)', ['accomplishments', t.id, 'DELETE']); await loadData(); triggerSync(); setAlertMessage("Entry deleted"); setAlertType('success'); setAlertVisible(true); } catch (e) { console.log(e); } finally { setLoading(false); } }, onCancel: () => setModernAlertConfig((prev: any) => ({ ...prev, visible: false })) }); };

    if (isInitialLoading) {
        return <HomeSkeleton />;
    }

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <StatusBar barStyle={theme.dark ? "light-content" : "dark-content"} translucent backgroundColor="transparent" />
            <ModernAlert {...modernAlertConfig} />
            <OvertimeModal visible={otModalVisible} onClose={() => setOtModalVisible(false)} onConfirm={(hrs: number) => { setOtModalVisible(false); processClockAction(true, hrs); }} theme={theme} />
            
            <NotificationModal 
                visible={notifModalVisible} 
                onClose={() => setNotifModalVisible(false)} 
                notifications={notifications}
                onMarkAllRead={markAllNotificationsRead}
                theme={theme}
            />

            <View style={StyleSheet.absoluteFill} pointerEvents="none"><Svg height="100%" width="100%"><Defs><LinearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={theme.colors.bgGradientStart} stopOpacity="1" /><Stop offset="1" stopColor={theme.colors.bgGradientEnd} stopOpacity="1" /></LinearGradient></Defs><Rect x="0" y="0" width="100%" height="100%" fill="url(#bgGrad)" /></Svg></View>
            <View style={{ position: 'absolute', top: 0, height: insets.top + 40, width: '100%', zIndex: 90 }}><Svg height="100%" width="100%"><Rect x="0" y="0" width="100%" height="100%" fill={theme.colors.bgGradientStart} opacity={0.8} /></Svg></View>

            <DynamicDateHeader selectedDate={selectedDate} onSelectDate={(date) => setSelectedDate(date)} monthRecords={monthRecords} isClockedIn={isClockedIn} workedMinutes={workedMinutes} dailyGoal={dailyGoal} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 24, paddingTop: 120 + insets.top, paddingBottom: 140 }} refreshControl={<RefreshControl refreshing={refreshing || syncStatus === 'syncing'} onRefresh={onRefresh} progressViewOffset={insets.top + 100} tintColor={theme.colors.primary} />}>
                <View style={{ alignItems: 'center', marginBottom: 40 }}>
                    <DynamicBar 
                        nameToDisplay={displayName}
                        alertVisible={alertVisible}
                        alertMessage={alertMessage}
                        alertType={alertType}
                        onHideAlert={handleHideAlert}
                        customGreeting={isBreak ? "Happy Break Time" : null} 
                    />
                    <BiometricButton onSuccess={handleClockButtonPress} isClockedIn={isClockedIn} isLoading={loading} settings={appSettings} />
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
                            otExpiry={otExpiry}
                        />
                    ) : (
                        <JobSetupCard theme={theme} router={router} isOffline={false} />
                    )}
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.5 }}>{activityTitle}</Text>
                    
                    {/* UPDATED: Action Buttons Row */}
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                         {/* Notification Button */}
                         <TouchableOpacity 
                            onPress={() => setNotifModalVisible(true)} 
                            style={{ backgroundColor: theme.colors.card, borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }}
                        >
                            <HugeiconsIcon icon={Notification01Icon} size={18} color={theme.colors.text} />
                            {unreadNotifsCount > 0 && (
                                <View style={{ position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.danger, borderWidth: 1.5, borderColor: theme.colors.card }} />
                            )}
                        </TouchableOpacity>

                        {/* Add Entry Button */}
                        <TouchableOpacity 
                            disabled={!isClockedIn} 
                            onPress={() => router.push({ pathname: '/reports/add-entry', params: { jobId: activeJobId } })} 
                            style={{ backgroundColor: isClockedIn ? theme.colors.iconBg : theme.colors.background, borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}
                        >
                            <HugeiconsIcon icon={PlusSignIcon} size={20} color={isClockedIn ? theme.colors.primary : theme.colors.icon} />
                        </TouchableOpacity>
                    </View>
                </View>
                
                <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }} collapsable={false}>
                    <View style={{ padding: 20 }}>
                        <ActivityTimeline 
                            timelineData={timelineData} 
                            theme={theme} 
                            onEditTask={handleEdit} 
                            onDeleteTask={handleDeleteTask} 
                        />
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}