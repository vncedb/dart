import {
  ArrowLeft01Icon,
  Clock01Icon,
  Notification01Icon,
  Settings01Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '../../constants/theme';

export default function NotificationsSettings() {
    const router = useRouter();
    const theme = useAppTheme();

    const [settings, setSettings] = useState({
        pushEnabled: true,
        attendanceEnabled: true, // New setting for persistent notification
        emailEnabled: false,
        soundEnabled: true,
        vibrationEnabled: true,
    });

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const stored = await AsyncStorage.getItem('notificationSettings');
            if (stored) {
                setSettings(JSON.parse(stored));
            }
            // Sync with global app settings for sound/vib
            const appSettings = await AsyncStorage.getItem('appSettings');
            if (appSettings) {
                const parsed = JSON.parse(appSettings);
                setSettings(prev => ({
                    ...prev,
                    soundEnabled: parsed.soundEnabled,
                    vibrationEnabled: parsed.vibrationEnabled
                }));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const toggleSwitch = async (key: keyof typeof settings) => {
        const newSettings = { ...settings, [key]: !settings[key] };
        setSettings(newSettings);
        
        try {
            await AsyncStorage.setItem('notificationSettings', JSON.stringify(newSettings));
            
            // Also update main App Settings if it's sound/vib
            if (key === 'soundEnabled' || key === 'vibrationEnabled') {
                await AsyncStorage.setItem('appSettings', JSON.stringify({
                    soundEnabled: newSettings.soundEnabled,
                    vibrationEnabled: newSettings.vibrationEnabled
                }));
            }
        } catch (e) {
            console.error(e);
        }
    };

    const SettingItem = ({ 
        label, 
        desc, 
        value, 
        onToggle, 
        icon 
    }: { 
        label: string, 
        desc?: string, 
        value: boolean, 
        onToggle: () => void, 
        icon: any 
    }) => (
        <View style={[styles.itemContainer, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
            <View style={styles.itemLeft}>
                <View style={[styles.iconBox, { backgroundColor: theme.colors.background }]}>
                    <HugeiconsIcon icon={icon} size={20} color={theme.colors.text} />
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.itemLabel, { color: theme.colors.text }]}>{label}</Text>
                    {desc && <Text style={[styles.itemDesc, { color: theme.colors.textSecondary }]}>{desc}</Text>}
                </View>
            </View>
            <Switch
                trackColor={{ false: theme.colors.border, true: theme.colors.success }}
                thumbColor={'#fff'}
                onValueChange={onToggle}
                value={value}
            />
        </View>
    );

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color={theme.colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: theme.colors.text }]}>Notifications</Text>
            </View>

            <ScrollView contentContainerStyle={styles.content}>
                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>GENERAL</Text>
                
                <SettingItem
                    label="Push Notifications"
                    desc="Receive alerts about shift updates and reminders."
                    value={settings.pushEnabled}
                    onToggle={() => toggleSwitch('pushEnabled')}
                    icon={Notification01Icon}
                />

                <SettingItem
                    label="Ongoing Attendance"
                    desc="Show persistent notification with timer while clocked in."
                    value={settings.attendanceEnabled}
                    onToggle={() => toggleSwitch('attendanceEnabled')}
                    icon={Clock01Icon}
                />

                <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary, marginTop: 24 }]}>PREFERENCES</Text>

                <SettingItem
                    label="Sound Effects"
                    value={settings.soundEnabled}
                    onToggle={() => toggleSwitch('soundEnabled')}
                    icon={Settings01Icon}
                />

                <SettingItem
                    label="Haptic Feedback"
                    value={settings.vibrationEnabled}
                    onToggle={() => toggleSwitch('vibrationEnabled')}
                    icon={Settings01Icon}
                />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        gap: 16,
    },
    backBtn: {
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
    },
    content: {
        padding: 20,
    },
    sectionTitle: {
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 12,
        letterSpacing: 1,
    },
    itemContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
    },
    itemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
        paddingRight: 12,
    },
    iconBox: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },
    itemLabel: {
        fontSize: 16,
        fontWeight: '600',
    },
    itemDesc: {
        fontSize: 12,
        marginTop: 2,
    },
});