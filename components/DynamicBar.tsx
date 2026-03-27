import {
    AlertCircleIcon,
    CheckmarkCircle02Icon,
    Coffee02Icon,
    Login03Icon,
    Logout03Icon,
    Moon02Icon,
    SparklesIcon,
    Sun03Icon,
} from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react-native';
import * as Haptics from 'expo-haptics';
import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
    FadeIn,
    FadeOut,
    LinearTransition,
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withTiming,
    ZoomIn,
    ZoomOut,
} from 'react-native-reanimated';

import { GREETINGS } from '../constants/Greetings';
import { useAppTheme } from '../constants/theme';

type AlertType = 'success' | 'error' | 'check-in' | 'check-out';

interface DynamicBarProps {
    nameToDisplay: string;
    alertVisible?: boolean;
    alertMessage?: string;
    alertType?: AlertType;
    onHideAlert?: () => void;
    customGreeting?: string | null;
    shiftStartTime?: string | null;
}

const getShiftCycleKey = (date: Date, shiftStartTime?: string | null) => {
    const cycleDate = new Date(date);

    if (shiftStartTime) {
        const [hourString, minuteString] = shiftStartTime.split(':');
        const shiftHour = Number(hourString);
        const shiftMinute = Number(minuteString);

        if (!Number.isNaN(shiftHour) && !Number.isNaN(shiftMinute)) {
            const boundary = new Date(date);
            boundary.setHours(shiftHour, shiftMinute, 0, 0);

            if (date.getTime() < boundary.getTime()) {
                cycleDate.setDate(cycleDate.getDate() - 1);
            }
        }
    }

    return [
        cycleDate.getFullYear(),
        String(cycleDate.getMonth() + 1).padStart(2, '0'),
        String(cycleDate.getDate()).padStart(2, '0'),
    ].join('-');
};

const hashString = (value: string) => {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }

    return Math.abs(hash);
};

