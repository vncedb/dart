import {
    AlarmClockIcon,
    AlertCircleIcon,
    Calendar03Icon,
    Clock01Icon,
    File02Icon,
    Notification01Icon,
    Settings02Icon,
    Tick01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    AppState,
    Linking,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import { useAppTheme } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { getDB } from '../../lib/db-client';
import { checkNotificationPermissions, clearAttendanceNotification, scheduleReminders } from '../../utils/NotificationService';

const APP_SETTINGS_KEY = 'appSettings';
const NOTIFICATION_SETTINGS_KEY = 'notificationSettings';

export default function NotificationsSettings() {
    const theme = useAppTheme();
    const { user } = useAuth();

    const [systemEnabled, setSystemEnabled] = useState(true);
    const [masterEnabled, setMasterEnabled] = useState(true);
    const [settings, setSettings] = useState({
        pushEnabled: true,
        clockInReminder: true,
        persistentTimer: true,
        breakReminders: true,
        dailyReportReminder: true,
        reportGenerationAlert: true
    });

    const featureControlsEnabled = masterEnabled && systemEnabled;

    const verifySystemPermissions = async () => {
        const isGranted = await checkNotificationPermissions();
        setSystemEnabled(isGranted);
    };

    useFocusEffect(useCallback(() => {
        verifySystemPermissions();
        const subscription = AppState.addEventListener('change', (nextAppState) => {
            if (nextAppState === 'active') verifySystemPermissions();
        });
        return () => subscription.remove();
    }, []));

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const [storedNotifSettings, storedAppSettings] = await Promise.all([
                AsyncStorage.getItem(NOTIFICATION_SETTINGS_KEY),
                AsyncStorage.getItem(APP_SETTINGS_KEY),
            ]);

            const parsedNotifSettings = storedNotifSettings ? JSON.parse(storedNotifSettings) : {};
            const parsedAppSettings = storedAppSettings ? JSON.parse(storedAppSettings) : {};

            setSettings((prev) => ({ ...prev, ...parsedNotifSettings }));
            setMasterEnabled(parsedNotifSettings.pushEnabled !== false && parsedAppSettings.notificationsEnabled !== false);
        } catch {
            // Silently ignore storage fetch errors
        }
    };

    const saveAppNotificationSetting = async (value: boolean) => {
        const stored = await AsyncStorage.getItem(APP_SETTINGS_KEY);
        const parsed = stored ? JSON.parse(stored) : {};
        parsed.notificationsEnabled = value;
        await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(parsed));
    };

    const saveNotificationSettings = async (nextSettings: typeof settings) => {
        setSettings(nextSettings);
        await AsyncStorage.setItem(NOTIFICATION_SETTINGS_KEY, JSON.stringify(nextSettings));
    };

    const refreshReminders = async () => {
        if (!user) return;
        try {
            const db = await getDB();
            const profile = await db.getFirstAsync('SELECT current_job_id FROM profiles WHERE id = ?', [user.id]) as any;

            let startTime = null;
            if (profile?.current_job_id) {
                const job = await db.getFirstAsync('SELECT work_schedule FROM job_positions WHERE id = ?', [profile.current_job_id]) as any;
                if (job?.work_schedule) {
                    const schedule = typeof job.work_schedule === 'string' ? JSON.parse(job.work_schedule) : job.work_schedule;
                    startTime = schedule.start || null;
                }
            }
            await scheduleReminders(startTime);
        } catch {
            // Silently ignore DB errors on reminder refresh
        }
    };

    const toggleMasterNotifications = async () => {
        const nextValue = !masterEnabled;
        setMasterEnabled(nextValue);

        const nextSettings = { ...settings, pushEnabled: nextValue };

        try {
            await Promise.all([
                saveAppNotificationSetting(nextValue),
                saveNotificationSettings(nextSettings),
            ]);
        } catch {
            // Silently ignore storage save errors
        }

        if (!nextValue) {
            await clearAttendanceNotification();
        }

        await refreshReminders();
    };

    const toggleSwitch = async (key: keyof typeof settings) => {
        if (!featureControlsEnabled) return;

        const newValue = !settings[key];
        const newSettings = { ...settings, [key]: newValue };

        try {
            await saveNotificationSettings(newSettings);
        } catch {
            // Silently ignore storage save errors
        }

        if (key === 'persistentTimer' && !newValue) {
            await clearAttendanceNotification();
        }

        await refreshReminders();
    };

    const Divider = ({ dimmed = false }: { dimmed?: boolean }) => (
        <View style={{ height: 1, backgroundColor: theme.colors.border, opacity: dimmed ? 0.3 : 0.5, marginVertical: 12 }} />
    );

    const SettingItem = ({ label, desc, value, onToggle, icon, isLast, disabled = false }: any) => (
        <View style={{ paddingVertical: 4, opacity: disabled ? 0.45 : 1 }} pointerEvents={disabled ? 'none' : 'auto'}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                        <HugeiconsIcon icon={icon} size={20} color={disabled ? theme.colors.textSecondary : (value ? theme.colors.primary : theme.colors.textSecondary)} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontFamily: 'Nunito_700Bold', color: theme.colors.text, letterSpacing: -0.2 }}>{label}</Text>
                        {desc && <Text style={{ fontSize: 13, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary, marginTop: 4, lineHeight: 18 }}>{desc}</Text>}
                    </View>
                </View>
                <Switch
                    trackColor={{ false: theme.colors.border, true: theme.colors.success }}
                    thumbColor={'#fff'}
                    onValueChange={onToggle}
                    value={value}
                    disabled={disabled}
                    style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }}
                />
            </View>
            {!isLast && <Divider dimmed={disabled} />}
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <Header title="Notifications" />

            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                {!systemEnabled && (
                    <TouchableOpacity
                        onPress={() => Linking.openSettings()}
                        activeOpacity={0.8}
                        style={[styles.warningBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}
                    >
                        <HugeiconsIcon icon={AlertCircleIcon} size={24} color="#EF4444" />
                        <View style={{ flex: 1, marginLeft: 16 }}>
                            <Text style={{ fontSize: 15, fontFamily: 'Nunito_700Bold', color: '#B91C1C', marginBottom: 2 }}>Device Notifications Are Off</Text>
                            <Text style={{ fontSize: 13, fontFamily: 'Nunito_500Medium', color: '#DC2626', lineHeight: 18 }}>Turn on notifications in your phone settings so DART can send reminders and timer alerts.</Text>
                        </View>
                        <HugeiconsIcon icon={Settings02Icon} size={20} color="#EF4444" />
                    </TouchableOpacity>
                )}

                <View style={{ marginBottom: 28 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>MASTER CONTROL</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                        <SettingItem
                            label="Notifications in DART"
                            desc={systemEnabled
                                ? 'Turn this on to let DART send shift reminders, timer updates, and report alerts.'
                                : 'Turn this on after enabling notifications in your phone settings.'}
                            value={masterEnabled}
                            onToggle={toggleMasterNotifications}
                            icon={Notification01Icon}
                            isLast
                        />
                    </View>
                </View>

                {!featureControlsEnabled && (
                    <View style={[styles.helperCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                        <HugeiconsIcon icon={Notification01Icon} size={18} color={theme.colors.textSecondary} />
                        <Text style={[styles.helperText, { color: theme.colors.textSecondary }]}>Enable the master notification switch{systemEnabled ? '' : ' and allow notifications in your phone settings'} to manage the options below.</Text>
                    </View>
                )}

                <View style={{ marginBottom: 28 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>ATTENDANCE</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                        <SettingItem
                            label="Shift Start Reminder"
                            desc="Get a reminder when it is time to start your scheduled shift."
                            value={settings.clockInReminder}
                            onToggle={() => toggleSwitch('clockInReminder')}
                            icon={Calendar03Icon}
                            disabled={!featureControlsEnabled}
                        />
                        <SettingItem
                            label="Live Shift Timer"
                            desc="Keep an ongoing notification visible while you are clocked in."
                            value={settings.persistentTimer}
                            onToggle={() => toggleSwitch('persistentTimer')}
                            icon={Clock01Icon}
                            disabled={!featureControlsEnabled}
                        />
                        <SettingItem
                            label="Break End Reminder"
                            desc="Get a reminder when your break should be finished."
                            value={settings.breakReminders}
                            onToggle={() => toggleSwitch('breakReminders')}
                            icon={AlarmClockIcon}
                            isLast
                            disabled={!featureControlsEnabled}
                        />
                    </View>
                </View>

                <View style={{ marginBottom: 28 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>REPORTS</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}> 
                        <SettingItem
                            label="Daily Report Reminder"
                            desc="Get a friendly reminder to review and generate your report for the day."
                            value={settings.dailyReportReminder}
                            onToggle={() => toggleSwitch('dailyReportReminder')}
                            icon={File02Icon}
                            disabled={!featureControlsEnabled}
                        />
                        <SettingItem
                            label="Report Ready Alert"
                            desc="Be notified when your PDF or Excel report is ready."
                            value={settings.reportGenerationAlert}
                            onToggle={() => toggleSwitch('reportGenerationAlert')}
                            icon={Tick01Icon}
                            isLast
                            disabled={!featureControlsEnabled}
                        />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    sectionTitle: { fontSize: 12, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1, marginBottom: 12, marginLeft: 8, textTransform: 'uppercase', opacity: 0.6 },
    card: { borderRadius: 24, borderWidth: 1, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
    warningBanner: { flexDirection: 'row', alignItems: 'center', padding: 18, borderRadius: 20, borderWidth: 1, marginBottom: 20 },
    helperCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 24 },
    helperText: { flex: 1, fontSize: 13, fontFamily: 'Nunito_600SemiBold', lineHeight: 18 },
});
