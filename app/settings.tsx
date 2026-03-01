// filepath: app/settings.tsx
import {
    CreditCardIcon,
    Download04Icon,
    InformationCircleIcon,
    Logout01Icon,
    Mail01Icon,
    Notification01Icon,
    PaintBoardIcon,
    PencilEdit02Icon,
    ReloadIcon,
    SecurityCheckIcon,
    Share08Icon,
    VolumeHighIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useRef, useState } from 'react';
import {
    BackHandler,
    Image,
    Linking,
    ScrollView,
    Share, // <-- ADDED SHARE API
    StatusBar,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    cancelAnimation,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../components/Header';
import LoadingOverlay from '../components/LoadingOverlay';
import ModernAlert from '../components/ModernAlert';
import { ModernSettingsItem } from '../components/SettingsComponents';
import SyncStatusIndicator from '../components/SyncStatusIndicator';
import { useAppTheme } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useSync } from '../context/SyncContext';
import { checkForUpdate } from '../lib/updateCheck';
import { ExportService } from '../services/ExportService';

type ThemeOption = 'system' | 'light' | 'dark';

export default function SettingsScreen() {
    const router = useRouter();
    const theme = useAppTheme();
    const { signOut, user } = useAuth();
    const { colorScheme } = useColorScheme();
    const { triggerSync, syncStatus, pendingCount, failedCount } = useSync();

    const [soundEnabled, setSoundEnabled] = useState(true);
    const [themePreference, setThemePreference] = useState<ThemeOption>('system');
    
    const [isLoading, setIsLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState('');
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    const [hasUpdate, setHasUpdate] = useState(false);

    const syncButtonRotation = useSharedValue(0);
    const isSyncing = syncStatus === 'syncing';

    const providers = user?.app_metadata?.providers || [];
    const hasGoogle = providers.includes('google');

    const isMounted = useRef(true);

    const dangerColor = theme.colors.danger || '#ef4444';

    useEffect(() => {
        if (isSyncing) {
            syncButtonRotation.value = withRepeat(withTiming(360, { duration: 1000 }), -1);
        } else {
            cancelAnimation(syncButtonRotation);
            syncButtonRotation.value = withTiming(0);
        }
    }, [isSyncing, syncButtonRotation]);

    const syncButtonStyle = useAnimatedStyle(() => ({
        transform: [{ rotate: `${syncButtonRotation.value}deg` }],
    }));

    useEffect(() => {
        loadSettings();
    }, []);

    useEffect(() => {
        const backAction = () => {
            if (router.canGoBack()) router.back();
            else router.replace('/(tabs)/home'); 
            return true; 
        };
        const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
        return () => backHandler.remove();
    }, [router]);

    useEffect(() => {
        isMounted.current = true;
        loadSettings();
        return () => { isMounted.current = false; };
    }, [colorScheme]);

    useEffect(() => {
        const version = Constants.expoConfig?.version || '1.0.0';
        checkForUpdate(version).then((res) => {
            if (res.hasUpdate) setHasUpdate(true);
        });
    }, []);

    const loadSettings = async () => {
        try {
            const storedSettings = await AsyncStorage.getItem('appSettings');
            if (storedSettings && isMounted.current) {
                const parsed = JSON.parse(storedSettings);
                if (parsed.soundEnabled !== undefined) setSoundEnabled(parsed.soundEnabled);
                if (parsed.themePreference) setThemePreference(parsed.themePreference);
            }
        } catch (e) { console.error(e); }
    };

    const saveSetting = async (key: string, value: any) => {
        try {
            const stored = await AsyncStorage.getItem('appSettings');
            const settings = stored ? JSON.parse(stored) : {};
            settings[key] = value;
            await AsyncStorage.setItem('appSettings', JSON.stringify(settings));
        } catch (e) { console.error(e); }
    };

    const toggleSound = (val: boolean) => {
        setSoundEnabled(val);
        saveSetting('soundEnabled', val);
    };

    const handleContactSupport = () => {
        Linking.openURL('mailto:dev.vncedb@gmail.com?subject=DART Support Request');
    };

    // --- NEW SHARE FUNCTION ---
    const handleShareApp = async () => {
        try {
            // Replace this with your actual Linktree, Carrd page, Expo EAS link, or Google Drive APK link
            const downloadLink = "https://dart-projectvdb.carrd.co/"; 
            
            const message = `Hey! I'm using DART (Daily Accomplishment Report Tools) to track my hours and generate reports easily.\n\nDownload the app here: ${downloadLink}`;
            
            await Share.share({
                message: message,
                title: 'Share DART App',
            });
        } catch (error) {
            console.log('Error sharing app:', error);
        }
    };

    const handleExportData = async () => {
        if (!user) return;
        setIsLoading(true);
        setLoadingMessage("Packaging your data...");
        try {
            await ExportService.exportAllData(user.id);
        } catch (e) {
            setAlertConfig({ visible: true, type: 'error', title: 'Export Failed', message: 'Could not export your data at this time.', confirmText: 'OK', onConfirm: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })) });
        } finally {
            setIsLoading(false);
        }
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
                setIsLoading(true);
                setLoadingMessage("Signing out...");
                await signOut();
                setIsLoading(false);
                router.replace('/'); 
            },
            onCancel: () => setAlertConfig((prev: any) => ({ ...prev, visible: false })),
        });
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.background }} edges={['top']}>
            <StatusBar barStyle={colorScheme === 'dark' ? "light-content" : "dark-content"} />
            <ModernAlert {...alertConfig} />
            <LoadingOverlay visible={isLoading} message={loadingMessage} />

            {/* ADDED SHARE BUTTON TO HEADER RIGHT ELEMENT */}
            <Header 
                title="Settings" 
                rightElement={
                    <TouchableOpacity onPress={handleShareApp} style={styles.headerShareBtn}>
                        <HugeiconsIcon icon={Share08Icon} size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                }
            />

            <ScrollView contentContainerStyle={{ padding: 24, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
                
                {/* PROFILE */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>PROFILE</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                         <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={[styles.profileIconContainer, { backgroundColor: theme.colors.background }]}>
                              {hasGoogle ? (
                                <Image source={require('../assets/images/google-logo.png')} style={{ width: 18, height: 18 }} resizeMode="contain" />
                              ) : (
                                <HugeiconsIcon icon={Mail01Icon} size={18} color={theme.colors.primary} />
                              )}
                            </View>
                            
                            <View style={{ marginLeft: 12, flex: 1 }}>
                                <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 16, fontFamily: 'Nunito_600SemiBold', color: theme.colors.text }}>
                                    {user?.email}
                                </Text>
                                
                                <View style={{ alignSelf: 'flex-start', transform: [{ translateX: -4 }], marginTop: 2 }}>
                                    <SyncStatusIndicator />
                                </View>
                            </View>

                            <TouchableOpacity 
                                onPress={() => triggerSync()} 
                                style={[styles.syncBtn, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}
                            >
                                <Animated.View style={syncButtonStyle}>
                                    <HugeiconsIcon icon={ReloadIcon} size={18} color={theme.colors.text} />
                                </Animated.View>
                                {(pendingCount > 0 || failedCount > 0) && (
                                    <View style={[
                                        styles.syncBadge, 
                                        { backgroundColor: failedCount > 0 ? dangerColor : theme.colors.primary, borderColor: theme.colors.card }
                                    ]} />
                                )}
                            </TouchableOpacity>

                         </View>
                    </View>
                </View>

                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>DATA MANAGEMENT</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        <ModernSettingsItem icon={Download04Icon} label="Backup Data" subLabel="Save a local copy of your data" onPress={handleExportData} isLast theme={theme} />
                    </View>
                </View>

                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>BILLING & SUBSCRIPTION</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        <ModernSettingsItem icon={CreditCardIcon} label="Manage Subscription" subLabel="View plans, invoices, and billing history" onPress={() => router.push('/settings/manage-subscriptions')} isLast theme={theme} />
                    </View>
                </View>

                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>APP SETTINGS</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        <ModernSettingsItem icon={Notification01Icon} label="Notifications" onPress={() => router.push('/settings/notifications')} theme={theme} />
                        <ModernSettingsItem icon={PaintBoardIcon} label="Appearance" subLabel={themePreference === 'system' ? 'System Default' : (themePreference === 'dark' ? 'Dark Mode' : 'Light Mode')} onPress={() => router.push('/settings/appearance')} theme={theme} />
                        <ModernSettingsItem 
                            icon={VolumeHighIcon} label="Sound Effects" isLast theme={theme} onPress={() => toggleSound(!soundEnabled)}
                            rightElement={<Switch value={soundEnabled} onValueChange={toggleSound} trackColor={{ false: '#767577', true: theme.colors.primary }} thumbColor={'#fff'} style={{ transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }] }} />} 
                        />
                    </View>
                </View>

                <View style={{ marginBottom: 24 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>SECURITY</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        <ModernSettingsItem icon={SecurityCheckIcon} label="Account & Security" subLabel="Biometrics, Password, Danger Zone" onPress={() => router.push('/settings/account-security')} isLast theme={theme} />
                    </View>
                </View>

                <View style={{ marginBottom: 32 }}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>SUPPORT</Text>
                    <View style={[styles.card, { backgroundColor: theme.colors.card, borderColor: theme.colors.border, padding: 16 }]}>
                        <ModernSettingsItem icon={InformationCircleIcon} label="Legal & Privacy" onPress={() => router.push('/settings/privacy-policy')} theme={theme} />
                        <ModernSettingsItem icon={Mail01Icon} label="Contact Support" onPress={handleContactSupport} theme={theme} />
                        <ModernSettingsItem icon={PencilEdit02Icon} label="Report or Feedback" onPress={() => router.push('/settings/feedback')} theme={theme} />
                        <ModernSettingsItem
                            icon={InformationCircleIcon} label="About" onPress={() => router.push('/settings/about')} isLast theme={theme}
                            rightElement={hasUpdate ? (<View style={[styles.updateBadge, { backgroundColor: theme.colors.primary }]} />) : undefined}
                        />
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleSignOut}
                    activeOpacity={0.7}
                    style={[styles.signOutButton, { backgroundColor: dangerColor + '10', borderColor: dangerColor + '30' }]}
                >
                    <HugeiconsIcon icon={Logout01Icon} size={20} color={dangerColor} strokeWidth={2.5} />
                    <Text style={[styles.signOutText, { color: dangerColor }]}>Sign Out</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    headerShareBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, // ADDED SHARE BTN STYLE
    sectionTitle: { fontSize: 12, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1, marginBottom: 12, marginLeft: 4, textTransform: 'uppercase', opacity: 0.7 },
    card: { borderRadius: 24, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    
    profileIconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    syncBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", marginLeft: 8 },
    
    syncBadge: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5, borderWidth: 1.5 },
    updateBadge: { width: 8, height: 8, borderRadius: 4 },
    signOutButton: { height: 56, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderWidth: 1, marginTop: 8, marginBottom: 16 },
    signOutText: { fontSize: 16, fontFamily: 'Nunito_700Bold', letterSpacing: 0.3 }
});