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
import * as Notifications from 'expo-notifications';
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
import { clearAttendanceNotification, scheduleReminders } from '../../utils/NotificationService';

export default function NotificationsSettings() {
    const theme = useAppTheme();
    const { user } = useAuth();
    const [systemEnabled, setSystemEnabled] = useState(true);
    const [settings, setSettings] = useState({ pushEnabled: true, clockInReminder: true, persistentTimer: true, breakReminders: true, dailyReportReminder: true, reportGenerationAlert: true });

    const checkSystemPermissions = async () => {
        const { status } = await Notifications.getPermissionsAsync();
        setSystemEnabled(status === 'granted');
    };

    useFocusEffect(useCallback(() => {
        checkSystemPermissions();
        const subscription = AppState.addEventListener('change', (nextAppState) => { if (nextAppState === 'active') checkSystemPermissions(); });
        return () => subscription.remove();
    }, []));

    useEffect(() => { loadSettings(); }, []);

    const loadSettings = async () => {
        try {
            const stored = await AsyncStorage.getItem('notificationSettings');
            if (stored) setSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
        } catch (e) {}
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
        } catch (e) {}
    };

    const toggleSwitch = async (key: keyof typeof settings) => {
        const newValue = !settings[key];
        const newSettings = { ...settings, [key]: newValue };
        setSettings(newSettings);
        try { await AsyncStorage.setItem('notificationSettings', JSON.stringify(newSettings)); } catch (e) {}
        if (key === 'pushEnabled' && !newValue) await clearAttendanceNotification();
        else if (key === 'persistentTimer' && !newValue) await clearAttendanceNotification();
        await refreshReminders();
    };

    const Divider = () => <View style={{ height: 1, backgroundColor: theme.colors.border, opacity: 0.5, marginVertical: 12 }} />;

    const SettingItem = ({ label, desc, value, onToggle, icon, isLast }: any) => (
        <View style={{ paddingVertical: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16 }}>
                    <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                        <HugeiconsIcon icon={icon} size={20} color={value ? theme.colors.primary : theme.colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontFamily: 'Nunito_700Bold', color: theme.colors.text, letterSpacing: -0.2 }}>{label}</Text>
                        {desc && <Text style={{ fontSize: 12, fontFamily: 'Nunito_500Medium', color: theme.colors.textSecondary, marginTop: 2, lineHeight: 16 }}>{desc}</Text>}
                    </View>
                </View>
                <Switch trackColor={{ false: theme.colors.border, true: theme.colors.success }} thumbColor={'#fff'} onValueChange={onToggle} value={value} style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }} />
            </View>
            {!isLast && <Divider />}
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <Header title="Notifications" />
            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                {!systemEnabled && (
                    <TouchableOpacity onPress={() => Linking.openSettings()} style={[styles.warningBanner, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                        <HugeiconsIcon icon={AlertCircleIcon} size={24} color="#EF4444" />
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text style={{ fontSize: 14, fontFamily: 'Nunito_700Bold', color: '#EF4444' }}>System Notifications Disabled</Text>
                            <Text style={{ fontSize: 12, fontFamily: 'Nunito_500Medium', color: '#B91C1C', marginTop: 2 }}>The app cannot send alerts. Tap to enable in Settings.</Text>
                        </View>
                        <HugeiconsIcon icon={Settings02Icon} size={20} color="#EF4444" />
                    </TouchableOpacity>
                )}

                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>SYSTEM</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <SettingItem label="Allow Push Notifications" desc="Receive important alerts on your device lock screen." value={settings.pushEnabled} onToggle={() => toggleSwitch('pushEnabled')} icon={Notification01Icon} isLast />
                    </View>
                </View>

                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>ATTENDANCE</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <SettingItem label="Shift Reminders" desc="Get notified 15 mins before your shift starts." value={settings.clockInReminder} onToggle={() => toggleSwitch('clockInReminder')} icon={Calendar03Icon} />
                        <SettingItem label="Persistent Timer" desc="Show an ongoing timer notification while you are clocked in." value={settings.persistentTimer} onToggle={() => toggleSwitch('persistentTimer')} icon={Clock01Icon} />
                        <SettingItem label="Break Reminders" desc="Notification when your break time is over." value={settings.breakReminders} onToggle={() => toggleSwitch('breakReminders')} icon={AlarmClockIcon} isLast />
                    </View>
                </View>

                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>REPORTS</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        <SettingItem label="Daily Report Reminder" desc="Remind me to generate a report at the end of the day." value={settings.dailyReportReminder} onToggle={() => toggleSwitch('dailyReportReminder')} icon={File02Icon} />
                         <SettingItem label="Generation Alerts" desc="Notify when PDF/Excel reports are ready to download." value={settings.reportGenerationAlert} onToggle={() => toggleSwitch('reportGenerationAlert')} icon={Tick01Icon} isLast />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    sectionTitle: { fontSize: 11, fontFamily: 'Nunito_700Bold', letterSpacing: 1, marginBottom: 12, marginLeft: 8, textTransform: 'uppercase', opacity: 0.6 },
    card: { borderRadius: 24, borderWidth: 1, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
    warningBanner: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 20, borderWidth: 1, marginBottom: 24 },
});