const withAlpha = (color: string, alpha: number) => {
    if (color.startsWith('#')) {
        const normalized = color.replace('#', '');
        const hex = normalized.length === 3
            ? normalized.split('').map((char) => char + char).join('')
            : normalized;

        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const rgbaMatch = color.match(/rgba?\(([^)]+)\)/i);
    if (!rgbaMatch) return color;

    const values = rgbaMatch[1].split(',').map((value) => value.trim());
    const [r = '0', g = '0', b = '0'] = values;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export default function DynamicBar({
    nameToDisplay,
    alertVisible = false,
    alertMessage = '',
    alertType = 'success',
    onHideAlert,
    customGreeting = null,
    shiftStartTime = null,
}: DynamicBarProps) {
    const theme = useAppTheme();

    const [mode, setMode] = useState<'greeting' | 'quote'>('greeting');
    const [now, setNow] = useState(() => new Date());
    const pressScale = useSharedValue(1);
    const glowProgress = useSharedValue(0);

    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 60000);
        return () => clearInterval(timer);
    }, []);

    useEffect(() => {
        if (alertVisible && onHideAlert) {
            setMode('greeting');
            const timer = setTimeout(onHideAlert, 4000);
            return () => clearTimeout(timer);
        }
    }, [alertVisible, onHideAlert]);

    const timeContent = useMemo(() => {
        if (customGreeting) {
            return { icon: Coffee02Icon, text: customGreeting };
        }

        const hour = now.getHours();
        if (hour < 5) return { icon: Moon02Icon, text: 'Good Early Morning' };
        if (hour < 12) return { icon: Sun03Icon, text: 'Good Morning' };
        if (hour < 18) return { icon: Sun03Icon, text: 'Good Afternoon' };
        return { icon: Moon02Icon, text: 'Good Evening' };
    }, [customGreeting, now]);

    const currentQuote = useMemo(() => {
        const cycleKey = getShiftCycleKey(now, shiftStartTime);
        const quoteIndex = hashString(`${cycleKey}-${nameToDisplay}`) % GREETINGS.length;
        return GREETINGS[quoteIndex];
    }, [nameToDisplay, now, shiftStartTime]);

    const getDisplayData = () => {
        if (alertVisible) {
            let icon;
            let color;
            let bg;
            let title;
            const isOvertimeCheckIn = alertType === 'check-in' && alertMessage.toLowerCase().includes('overtime');

            switch (alertType) {
                case 'error':
                    icon = AlertCircleIcon;
                    color = theme.colors.danger;
                    bg = theme.colors.dangerLight;
                    title = 'Error';
                    break;
                case 'check-in':
                    icon = Login03Icon;
                    color = isOvertimeCheckIn ? '#f59e0b' : theme.colors.success;
                    bg = isOvertimeCheckIn ? theme.colors.warningLight : theme.colors.successLight;
                    title = isOvertimeCheckIn ? 'Overtime Started' : 'Time In Success';
                    break;
                case 'check-out':
                    icon = Logout03Icon;
                    color = theme.colors.warning;
                    bg = theme.colors.warningLight;
                    title = 'Time Out Success';
                    break;
                case 'success':
                default:
                    icon = CheckmarkCircle02Icon;
                    color = theme.colors.success;
                    bg = theme.colors.successLight;
                    title = 'Success';
                    break;
            }

            return { key: 'alert', icon, color, bg, title, subtitle: alertMessage, borderColor: color };
        }

        if (mode === 'quote') {
            return {
                key: 'quote',
                icon: currentQuote.icon || SparklesIcon,
                color: theme.colors.primary,
                bg: theme.colors.primaryLight,
                title: '',
                subtitle: currentQuote.text.trim(),
                borderColor: theme.colors.border,
            };
        }

        return {
            key: 'greeting',
            icon: timeContent.icon,
            color: theme.colors.primary,
            bg: theme.colors.primaryLight,
            title: timeContent.text,
            subtitle: nameToDisplay,
            borderColor: theme.colors.border,
        };
    };

    const data = getDisplayData();
    const contentKey = `${data.key}-${data.key === 'quote' ? currentQuote.text : data.subtitle}`;

    const barAnimatedStyle = useAnimatedStyle(() => ({
        transform: [{ scale: pressScale.value }],
    }));

    const glowAnimatedStyle = useAnimatedStyle(() => ({
        opacity: glowProgress.value,
        transform: [
            { scaleX: 0.94 + (glowProgress.value * 0.08) },
            { scaleY: 0.88 + (glowProgress.value * 0.14) },
        ],
    }));

    const handlePressIn = () => {
        pressScale.value = withTiming(0.988, { duration: 120 });
        glowProgress.value = withTiming(0.45, { duration: 140 });
    };

    const handlePressOut = () => {
        pressScale.value = withTiming(1, { duration: 160 });
    };

    const handlePress = () => {
        Haptics.selectionAsync();
        glowProgress.value = withSequence(
            withTiming(0.82, { duration: 110 }),
            withTiming(0, { duration: 280 }),
        );

        if (alertVisible && onHideAlert) {
            onHideAlert();
            return;
        }

        setMode((previousMode) => previousMode === 'greeting' ? 'quote' : 'greeting');
    };

    return (
        <Animated.View style={styles.container} layout={LinearTransition.duration(300)}>
            <Animated.View
                style={[
                    styles.bar,
                    barAnimatedStyle,
                    {
                        backgroundColor: theme.colors.card,
                        borderColor: data.borderColor,
                        shadowColor: theme.dark ? '#000' : data.borderColor,
                    },
                ]}
            >
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.pressGlow,
                        glowAnimatedStyle,
                        {
                            backgroundColor: withAlpha(data.color, theme.dark ? 0.2 : 0.12),
                        },
                    ]}
                />
                <TouchableOpacity
                    activeOpacity={1}
                    onPress={handlePress}
                    onPressIn={handlePressIn}
                    onPressOut={handlePressOut}
                    style={styles.touchArea}
                >
                    <Animated.View
                        style={[
                            styles.iconWrapper,
                            {
                                backgroundColor: data.bg,
                                borderColor: theme.dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.75)',
                            },
                        ]}
                        layout={LinearTransition.duration(300)}
                    >
                        <Animated.View key={contentKey} entering={ZoomIn.duration(300)} exiting={ZoomOut.duration(300)}>
                            <HugeiconsIcon icon={data.icon as any} size={20} color={data.color} />
                        </Animated.View>
                    </Animated.View>

                    <View style={styles.textWrapper}>
                        <Animated.View
                            key={contentKey}
                            entering={FadeIn.duration(400).delay(100)}
                            exiting={FadeOut.duration(300)}
                            style={styles.textContainer}
                        >
                            {data.key === 'quote' ? (
                                <View style={styles.quoteWrapper}>
                                    <Text style={[styles.quoteText, { color: theme.colors.text }]} numberOfLines={2}>
                                        <Text style={[styles.quoteMark, { color: theme.colors.primary }]}>{'"'}</Text>
                                        {data.subtitle}
                                        <Text style={[styles.quoteMark, { color: theme.colors.primary }]}>{'" '}</Text>
                                    </Text>
                                </View>
                            ) : (
                                <View style={styles.contentWrapper}>
                                    <Text style={[styles.label, { color: alertVisible ? data.color : theme.colors.textSecondary, textAlign: 'left' }]}>
                                        {data.title}
                                    </Text>
                                    <Text style={[styles.mainText, { color: theme.colors.text, textAlign: 'left' }]} numberOfLines={1}>
                                        {data.subtitle}
                                    </Text>
                                </View>
                            )}
                        </Animated.View>
                    </View>
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    container: { width: '100%', alignItems: 'center', marginBottom: 32, paddingHorizontal: 24 },
    bar: {
        borderRadius: 30,
        width: '100%',
        maxWidth: 380,
        height: 64,
        borderWidth: 1,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 5,
        overflow: 'hidden',
    },
    touchArea: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
        paddingRight: 16,
        flex: 1,
    },
    pressGlow: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 30,
    },
    iconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        borderWidth: 1,
    },
    textWrapper: { flex: 1, justifyContent: 'center' },
    textContainer: { justifyContent: 'center', width: '100%' },
    contentWrapper: { alignItems: 'flex-start', justifyContent: 'center' },
    quoteWrapper: { justifyContent: 'center', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 10, width: '100%' },
    label: {
        fontSize: 10,
        fontFamily: 'Nunito_700Bold',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 2,
    },
    mainText: { fontSize: 16, fontFamily: 'Nunito_700Bold', letterSpacing: -0.2 },
    quoteText: {
        fontSize: 13,
        fontFamily: 'Nunito_700Bold',
        lineHeight: 19,
        fontStyle: 'italic',
        textAlign: 'center',
        paddingRight: 10,
    },
    quoteMark: {
        fontSize: 14,
        lineHeight: 19,
        fontFamily: 'Nunito_800ExtraBold',
    },
});
