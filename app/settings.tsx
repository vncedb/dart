// Hidden Scroll Bar Indicator
import {
    ArrowRight01Icon,
    Delete02Icon,
    InformationCircleIcon,
    Logout01Icon,
    Mail01Icon,
    Notification01Icon,
    PaintBoardIcon,
    SecurityCheckIcon,
    VolumeHighIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import {
    Animated,
    BackHandler,
    Image,
    Linking,
    Pressable,
    ScrollView,
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import LoadingOverlay from '../components/LoadingOverlay';
import ModernAlert from '../components/ModernAlert';
import { useAppTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';

type ThemeOption = 'system' | 'light' | 'dark';

// --- Modern Animated Settings Item ---
const ModernSettingsItem = ({ icon, label, subLabel, onPress, rightElement, destructive, isLast, theme }: any) => {
    const scaleValue = useRef(new Animated.Value(1)).current;

    const onPressIn = () => {
        Animated.spring(scaleValue, { toValue: 0.97, useNativeDriver: true, speed: 20 }).start();
    };

    const onPressOut = () => {
        Animated.spring(scaleValue, { toValue: 1, useNativeDriver: true, speed: 20 }).start();
    };

    return (
        <View>
            <Pressable 
                onPress={onPress}
                onPressIn={onPress ? onPressIn : undefined}
                onPressOut={onPress ? onPressOut : undefined}
                disabled={!onPress}
            >
                <Animated.View style={{ 
                    flexDirection: 'row', alignItems: 'center', paddingVertical: 12,
                    transform: [{ scale: scaleValue }]
                }}>
                    <View style={{ 
                        width: 36, height: 36, borderRadius: 10, 
                        backgroundColor: destructive ? '#fee2e2' : theme.colors.background, 
                        alignItems: 'center', justifyContent: 'center', marginRight: 12 
                    }}>
                        <HugeiconsIcon icon={icon} size={18} color={destructive ? '#ef4444' : (onPress || rightElement ? theme.colors.primary : theme.colors.textSecondary)} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: destructive ? '#ef4444' : theme.colors.text }}>{label}</Text>
                        {subLabel && <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>{subLabel}</Text>}
                    </View>
                    {rightElement ? rightElement : (onPress && <HugeiconsIcon icon={ArrowRight01Icon} size={20} color={theme.colors.textSecondary} />)}
                </Animated.View>
            </Pressable>
            {!isLast && <View style={{ height: 1, backgroundColor: theme.colors.border, opacity: 0.5, marginVertical: 4 }} />}
        </View>
    );
};

export default function SettingsScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const { signOut, user } = useAuth();
    const { colorScheme } = useColorScheme();

    const [soundEnabled, setSoundEnabled] = useState(true);
    const [themePreference, setThemePreference] = useState<ThemeOption>('system');
    
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    // Check Provider
    const isGoogleAuth = user?.app_metadata?.provider === 'google';

    const isMounted = useRef(true);

    // Refresh settings when screen comes into focus (e.g. back from Appearance screen)
    useEffect(() => {
        loadSettings();
        // Add listener for focus to reload settings if they changed elsewhere
        // (Though React Navigation state updates usually trigger re-renders, explicit reloading ensures sync)
        const unsubscribe = router.canGoBack() ? null : null; 
        return () => {};
    }, []);

    useEffect(() => {
        const backAction = () => {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/(tabs)/home'); 
            }
            return true; 
        };

        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [router]);

    useEffect(() => {
        isMounted.current = true;
        loadSettings();
        return () => { isMounted.current = false; };
    }, [colorScheme]); // Reload if color scheme changes

    const loadSettings = async () => {
        try {
            const storedSettings = await AsyncStorage.getItem('appSettings');
            if (storedSettings && isMounted.current) {
                const parsed = JSON.parse(storedSettings);
                if (parsed.soundEnabled !== undefined) setSoundEnabled(parsed.soundEnabled);
                if (parsed.themePreference) setThemePreference(parsed.themePreference);
            }
        } catch (e) {
            console.error("Failed to load settings", e);
        }
    };

    const saveSetting = async (key: string, value: any) => {
        try {
            const stored = await AsyncStorage.getItem('appSettings');
            const settings = stored ? JSON.parse(stored) : {};
            settings[key] = value;
            await AsyncStorage.setItem('appSettings', JSON.stringify(settings));
        } catch (e) {
            console.error(e);
        }
    };

    const toggleSound = (val: boolean) => {
        setSoundEnabled(val);
        saveSetting('soundEnabled', val);
    };

    const handleContactSupport = () => {
        Linking.openURL('mailto:support@projectvdb.com?subject=DART Support Request');
    };

    const handleClearCache = async () => {
        setAlertConfig({
            visible: true,
            type: 'confirm',
            title: 'Clear Cache',
            message: 'This will free up space by deleting temporary files. Your data is safe.',
            confirmText: 'Clear Cache',
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                setIsLoading(true);
                setLoadingMessage('Cleaning up...');
                try {
                    const fs = FileSystem as any;
                    if (fs.cacheDirectory) await fs.deleteAsync(fs.cacheDirectory, { idempotent: true });
                    
                    setTimeout(() => {
                        if (!isMounted.current) return;
                        setIsLoading(false);
                        setAlertConfig({ visible: true, type: 'success', title: 'Success', message: 'Cache cleared.', onConfirm: () => setAlertConfig((p:any) => ({...p, visible: false})) });
                    }, 800);
                } catch (e) {
                    setIsLoading(false);
                }
            },
            onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
        });
    };

    const handleSignOut = () => {
        setAlertConfig({
            visible: true,
            type: 'confirm',
            title: 'Sign Out',
            message: 'Are you sure you want to sign out?',
            confirmText: 'Sign Out',
            confirmType: 'destructive',
            onConfirm: async () => {
                setAlertConfig((prev: any) => ({ ...prev, visible: false }));
                await signOut();
            },
            onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
        });
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <StatusBar barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} />
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={isLoading} message={loadingMessage} />

            <Header title="Settings" />

            <ScrollView 
                contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
                showsVerticalScrollIndicator={false}
            >
                {/* --- PROFILE SECTION --- */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={styles.sectionTitle}>PROFILE</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                         <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.profileIconContainer, { backgroundColor: theme.colors.background }]}>
                              {isGoogleAuth ? (
                                <Image 
                                  source={require('../assets/images/google-logo.png')} 
                                  style={{ width: 22, height: 22 }}
                                  resizeMode="contain"
                                />
                              ) : (
                                <HugeiconsIcon icon={Mail01Icon} size={22} color={theme.colors.primary} />
                              )}
                            </View>
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.text }}>
                                    {user?.email}
                                </Text>
                                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>
                                    Signed in via {isGoogleAuth ? 'Google' : 'Email'}
                                </Text>
                            </View>
                         </View>
                    </View>
                </View>

                <View style={{ marginBottom: 24 }}>
                    <Text style={styles.sectionTitle}>APP SETTINGS</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        <ModernSettingsItem icon={Notification01Icon} label="Notifications" onPress={() => router.push('/settings/notifications')} theme={theme} />
                        <ModernSettingsItem 
                            icon={PaintBoardIcon} 
                            label="Appearance" 
                            subLabel={themePreference === 'system' ? 'System Default' : (themePreference === 'dark' ? 'Dark Mode' : 'Light Mode')} 
                            onPress={() => router.push('/settings/appearance')} 
                            theme={theme}
                        />
                        <ModernSettingsItem 
                            icon={VolumeHighIcon} 
                            label="Sound Effects" 
                            isLast
                            theme={theme}
                            rightElement={
                                <Switch value={soundEnabled} onValueChange={toggleSound} trackColor={{ false: '#767577', true: theme.colors.primary }} thumbColor={'#fff'} style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }} />
                            } 
                        />
                    </View>
                </View>

                <View style={{ marginBottom: 24 }}>
                    <Text style={styles.sectionTitle}>SECURITY</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        <ModernSettingsItem icon={SecurityCheckIcon} label="Account & Security" subLabel="Biometrics, Password, Danger Zone" onPress={() => router.push('/settings/account-security')} isLast theme={theme} />
                    </View>
                </View>

                <View style={{ marginBottom: 32 }}>
                    <Text style={styles.sectionTitle}>SUPPORT</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        <ModernSettingsItem icon={InformationCircleIcon} label="Privacy Policy" onPress={() => router.push('/settings/privacy-policy')} theme={theme} />
                        <ModernSettingsItem icon={Mail01Icon} label="Contact Support" onPress={handleContactSupport} theme={theme} />
                        <ModernSettingsItem icon={InformationCircleIcon} label="About" subLabel="Version & Build Info" onPress={() => router.push('/settings/about')} theme={theme} />
                        <ModernSettingsItem icon={Delete02Icon} label="Clear Cache" onPress={handleClearCache} isLast theme={theme} />
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleSignOut}
                    activeOpacity={0.8}
                    style={{
                        backgroundColor: '#FEF2F2', 
                        height: 56,
                        borderRadius: 16,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 12,
                        borderWidth: 1,
                        borderColor: '#FEE2E2'
                    }}
                >
                    <Text style={{ color: '#ef4444', fontSize: 15, fontWeight: '600' }}>Sign Out</Text>
                    <HugeiconsIcon icon={Logout01Icon} size={20} color="#ef4444" strokeWidth={2.5} />
                </TouchableOpacity>

            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', opacity: 0.7 },
    card: { borderRadius: 24, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    profileIconContainer: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }
});