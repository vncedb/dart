// Updated Icon to Tick01Icon for Alerts
import {
    AlarmClockIcon,
    Calendar03Icon,
    Clock01Icon,
    File02Icon,
    Notification01Icon,
    Tick01Icon // Updated Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import { useAppTheme } from '../../constants/theme';

export default function NotificationsSettings() {
    const theme = useAppTheme();

    const [settings, setSettings] = useState({
        pushEnabled: true,
        clockInReminder: true,
        persistentTimer: true,
        breakReminders: true,
        dailyReportReminder: true,
        reportGenerationAlert: true,
    });

    useEffect(() => { loadSettings(); }, []);

    const loadSettings = async () => {
        try {
            const stored = await AsyncStorage.getItem('notificationSettings');
            if (stored) setSettings(prev => ({ ...prev, ...JSON.parse(stored) }));
        } catch (e) { console.error("Error loading notification settings:", e); }
    };

    const toggleSwitch = async (key: keyof typeof settings) => {
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        try { await AsyncStorage.setItem('notificationSettings', JSON.stringify(newSettings)); } 
        catch (e) { console.error("Error saving notification settings:", e); }
    };

    const Divider = () => (
        <View style={{ height: 1, backgroundColor: theme.colors.border, opacity: 0.5, marginVertical: 12 }} />
    );

    const SettingItem = ({ label, desc, value, onToggle, icon, isLast }: any) => (
        <View style={{ paddingVertical: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16 }}>
                    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <HugeiconsIcon icon={icon} size={18} color={value ? theme.colors.primary : theme.colors.textSecondary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.text }}>{label}</Text>
                        {desc && <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2, lineHeight: 16 }}>{desc}</Text>}
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
            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }}>
                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>SYSTEM</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        <SettingItem label="Allow Push Notifications" desc="Receive important alerts on your device lock screen." value={settings.pushEnabled} onToggle={() => toggleSwitch('pushEnabled')} icon={Notification01Icon} isLast />
                    </View>
                </View>
                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>ATTENDANCE</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        <SettingItem label="Shift Reminders" desc="Get notified 15 mins before your shift starts." value={settings.clockInReminder} onToggle={() => toggleSwitch('clockInReminder')} icon={Calendar03Icon} />
                        <SettingItem label="Persistent Timer" desc="Show an ongoing timer notification while you are clocked in." value={settings.persistentTimer} onToggle={() => toggleSwitch('persistentTimer')} icon={Clock01Icon} />
                        <SettingItem label="Break Reminders" desc="Notification when your break time is over." value={settings.breakReminders} onToggle={() => toggleSwitch('breakReminders')} icon={AlarmClockIcon} isLast />
                    </View>
                </View>
                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>REPORTS</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        <SettingItem label="Daily Report Reminder" desc="Remind me to generate a report at the end of the day." value={settings.dailyReportReminder} onToggle={() => toggleSwitch('dailyReportReminder')} icon={File02Icon} />
                         <SettingItem label="Generation Alerts" desc="Notify when PDF/Excel reports are ready to download." value={settings.reportGenerationAlert} onToggle={() => toggleSwitch('reportGenerationAlert')} icon={Tick01Icon} isLast />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', opacity: 0.7 },
    card: { borderRadius: 24, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
});