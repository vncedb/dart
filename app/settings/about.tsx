// app/settings/about.tsx
import {
    Facebook02Icon,
    GithubIcon,
    InstagramIcon,
    NewTwitterIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { useColorScheme } from 'nativewind';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import Header from '../../components/Header';
import ModernAlert from '../../components/ModernAlert';
import { useAppTheme } from '../../constants/theme';
import {
    checkForUpdate,
    getApkDownloadUrl,
    UpdateCheckResult,
} from '../../lib/updateCheck';

export default function AboutScreen() {
    const theme = useAppTheme();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';

    const appVersion = Constants.expoConfig?.version || '1.0.0';

    const [toastState, setToastState] = useState<'hidden' | 'checking' | 'latest' | 'update'>('hidden');
    const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);
    const [hasUpdate, setHasUpdate] = useState(false);
    const [loading, setLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });

    // Check for update on mount (for indicator)
    useEffect(() => {
        let cancelled = false;
        checkForUpdate(appVersion).then((res) => {
            if (!cancelled && res.hasUpdate) {
                setHasUpdate(true);
                setUpdateResult(res);
            }
        });
        return () => { cancelled = true; };
    }, [appVersion]);

    const handleCheckUpdate = async () => {
        if (toastState !== 'hidden' && toastState !== 'update') return;

        setToastState('checking');
        setLoading(true);

        try {
            const res = await checkForUpdate(appVersion);
            setUpdateResult(res);

            if (res.hasUpdate) {
                setHasUpdate(true);
                setToastState('update');
                setAlertConfig({
                    visible: true,
                    type: 'confirm',
                    title: 'Update Available',
                    message: `Version ${res.latestVersion} is available. You're on ${appVersion}`,
                    confirmText: Platform.OS === 'android' ? 'Download & Install' : 'View Release',
                    cancelText: 'Later',
                    onConfirm: () => {
                        setAlertConfig((p: any) => ({ ...p, visible: false }));
                        handleInstallUpdate(res);
                    },
                    onCancel: () => {
                        setAlertConfig((p: any) => ({ ...p, visible: false }));
                        setToastState('hidden');
                    },
                });
            } else {
                setToastState('latest');
                setTimeout(() => setToastState('hidden'), 3000);
            }
        } catch {
            setToastState('latest');
            setTimeout(() => setToastState('hidden'), 3000);
        } finally {
            setLoading(false);
        }
    };

    const handleInstallUpdate = async (res: UpdateCheckResult) => {
        setToastState('hidden');

        if (Platform.OS === 'android') {
            const apkUrl = getApkDownloadUrl(res.release);
            if (apkUrl) {
                try {
                    await downloadAndInstallApk(apkUrl);
                } catch {
                    setAlertConfig({
                        visible: true,
                        type: 'error',
                        title: 'Install Failed',
                        message: 'Could not download or install. Please try from the release page.',
                        confirmText: 'Open Release',
                        onConfirm: () => {
                            setAlertConfig((p: any) => ({ ...p, visible: false }));
                            if (res.release?.html_url) Linking.openURL(res.release.html_url);
                        },
                    });
                }
            } else {
                if (res.release?.html_url) Linking.openURL(res.release.html_url);
            }
        } else {
            if (res.release?.html_url) Linking.openURL(res.release.html_url);
        }
    };

    const downloadAndInstallApk = async (url: string) => {
        const filename = `dart-update-${Date.now()}.apk`;
        const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
        const localPath = `${dir}${filename}`;

        const { uri } = await FileSystem.downloadAsync(url, localPath);
        const contentUri = await FileSystem.getContentUriAsync(uri);

        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
            data: contentUri,
            flags: 1,
            type: 'application/vnd.android.package-archive',
        });
    };

    const SocialButton = ({ icon, url, color }: { icon: any, url: string, color?: string }) => (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => Linking.openURL(url)}
            style={[styles.socialIconBtn, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
        >
            <HugeiconsIcon icon={icon} size={24} color={color || theme.colors.text} />
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]} edges={['top']}>
            <Header title="About" />
            <ModernAlert {...alertConfig} />

            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Logo */}
                <Image
                    source={isDark
                        ? require('../../assets/images/dart-logo-transparent-light.png')
                        : require('../../assets/images/dart-logo-transparent-dark.png')
                    }
                    style={styles.logo}
                    resizeMode="contain"
                />

                <View style={[styles.badge, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Text style={[styles.badgeText, { color: theme.colors.primary }]}>
                        Daily Accomplishment Report Tools
                    </Text>
                </View>

                <Text style={[styles.appDesc, { color: theme.colors.textSecondary }]}>
                    A streamlined, secure, and intuitive platform designed to help professionals track their hours and log daily accomplishments with ease.
                </Text>

                {/* Version Pill with Update Indicator */}
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={handleCheckUpdate}
                    disabled={loading}
                    style={[
                        styles.metaContainer,
                        { backgroundColor: theme.colors.card, borderColor: theme.colors.border },
                        hasUpdate && { borderColor: theme.colors.primary, backgroundColor: theme.colors.primary + '08' },
                    ]}
                >
                    {hasUpdate && (
                        <View style={[styles.updateDot, { backgroundColor: theme.colors.primary }]} />
                    )}
                    <View style={styles.metaBlock}>
                        <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>Version</Text>
                        <Text style={[styles.metaValue, { color: theme.colors.text }]}>{appVersion}</Text>
                    </View>

                    <View style={[styles.metaDivider, { backgroundColor: theme.colors.textSecondary }]} />

                    <View style={styles.metaBlock}>
                        <Text style={[styles.metaLabel, { color: theme.colors.textSecondary }]}>
                            {loading ? 'Checking...' : 'Tap to check'}
                        </Text>
                        <Text style={[styles.metaValue, { color: theme.colors.text }]}>
                            {updateResult?.latestVersion || 'â€”'}
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Connect With Us */}
                <View style={styles.linksSection}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>
                        CONNECT WITH US
                    </Text>

                    <View style={styles.socialRow}>
                        <SocialButton icon={GithubIcon} url="https://github.com/vncedb/dart" />
                        <SocialButton icon={Facebook02Icon} url="https://facebook.com/projectvdb" color="#1877F2" />
                        <SocialButton icon={InstagramIcon} url="https://www.instagram.com/projectvdb" color="#E4405F" />
                        <SocialButton icon={NewTwitterIcon} url="https://x.com/projectvdb" />
                    </View>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={[styles.footerDev, { color: theme.colors.text }]}>
                        Developed by Project Vdb
                    </Text>
                    <Text style={[styles.footerCopy, { color: theme.colors.textSecondary }]}>
                        Â© {new Date().getFullYear()} DART.
                    </Text>
                </View>

            </ScrollView>

            {/* Toast */}
            {toastState !== 'hidden' && (
                <Animated.View
                    entering={FadeInDown.duration(300)}
                    exiting={FadeOutDown.duration(300)}
                    style={[styles.toast, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}
                >
                    {toastState === 'checking' ? (
                        <ActivityIndicator size="small" color={theme.colors.primary} style={{ marginRight: 10 }} />
                    ) : (
                        <Image
                            source={isDark ? require('../../assets/images/icon-transparent-white.png') : require('../../assets/images/icon-transparent.png')}
                            style={styles.toastLogo}
                            resizeMode="contain"
                        />
                    )}
                    <Text style={[styles.toastText, { color: theme.colors.text }]}>
                        {toastState === 'checking'
                            ? 'Checking for updates...'
                            : toastState === 'update'
                                ? 'Update available!'
                                : 'This is the latest version.'}
                    </Text>
                </Animated.View>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: { padding: 24, alignItems: 'center', paddingBottom: 60 },
    logo: { width: 240, height: 135, marginBottom: 12, marginTop: 12 },
    badge: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginBottom: 24 },
    badgeText: { fontSize: 11, fontFamily: 'Nunito_700Bold', textTransform: 'uppercase', letterSpacing: 0.5 },
    appDesc: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', textAlign: 'center', marginBottom: 32, paddingHorizontal: 16, lineHeight: 24 },

    metaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 100,
        borderWidth: 1,
        marginBottom: 48,
        position: 'relative',
    },
    updateDot: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    metaBlock: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
    metaLabel: { fontSize: 12, fontFamily: 'Nunito_600SemiBold', letterSpacing: 0.2 },
    metaValue: { fontSize: 13, fontFamily: 'Nunito_800ExtraBold' },
    metaDivider: { width: 4, height: 4, borderRadius: 2, marginHorizontal: 16, opacity: 0.4 },

    linksSection: { width: '100%', alignItems: 'center', marginBottom: 48 },
    sectionTitle: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1, marginBottom: 20, textTransform: 'uppercase', opacity: 0.7 },
    socialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
    socialIconBtn: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },

    footer: { alignItems: 'center', marginBottom: 20 },
    footerDev: { fontSize: 14, fontFamily: 'Nunito_700Bold', marginBottom: 6 },
    footerCopy: { fontSize: 12, fontFamily: 'Nunito_600SemiBold', opacity: 0.6 },

    toast: {
        position: 'absolute',
        bottom: 50,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 100,
        borderWidth: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 5,
        zIndex: 100,
    },
    toastLogo: { width: 18, height: 18, marginRight: 8 },
    toastText: { fontSize: 13, fontFamily: 'Nunito_700Bold' },
});
