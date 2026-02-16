import {
    Calendar03Icon,
    Clock01Icon,
    HourglassIcon
} from '@hugeicons/core-free-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import { ModernSettingsItem, SettingsDropdownItem } from '../../components/SettingsComponents';
import { useAppTheme } from '../../constants/theme';

export default function GeneralSettingsScreen() {
    const theme = useAppTheme();

    // --- State ---
    const [autoTimeOut, setAutoTimeOut] = useState<string>('never');
    const [use24hFormat, setUse24hFormat] = useState(false);
    const [startOfWeek, setStartOfWeek] = useState('mon');

    // --- Options ---
    const autoTimeOutOptions = [
        { label: 'Disabled', value: 'never' },
        { label: 'When Shift Ends', value: 'shift_end' },
        { label: '1 Hour After Shift', value: 'plus_1h' },
        { label: '2 Hours After Shift', value: 'plus_2h' },
        { label: '4 Hours After Shift', value: 'plus_4h' },
        { label: 'Fixed 12h Duration', value: 'fixed_12h' },
    ];

    const weekStartOptions = [
        { label: 'Monday', value: 'mon' },
        { label: 'Sunday', value: 'sun' },
        { label: 'Saturday', value: 'sat' },
    ];

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            const stored = await AsyncStorage.getItem('appSettings');
            if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed.autoTimeOut !== undefined) setAutoTimeOut(parsed.autoTimeOut);
                if (parsed.use24hFormat !== undefined) setUse24hFormat(parsed.use24hFormat);
                if (parsed.startOfWeek !== undefined) setStartOfWeek(parsed.startOfWeek);
            }
        } catch (e) {
            console.error("Failed to load settings", e);
        }
    };

    const updateSetting = async (key: string, value: any, setter: Function) => {
        setter(value);
        try {
            const stored = await AsyncStorage.getItem('appSettings');
            const settings = stored ? JSON.parse(stored) : {};
            settings[key] = value;
            await AsyncStorage.setItem('appSettings', JSON.stringify(settings));
        } catch (e) {
            console.error("Failed to save setting", e);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <Header title="General" />
            
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                
                {/* DISPLAY & INTERFACE */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>DISPLAY & INTERFACE</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        
                        <ModernSettingsItem 
                            icon={Clock01Icon} 
                            label="24-Hour Time" 
                            subLabel="Use 13:00 instead of 1:00 PM"
                            theme={theme}
                            isLast
                            onPress={() => updateSetting('use24hFormat', !use24hFormat, setUse24hFormat)}
                            rightElement={
                                <Switch 
                                    value={use24hFormat} 
                                    onValueChange={(val) => updateSetting('use24hFormat', val, setUse24hFormat)} 
                                    trackColor={{ false: '#767577', true: theme.colors.primary }} 
                                    thumbColor={'#fff'} 
                                    style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }} 
                                />
                            } 
                        />
                    </View>
                </View>

                {/* LOGIC & BEHAVIOR */}
                <View style={styles.section}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>LOGIC & BEHAVIOR</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                        
                        <SettingsDropdownItem 
                            icon={HourglassIcon} 
                            label="Auto Time Out"
                            options={autoTimeOutOptions}
                            value={autoTimeOut}
                            onChange={(val: any) => updateSetting('autoTimeOut', val, setAutoTimeOut)}
                            theme={theme}
                        />

                        <SettingsDropdownItem 
                            icon={Calendar03Icon} 
                            label="Start of Week"
                            options={weekStartOptions}
                            value={startOfWeek}
                            onChange={(val: any) => updateSetting('startOfWeek', val, setStartOfWeek)}
                            theme={theme}
                            isLast
                        />
                    </View>
                </View>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    content: { padding: 24, paddingBottom: 100 },
    section: { marginBottom: 24 },
    sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', opacity: 0.7 },
    card: { borderRadius: 24, borderWidth: 1, padding: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
});