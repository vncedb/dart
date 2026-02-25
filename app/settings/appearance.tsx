import {
    Moon02Icon,
    SmartPhone02Icon,
    Sun03Icon,
    Tick02Icon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useAppTheme } from '../../constants/theme';

type ThemeOption = 'system' | 'light' | 'dark';

export default function AppearanceScreen() {
    const theme = useAppTheme();
    const { setColorScheme } = useColorScheme();
    const [themePreference, setThemePreference] = useState<ThemeOption>('system');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => { loadSettings(); }, []);

    const loadSettings = async () => {
        try {
            const storedSettings = await AsyncStorage.getItem('appSettings');
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings);
                if (parsed.themePreference) setThemePreference(parsed.themePreference);
            }
        } catch {
            // Ignored unused error variable
        }
    };

    const handleThemeChange = async (newTheme: ThemeOption) => {
        if (themePreference === newTheme) return;
        setIsLoading(true);
        await new Promise(resolve => setTimeout(resolve, 300));
        try {
            setThemePreference(newTheme);
            setColorScheme(newTheme);
            const stored = await AsyncStorage.getItem('appSettings');
            const settings = stored ? JSON.parse(stored) : {};
            settings.themePreference = newTheme;
            await AsyncStorage.setItem('appSettings', JSON.stringify(settings));
        } catch {
            // Ignored unused error variable
        } 
        finally { setIsLoading(false); }
    };

    const Divider = () => <View style={{ height: 1, backgroundColor: theme.colors.border, opacity: 0.5, marginVertical: 12 }} />;

    const ThemeItem = ({ label, desc, value, icon, isLast }: any) => {
        const isSelected = themePreference === value;
        return (
            <TouchableOpacity activeOpacity={0.7} onPress={() => handleThemeChange(value)} style={{ paddingVertical: 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 16 }}>
                        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
                            <HugeiconsIcon icon={icon} size={20} color={isSelected ? theme.colors.primary : theme.colors.textSecondary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 16, fontFamily: isSelected ? 'Nunito_700Bold' : 'Nunito_600SemiBold', color: isSelected ? theme.colors.primary : theme.colors.text, letterSpacing: -0.2 }}>{label}</Text>
                            {desc && <Text style={{ fontSize: 12, fontFamily: 'Nunito_600SemiBold', color: theme.colors.textSecondary, marginTop: 2, lineHeight: 16 }}>{desc}</Text>}
                        </View>
                    </View>
                    {isSelected && <HugeiconsIcon icon={Tick02Icon} size={22} color={theme.colors.primary} strokeWidth={3} />}
                </View>
                {!isLast && <Divider />}
            </TouchableOpacity>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <Header title="Appearance" />
            <LoadingOverlay visible={isLoading} message="Applying Theme..." />
            
            <ScrollView contentContainerStyle={{ padding: 24 }}>
                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>INTERFACE STYLE</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        <ThemeItem label="Automatic" desc="Match your device's system settings." value="system" icon={SmartPhone02Icon} />
                        <ThemeItem label="Light Mode" desc="Always use light theme." value="light" icon={Sun03Icon} />
                        <ThemeItem label="Dark Mode" desc="Always use dark theme." value="dark" icon={Moon02Icon} isLast />
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    sectionTitle: { fontSize: 11, fontFamily: 'Nunito_700Bold', letterSpacing: 1, marginBottom: 12, marginLeft: 8, textTransform: 'uppercase', opacity: 0.6 },
    card: { borderRadius: 24, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
});