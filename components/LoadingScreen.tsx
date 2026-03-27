import {
    File02Icon,
    Layers01Icon,
    UserCircleIcon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import LottieView from 'lottie-react-native';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAppTheme } from '../constants/theme';

interface LoadingScreenProps {
    message?: string;
    variant?: 'profile' | 'reports' | 'jobs' | 'edit-profile' | 'job-form' | 'generic';
}

const getVariantMeta = (variant: LoadingScreenProps['variant'], theme: ReturnType<typeof useAppTheme>) => {
    switch (variant) {
        case 'profile':
            return {
                title: 'Loading Profile',
                subtitle: 'Preparing your account details and current workspace.',
                icon: UserCircleIcon,
                accent: theme.colors.primary,
            };
        case 'reports':
            return {
                title: 'Loading Reports',
                subtitle: 'Gathering your logs, saved files, and report history.',
                icon: File02Icon,
                accent: theme.colors.primary,
            };
        case 'jobs':
            return {
                title: 'Loading Jobs',
                subtitle: 'Preparing your job setup and schedule information.',
                icon: Layers01Icon,
                accent: theme.colors.success,
            };
        case 'edit-profile':
            return {
                title: 'Loading Profile Editor',
                subtitle: 'Preparing your editable profile details.',
                icon: UserCircleIcon,
                accent: theme.colors.primary,
            };
        case 'job-form':
            return {
                title: 'Loading Job Form',
                subtitle: 'Preparing your job configuration workspace.',
                icon: Layers01Icon,
                accent: theme.colors.success,
            };
        case 'generic':
        default:
            return {
                title: 'Loading',
                subtitle: 'Please wait while we prepare this screen.',
                icon: File02Icon,
                accent: theme.colors.primary,
            };
    }
};

export default function LoadingScreen({ message = 'Loading...', variant = 'generic' }: LoadingScreenProps) {
    const theme = useAppTheme();
    const meta = getVariantMeta(variant, theme);
    const animationSource = theme.dark
        ? require('../assets/loading/loading-darkmode.json')
        : require('../assets/loading/loading-lightmode.json');

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={[styles.backdropOrb, { backgroundColor: meta.accent + '10' }]} />

            <View
                style={[
                    styles.card,
                    {
                        backgroundColor: theme.colors.card,
                        borderColor: theme.colors.border,
                        shadowColor: meta.accent,
                    },
                ]}
            >
                <View style={[styles.iconWrap, { backgroundColor: meta.accent + '12', borderColor: meta.accent + '22' }]}>
                    <LottieView
                        source={animationSource}
                        autoPlay
                        loop
                        style={styles.lottie}
                        resizeMode="contain"
                    />
                </View>

                <Text style={[styles.title, { color: theme.colors.text }]}>{meta.title}</Text>
                <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>{meta.subtitle}</Text>

                <View style={[styles.messagePill, { backgroundColor: theme.colors.background, borderColor: theme.colors.border }]}>
                    <HugeiconsIcon icon={meta.icon} size={16} color={meta.accent} />
                    <Text style={[styles.messageText, { color: theme.colors.text }]}>{message}</Text>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        overflow: 'hidden',
    },
    backdropOrb: {
        position: 'absolute',
        width: 260,
        height: 260,
        borderRadius: 130,
        top: '18%',
    },
    card: {
        width: '100%',
        maxWidth: 360,
        borderWidth: 1,
        borderRadius: 28,
        paddingHorizontal: 24,
        paddingVertical: 28,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.08,
        shadowRadius: 28,
        elevation: 3,
    },
    iconWrap: {
        width: 84,
        height: 84,
        borderRadius: 20,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14,
        overflow: 'hidden',
    },
    lottie: {
        width: '100%',
        height: '100%',
    },
    title: {
        fontSize: 22,
        fontFamily: 'Nunito_800ExtraBold',
        letterSpacing: -0.4,
        textAlign: 'center',
    },
    subtitle: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 22,
        fontFamily: 'Nunito_600SemiBold',
        textAlign: 'center',
        maxWidth: 280,
    },
    messagePill: {
        marginTop: 22,
        minHeight: 48,
        borderRadius: 999,
        borderWidth: 1,
        paddingHorizontal: 16,
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    messageText: {
        fontSize: 13,
        fontFamily: 'Nunito_700Bold',
        letterSpacing: 0.1,
        textAlign: 'center',
    },
});
