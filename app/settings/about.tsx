import {
    Facebook02Icon,
    GithubIcon,
    InstagramIcon,
    NewTwitterIcon
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useColorScheme } from 'nativewind';
import React, { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    Linking,
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
    getReleaseTagUrl,
    UpdateCheckResult,
} from '../../lib/updateCheck';

export default function AboutScreen() {
    const theme = useAppTheme();
    const { colorScheme } = useColorScheme();
    const isDark = colorScheme === 'dark';
    const installedVersion = Application.nativeApplicationVersion || Constants.expoConfig?.version || '1.0.0';
    const copyrightText = useMemo(
        () => `${String.fromCharCode(0x00A9)} ${new Date().getFullYear()} DART. All rights reserved.`,
        []
    );

    const [toastState, setToastState] = useState<'hidden' | 'checking' | 'latest' | 'update'>('hidden');
    const [loading, setLoading] = useState(false);
    const [alertConfig, setAlertConfig] = useState<any>({ visible: false });
    const [updateResult, setUpdateResult] = useState<UpdateCheckResult | null>(null);

    const handleCheckUpdate = async () => {
        if (loading) return;

        setToastState('checking');
        setLoading(true);

        try {
            const res = await checkForUpdate(installedVersion);
            setUpdateResult(res);

            if (res.error) {
                setToastState('hidden');
                setAlertConfig({
                    visible: true,
                    type: 'error',
                    title: 'Update Check Failed',
                    message: 'Could not read the latest release information right now. Please try again later.',
                    confirmText: 'Okay',
                    onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false })),
                });
                return;
            }

            if (res.hasUpdate) {
                const releaseUrl = getReleaseTagUrl(res.release, res.latestVersion);
                setToastState('update');
                setAlertConfig({
                    visible: true,
                    type: 'confirm',
                    title: 'Download Update',
                    message: `Version ${res.latestVersion} is available. Open the GitHub release page to download the latest build?`,
                    confirmText: 'Open Release',
                    cancelText: 'Later',
                    onConfirm: () => {
                        setAlertConfig((p: any) => ({ ...p, visible: false }));
                        setToastState('hidden');
                        if (releaseUrl) {
                            Linking.openURL(releaseUrl);
                        }
                    },
                    onCancel: () => {
                        setAlertConfig((p: any) => ({ ...p, visible: false }));
                        setToastState('hidden');
                    },
                });
            } else {
                setToastState('latest');
                setTimeout(() => setToastState('hidden'), 2200);
            }
        } catch {
            setToastState('hidden');
            setAlertConfig({
                visible: true,
                type: 'error',
                title: 'Update Check Failed',
                message: 'Could not read the latest release information right now. Please try again later.',
                confirmText: 'Okay',
                onConfirm: () => setAlertConfig((p: any) => ({ ...p, visible: false })),
            });
        } finally {
            setLoading(false);
        }
    };

    const versionHeadline = updateResult?.hasUpdate ? 'Update Available' : 'Version';
    const latestVersion = updateResult?.latestVersion || installedVersion;

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

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <Image
                    source={isDark
                        ? require('../../assets/images/dart-logo-transparent-light.png')
                        : require('../../assets/images/dart-logo-transparent-dark.png')
                    }
                    style={styles.logo}
                    resizeMode="contain"
                />

                <View style={[styles.badge, { backgroundColor: theme.colors.primary + '15' }]}>
                    <Text style={[styles.badgeText, { color: theme.colors.primary }]}>Daily Accomplishment Report Tools</Text>
                </View>

                <Text style={[styles.appDesc, { color: theme.colors.textSecondary }]}>
                    A streamlined, secure, and intuitive platform designed to help professionals track their hours and log daily accomplishments with ease.
                </Text>

                <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={handleCheckUpdate}
                    disabled={loading}
                    style={[styles.versionCard, { backgroundColor: theme.colors.card, borderColor: updateResult?.hasUpdate ? theme.colors.primary + '40' : theme.colors.border }]}
                >
                    <View style={[styles.versionGlow, { backgroundColor: theme.colors.primary + '08' }]} />
                    <Text style={[styles.versionLabel, { color: updateResult?.hasUpdate ? theme.colors.primary : theme.colors.textSecondary }]}>
                        {loading ? 'Checking Release...' : versionHeadline}
                    </Text>

                    {updateResult?.hasUpdate ? (
                        <View style={styles.versionCompareRow}>
                            <Text style={[styles.versionCurrent, { color: theme.colors.textSecondary }]}>{installedVersion}</Text>
                            <Text style={[styles.versionArrow, { color: theme.colors.textSecondary }]}>{'->'}</Text>
                            <Text style={[styles.versionNext, { color: theme.colors.text }]}>{latestVersion}</Text>
                        </View>
                    ) : (
                        <Text style={[styles.versionValue, { color: theme.colors.text }]}>{installedVersion}</Text>
                    )}
                </TouchableOpacity>

                <View style={styles.linksSection}>
                    <Text style={[styles.sectionTitle, { color: theme.colors.textSecondary }]}>CONNECT WITH US</Text>

                    <View style={styles.socialRow}>
                        <SocialButton icon={GithubIcon} url="https://github.com/vncedb/dart" />
                        <SocialButton icon={Facebook02Icon} url="https://facebook.com/projectvdb" color="#1877F2" />
                        <SocialButton icon={InstagramIcon} url="https://www.instagram.com/projectvdb" color="#E4405F" />
                        <SocialButton icon={NewTwitterIcon} url="https://x.com/projectvdb" />
                    </View>
                </View>

                <View style={[styles.footerCard, { backgroundColor: theme.colors.card, borderColor: theme.colors.border }]}>
                    <Text style={[styles.footerDev, { color: theme.colors.text }]}>Developed by Project Vdb</Text>
                    <Text style={[styles.footerCopy, { color: theme.colors.textSecondary }]}>{copyrightText}</Text>
                </View>
            </ScrollView>

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
                            ? 'Checking latest release...'
                            : toastState === 'update'
                                ? 'Update available.'
                                : 'You are on the latest version.'}
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
    appDesc: { fontSize: 15, fontFamily: 'Nunito_600SemiBold', textAlign: 'center', marginBottom: 28, paddingHorizontal: 16, lineHeight: 24 },

    versionCard: {
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 22,
        paddingVertical: 22,
        borderRadius: 28,
        borderWidth: 1,
        marginBottom: 44,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.05,
        shadowRadius: 20,
        elevation: 3,
    },
    versionGlow: {
        position: 'absolute',
        top: -40,
        width: 200,
        height: 120,
        borderRadius: 999,
        opacity: 0.9,
    },
    versionLabel: {
        fontSize: 12,
        fontFamily: 'Nunito_700Bold',
        marginBottom: 8,
        textTransform: 'uppercase',
        letterSpacing: 1,
        textAlign: 'center',
    },
    versionValue: {
        fontSize: 22,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: -0.4,
        textAlign: 'center',
    },
    versionCompareRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
    },
    versionCurrent: {
        fontSize: 18,
        fontFamily: 'Nunito_700Bold',
    },
    versionArrow: {
        fontSize: 16,
        fontFamily: 'Nunito_700Bold',
        marginHorizontal: 10,
    },
    versionNext: {
        fontSize: 22,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: -0.3,
    },

    linksSection: { width: '100%', alignItems: 'center', marginBottom: 36 },
    sectionTitle: { fontSize: 11, fontFamily: 'Nunito_800ExtraBold', letterSpacing: 1, marginBottom: 20, textTransform: 'uppercase', opacity: 0.7 },
    socialRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
    socialIconBtn: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },

    footerCard: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 22,
        borderWidth: 1,
        paddingHorizontal: 18,
        paddingVertical: 18,
        alignItems: 'center',
    },
    footerDev: { fontSize: 14, fontFamily: 'Nunito_700Bold', marginBottom: 8 },
    footerCopy: { fontSize: 12, fontFamily: 'Nunito_600SemiBold', opacity: 0.72, textAlign: 'center', lineHeight: 18 },

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




